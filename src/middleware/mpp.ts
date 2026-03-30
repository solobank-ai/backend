import { createMiddleware } from "hono/factory";
import { getService, findEndpoint } from "../services/registry.js";
import type { MppChallenge } from "../types/index.js";
import type { RedisStore } from "../db/redis.js";
import type { Database } from "../db/postgres.js";

interface MppDeps {
  verifier: { verify(sig: string, amount: string): Promise<{ valid: boolean; error?: string; transferredRaw: bigint }> };
  redis: RedisStore;
  db: Database;
  recipientWallet: string;
  apiKeys: Record<string, string>;
}

export function createMppMiddleware(deps: MppDeps) {
  return createMiddleware(async (c, next) => {
    const serviceName = c.req.param("service") ?? "";
    const url = new URL(c.req.url);
    const wildcardPath = url.pathname.replace(`/${serviceName}`, "");

    // Look up service
    const service = getService(serviceName);
    if (!service) {
      return c.json({ error: "Unknown service", service: serviceName }, 404);
    }

    // Check API key is configured
    const apiKey = deps.apiKeys[service.apiKeyEnv];
    if (!apiKey) {
      return c.json({ error: "Service not configured" }, 503);
    }

    // Find matching endpoint
    const endpoint = findEndpoint(service, wildcardPath, c.req.method);
    if (!endpoint) {
      return c.json({
        error: "Unknown endpoint",
        service: serviceName,
        path: wildcardPath,
        availableEndpoints: service.endpoints.map((ep) => `${ep.method} ${ep.path}`),
      }, 404);
    }

    // Check for payment signature
    const signature =
      c.req.header("x-payment-signature") ??
      c.req.header("x-solana-signature");

    if (!signature) {
      // Return 402 challenge
      const challenge: MppChallenge = {
        status: 402,
        message: "Payment Required",
        payment: {
          amount: endpoint.priceUsd,
          currency: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          recipient: deps.recipientWallet,
          network: "solana-mainnet",
        },
        service: service.name,
        endpoint: endpoint.path,
      };
      return c.json(challenge, 402);
    }

    // Check replay
    try {
      const used = await deps.redis.isUsed(signature);
      if (used) {
        return c.json({ error: "Transaction signature already used" }, 409);
      }
    } catch {
      return c.json({ error: "Replay protection unavailable" }, 503);
    }

    // Verify on-chain
    let result;
    try {
      result = await deps.verifier.verify(signature, endpoint.priceUsd);
    } catch (err) {
      return c.json({
        error: "Invalid payment signature",
        detail: err instanceof Error ? err.message : "Unknown error",
      }, 400);
    }
    if (!result.valid) {
      return c.json({
        error: "Payment verification failed",
        detail: result.error,
        payment: {
          amount: endpoint.priceUsd,
          currency: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          recipient: deps.recipientWallet,
          network: "solana-mainnet",
        },
      }, 402);
    }

    // Mark as used
    await deps.redis.markUsed(signature);

    // Log transaction (fire-and-forget)
    deps.db
      .logTransaction({
        signature,
        service: service.name,
        endpoint: endpoint.path,
        amountUsd: endpoint.priceUsd,
        agentAddress: "unknown", // TODO: extract from tx
        status: "success",
        createdAt: new Date(),
      })
      .catch(console.error);

    // Store context for proxy handler
    (c as any).set("txSignature", signature);
    (c as any).set("service", service);
    (c as any).set("endpoint", endpoint);
    (c as any).set("apiKey", apiKey);

    await next();
  });
}
