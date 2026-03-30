import postgres from "postgres";
import type { TransactionLog, StatsQuery, StatsResult } from "../types/index.js";

export function createDb(url: string) {
  const sql = postgres(url);

  return {
    async initialize(): Promise<void> {
      await sql`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          signature TEXT UNIQUE NOT NULL,
          service TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          amount_usd TEXT NOT NULL,
          agent_address TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'success',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_transactions_service ON transactions (service)
      `;
    },

    async logTransaction(log: TransactionLog): Promise<void> {
      await sql`
        INSERT INTO transactions (signature, service, endpoint, amount_usd, agent_address, status)
        VALUES (${log.signature}, ${log.service}, ${log.endpoint}, ${log.amountUsd}, ${log.agentAddress}, ${log.status})
        ON CONFLICT (signature) DO NOTHING
      `;
    },

    async getStats(query?: StatsQuery): Promise<StatsResult> {
      const period = query?.period ?? "24h";
      const intervalMap: Record<string, string> = {
        "1h": "1 hour",
        "24h": "24 hours",
        "7d": "7 days",
        "30d": "30 days",
      };
      const interval = intervalMap[period] ?? "24 hours";

      const baseCondition = query?.service
        ? sql`WHERE created_at > NOW() - ${interval}::interval AND service = ${query.service}`
        : sql`WHERE created_at > NOW() - ${interval}::interval`;

      const [totals] = await sql`
        SELECT
          COUNT(*)::int AS total_transactions,
          COALESCE(SUM(amount_usd::numeric), 0)::text AS total_revenue_usd
        FROM transactions
        ${baseCondition}
      `;

      const serviceStats = await sql`
        SELECT
          service,
          COUNT(*)::int AS count,
          COALESCE(SUM(amount_usd::numeric), 0)::text AS revenue_usd
        FROM transactions
        ${baseCondition}
        GROUP BY service
      `;

      const services: Record<string, { count: number; revenueUsd: string }> = {};
      for (const row of serviceStats) {
        services[row.service] = {
          count: row.count,
          revenueUsd: row.revenue_usd,
        };
      }

      return {
        totalTransactions: totals.total_transactions,
        totalRevenueUsd: totals.total_revenue_usd,
        services,
        period,
      };
    },

    async disconnect(): Promise<void> {
      await sql.end();
    },
  };
}

export type Database = ReturnType<typeof createDb>;
