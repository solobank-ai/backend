import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";

import { env } from "./config/env.js";
import { createVerifier } from "./verify/solana.js";
import { createRedisClient } from "./db/redis.js";
import { createDb } from "./db/postgres.js";
import { createMppMiddleware, type MppVariables } from "./middleware/mpp.js";
import { buildServices, gatewayRoutes, getMissingRequiredEnv } from "./services/registry.js";
import { createStatsRoute } from "./routes/stats.js";
import { createPaymentsRoute } from "./routes/payments.js";

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

const FETCH_TIMEOUT_MS = 30_000;

async function fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (response.status < 500 || attempt === retries - 1) {
        return response;
      }
    } catch {
      clearTimeout(timer);
      if (attempt === retries - 1) break;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }

  return Response.json(
    { error: "Upstream service unavailable" },
    { status: 502 },
  );
}

async function getDependencyHealth() {
  const checks: Record<string, string> = {
    server: "ok",
    network: `solana-${env.SOLANA_NETWORK}`,
  };

  try {
    await redis.isUsed("__health_check__");
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  try {
    await db.healthcheck();
    checks.postgres = "ok";
  } catch {
    checks.postgres = "error";
  }

  return checks;
}

function getProviderSummary() {
  const unconfigured = gatewayRoutes
    .filter((route) => getMissingRequiredEnv(route).length > 0)
    .map((route) => ({ service: route.service, path: route.path }));

  return {
    totalRoutes: gatewayRoutes.length,
    configuredRoutes: gatewayRoutes.length - unconfigured.length,
    unconfigured,
  };
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
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-payment-signature",
      "x-solana-signature",
    ],
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
  const checks = await getDependencyHealth();
  const providers = getProviderSummary();

  const healthy = checks.redis === "ok" && checks.postgres === "ok";
  return c.json(
    {
      status: healthy ? "ok" : "degraded",
      ...checks,
      configuredRoutes: providers.configuredRoutes,
      totalRoutes: providers.totalRoutes,
    },
    healthy ? 200 : 503,
  );
});

app.get("/services", (c) => {
  const catalog = buildServices(env.SOLANA_NETWORK);
  const totalEndpoints = catalog.reduce((sum, s) => sum + s.endpoints.length, 0);
  return c.json({
    network: `solana-${env.SOLANA_NETWORK}`,
    currency: env.SOLANA_NETWORK === "devnet" ? "SOL" : "USDC",
    totalServices: catalog.length,
    totalEndpoints,
    services: catalog,
  });
});

app.get("/status", async (c) => {
  const checks = await getDependencyHealth();
  const providers = getProviderSummary();
  const recipientConfigured = env.RECIPIENT_WALLET.trim().length > 0;
  const healthy = checks.redis === "ok" && checks.postgres === "ok";

  return c.json(
    {
      ok: healthy && recipientConfigured,
      network: `solana-${env.SOLANA_NETWORK}`,
      recipient: {
        ok: recipientConfigured,
      },
      rpc: {
        ok: true,
      },
      redis: {
        ok: checks.redis === "ok",
      },
      database: {
        ok: checks.postgres === "ok",
      },
      storage: {
        mode: "postgres",
        replay: "redis",
      },
      providers,
    },
    healthy && recipientConfigured ? 200 : 503,
  );
});

// Admin-only routes (require ADMIN_TOKEN via Bearer auth)
const adminAuth = createMiddleware(async (c, next) => {
  if (env.ADMIN_TOKEN) {
    const auth = c.req.header("authorization");
    if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  await next();
});

app.use("/stats/*", adminAuth);
app.use("/payments/*", adminAuth);
app.use("/mpp/stats/*", adminAuth);
app.use("/mpp/payments/*", adminAuth);
// Also protect the root paths themselves
app.get("/stats", adminAuth);
app.get("/payments", adminAuth);

app.route("/stats", createStatsRoute(db));
app.route("/payments", createPaymentsRoute(db));
app.route("/mpp/stats", createStatsRoute(db));
app.route("/mpp/payments", createPaymentsRoute(db));

// ── MPP-protected proxy routes ──

app.all("/:service/*", mpp, async (c) => {
  const route = c.get("route");
  const txSignature = c.get("txSignature");

  const bodyText = await c.req.text();
  const method = route.upstreamMethod ?? "POST";

  // Resolve upstream URL with params
  let upstreamUrl = route.resolveUpstream(route.params);

  // bodyToQuery: convert POST body to query params for GET upstreams
  // Block keys that could override auth params already in the URL
  const BLOCKED_QUERY_KEYS = new Set([
    "api_key", "apikey", "key", "token", "access_key",
    "x_cg_demo_api_key", "appid", "callback", "webhook",
  ]);

  if (route.bodyToQuery && bodyText) {
    try {
      const parsed = JSON.parse(bodyText) as Record<string, string>;
      const safe: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (!BLOCKED_QUERY_KEYS.has(k.toLowerCase()) && typeof v === "string") {
          safe[k] = v;
        }
      }
      const query = new URLSearchParams(safe).toString();
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
  console.log(`Status: /status`);
  console.log(`Stats: /stats`);
  console.log(`Payments: /payments`);
  console.log(`MPP Stats: /mpp/stats`);
  console.log(`MPP Payments: /mpp/payments`);
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
