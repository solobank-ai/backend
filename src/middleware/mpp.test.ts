import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { createMppMiddleware, type MppVariables } from "./mpp.js";

// ── Mock dependencies ──

function createMockDeps(overrides: Partial<{
  verifyResult: { valid: boolean; error?: string; transferredRaw: bigint; senderAddress?: string };
  verifyThrows: boolean;
  network: "devnet" | "mainnet-beta";
  tryMarkUsedResult: boolean;
  tryMarkUsedThrows: boolean;
}> = {}) {
  const {
    verifyResult = { valid: true, transferredRaw: 10_000_000n, senderAddress: "SenderAddr" },
    verifyThrows = false,
    network = "devnet",
    tryMarkUsedResult = true,
    tryMarkUsedThrows = false,
  } = overrides;

  return {
    verifier: {
      verify: verifyThrows
        ? vi.fn().mockRejectedValue(new Error("RPC error"))
        : vi.fn().mockResolvedValue(verifyResult),
      network: network as any,
    },
    redis: {
      tryMarkUsed: tryMarkUsedThrows
        ? vi.fn().mockRejectedValue(new Error("Redis down"))
        : vi.fn().mockResolvedValue(tryMarkUsedResult),
      isUsed: vi.fn(),
      disconnect: vi.fn(),
    },
    db: {
      initialize: vi.fn().mockResolvedValue(undefined),
      logTransaction: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn(),
      getMppStats: vi.fn(),
      healthcheck: vi.fn(),
      listPayments: vi.fn(),
      disconnect: vi.fn(),
    },
    recipientWallet: "GkJt9upmT2W8pMawijvVwoT9RLdCN3rdqRfPCxG3ganG",
  };
}

// We need to mock resolveGatewayRoute and getMissingRequiredEnv
vi.mock("../services/registry.js", () => ({
  resolveGatewayRoute: vi.fn(),
  getMissingRequiredEnv: vi.fn().mockReturnValue([]),
}));

import { resolveGatewayRoute, getMissingRequiredEnv } from "../services/registry.js";

const mockResolve = resolveGatewayRoute as ReturnType<typeof vi.fn>;
const mockMissingEnv = getMissingRequiredEnv as ReturnType<typeof vi.fn>;

function buildApp(deps: ReturnType<typeof createMockDeps>) {
  const app = new Hono<{ Variables: MppVariables }>();
  app.use("/*", createMppMiddleware(deps));
  app.all("/*", (c) => c.json({ ok: true, route: c.get("route")?.service }));
  return app;
}

const VALID_SIG = "5mzm69ipnV9qJFSdK7bFj5HnGqhB4Qh6jLY8pB8gZ7EbNFJ1GaW8GwGFmMvBpxHNqNY8t7X";

describe("MPP Middleware", () => {
  beforeEach(() => {
    mockResolve.mockReset();
    mockMissingEnv.mockReset().mockReturnValue([]);
  });

  it("returns 404 for unknown endpoint", async () => {
    mockResolve.mockReturnValue(null);
    const app = buildApp(createMockDeps());
    const res = await app.request("/unknown/path", { method: "POST" });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Unknown endpoint");
  });

  it("returns 503 when upstream not configured", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    mockMissingEnv.mockReturnValue(["OPENAI_API_KEY"]);
    const app = buildApp(createMockDeps());
    const res = await app.request("/openai/v1/chat", { method: "POST" });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("not configured");
  });

  it("returns 402 challenge when no signature header", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const app = buildApp(createMockDeps());
    const res = await app.request("/openai/v1/chat", { method: "POST" });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.payment.amount).toBe("0.01");
    expect(body.payment.currency).toBe("SOL");
    expect(body.payment.recipient).toBe("GkJt9upmT2W8pMawijvVwoT9RLdCN3rdqRfPCxG3ganG");
    expect(body.payment.network).toBe("solana-devnet");
  });

  it("returns USDC currency on mainnet", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const app = buildApp(createMockDeps({ network: "mainnet-beta" }));
    const res = await app.request("/openai/v1/chat", { method: "POST" });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.payment.currency).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(body.payment.network).toBe("solana-mainnet");
  });

  it("returns 400 for invalid signature format", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const app = buildApp(createMockDeps());
    const res = await app.request("/openai/v1/chat", {
      method: "POST",
      headers: { "x-payment-signature": "invalid!@#$" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature format");
  });

  it("returns 400 for too-short signature", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const app = buildApp(createMockDeps());
    const res = await app.request("/openai/v1/chat", {
      method: "POST",
      headers: { "x-payment-signature": "abc" },
    });
    expect(res.status).toBe(400);
  });

  it("accepts x-solana-signature header as fallback", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const deps = createMockDeps();
    const app = buildApp(deps);
    const res = await app.request("/openai/v1/chat", {
      method: "POST",
      headers: { "x-solana-signature": VALID_SIG },
    });
    expect(res.status).toBe(200);
    expect(deps.verifier.verify).toHaveBeenCalledWith(VALID_SIG, "0.01");
  });

  it("returns 200 and passes through on valid payment", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const deps = createMockDeps();
    const app = buildApp(deps);
    const res = await app.request("/openai/v1/chat", {
      method: "POST",
      headers: { "x-payment-signature": VALID_SIG },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.route).toBe("openai");
    expect(deps.verifier.verify).toHaveBeenCalledWith(VALID_SIG, "0.01");
    expect(deps.redis.tryMarkUsed).toHaveBeenCalledWith(VALID_SIG);
    expect(deps.db.logTransaction).toHaveBeenCalled();
  });

  it("returns 402 when verification fails", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const deps = createMockDeps({
      verifyResult: { valid: false, error: "Insufficient payment", transferredRaw: 0n },
    });
    const app = buildApp(deps);
    const res = await app.request("/openai/v1/chat", {
      method: "POST",
      headers: { "x-payment-signature": VALID_SIG },
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("Payment verification failed");
    expect(body.payment).toBeDefined();
  });

  it("returns 400 when verifier throws", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const app = buildApp(createMockDeps({ verifyThrows: true }));
    const res = await app.request("/openai/v1/chat", {
      method: "POST",
      headers: { "x-payment-signature": VALID_SIG },
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 on replay (signature already used)", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const app = buildApp(createMockDeps({ tryMarkUsedResult: false }));
    const res = await app.request("/openai/v1/chat", {
      method: "POST",
      headers: { "x-payment-signature": VALID_SIG },
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already used");
  });

  it("returns 503 when Redis is down", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const app = buildApp(createMockDeps({ tryMarkUsedThrows: true }));
    const res = await app.request("/openai/v1/chat", {
      method: "POST",
      headers: { "x-payment-signature": VALID_SIG },
    });
    expect(res.status).toBe(503);
  });

  it("verifies BEFORE marking as used (order matters)", async () => {
    mockResolve.mockReturnValue({ service: "openai", path: "/v1/chat", price: "0.01", params: {} });
    const callOrder: string[] = [];
    const deps = createMockDeps();
    deps.verifier.verify = vi.fn().mockImplementation(async () => {
      callOrder.push("verify");
      return { valid: true, transferredRaw: 10_000_000n, senderAddress: "Sender" };
    });
    deps.redis.tryMarkUsed = vi.fn().mockImplementation(async () => {
      callOrder.push("markUsed");
      return true;
    });

    const app = buildApp(deps);
    await app.request("/openai/v1/chat", {
      method: "POST",
      headers: { "x-payment-signature": VALID_SIG },
    });

    expect(callOrder).toEqual(["verify", "markUsed"]);
  });
});
