import { createMiddleware } from "hono/factory";
import { getMissingRequiredEnv, resolveGatewayRoute } from "../services/registry.js";
import type { MppChallenge, ResolvedGatewayRoute } from "../types/index.js";
import type { RedisStore } from "../db/redis.js";
import type { Database } from "../db/postgres.js";
import type { SolanaNetwork } from "../verify/solana.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface MppDeps {
  verifier: {
    verify(sig: string, amount: string): Promise<{ valid: boolean; error?: string; transferredRaw: bigint; senderAddress?: string }>;
    verifyFast?(sig: string, amount: string, rawTxBase64: string): Promise<{ valid: boolean; error?: string; transferredRaw: bigint; senderAddress?: string }>;
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

/** Validate signature format: base58, 64-88 chars */
function isValidSignature(sig: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(sig);
}

export function createMppMiddleware(deps: MppDeps) {
  const isDevnet = deps.verifier.network === "devnet";
  const networkLabel = isDevnet ? "solana-devnet" : "solana-mainnet";
  const currency = isDevnet ? "SOL" : USDC_MINT;

  return createMiddleware<{ Variables: MppVariables }>(async (c, next) => {
    const url = new URL(c.req.url);
    const route = resolveGatewayRoute(url.pathname);

    if (!route) {
      return c.json({ error: "Unknown endpoint" }, 404);
    }

    const missingEnv = getMissingRequiredEnv(route);
    if (missingEnv.length > 0) {
      return c.json({ error: "Upstream provider is not configured", service: route.service }, 503);
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

    // Validate signature format before any DB/RPC calls
    if (!isValidSignature(signature)) {
      return c.json({ error: "Invalid signature format" }, 400);
    }

    // 1. Verify on-chain FIRST (before marking as used)
    //    Fast-path: if client sends raw tx bytes, skip getTransaction entirely
    const rawTx = c.req.header("x-payment-transaction");
    let result;
    try {
      if (rawTx && deps.verifier.verifyFast) {
        result = await deps.verifier.verifyFast(signature, route.price, rawTx);
      } else {
        result = await deps.verifier.verify(signature, route.price);
      }
    } catch {
      return c.json({ error: "Payment verification failed" }, 400);
    }
    if (!result.valid) {
      return c.json({
        error: "Payment verification failed",
        payment: {
          amount: route.price,
          currency,
          recipient: deps.recipientWallet,
          network: networkLabel,
        },
      }, 402);
    }

    // 2. Atomic replay protection AFTER successful verification
    //    If this fails, the signature was already used — no money lost
    let isNew: boolean;
    try {
      isNew = await deps.redis.tryMarkUsed(signature);
    } catch {
      return c.json({ error: "Service temporarily unavailable" }, 503);
    }
    if (!isNew) {
      return c.json({ error: "Transaction signature already used" }, 409);
    }

    // Log transaction (fire-and-forget, also serves as fallback replay check via UNIQUE constraint)
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
      .catch(() => {});

    // Store route for proxy handler
    c.set("route", route);
    c.set("txSignature", signature);

    await next();
  });
}
