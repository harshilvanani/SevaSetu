import { Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';

import type { EnvConfig } from './config';

/** VPC across two availability zones. The database sits in isolated subnets with no internet route. */
export class NetworkStack extends Stack {
  readonly vpc: ec2.Vpc;
  private readonly zones: string[];

  /** Fixed zones, so `cdk synth` never has to ask AWS (no credentials needed). */
  get availabilityZones(): string[] {
    return this.zones;
  }

  constructor(scope: Construct, id: string, cfg: EnvConfig, props?: StackProps) {
    super(scope, id, props);
    this.zones = [`${cfg.region}a`, `${cfg.region}b`];
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: cfg.natGateways,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'app', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 22 },
        { name: 'data', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
    this.vpc.addFlowLog('FlowLogs');
    // Security groups live in the stacks that use them (Data, Api) to avoid cross-stack cycles.
  }
}
