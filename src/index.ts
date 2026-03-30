import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { env } from "./config/env.js";
import { createVerifier } from "./verify/solana.js";
import { createRedisClient } from "./db/redis.js";
import { createDb } from "./db/postgres.js";
import { createMppMiddleware } from "./middleware/mpp.js";
import { proxy } from "./routes/proxy.js";
import { services } from "./routes/services.js";
import { createStatsRoute } from "./routes/stats.js";

// Initialize dependencies
const verifier = createVerifier(env.SOLANA_RPC_URL, env.RECIPIENT_WALLET);
const redis = createRedisClient(env.REDIS_URL);
const db = createDb(env.DATABASE_URL);

// Initialize database
await db.initialize();

// API keys map
const apiKeys: Record<string, string> = {
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
  GROQ_API_KEY: env.GROQ_API_KEY,
};

// Create MPP middleware
const mpp = createMppMiddleware({
  verifier,
  redis,
  db,
  recipientWallet: env.RECIPIENT_WALLET,
  apiKeys,
});

// Build app
const app = new Hono();

app.use("*", cors());
app.use("*", logger());

// Public routes
app.get("/health", (c) => c.json({ status: "ok", network: "solana-mainnet" }));
app.route("/services", services);
app.route("/stats", createStatsRoute(db));

// MPP-protected proxy routes
app.all("/:service{[a-z]+}/*path", mpp, async (c) => {
  // Forward to proxy handler
  const service = (c as any).get("service") as any;
  const endpoint = (c as any).get("endpoint") as any;
  const apiKey = (c as any).get("apiKey") as string;
  const wildcardPath = "/" + (c.req.param("path") || "");

  const upstreamUrl = service.baseUrl + wildcardPath;

  const headers: Record<string, string> = {
    [service.authHeader]: service.authPrefix + apiKey,
    "Content-Type": c.req.header("content-type") ?? "application/json",
  };

  if (service.name === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
  }

  const upstream = await fetch(upstreamUrl, {
    method: c.req.method,
    headers,
    body: c.req.method !== "GET" ? c.req.raw.body : undefined,
  });

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  responseHeaders.set("x-payment-status", "confirmed");
  responseHeaders.set("x-payment-signature", (c as any).get("txSignature") as string);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
});

// Start server
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`MPP Gateway running on http://localhost:${info.port}`);
  console.log(`Services: /services`);
  console.log(`Stats: /stats`);
  console.log(`Network: solana-mainnet`);
  console.log(`Recipient: ${env.RECIPIENT_WALLET}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await redis.disconnect();
  await db.disconnect();
  process.exit(0);
});
