#!/usr/bin/env node
// SevaSetu on AWS (docs/architecture/aws-target.md). Synth only until the move is approved:
//   cd infra && npm install && npm run synth            # dev (pass -c account=<id> for a real account)
//   npx cdk synth --all -c env=prod -c alertEmail=you@example.org
import { App, Tags } from 'aws-cdk-lib';

import { ApiStack } from '../lib/api-stack';
import { AuthStack } from '../lib/auth-stack';
import { CONFIGS, type EnvName } from '../lib/config';
import { DataStack } from '../lib/data-stack';
import { EdgeSecurityStack } from '../lib/edge-security-stack';
import { NetworkStack } from '../lib/network-stack';
import { OpsStack } from '../lib/ops-stack';
import { WebStack } from '../lib/web-stack';

const app = new App();
const envName = (app.node.tryGetContext('env') ?? 'dev') as EnvName;
const cfg = CONFIGS[envName];
if (!cfg) throw new Error(`Unknown env "${envName}". Use dev, staging or prod.`);
const account = app.node.tryGetContext('account') ?? process.env.CDK_DEFAULT_ACCOUNT;
const env = { account, region: cfg.region };
const p = `SevaSetu-${cfg.name}`;

const net = new NetworkStack(app, `${p}-Network`, cfg, { env });
const data = new DataStack(app, `${p}-Data`, cfg, net, { env });
const auth = new AuthStack(app, `${p}-Auth`, cfg, { env });
const api = new ApiStack(app, `${p}-Api`, cfg, { vpc: net.vpc, cluster: data.cluster, proxy: data.proxy, userPool: auth.userPool, appClient: auth.appClient }, { env });
const edge = new EdgeSecurityStack(app, `${p}-EdgeSecurity`, cfg, { env: { account, region: 'us-east-1' }, crossRegionReferences: true });
new WebStack(app, `${p}-Web`, cfg, { apiDomain: `${api.api.apiId}.execute-api.${cfg.region}.amazonaws.com`, webAclArn: edge.webAclArn }, { env, crossRegionReferences: true });
new OpsStack(app, `${p}-Ops`, cfg, { jobs: api.functions.Jobs, webhook: api.functions.StripeWebhook, alertEmail: app.node.tryGetContext('alertEmail') }, { env });

// RDS proxy target groups do not take tags
const tagOpts = { excludeResourceTypes: ['AWS::RDS::DBProxyTargetGroup'] };
Tags.of(app).add('project', 'sevasetu', tagOpts);
Tags.of(app).add('environment', cfg.name, tagOpts);
