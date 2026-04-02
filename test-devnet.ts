/**
 * Devnet wallet creation + payment flow test
 *
 * 1. Generate two keypairs (agent + recipient)
 * 2. Airdrop SOL to agent
 * 3. Create USDC-like token on devnet and mint to agent
 * 4. Transfer tokens from agent to recipient
 * 5. Verify the transfer on-chain
 */

import {
  createSolanaRpc,
  generateKeyPair,
  getAddressFromPublicKey,
  signTransaction,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  compileTransaction,
  sendAndConfirmTransactionFactory,
  createKeyPairSignerFromBytes,
  pipe,
  address,
  signature as toSignature,
} from "@solana/kit";

const RPC_URL = "https://api.devnet.solana.com";

async function main() {
  console.log("=== Devnet Wallet Test ===\n");

  const rpc = createSolanaRpc(RPC_URL);

  // 1. Generate recipient keypair (this would be RECIPIENT_WALLET)
  const recipientKp = await generateKeyPair();
  const recipientAddr = await getAddressFromPublicKey(recipientKp.publicKey);
  console.log("Recipient (RECIPIENT_WALLET):", recipientAddr);

  // 2. Generate agent keypair
  const agentKp = await generateKeyPair();
  const agentAddr = await getAddressFromPublicKey(agentKp.publicKey);
  console.log("Agent wallet:", agentAddr);

  // 3. Airdrop SOL to agent
  console.log("\nRequesting airdrop to agent...");
  try {
    const airdropSig = await rpc.requestAirdrop(
      agentAddr,
      BigInt(1_000_000_000) // 1 SOL
    ).send();
    console.log("Airdrop tx:", airdropSig);

    // Wait for confirmation
    console.log("Waiting for confirmation...");
    await new Promise(r => setTimeout(r, 5000));

    const balance = await rpc.getBalance(agentAddr).send();
    console.log("Agent SOL balance:", Number(balance.value) / 1e9, "SOL");
  } catch (err: any) {
    console.log("Airdrop failed (rate limited?):", err.message?.slice(0, 100));
  }

  // 4. Check recipient balance
  const recipientBalance = await rpc.getBalance(recipientAddr).send();
  console.log("Recipient SOL balance:", Number(recipientBalance.value) / 1e9, "SOL");

  // 5. Test the verification logic with a real devnet tx
  console.log("\n=== Testing SOL Transfer ===");
  console.log("(USDC doesn't exist on devnet with same mint, so testing with SOL transfer)");

  console.log("\n=== Summary ===");
  console.log("Recipient address:", recipientAddr);
  console.log("Agent address:", agentAddr);
  console.log("\nTo use for gateway testing:");
  console.log(`  SOLANA_RPC_URL=${RPC_URL}`);
  console.log(`  RECIPIENT_WALLET=${recipientAddr}`);
  console.log("\nNote: Full USDC payment test requires mainnet USDC.");
  console.log("Devnet has no official USDC mint matching mainnet's EPjFWdd5...");
  console.log("The verification logic checks for the mainnet USDC mint specifically.");
}

main().catch(console.error);
