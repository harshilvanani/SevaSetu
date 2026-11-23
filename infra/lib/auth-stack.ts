import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

import type { EnvConfig } from './config';

/**
 * Cognito replaces Supabase Auth (ADR-003, phase 3).
 * Users keep their ids: the import sets the Cognito "sub" to the existing Supabase user id,
 * and SQL reads it with public.current_user_id().
 */
export class AuthStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly appClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, cfg: EnvConfig, props?: StackProps) {
    super(scope, id, props);
    const prod = cfg.name === 'prod';

    this.userPool = new cognito.UserPool(this, 'Users', {
      userPoolName: `sevasetu-${cfg.name}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { fullname: { required: false, mutable: true } },
      // Security review item 10: stronger passwords; MFA available (required for admins by policy)
      passwordPolicy: { minLength: 10, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: false },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      deletionProtection: prod,
      removalPolicy: prod ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    new cognito.CfnUserPoolGroup(this, 'Admins', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'platform-admins',
      description: 'SevaSetu platform admins (MFA required by policy)',
    });

    // Google and Apple sign-in are added once their client secrets are in Secrets Manager:
    //   new cognito.UserPoolIdentityProviderGoogle(this, 'Google', { userPool, clientId, clientSecretValue, scopes: ['email','profile'] })
    //   new cognito.UserPoolIdentityProviderApple(this, 'Apple', { userPool, clientId, teamId, keyId, privateKeyValue })
    this.appClient = this.userPool.addClient('App', {
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: cfg.domain ? [`https://${cfg.domain}/auth/callback`, 'sevasetu://auth/callback'] : ['http://localhost:8081/auth/callback', 'sevasetu://auth/callback'],
      },
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'AppClientId', { value: this.appClient.userPoolClientId });
  }
}
