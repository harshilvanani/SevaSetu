// Per-environment sizing (docs/architecture/aws-target.md → Environments).
export type EnvName = 'dev' | 'staging' | 'prod';

export type EnvConfig = {
  name: EnvName;
  region: string;
  /** Aurora Serverless v2 capacity (ACU). */
  dbMinAcu: number;
  dbMaxAcu: number;
  dbReader: boolean;
  backupDays: number;
  natGateways: number;
  apiTasksMin: number;
  apiTasksMax: number;
  /** Domain for the website, when one is set up in Route 53. */
  domain?: string;
  /** Monthly AWS budget alert in USD. */
  monthlyBudgetUsd: number;
};

const base = { region: 'ca-central-1' }; // ADR-004: keep data in Canada

export const CONFIGS: Record<EnvName, EnvConfig> = {
  dev: { ...base, name: 'dev', dbMinAcu: 0.5, dbMaxAcu: 2, dbReader: false, backupDays: 1, natGateways: 1, apiTasksMin: 1, apiTasksMax: 2, monthlyBudgetUsd: 100 },
  staging: { ...base, name: 'staging', dbMinAcu: 0.5, dbMaxAcu: 4, dbReader: false, backupDays: 7, natGateways: 1, apiTasksMin: 1, apiTasksMax: 3, monthlyBudgetUsd: 200 },
  prod: { ...base, name: 'prod', dbMinAcu: 1, dbMaxAcu: 16, dbReader: true, backupDays: 35, natGateways: 2, apiTasksMin: 2, apiTasksMax: 10, monthlyBudgetUsd: 600 },
};
