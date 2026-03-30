import { Hono } from "hono";
import type { Database } from "../db/postgres.js";
import type { StatsQuery } from "../types/index.js";

export function createStatsRoute(db: Database) {
  const stats = new Hono();

  stats.get("/", async (c) => {
    const query: StatsQuery = {
      service: c.req.query("service") || undefined,
      period: (c.req.query("period") as StatsQuery["period"]) || "24h",
    };

    try {
      const result = await db.getStats(query);
      return c.json(result);
    } catch (error) {
      console.error("Stats query failed:", error);
      return c.json({ error: "Failed to fetch stats" }, 500);
    }
  });

  return stats;
}
