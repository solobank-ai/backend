import { Hono } from "hono";
import type { Database } from "../db/postgres.js";

export function createPaymentsRoute(db: Database) {
  const payments = new Hono();

  payments.get("/", async (c) => {
    const requestedLimit = Number(c.req.query("limit") ?? "100");
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(50, requestedLimit))
      : 100;
    const requestedOffset = Number(c.req.query("offset") ?? "0");
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(0, requestedOffset)
      : 0;
    const service = c.req.query("service") || undefined;
    const search = c.req.query("search")?.trim() || undefined;

    try {
      const result = await db.listPayments({
        limit,
        offset,
        service,
        search,
      });
      return c.json(result);
    } catch (error) {
      console.error("Payments query failed:", error);
      return c.json({ error: "Failed to fetch payments" }, 500);
    }
  });

  return payments;
}
