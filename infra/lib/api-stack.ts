import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpAlbIntegration, HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

import type { EnvConfig } from './config';

type Deps = {
  vpc: ec2.IVpc;
  cluster: rds.DatabaseCluster;
  proxy: rds.DatabaseProxy;
  userPool: cognito.IUserPool;
  appClient: cognito.IUserPoolClient;
};

/**
 * One API entry point (API Gateway HTTP API):
 *   /rest/*        → PostgREST on Fargate: the same REST + RPC API the app uses today (ADR-002, ADR-003)
 *   /functions/*   → Lambda: Stripe connect / checkout / webhook (replaces Supabase Edge Functions)
 */
export class ApiStack extends Stack {
  readonly api: apigw.HttpApi;
  readonly functions: Record<string, lambda.Function> = {};

  constructor(scope: Construct, id: string, cfg: EnvConfig, deps: Deps, props?: StackProps) {
    super(scope, id, props);

    // Secrets kept outside the code: Stripe keys and the Cognito JWKS that PostgREST verifies tokens with.
    const stripe = new secrets.Secret(this, 'StripeKeys', {
      secretName: `sevasetu/${cfg.name}/stripe`,
      description: 'STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (set by hand, never in git)',
    });
    const jwks = new secrets.Secret(this, 'CognitoJwks', {
      secretName: `sevasetu/${cfg.name}/cognito-jwks`,
      description: 'JSON Web Key Set of the Cognito user pool, copied from its jwks.json at deploy time',
    });

    // Security group for Fargate tasks and Lambda functions
    const appSg = new ec2.SecurityGroup(this, 'AppSg', { vpc: deps.vpc, description: 'SevaSetu API and functions' });

    // ---------------- PostgREST on Fargate (internal load balancer, private subnets)
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc: deps.vpc, containerInsightsV2: ecs.ContainerInsights.ENABLED });
    const svc = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'PostgREST', {
      cluster,
      publicLoadBalancer: false,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [appSg],
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: cfg.apiTasksMin,
      minHealthyPercent: cfg.apiTasksMin > 1 ? 50 : 100,
      circuitBreaker: { rollback: true },
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('postgrest/postgrest:v12.2.3'),
        containerPort: 3000,
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'postgrest', logRetention: logs.RetentionDays.ONE_MONTH }),
        environment: {
          // libpq reads PGHOST / PGUSER / PGPASSWORD; the URI stays generic
          PGRST_DB_URI: 'postgresql://',
          PGHOST: deps.proxy.endpoint,
          PGDATABASE: 'sevasetu',
          PGSSLMODE: 'require',
          PGRST_DB_SCHEMAS: 'public',
          PGRST_DB_ANON_ROLE: 'anon',
          // Cognito tokens get "role":"authenticated" from a pre-token-generation Lambda (phase 3)
          PGRST_JWT_ROLE_CLAIM_KEY: '.role',
          PGRST_DB_POOL: '20',
          PGRST_OPENAPI_MODE: 'disabled',
        },
        secrets: {
          PGUSER: ecs.Secret.fromSecretsManager(deps.cluster.secret!, 'username'),
          PGPASSWORD: ecs.Secret.fromSecretsManager(deps.cluster.secret!, 'password'),
          PGRST_JWT_SECRET: ecs.Secret.fromSecretsManager(jwks),
        },
      },
    });
    svc.targetGroup.configureHealthCheck({ path: '/', healthyHttpCodes: '200-404' });
    const scaling = svc.service.autoScaleTaskCount({ minCapacity: cfg.apiTasksMin, maxCapacity: cfg.apiTasksMax });
    scaling.scaleOnCpuUtilization('Cpu', { targetUtilizationPercent: 60 });
    scaling.scaleOnRequestCount('Requests', { requestsPerTarget: 500, targetGroup: svc.targetGroup });

    // ---------------- Lambda functions (code moves from supabase/functions/* in phase 4)
    const fn = (name: string, description: string) => {
      const f = new lambda.Function(this, name, {
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        // Placeholder until the Edge Function code is ported (Deno → Node). Returns 501.
        code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 501, body: "not deployed yet" });'),
        description,
        timeout: Duration.seconds(15),
        memorySize: 256,
        vpc: deps.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [appSg],
        environment: { STRIPE_SECRET_ARN: stripe.secretArn, DB_SECRET_ARN: deps.cluster.secret!.secretArn, PGHOST: deps.proxy.endpoint },
        logGroup: new logs.LogGroup(this, `${name}Logs`, { retention: logs.RetentionDays.ONE_MONTH }),
        tracing: lambda.Tracing.ACTIVE,
      });
      stripe.grantRead(f);
      deps.cluster.secret!.grantRead(f);
      this.functions[name] = f;
      return f;
    };
    const connect = fn('StripeConnect', 'Owner-only Stripe Connect onboarding link');
    const checkout = fn('DonateCheckout', 'Creates a pending donation and a Stripe Checkout session');
    const webhook = fn('StripeWebhook', 'Verifies and applies Stripe webhook events');
    fn('SendPush', 'Sends Expo push notifications');
    fn('Jobs', 'Scheduled jobs: reminders, invitation expiry, dashboard summaries, purges');

    // ---------------- API Gateway
    const authorizer = new HttpJwtAuthorizer('Cognito', `https://cognito-idp.${cfg.region}.amazonaws.com/${deps.userPool.userPoolId}`, {
      jwtAudience: [deps.appClient.userPoolClientId],
    });
    this.api = new apigw.HttpApi(this, 'Api', {
      apiName: `sevasetu-${cfg.name}`,
      corsPreflight: {
        allowOrigins: cfg.domain ? [`https://${cfg.domain}`] : ['http://localhost:8081'],
        allowMethods: [apigw.CorsHttpMethod.ANY],
        allowHeaders: ['authorization', 'content-type', 'prefer', 'range', 'apikey'],
      },
    });
    const rest = new HttpAlbIntegration('Rest', svc.listener);
    // Visitors read public seva without a token, so the REST route itself is open;
    // row-level security in the database decides what each caller sees (ADR-002).
    this.api.addRoutes({ path: '/rest/{proxy+}', methods: [apigw.HttpMethod.ANY], integration: rest });
    this.api.addRoutes({ path: '/functions/stripe-connect', methods: [apigw.HttpMethod.POST], integration: new HttpLambdaIntegration('Connect', connect), authorizer });
    this.api.addRoutes({ path: '/functions/donate-checkout', methods: [apigw.HttpMethod.POST], integration: new HttpLambdaIntegration('Checkout', checkout) });
    this.api.addRoutes({ path: '/functions/stripe-webhook', methods: [apigw.HttpMethod.POST], integration: new HttpLambdaIntegration('Webhook', webhook) });

    new CfnOutput(this, 'ApiUrl', { value: this.api.apiEndpoint });
  }
}
