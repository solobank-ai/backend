import { createSolanaRpc, signature as toSignature } from "@solana/kit";
import type { VerifyResult } from "../types/index.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const SOL_DECIMALS = 9;
const MAX_RETRIES = 5;
const MAX_TX_AGE_SECONDS = 300; // 5 minutes

function parseAmountToRaw(amount: string, decimals: number): bigint {
  const [whole = "0", fraction = ""] = amount.split(".");
  const padded = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + padded);
}

interface TokenBalance {
  accountIndex: number;
  mint: string;
  uiTokenAmount: {
    amount: string;
    decimals: number;
  };
  owner?: string;
}

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

function extractSenderFromTokenBalances(
  pre: TokenBalance[],
  post: TokenBalance[],
): string | undefined {
  for (const preBal of pre) {
    if (preBal.mint !== USDC_MINT) continue;
    const postBal = post.find(
      (p) => p.accountIndex === preBal.accountIndex && p.mint === USDC_MINT,
    );
    const preAmount = BigInt(preBal.uiTokenAmount.amount);
    const postAmount = BigInt(postBal?.uiTokenAmount.amount ?? "0");
    if (postAmount < preAmount && preBal.owner) {
      return preBal.owner;
    }
  }
  return undefined;
}

export type SolanaNetwork = "mainnet-beta" | "devnet";

export function createVerifier(
  rpcUrl: string,
  recipientAddress: string,
  network: SolanaNetwork = "mainnet-beta",
) {
  const rpc = createSolanaRpc(rpcUrl);
  const isDevnet = network === "devnet";

  async function fetchTransaction(sig: string): Promise<any> {
    const txSignature = toSignature(sig);
    let tx: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        tx = await rpc
          .getTransaction(txSignature, {
            commitment: "confirmed",
            encoding: "jsonParsed",
            maxSupportedTransactionVersion: 0,
          })
          .send();
      } catch {
        // RPC error, retry
      }
      if (tx) break;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }

    return tx;
  }

  function checkTxAge(tx: any): string | null {
    if (tx.blockTime) {
      const age = Math.floor(Date.now() / 1000) - Number(tx.blockTime);
      if (age > MAX_TX_AGE_SECONDS) return "Transaction too old";
    }
    return null;
  }

  async function verifyMainnet(sig: string, expectedAmountUsd: string): Promise<VerifyResult> {
    const expectedRaw = parseAmountToRaw(expectedAmountUsd, USDC_DECIMALS);
    const tx = await fetchTransaction(sig);

    if (!tx) {
      return { valid: false, error: "Transaction not found after retries", transferredRaw: 0n };
    }
    if (tx.meta?.err) {
      return { valid: false, error: "Transaction failed on-chain", transferredRaw: 0n };
    }

    const ageError = checkTxAge(tx);
    if (ageError) return { valid: false, error: ageError, transferredRaw: 0n };

    const pre: TokenBalance[] = tx.meta?.preTokenBalances ?? [];
    const post: TokenBalance[] = tx.meta?.postTokenBalances ?? [];
    const transferredRaw = sumReceivedAmount(pre, post, recipientAddress);
    const senderAddress = extractSenderFromTokenBalances(pre, post);

    if (transferredRaw < expectedRaw) {
      return {
        valid: false,
        error: `Insufficient payment: received ${transferredRaw}, expected ${expectedRaw}`,
        transferredRaw,
        senderAddress,
      };
    }

    return { valid: true, transferredRaw, senderAddress };
  }

  async function verifyDevnet(sig: string, expectedAmount: string): Promise<VerifyResult> {
    const expectedLamports = parseAmountToRaw(expectedAmount, SOL_DECIMALS);
    const tx = await fetchTransaction(sig);

    if (!tx) {
      return { valid: false, error: "Transaction not found after retries", transferredRaw: 0n };
    }
    if (tx.meta?.err) {
      return { valid: false, error: "Transaction failed on-chain", transferredRaw: 0n };
    }

    const ageError = checkTxAge(tx);
    if (ageError) return { valid: false, error: ageError, transferredRaw: 0n };

    // Find recipient in account keys and check SOL lamport delta
    const accountKeys: { pubkey: string }[] =
      tx.transaction?.message?.accountKeys ?? [];
    const preBalances: number[] = tx.meta?.preBalances ?? [];
    const postBalances: number[] = tx.meta?.postBalances ?? [];

    let recipientIndex = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      if (String(accountKeys[i].pubkey ?? accountKeys[i]) === recipientAddress) {
        recipientIndex = i;
        break;
      }
    }

    if (recipientIndex === -1) {
      return { valid: false, error: "Recipient not found in transaction accounts", transferredRaw: 0n };
    }

    const preLamports = BigInt(preBalances[recipientIndex] ?? 0);
    const postLamports = BigInt(postBalances[recipientIndex] ?? 0);
    const receivedLamports = postLamports - preLamports;

    // Extract sender: first account that lost SOL (excluding fee payer logic — simplest heuristic)
    let senderAddress: string | undefined;
    for (let i = 0; i < accountKeys.length; i++) {
      if (i === recipientIndex) continue;
      const delta = BigInt(postBalances[i] ?? 0) - BigInt(preBalances[i] ?? 0);
      if (delta < 0n) {
        senderAddress = String(accountKeys[i].pubkey ?? accountKeys[i]);
        break;
      }
    }

    if (receivedLamports < expectedLamports) {
      return {
        valid: false,
        error: `Insufficient payment: received ${receivedLamports} lamports, expected ${expectedLamports}`,
        transferredRaw: receivedLamports > 0n ? receivedLamports : 0n,
        senderAddress,
      };
    }

    return { valid: true, transferredRaw: receivedLamports, senderAddress };
  }

  return {
    verify: isDevnet ? verifyDevnet : verifyMainnet,
    network,
  };
}
