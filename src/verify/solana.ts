import { createSolanaRpc, signature as toSignature } from "@solana/kit";
import type { VerifyResult } from "../types/index.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const SOL_DECIMALS = 9;
const MAX_RETRIES = 10;
const RETRY_INTERVAL_MS = 200;
const MAX_TX_AGE_SECONDS = 300; // 5 minutes

function parseAmountToRaw(amount: string, decimals: number): bigint {
  const [whole = "0", fraction = ""] = amount.split(".");
  const padded = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + padded);
}

// ── Parsed instruction types ──

interface ParsedInstruction {
  program: string;
  programId: string;
  parsed?: {
    type: string;
    info: Record<string, any>;
  };
}

interface TokenBalance {
  accountIndex: number;
  mint: string;
  uiTokenAmount: { amount: string; decimals: number };
  owner?: string;
}

// ── Instruction-level verification (mainnet USDC) ──

interface UsdcTransferInfo {
  sender: string;
  destination: string;
  amount: bigint;
}

/**
 * Extract USDC transfer details from parsed instructions.
 * Checks for spl-token `transfer`, `transferChecked` instructions.
 */
function extractUsdcTransfers(
  instructions: ParsedInstruction[],
  innerInstructions: { index: number; instructions: ParsedInstruction[] }[],
  recipient: string,
  recipientAtas: Set<string>,
): UsdcTransferInfo[] {
  const transfers: UsdcTransferInfo[] = [];

  const allInstructions: ParsedInstruction[] = [
    ...instructions,
    ...innerInstructions.flatMap((inner) => inner.instructions),
  ];

  for (const ix of allInstructions) {
    if (ix.program !== "spl-token" || !ix.parsed) continue;

    const { type, info } = ix.parsed;

    if (type === "transfer" || type === "transferChecked") {
      const dest: string = info.destination ?? "";
      // destination is an ATA — check if it belongs to recipient
      if (recipientAtas.has(dest)) {
        const rawAmount =
          type === "transferChecked"
            ? BigInt(info.tokenAmount?.amount ?? "0")
            : BigInt(info.amount ?? "0");
        transfers.push({
          sender: info.source ?? info.authority ?? "unknown",
          destination: dest,
          amount: rawAmount,
        });
      }
    }
  }

  return transfers;
}

/**
 * Build a set of ATAs (Associated Token Accounts) owned by recipient for USDC.
 */
function getRecipientAtas(
  postTokenBalances: TokenBalance[],
  recipient: string,
): Set<string> {
  // postTokenBalances have accountIndex — we need to map them to actual addresses
  // But ATAs are identified by owner + mint in token balances
  // We collect accountIndexes where owner = recipient and mint = USDC
  const atas = new Set<string>();
  for (const bal of postTokenBalances) {
    if (bal.owner === recipient && bal.mint === USDC_MINT) {
      // The "account" at this index is the ATA
      atas.add(String(bal.accountIndex));
    }
  }
  return atas;
}

// ── Balance delta verification (fallback & cross-check) ──

function sumReceivedAmount(
  pre: TokenBalance[],
  post: TokenBalance[],
  recipient: string,
): bigint {
  let received = 0n;
  for (const postBal of post) {
    if (postBal.mint !== USDC_MINT || postBal.owner !== recipient) continue;
    const preBal = pre.find(
      (p) => p.accountIndex === postBal.accountIndex && p.mint === USDC_MINT,
    );
    const preAmount = BigInt(preBal?.uiTokenAmount.amount ?? "0");
    const postAmount = BigInt(postBal.uiTokenAmount.amount);
    const delta = postAmount - preAmount;
    if (delta > 0n) received += delta;
  }
  return received;
}

// ── Devnet SOL instruction verification ──

interface SolTransferInfo {
  sender: string;
  destination: string;
  lamports: bigint;
}

function extractSolTransfers(
  instructions: ParsedInstruction[],
  recipient: string,
): SolTransferInfo[] {
  const transfers: SolTransferInfo[] = [];
  for (const ix of instructions) {
    if (ix.program !== "system" || !ix.parsed) continue;
    if (ix.parsed.type !== "transfer") continue;
    const { info } = ix.parsed;
    if (info.destination === recipient) {
      transfers.push({
        sender: info.source ?? "unknown",
        destination: info.destination,
        lamports: BigInt(info.lamports ?? "0"),
      });
    }
  }
  return transfers;
}

// ── Main verifier ──

export type SolanaNetwork = "mainnet-beta" | "devnet";

