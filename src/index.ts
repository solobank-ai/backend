import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";

import { env } from "./config/env.js";
import { createVerifier } from "./verify/solana.js";
import { createRedisClient } from "./db/redis.js";
import { createDb } from "./db/postgres.js";
import { createMppMiddleware, type MppVariables } from "./middleware/mpp.js";
import { buildServices } from "./services/registry.js";
import { createStatsRoute } from "./routes/stats.js";

// ── Initialize dependencies ──

const verifier = createVerifier(env.SOLANA_RPC_URL, env.RECIPIENT_WALLET, env.SOLANA_NETWORK);
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

const app = new Hono<{ Variables: MppVariables }>();

// CORS — restrict origins if configured
const origins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["*"];

app.use(
  "*",
  cors({
    origin: origins.includes("*") ? "*" : origins,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "x-payment-signature", "x-solana-signature"],
  }),
);

app.use("*", logger());

// Body size limit
app.use(
  "/:service/*",
  bodyLimit({ maxSize: env.MAX_BODY_SIZE_MB * 1024 * 1024 }),
);

// ── Public routes ──

app.get("/health", async (c) => {
  const checks: Record<string, string> = {
    server: "ok",
    network: `solana-${env.SOLANA_NETWORK}`,
  };

  // Check Redis
  try {
    await redis.isUsed("__health_check__");
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  // Check PostgreSQL
  try {
    await db.getStats({ period: "1h" });
    checks.postgres = "ok";
  } catch {
    checks.postgres = "error";
  }

  const healthy = checks.redis === "ok" && checks.postgres === "ok";
  return c.json({ status: healthy ? "ok" : "degraded", ...checks }, healthy ? 200 : 503);
});

app.get("/services", (c) => {
  const catalog = buildServices();
  const totalEndpoints = catalog.reduce((sum, s) => sum + s.endpoints.length, 0);
  return c.json({
    network: `solana-${env.SOLANA_NETWORK}`,
    currency: env.SOLANA_NETWORK === "devnet" ? "SOL" : "USDC",
    totalServices: catalog.length,
    totalEndpoints,
    services: catalog,
  });
});

app.route("/stats", createStatsRoute(db));

// ── MPP-protected proxy routes ──

app.all("/:service/*", mpp, async (c) => {
  const route = c.get("route");
  const txSignature = c.get("txSignature");

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
  console.log(`Network: solana-${env.SOLANA_NETWORK}`);
  console.log(`Recipient: ${env.RECIPIENT_WALLET}`);
});

// ── Graceful shutdown ──

async function shutdown() {
  console.log("\nShutting down...");
  await redis.disconnect();
  await db.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
