import { createMiddleware } from "hono/factory";

interface Bucket {
  count: number;
  resetAt: number;
}

interface Options {
  windowMs: number;
  max: number;
}

/** Simple per-IP fixed-window rate limiter. In-memory; replace with Redis for multi-node. */
export function createRateLimiter(opts: Options) {
  const buckets = new Map<string, Bucket>();

  // Periodic cleanup so the map doesn't grow unbounded.
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, opts.windowMs).unref?.();

  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";

    const now = Date.now();
    const bucket = buckets.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + opts.windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > opts.max) {
        const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
        c.header("retry-after", String(retryAfter));
        return c.json({ error: "Too many requests" }, 429);
      }
    }

    await next();
  });
}
