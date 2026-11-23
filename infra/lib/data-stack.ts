import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

import type { EnvConfig } from './config';

/**
 * Aurora PostgreSQL Serverless v2 (ADR-001): the same SQL migrations and pgTAP tests run here.
 * RDS Proxy pools connections when Fargate tasks and Lambda functions scale out.
 */
export class DataStack extends Stack {
  readonly cluster: rds.DatabaseCluster;
  readonly proxy: rds.DatabaseProxy;
  readonly filesBucket: s3.Bucket;
  readonly key: kms.Key;

  constructor(scope: Construct, id: string, cfg: EnvConfig, net: { vpc: ec2.IVpc }, props?: StackProps) {
    super(scope, id, props);
    const prod = cfg.name === 'prod';
    // Aurora and RDS Proxy: isolated subnets (no internet route); PostgreSQL reachable only from inside the VPC
    const dbSg = new ec2.SecurityGroup(this, 'DbSg', { vpc: net.vpc, description: 'SevaSetu database', allowAllOutbound: false });
    dbSg.addIngressRule(ec2.Peer.ipv4(net.vpc.vpcCidrBlock), ec2.Port.tcp(5432), 'PostgreSQL from the VPC only');
    this.key = new kms.Key(this, 'DataKey', { enableKeyRotation: true, description: `SevaSetu ${cfg.name} data key` });

    this.cluster = new rds.DatabaseCluster(this, 'Db', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_16_4 }),
      vpc: net.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      defaultDatabaseName: 'sevasetu',
      credentials: rds.Credentials.fromGeneratedSecret('sevasetu_admin'),
      serverlessV2MinCapacity: cfg.dbMinAcu,
      serverlessV2MaxCapacity: cfg.dbMaxAcu,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      readers: cfg.dbReader ? [rds.ClusterInstance.serverlessV2('reader', { scaleWithWriter: true })] : [],
      storageEncrypted: true,
      storageEncryptionKey: this.key,
      backup: { retention: Duration.days(cfg.backupDays) },
      cloudwatchLogsExports: ['postgresql'],
      deletionProtection: prod,
      removalPolicy: prod ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
      parameters: {
        // slow-query log for the "searches under 2 seconds" target
        log_min_duration_statement: '1000',
        // pg_cron is available on Aurora; jobs move to EventBridge (ADR-003) but this keeps the option open
        'shared_preload_libraries': 'pg_stat_statements,pg_cron',
      },
    });

    this.proxy = this.cluster.addProxy('Proxy', {
      secrets: [this.cluster.secret!],
      vpc: net.vpc,
      securityGroups: [dbSg],
      requireTLS: true,
    });

    // Photos, certificates and exports (Phase 2). Private; served through signed links.
    this.filesBucket = new s3.Bucket(this, 'Files', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.key,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: prod,
      lifecycleRules: [{ prefix: 'exports/', expiration: Duration.days(7) }],
      removalPolicy: prod ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !prod,
    });
  }
}
