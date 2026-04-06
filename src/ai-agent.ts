/**
 * Solobank AI Decision Agent
 *
 * Uses OpenAI GPT-4o-mini to analyze DeFi market conditions
 * and produce investment decisions that get recorded on-chain.
 *
 * Flow:
 * 1. Fetch current lending rates from Kamino + Marginfi
 * 2. Send data to GPT-4o-mini for analysis
 * 3. AI returns structured decision (lend/swap/rebalance/withdraw)
 * 4. Decision is recorded on Solana via smart contract
 *
 * Model choice: GPT-4o-mini
 * - Fast (~200ms response)
 * - Cheap ($0.15/1M input tokens)
 * - Sufficient for numeric analysis (compare APYs, assess risk)
 * - Structured output (JSON mode) for reliable parsing
 */

interface DeFiRate {
  protocol: string;
  asset: string;
  apy: number;
  apr: number;
  market: string;
}

interface AiDecision {
  action: "lend" | "swap" | "rebalance" | "withdraw" | "hold";
  asset: string;
  amount: number;
  protocol?: string;
  reasoning: string;
  confidence: number; // 0-100
  riskLevel: "low" | "medium" | "high";
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are Solobank AI — an autonomous DeFi investment agent on Solana.
You analyze lending rates, market conditions, and portfolio state to make optimal decisions.

You must respond with a JSON object (no markdown, no explanation outside JSON):
{
  "action": "lend" | "swap" | "rebalance" | "withdraw" | "hold",
  "asset": "USDC" | "SOL",
  "amount": <number in USD>,
  "protocol": "kamino" | "marginfi" | null,
  "reasoning": "<1-2 sentence explanation>",
  "confidence": <0-100>,
  "riskLevel": "low" | "medium" | "high"
}

Rules:
- Prefer higher APY when risk is similar
- If APY difference < 0.5%, recommend "hold" (not worth gas)
- If no rates available, recommend "hold"
- Never recommend more than the available balance
- Be conservative: confidence < 70 means "hold"`;

export async function analyzeMarket(
  rates: DeFiRate[],
  currentBalance: number,
  currentPositions: string[],
): Promise<AiDecision> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const userPrompt = `Current DeFi rates:
${rates.map((r) => `- ${r.protocol} ${r.asset}: ${r.apy.toFixed(2)}% APY (market: ${r.market})`).join("\n")}

Portfolio:
- Available balance: $${currentBalance.toFixed(2)} USDC
- Current positions: ${currentPositions.length > 0 ? currentPositions.join(", ") : "none"}

What should I do?`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1, // Low temp for consistent financial decisions
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");

  const decision: AiDecision = JSON.parse(content);

  console.log(
    `[ai-agent] Decision: ${decision.action} ${decision.amount} ${decision.asset}` +
      ` via ${decision.protocol ?? "none"} (confidence: ${decision.confidence}%, risk: ${decision.riskLevel})` +
      ` | Tokens: ${data.usage.total_tokens} ($${((data.usage.prompt_tokens * 0.15 + data.usage.completion_tokens * 0.6) / 1_000_000).toFixed(6)})`,
  );

  return decision;
}

/**
 * Hash reasoning text to 32 bytes for on-chain storage.
 * The full reasoning is stored off-chain; only the hash goes on-chain.
 */
export function hashReasoning(reasoning: string): Uint8Array {
  const encoder = new TextEncoder();
  const data = encoder.encode(reasoning);
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return new Uint8Array(createHash("sha256").update(data).digest());
}

// ── Test/demo function ──

export async function runDemoDecision(): Promise<AiDecision> {
  const mockRates: DeFiRate[] = [
    { protocol: "kamino", asset: "USDC", apy: 8.21, apr: 7.89, market: "main" },
    { protocol: "marginfi", asset: "USDC", apy: 7.05, apr: 6.81, market: "main" },
    { protocol: "kamino", asset: "SOL", apy: 5.12, apr: 4.95, market: "main" },
    { protocol: "marginfi", asset: "SOL", apy: 4.88, apr: 4.71, market: "main" },
  ];

  return analyzeMarket(mockRates, 100, []);
}