export function createVerifier(
  rpcUrl: string,
  recipientAddress: string,
  network: SolanaNetwork = "mainnet-beta",
) {
  const rpc = createSolanaRpc(rpcUrl);
  const isDevnet = network === "devnet";

  async function waitForConfirmation(sig: string): Promise<boolean> {
    const txSignature = toSignature(sig);
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await rpc
          .getSignatureStatuses([txSignature])
          .send();
        const status = result.value?.[0];
        if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
          return true;
        }
      } catch {
        // RPC error, retry
      }
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
    }
    return false;
  }

  async function fetchTransaction(sig: string): Promise<any> {
    const txSignature = toSignature(sig);

    // Phase 1: fast poll with getSignatureStatuses (lightweight RPC call)
    const confirmed = await waitForConfirmation(sig);
    if (!confirmed) return null;

    // Phase 2: fetch full transaction (should succeed immediately after confirmation)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const tx = await rpc
          .getTransaction(txSignature, {
            commitment: "confirmed",
            encoding: "jsonParsed",
            maxSupportedTransactionVersion: 0,
          })
          .send();
        if (tx) return tx;
      } catch {
        // RPC error, retry
      }
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
    }

    return null;
  }

  function checkTxBasics(tx: any): string | null {
    if (tx.meta?.err) return "Transaction failed on-chain";
    if (tx.blockTime) {
      const age = Math.floor(Date.now() / 1000) - Number(tx.blockTime);
      if (age > MAX_TX_AGE_SECONDS) return "Transaction too old";
    }
    return null;
  }

  // ── Mainnet: USDC verification with instruction checks ──

  async function verifyMainnet(sig: string, expectedAmountUsd: string): Promise<VerifyResult> {
    const expectedRaw = parseAmountToRaw(expectedAmountUsd, USDC_DECIMALS);
    const tx = await fetchTransaction(sig);

    if (!tx) {
      return { valid: false, error: "Transaction not found after retries", transferredRaw: 0n };
    }

    const basicError = checkTxBasics(tx);
    if (basicError) return { valid: false, error: basicError, transferredRaw: 0n };

    const pre: TokenBalance[] = tx.meta?.preTokenBalances ?? [];
    const post: TokenBalance[] = tx.meta?.postTokenBalances ?? [];
    const instructions: ParsedInstruction[] =
      tx.transaction?.message?.instructions ?? [];
    const innerInstructions: { index: number; instructions: ParsedInstruction[] }[] =
      tx.meta?.innerInstructions ?? [];

    // 1. Balance delta check (robust, catches all transfer types)
    const balanceDelta = sumReceivedAmount(pre, post, recipientAddress);

    // 2. Instruction-level check (verifies actual spl-token transfer)
    const recipientAtas = getRecipientAtas(post, recipientAddress);
    // Also need to map accountIndex → address for ATA matching in instructions
    const accountKeys: { pubkey: string }[] =
      tx.transaction?.message?.accountKeys ?? [];

    // Build a set of actual ATA addresses owned by recipient
    const ataAddresses = new Set<string>();
    for (const bal of post) {
      if (bal.owner === recipientAddress && bal.mint === USDC_MINT) {
        const addr = accountKeys[bal.accountIndex];
        if (addr) ataAddresses.add(String(addr.pubkey ?? addr));
      }
    }

    const usdcTransfers = extractUsdcTransfers(
      instructions,
      innerInstructions,
      recipientAddress,
      ataAddresses,
    );

    const instructionTotal = usdcTransfers.reduce((sum, t) => sum + t.amount, 0n);
    const senderAddress = usdcTransfers[0]?.sender;

    // Both checks must agree: balance delta and instruction total
    const transferredRaw = balanceDelta < instructionTotal ? balanceDelta : instructionTotal;

    if (transferredRaw < expectedRaw) {
      return {
        valid: false,
        error: `Insufficient payment: received ${transferredRaw}, expected ${expectedRaw}`,
        transferredRaw,
        senderAddress,
      };
    }

    // Extra safety: if instructions show 0 but balance changed, something fishy
    if (instructionTotal === 0n && balanceDelta > 0n) {
      return {
        valid: false,
        error: "Balance changed without a valid spl-token transfer instruction",
        transferredRaw: 0n,
        senderAddress,
      };
    }

    return { valid: true, transferredRaw, senderAddress };
  }

  // ── Devnet: SOL verification with instruction checks ──

  async function verifyDevnet(sig: string, expectedAmount: string): Promise<VerifyResult> {
    const expectedLamports = parseAmountToRaw(expectedAmount, SOL_DECIMALS);
    const tx = await fetchTransaction(sig);

    if (!tx) {
      return { valid: false, error: "Transaction not found after retries", transferredRaw: 0n };
    }

    const basicError = checkTxBasics(tx);
    if (basicError) return { valid: false, error: basicError, transferredRaw: 0n };

    const instructions: ParsedInstruction[] =
      tx.transaction?.message?.instructions ?? [];

    // Instruction-level check: find system transfer to recipient
    const solTransfers = extractSolTransfers(instructions, recipientAddress);

    if (solTransfers.length === 0) {
      return {
        valid: false,
        error: "No SOL transfer to recipient found in transaction instructions",
        transferredRaw: 0n,
      };
    }

    const totalLamports = solTransfers.reduce((sum, t) => sum + t.lamports, 0n);
    const senderAddress = solTransfers[0]?.sender;

    if (totalLamports < expectedLamports) {
      return {
        valid: false,
        error: `Insufficient payment: received ${totalLamports} lamports, expected ${expectedLamports}`,
        transferredRaw: totalLamports,
        senderAddress,
      };
    }

    return { valid: true, transferredRaw: totalLamports, senderAddress };
  }

  return {
    verify: isDevnet ? verifyDevnet : verifyMainnet,
    network,
  };
}
