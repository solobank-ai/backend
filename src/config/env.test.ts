import { describe, it, expect } from "vitest";
import { z } from "zod";

// We can't easily test env.ts directly (it exits on failure),
// so we test the schema logic separately.

const envSchema = z.object({
  SOLANA_RPC_URL: z.string().url().default("https://api.mainnet-beta.solana.com"),
  SOLANA_NETWORK: z.enum(["mainnet-beta", "devnet"]).default("mainnet-beta"),
  RECIPIENT_WALLET: z.string().min(32, "RECIPIENT_WALLET is required"),
  PORT: z.coerce.number().default(3001),
  ALLOWED_ORIGINS: z.string().optional(),
  MAX_BODY_SIZE_MB: z.coerce.number().default(10),
  ADMIN_TOKEN: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  DATABASE_URL: z.string().default("postgresql://localhost:5432/mpp_gateway"),
});

describe("Environment schema", () => {
  const validEnv = {
    RECIPIENT_WALLET: "GkJt9upmT2W8pMawijvVwoT9RLdCN3rdqRfPCxG3ganG",
  };

  it("parses valid minimal env", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SOLANA_NETWORK).toBe("mainnet-beta");
      expect(result.data.PORT).toBe(3001);
      expect(result.data.SOLANA_RPC_URL).toBe("https://api.mainnet-beta.solana.com");
    }
  });

  it("applies defaults correctly", () => {
    const result = envSchema.parse(validEnv);
    expect(result.PORT).toBe(3001);
    expect(result.MAX_BODY_SIZE_MB).toBe(10);
    expect(result.REDIS_URL).toBe("redis://localhost:6379");
  });

  it("rejects missing RECIPIENT_WALLET", () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects too-short RECIPIENT_WALLET", () => {
    const result = envSchema.safeParse({ RECIPIENT_WALLET: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid SOLANA_NETWORK", () => {
    const result = envSchema.safeParse({ ...validEnv, SOLANA_NETWORK: "testnet" });
    expect(result.success).toBe(false);
  });

  it("accepts devnet network", () => {
    const result = envSchema.parse({ ...validEnv, SOLANA_NETWORK: "devnet" });
    expect(result.SOLANA_NETWORK).toBe("devnet");
  });

  it("rejects invalid RPC URL", () => {
    const result = envSchema.safeParse({ ...validEnv, SOLANA_RPC_URL: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("coerces PORT to number", () => {
    const result = envSchema.parse({ ...validEnv, PORT: "8080" });
    expect(result.PORT).toBe(8080);
  });

  it("coerces MAX_BODY_SIZE_MB to number", () => {
    const result = envSchema.parse({ ...validEnv, MAX_BODY_SIZE_MB: "50" });
    expect(result.MAX_BODY_SIZE_MB).toBe(50);
  });
});
