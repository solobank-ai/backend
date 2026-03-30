export interface ServiceEndpoint {
  path: string;
  method: "POST" | "GET";
  priceUsd: string;
  description: string;
}

export interface ServiceConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  authHeader: string;
  authPrefix: string;
  apiKeyEnv: string;
  endpoints: ServiceEndpoint[];
}

export interface MppChallenge {
  status: 402;
  message: string;
  payment: {
    amount: string;
    currency: string;
    recipient: string;
    network: string;
  };
  service: string;
  endpoint: string;
}

export interface VerifyResult {
  valid: boolean;
  error?: string;
  transferredRaw: bigint;
}

export interface TransactionLog {
  signature: string;
  service: string;
  endpoint: string;
  amountUsd: string;
  agentAddress: string;
  status: "success" | "failed";
  createdAt: Date;
}

export interface StatsQuery {
  service?: string;
  period?: "1h" | "24h" | "7d" | "30d";
}

export interface StatsResult {
  totalTransactions: number;
  totalRevenueUsd: string;
  services: Record<string, { count: number; revenueUsd: string }>;
  period: string;
}

export type MppVariables = {
  txSignature: string;
  service: ServiceConfig;
  endpoint: ServiceEndpoint;
};
