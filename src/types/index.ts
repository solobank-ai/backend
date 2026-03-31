export interface GatewayRouteConfig {
  service: string;
  path: string;
  description: string;
  price: string;
  requiredEnv?: string[];
  upstreamMethod?: "GET" | "POST";
  bodyToQuery?: boolean;
  resolveUpstream: (params: Record<string, string>) => string;
  resolveHeaders: (params: Record<string, string>) => Record<string, string | undefined>;
}

export interface ResolvedGatewayRoute extends GatewayRouteConfig {
  params: Record<string, string>;
}

export interface ServiceMeta {
  id: string;
  name: string;
  description: string;
  categories: string[];
}

export interface EndpointDefinition {
  method: "GET" | "POST";
  path: string;
  description: string;
  price: string;
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
  senderAddress?: string;
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

export interface PaymentListEntry {
  id: number;
  service: string;
  endpoint: string;
  amount: string;
  digest: string;
  sender: string;
  status: "success" | "failed";
  createdAt: string;
}

export interface PaymentListQuery {
  limit: number;
  offset: number;
  service?: string;
  search?: string;
}

export interface PaymentListResult {
  payments: PaymentListEntry[];
  total: number;
  hasMore: boolean;
}

export interface MppServiceStat {
  service: string;
  count: number;
  volume: string;
}

export interface MppStatsResult {
  totalPayments: number;
  totalVolume: string;
  services: MppServiceStat[];
}
