import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ──

const mockSend = vi.fn();

vi.mock("@solana/kit", () => ({
  createSolanaRpc: () => ({
    getTransaction: () => ({
      send: mockSend,
    }),
    getSignatureStatuses: () => ({
      send: vi.fn().mockResolvedValue({ value: [{ confirmationStatus: "confirmed" }] }),
    }),
  }),
  signature: (s: string) => s,
}));

import { createVerifier } from "./solana.js";

// ── Constants ──

const RECIPIENT = "GkJt9upmT2W8pMawijvVwoT9RLdCN3rdqRfPCxG3ganG";
const SENDER = "5TyuX82zQK2n1qyXYZtYDidkZDdptkVv9dWEpzbH1vP3";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const RECIPIENT_ATA = "RecipientAtaAddress11111111111111111111111";

// ── Mock TX builders ──

function mockSolTransferTx(lamports: number, dest: string, sender = SENDER) {
  return {
    meta: { err: null },
    blockTime: Math.floor(Date.now() / 1000) - 10,
    transaction: {
      message: {
        instructions: [{
          program: "system",
          programId: "11111111111111111111111111111111",
          parsed: { type: "transfer", info: { source: sender, destination: dest, lamports } },
        }],
        accountKeys: [{ pubkey: sender }, { pubkey: dest }],
      },
    },
  };
}

function mockUsdcTransferTx(amount: string, dest: string, destAta: string, sender = SENDER) {
  return {
    meta: {
      err: null,
      preTokenBalances: [
        { accountIndex: 2, mint: USDC_MINT, uiTokenAmount: { amount: "0", decimals: 6 }, owner: dest },
      ],
      postTokenBalances: [
        { accountIndex: 2, mint: USDC_MINT, uiTokenAmount: { amount, decimals: 6 }, owner: dest },
      ],
      innerInstructions: [],
    },
    blockTime: Math.floor(Date.now() / 1000) - 10,
    transaction: {
      message: {
        instructions: [{
          program: "spl-token",
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          parsed: {
            type: "transferChecked",
            info: { source: "SenderAta", destination: destAta, authority: sender, tokenAmount: { amount, decimals: 6 } },
          },
        }],
        accountKeys: [{ pubkey: sender }, { pubkey: "SenderAta" }, { pubkey: destAta }],
      },
    },
  };
}

// ── Tests ──

describe("Payment Verifier — Devnet (SOL)", () => {
  beforeEach(() => { mockSend.mockReset(); });

  it("accepts valid SOL transfer with correct amount", async () => {
    mockSend.mockResolvedValue(mockSolTransferTx(10_000_000, RECIPIENT));
    const v = createVerifier("https://rpc", RECIPIENT, "devnet");
    const r = await v.verify("sig1", "0.01");
    expect(r.valid).toBe(true);
    expect(r.transferredRaw).toBe(10_000_000n);
    expect(r.senderAddress).toBe(SENDER);
  });

  it("accepts overpayment", async () => {
    mockSend.mockResolvedValue(mockSolTransferTx(50_000_000, RECIPIENT));
    const v = createVerifier("https://rpc", RECIPIENT, "devnet");
    const r = await v.verify("sig2", "0.01");
    expect(r.valid).toBe(true);
    expect(r.transferredRaw).toBe(50_000_000n);
  });

  it("rejects insufficient amount", async () => {
    mockSend.mockResolvedValue(mockSolTransferTx(1_000_000, RECIPIENT));
    const v = createVerifier("https://rpc", RECIPIENT, "devnet");
    const r = await v.verify("sig3", "0.01");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Insufficient payment");
  });

  it("rejects transfer to wrong recipient", async () => {
    mockSend.mockResolvedValue(mockSolTransferTx(10_000_000, "WrongAddr"));
    const v = createVerifier("https://rpc", RECIPIENT, "devnet");
    const r = await v.verify("sig4", "0.01");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("No SOL transfer to recipient");
  });

  it("rejects failed transaction", async () => {
    mockSend.mockResolvedValue({
      meta: { err: { InstructionError: [0, "InsufficientFunds"] } },
      blockTime: Math.floor(Date.now() / 1000) - 10,
      transaction: { message: { instructions: [], accountKeys: [] } },
    });
    const v = createVerifier("https://rpc", RECIPIENT, "devnet");
    const r = await v.verify("sig5", "0.01");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("Transaction failed on-chain");
  });

  it("rejects old transaction (> 5 minutes)", async () => {
    mockSend.mockResolvedValue({
      meta: { err: null },
      blockTime: Math.floor(Date.now() / 1000) - 600,
      transaction: {
        message: {
          instructions: [{
            program: "system", programId: "111",
            parsed: { type: "transfer", info: { source: SENDER, destination: RECIPIENT, lamports: 10_000_000 } },
          }],
          accountKeys: [],
        },
      },
    });
    const v = createVerifier("https://rpc", RECIPIENT, "devnet");
    const r = await v.verify("sig6", "0.01");
    expect(r.valid).toBe(false);
    expect(r.error).toBe("Transaction too old");
  });

  it("rejects when transaction not found", async () => {
    mockSend.mockResolvedValue(null);
    const v = createVerifier("https://rpc", RECIPIENT, "devnet");
    const r = await v.verify("sig7", "0.01");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Transaction not found");
  }, 30_000); // verifier retries 5 times with backoff

  it("handles decimal amounts correctly (0.123456789 SOL)", async () => {
    mockSend.mockResolvedValue(mockSolTransferTx(123_456_789, RECIPIENT));
    const v = createVerifier("https://rpc", RECIPIENT, "devnet");
    const r = await v.verify("sig8", "0.123456789");
    expect(r.valid).toBe(true);
    expect(r.transferredRaw).toBe(123_456_789n);
  });
});

