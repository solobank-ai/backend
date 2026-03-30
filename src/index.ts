import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { env } from "./config/env.js";
import { createVerifier } from "./verify/solana.js";
import { createRedisClient } from "./db/redis.js";
import { createDb } from "./db/postgres.js";
import { createMppMiddleware } from "./middleware/mpp.js";
import { buildServices } from "./services/registry.js";
import { createStatsRoute } from "./routes/stats.js";
import type { ResolvedGatewayRoute } from "./types/index.js";

// ── Initialize dependencies ──

const verifier = createVerifier(env.SOLANA_RPC_URL, env.RECIPIENT_WALLET);
const redis = createRedisClient(env.REDIS_URL);
const db = createDb(env.DATABASE_URL);

await db.initialize();

const mpp = createMppMiddleware({
  verifier,
  redis,
  db,
  recipientWallet: env.RECIPIENT_WALLET,
});

// ── Fetch with retries ──

function cleanHeaders(input: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.status < 500 || attempt === retries - 1) {
        return response;
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === retries - 1) break;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }

  return Response.json(
    { error: "Upstream service unavailable after retries", detail: lastError },
    { status: 502 },
  );
}

// ── Build app ──

const app = new Hono();

app.use("*", cors());
app.use("*", logger());

// Public routes
app.get("/health", (c) => c.json({ status: "ok", network: "solana-mainnet" }));

app.get("/services", (c) => {
  const catalog = buildServices();
  const totalEndpoints = catalog.reduce((sum, s) => sum + s.endpoints.length, 0);
  return c.json({
    network: "solana-mainnet",
    currency: "USDC",
    totalServices: catalog.length,
    totalEndpoints,
    services: catalog,
  });
});

app.route("/stats", createStatsRoute(db));

// MPP-protected proxy routes
app.all("/:service/*", mpp, async (c) => {
  const route = (c as any).get("route") as ResolvedGatewayRoute;
  const txSignature = (c as any).get("txSignature") as string;

  const bodyText = await c.req.text();
  const method = route.upstreamMethod ?? "POST";

  // Resolve upstream URL with params
  let upstreamUrl = route.resolveUpstream(route.params);

  // bodyToQuery: convert POST body to query params for GET upstreams
  if (route.bodyToQuery && bodyText) {
    try {
      const query = new URLSearchParams(
        JSON.parse(bodyText) as Record<string, string>,
      ).toString();
      if (query) {
        upstreamUrl += (upstreamUrl.includes("?") ? "&" : "?") + query;
      }
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
  }

  // Resolve headers with params
  const upstreamHeaders = cleanHeaders({
    ...(method === "POST" ? { "content-type": "application/json" } : {}),
    ...route.resolveHeaders(route.params),
  });

  // Fetch upstream with retries
  const upstream = await fetchWithRetry(upstreamUrl, {
    method,
    headers: upstreamHeaders,
    body: method === "POST" && bodyText ? bodyText : undefined,
  });

  // Build response
  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  responseHeaders.set("x-payment-status", "confirmed");
  responseHeaders.set("x-payment-signature", txSignature);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
});

// ── Start server ──

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`MPP Gateway running on http://localhost:${info.port}`);
  console.log(`Services: /services`);
  console.log(`Stats: /stats`);
  console.log(`Network: solana-mainnet`);
  console.log(`Recipient: ${env.RECIPIENT_WALLET}`);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await redis.disconnect();
  await db.disconnect();
  process.exit(0);
});
