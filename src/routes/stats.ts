import { Hono } from "hono";
import type { Database } from "../db/postgres.js";

export function createStatsRoute(db: Database) {
  const stats = new Hono();

  stats.get("/", async (c) => {
    try {
      const result = await db.getMppStats();
      return c.json(result);
    } catch (error) {
      console.error("Stats query failed:", error);
      return c.json({ error: "Failed to fetch stats" }, 500);
    }
  });

  return stats;
}
