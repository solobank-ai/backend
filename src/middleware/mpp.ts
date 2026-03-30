import { createMiddleware } from "hono/factory";
import { resolveGatewayRoute } from "../services/registry.js";
import type { MppChallenge, ResolvedGatewayRoute } from "../types/index.js";
import type { RedisStore } from "../db/redis.js";
import type { Database } from "../db/postgres.js";
import type { SolanaNetwork } from "../verify/solana.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface MppDeps {
  verifier: {
    verify(sig: string, amount: string): Promise<{ valid: boolean; error?: string; transferredRaw: bigint; senderAddress?: string }>;
    network: SolanaNetwork;
  };
  redis: RedisStore;
  db: Database;
  recipientWallet: string;
}

export type MppVariables = {
  route: ResolvedGatewayRoute;
  txSignature: string;
};

export function createMppMiddleware(deps: MppDeps) {
  const isDevnet = deps.verifier.network === "devnet";
  const networkLabel = isDevnet ? "solana-devnet" : "solana-mainnet";
  const currency = isDevnet ? "SOL" : USDC_MINT;

  return createMiddleware<{ Variables: MppVariables }>(async (c, next) => {
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
          currency,
          recipient: deps.recipientWallet,
          network: networkLabel,
        },
        service: route.service,
        endpoint: route.path,
      };
      return c.json(challenge, 402);
    }

    // Atomic replay protection: mark as used OR reject if already used
    let isNew: boolean;
    try {
      isNew = await deps.redis.tryMarkUsed(signature);
    } catch {
      return c.json({ error: "Replay protection unavailable" }, 503);
    }
    if (!isNew) {
      return c.json({ error: "Transaction signature already used" }, 409);
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
          currency,
          recipient: deps.recipientWallet,
          network: networkLabel,
        },
      }, 402);
    }

    // Log transaction (fire-and-forget)
    deps.db
      .logTransaction({
        signature,
        service: route.service,
        endpoint: route.path,
        amountUsd: route.price,
        agentAddress: result.senderAddress ?? "unknown",
        status: "success",
        createdAt: new Date(),
      })
      .catch(console.error);

    // Store route for proxy handler
    c.set("route", route);
    c.set("txSignature", signature);

    await next();
  });
}
