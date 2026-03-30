import { createMiddleware } from "hono/factory";
import { resolveGatewayRoute } from "../services/registry.js";
import type { MppChallenge } from "../types/index.js";
import type { RedisStore } from "../db/redis.js";
import type { Database } from "../db/postgres.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface MppDeps {
  verifier: { verify(sig: string, amount: string): Promise<{ valid: boolean; error?: string; transferredRaw: bigint }> };
  redis: RedisStore;
  db: Database;
  recipientWallet: string;
}

export function createMppMiddleware(deps: MppDeps) {
  return createMiddleware(async (c, next) => {
    const url = new URL(c.req.url);
    const route = resolveGatewayRoute(url.pathname);

    if (!route) {
      return c.json({ error: "Unknown endpoint", path: url.pathname }, 404);
    }

    // Check for payment signature
    const signature =
      c.req.header("x-payment-signature") ??
      c.req.header("x-solana-signature");

    if (!signature) {
      const challenge: MppChallenge = {
        status: 402,
        message: "Payment Required",
        payment: {
          amount: route.price,
          currency: USDC_MINT,
          recipient: deps.recipientWallet,
          network: "solana-mainnet",
        },
        service: route.service,
        endpoint: route.path,
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
      result = await deps.verifier.verify(signature, route.price);
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
          amount: route.price,
          currency: USDC_MINT,
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
        service: route.service,
        endpoint: route.path,
        amountUsd: route.price,
        agentAddress: "unknown",
        status: "success",
        createdAt: new Date(),
      })
      .catch(console.error);

    // Store route for proxy handler
    (c as any).set("route", route);
    (c as any).set("txSignature", signature);

    await next();
  });
}
