import { createSolanaRpc, type Signature, signature as toSignature, address } from "@solana/kit";
import type { VerifyResult } from "../types/index.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const MAX_RETRIES = 5;
const MAX_TX_AGE_SECONDS = 300; // 5 minutes

function parseAmountToRaw(amount: string): bigint {
  const [whole = "0", fraction = ""] = amount.split(".");
  const padded = fraction.padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
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
  recipient: string
): bigint {
  let received = 0n;

  for (const postBal of post) {
    if (postBal.mint !== USDC_MINT || postBal.owner !== recipient) continue;

    const preBal = pre.find(
      (p) => p.accountIndex === postBal.accountIndex && p.mint === USDC_MINT
    );
    const preAmount = BigInt(preBal?.uiTokenAmount.amount ?? "0");
    const postAmount = BigInt(postBal.uiTokenAmount.amount);
    const delta = postAmount - preAmount;

    if (delta > 0n) received += delta;
  }

  return received;
}

export function createVerifier(rpcUrl: string, recipientAddress: string) {
  const rpc = createSolanaRpc(rpcUrl);

  async function verify(sig: string, expectedAmountUsd: string): Promise<VerifyResult> {
    const txSignature = toSignature(sig);
    const expectedRaw = parseAmountToRaw(expectedAmountUsd);

    // Retry loop — tx may not be confirmed yet
    let tx: any = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await rpc
          .getTransaction(txSignature, {
            commitment: "confirmed",
            encoding: "jsonParsed",
            maxSupportedTransactionVersion: 0,
          })
          .send();
        tx = result;
      } catch {
        // RPC error, retry
      }

      if (tx) break;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }

    if (!tx) {
      return { valid: false, error: "Transaction not found after retries", transferredRaw: 0n };
    }

    // Check tx didn't fail
    if (tx.meta?.err) {
      return { valid: false, error: "Transaction failed on-chain", transferredRaw: 0n };
    }

    // Check tx age
    if (tx.blockTime) {
      const age = Math.floor(Date.now() / 1000) - Number(tx.blockTime);
      if (age > MAX_TX_AGE_SECONDS) {
        return { valid: false, error: "Transaction too old", transferredRaw: 0n };
      }
    }

    // Compute USDC received by recipient
    const pre: TokenBalance[] = tx.meta?.preTokenBalances ?? [];
    const post: TokenBalance[] = tx.meta?.postTokenBalances ?? [];
    const transferredRaw = sumReceivedAmount(pre, post, recipientAddress);

    if (transferredRaw < expectedRaw) {
      return {
        valid: false,
        error: `Insufficient payment: received ${transferredRaw}, expected ${expectedRaw}`,
        transferredRaw,
      };
    }

    return { valid: true, transferredRaw };
  }

  return { verify };
}