describe("Payment Verifier — Mainnet (USDC)", () => {
  beforeEach(() => { mockSend.mockReset(); });

  it("accepts valid USDC transferChecked", async () => {
    mockSend.mockResolvedValue(mockUsdcTransferTx("10000000", RECIPIENT, RECIPIENT_ATA));
    const v = createVerifier("https://rpc", RECIPIENT, "mainnet-beta");
    const r = await v.verify("usdc1", "10.00");
    expect(r.valid).toBe(true);
    expect(r.transferredRaw).toBe(10_000_000n);
  });

  it("rejects insufficient USDC", async () => {
    mockSend.mockResolvedValue(mockUsdcTransferTx("500000", RECIPIENT, RECIPIENT_ATA));
    const v = createVerifier("https://rpc", RECIPIENT, "mainnet-beta");
    const r = await v.verify("usdc2", "1.00");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Insufficient payment");
  });

  it("rejects when no spl-token instructions found", async () => {
    mockSend.mockResolvedValue({
      meta: { err: null, preTokenBalances: [], postTokenBalances: [], innerInstructions: [] },
      blockTime: Math.floor(Date.now() / 1000) - 10,
      transaction: {
        message: {
          instructions: [{
            program: "system", programId: "111",
            parsed: { type: "transfer", info: { lamports: 10000 } },
          }],
          accountKeys: [],
        },
      },
    });
    const v = createVerifier("https://rpc", RECIPIENT, "mainnet-beta");
    const r = await v.verify("usdc3", "1.00");
    expect(r.valid).toBe(false);
  });

  it("rejects when balance changed but no matching instruction (attack vector)", async () => {
    // Balance delta shows +1 USDC but no spl-token instruction → transferredRaw = min(delta, 0) = 0
    mockSend.mockResolvedValue({
      meta: {
        err: null,
        preTokenBalances: [
          { accountIndex: 1, mint: USDC_MINT, uiTokenAmount: { amount: "0", decimals: 6 }, owner: RECIPIENT },
        ],
        postTokenBalances: [
          { accountIndex: 1, mint: USDC_MINT, uiTokenAmount: { amount: "1000000", decimals: 6 }, owner: RECIPIENT },
        ],
        innerInstructions: [],
      },
      blockTime: Math.floor(Date.now() / 1000) - 10,
      transaction: {
        message: {
          instructions: [],
          accountKeys: [{ pubkey: SENDER }, { pubkey: RECIPIENT_ATA }],
        },
      },
    });
    const v = createVerifier("https://rpc", RECIPIENT, "mainnet-beta");
    const r = await v.verify("attack1", "1.00");
    expect(r.valid).toBe(false);
    // Verifier computes transferredRaw = min(balanceDelta=1M, instructionTotal=0) = 0
    // So it returns "Insufficient payment" — which still correctly rejects the attack
    expect(r.transferredRaw).toBe(0n);
  });
});

describe("Payment Verifier — network selection", () => {
  it("uses devnet verifier for devnet", () => {
    const v = createVerifier("https://rpc", RECIPIENT, "devnet");
    expect(v.network).toBe("devnet");
  });

  it("uses mainnet verifier by default", () => {
    const v = createVerifier("https://rpc", RECIPIENT);
    expect(v.network).toBe("mainnet-beta");
  });
});
