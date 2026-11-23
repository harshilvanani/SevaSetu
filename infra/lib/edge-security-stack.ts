import { Stack, type StackProps } from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';

import type { EnvConfig } from './config';

/**
 * AWS WAF for CloudFront. CloudFront web ACLs must live in us-east-1; they only filter traffic
 * and hold no volunteer data (ADR-004).
 * Closes security review item 11: rate-limits the public donate endpoint and the API.
 */
export class EdgeSecurityStack extends Stack {
  readonly webAclArn: string;

  constructor(scope: Construct, id: string, cfg: EnvConfig, props?: StackProps) {
    super(scope, id, props);
    const managed = (name: string, priority: number): wafv2.CfnWebACL.RuleProperty => ({
      name,
      priority,
      overrideAction: { none: {} },
      statement: { managedRuleGroupStatement: { vendorName: 'AWS', name } },
      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: name, sampledRequestsEnabled: true },
    });
    const acl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: `sevasetu-${cfg.name}`,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: `sevasetu-${cfg.name}`, sampledRequestsEnabled: true },
      rules: [
        managed('AWSManagedRulesCommonRuleSet', 1),
        managed('AWSManagedRulesKnownBadInputsRuleSet', 2),
        managed('AWSManagedRulesAmazonIpReputationList', 3),
        {
          // 30 donation checkouts per 5 minutes per IP address
          name: 'DonateRateLimit',
          priority: 10,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 30,
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: { uriPath: {} },
                  positionalConstraint: 'CONTAINS',
                  searchString: '/functions/donate-checkout',
                  textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
                },
              },
            },
          },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'DonateRateLimit', sampledRequestsEnabled: true },
        },
        {
          // 2,000 API requests per 5 minutes per IP address
          name: 'ApiRateLimit',
          priority: 11,
          action: { block: {} },
          statement: { rateBasedStatement: { limit: 2000, aggregateKeyType: 'IP' } },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'ApiRateLimit', sampledRequestsEnabled: true },
        },
      ],
    });
    this.webAclArn = acl.attrArn;
  }
}
