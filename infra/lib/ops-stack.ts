import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as targets from 'aws-cdk-lib/aws-scheduler-targets';
import type { Construct } from 'constructs';

import type { EnvConfig } from './config';

/**
 * Scheduled jobs (replace pg_cron + pg_net, ADR-003), alarms and a monthly budget alert.
 */
export class OpsStack extends Stack {
  constructor(scope: Construct, id: string, cfg: EnvConfig, deps: { jobs: lambda.IFunction; webhook: lambda.IFunction; alertEmail?: string }, props?: StackProps) {
    super(scope, id, props);

    const job = (name: string, expr: scheduler.ScheduleExpression, task: string) =>
      new scheduler.Schedule(this, name, {
        schedule: expr,
        description: task,
        target: new targets.LambdaInvoke(deps.jobs, { input: scheduler.ScheduleTargetInput.fromObject({ task }) }),
      });
    job('Reminders', scheduler.ScheduleExpression.cron({ minute: '7' }), 'send_seva_reminders');
    job('ExpireInvitations', scheduler.ScheduleExpression.cron({ minute: '17', hour: '3' }), 'expire_invitations');
    job('DashboardSummaries', scheduler.ScheduleExpression.rate(Duration.minutes(15)), 'refresh_org_insights');
    job('Purges', scheduler.ScheduleExpression.cron({ minute: '41', hour: '4' }), 'purge_expired_private_data');

    // Alarm when payment webhooks fail: a failed webhook means a donation stays "pending".
    new cloudwatch.Alarm(this, 'WebhookErrors', {
      metric: deps.webhook.metricErrors({ period: Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'Stripe webhook errors: donations may not be marked paid',
    });

    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `sevasetu-${cfg.name}`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: cfg.monthlyBudgetUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: deps.alertEmail
        ? [80, 100].map((threshold) => ({
            notification: { comparisonOperator: 'GREATER_THAN', notificationType: 'ACTUAL', threshold, thresholdType: 'PERCENTAGE' },
            subscribers: [{ subscriptionType: 'EMAIL', address: deps.alertEmail! }],
          }))
        : [],
    });
  }
}
