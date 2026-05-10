import { Hono } from "hono";
import type { Database } from "../db/postgres.js";

export function createPaymentsRoute(db: Database) {
  const payments = new Hono();

  const SERVICE_RE = /^[a-z0-9_-]{1,32}$/i;
  const SEARCH_RE = /^[A-Za-z0-9_-]{1,64}$/;

  payments.get("/", async (c) => {
    const requestedLimit = Number(c.req.query("limit") ?? "50");
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(50, requestedLimit))
      : 50;
    const requestedOffset = Number(c.req.query("offset") ?? "0");
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(0, Math.min(1_000_000, requestedOffset))
      : 0;

    const rawService = c.req.query("service");
    const service = rawService && SERVICE_RE.test(rawService) ? rawService : undefined;

    const rawSearch = c.req.query("search")?.trim();
    const search = rawSearch && SEARCH_RE.test(rawSearch) ? rawSearch : undefined;

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
