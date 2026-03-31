import { Hono } from "hono";
import type { Database } from "../db/postgres.js";

export function createPaymentsRoute(db: Database) {
  const payments = new Hono();

  payments.get("/", async (c) => {
    const requestedLimit = Number(c.req.query("limit") ?? "100");
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(500, requestedLimit))
      : 100;

    try {
      const entries = await db.listPayments(limit);
      return c.json({
        count: entries.length,
        payments: entries,
      });
    } catch (error) {
      console.error("Payments query failed:", error);
      return c.json({ error: "Failed to fetch payments" }, 500);
    }
  });

  return payments;
}
