/**
 * Price Monitor — checks upstream API pricing pages and alerts via Telegram
 * Run daily via cron: 0 9 * * * cd ~/backend && node dist/price-monitor.js
 */

const TG_BOT_TOKEN = "8506414388:AAFp13JYjiTftafbBFCn0GrjFw2wmRQ3i0U";
const TG_CHAT_ID = "1070192110";

interface PriceCheck {
  service: string;
  endpoint: string;
  ourPrice: number;
  upstreamCost: number;
}

// Known upstream costs (updated manually or via API)
const UPSTREAM_COSTS: PriceCheck[] = [
  // LLMs (per ~500 input + 200 output tokens)
  { service: "OpenAI GPT-4o", endpoint: "/v1/chat/completions", ourPrice: 0.01, upstreamCost: 0.00325 },
  { service: "Anthropic Claude Sonnet", endpoint: "/v1/messages", ourPrice: 0.01, upstreamCost: 0.0045 },
  { service: "Gemini 2.5 Flash", endpoint: "/v1beta/models/gemini-2.5-flash", ourPrice: 0.005, upstreamCost: 0.00065 },
  { service: "Gemini 2.5 Pro", endpoint: "/v1beta/models/gemini-2.5-pro", ourPrice: 0.02, upstreamCost: 0.002625 },
  { service: "DeepSeek", endpoint: "/v1/chat/completions", ourPrice: 0.005, upstreamCost: 0.00025 },
  { service: "Groq", endpoint: "/v1/chat/completions", ourPrice: 0.005, upstreamCost: 0.00045 },
  { service: "Mistral", endpoint: "/v1/chat/completions", ourPrice: 0.005, upstreamCost: 0.00022 },
  { service: "Perplexity", endpoint: "/v1/chat/completions", ourPrice: 0.01, upstreamCost: 0.0057 },
  { service: "Together AI", endpoint: "/v1/chat/completions", ourPrice: 0.005, upstreamCost: 0.0003 },
  { service: "OpenRouter", endpoint: "/v1/chat/completions", ourPrice: 0.01, upstreamCost: 0.003 },
  { service: "AI21", endpoint: "/v1/chat/completions", ourPrice: 0.01, upstreamCost: 0.002 },

  // Images
  { service: "OpenAI DALL-E 3", endpoint: "/v1/images/generations", ourPrice: 0.05, upstreamCost: 0.04 },
  { service: "Stability SD3", endpoint: "/v1/generate/sd3", ourPrice: 0.08, upstreamCost: 0.065 },
  { service: "Stability Ultra", endpoint: "/v1/generate/ultra", ourPrice: 0.10, upstreamCost: 0.08 },
  { service: "fal.ai Flux Dev", endpoint: "/fal-ai/flux/dev", ourPrice: 0.03, upstreamCost: 0.012 },
  { service: "fal.ai Flux Pro", endpoint: "/fal-ai/flux-pro", ourPrice: 0.05, upstreamCost: 0.03 },

  // Audio
  { service: "ElevenLabs TTS", endpoint: "/v1/text-to-speech", ourPrice: 0.08, upstreamCost: 0.06 },
  { service: "ElevenLabs Sound", endpoint: "/v1/sound-generation", ourPrice: 0.08, upstreamCost: 0.06 },
  { service: "OpenAI Whisper", endpoint: "/v1/audio/transcriptions", ourPrice: 0.01, upstreamCost: 0.006 },
  { service: "OpenAI TTS", endpoint: "/v1/audio/speech", ourPrice: 0.02, upstreamCost: 0.015 },
  { service: "AssemblyAI", endpoint: "/v1/transcribe", ourPrice: 0.02, upstreamCost: 0.0025 },

  // Search
  { service: "Brave Search", endpoint: "/v1/web/search", ourPrice: 0.005, upstreamCost: 0.005 },
  { service: "Perplexity Sonar", endpoint: "/v1/chat/completions", ourPrice: 0.01, upstreamCost: 0.0057 },

  // Translation
  { service: "DeepL", endpoint: "/v1/translate", ourPrice: 0.03, upstreamCost: 0.025 },

  // Data (free upstream)
  { service: "CoinGecko", endpoint: "/v1/price", ourPrice: 0.005, upstreamCost: 0 },
  { service: "OpenWeather", endpoint: "/v1/weather", ourPrice: 0.005, upstreamCost: 0 },

  // Web
  { service: "Firecrawl", endpoint: "/v1/scrape", ourPrice: 0.01, upstreamCost: 0.0053 },
  { service: "NewsAPI", endpoint: "/v1/headlines", ourPrice: 0.02, upstreamCost: 0.015 },

  // Communication
  { service: "Twilio SMS", endpoint: "/v1/messages", ourPrice: 0.02, upstreamCost: 0.0083 },
  { service: "SendGrid", endpoint: "/v1/mail/send", ourPrice: 0.005, upstreamCost: 0.001 },
];

async function sendTelegram(text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "HTML" }),
  });
}

async function checkPrices(): Promise<void> {
  const alerts: string[] = [];
  const losses: string[] = [];

  for (const check of UPSTREAM_COSTS) {
    const margin = check.ourPrice - check.upstreamCost;
    const marginPct = check.upstreamCost > 0 ? ((margin / check.ourPrice) * 100).toFixed(0) : "100";

    if (margin < 0) {
      losses.push(
        `LOSS ${check.service}: $${check.ourPrice} < $${check.upstreamCost} (margin: -$${(-margin).toFixed(4)})`,
      );
    } else if (margin < 0.002 && check.upstreamCost > 0) {
      alerts.push(
        `LOW ${check.service}: margin $${margin.toFixed(4)} (${marginPct}%)`,
      );
    }
  }

  if (losses.length > 0 || alerts.length > 0) {
    let msg = "<b>Solobank Price Alert</b>\n\n";
    if (losses.length > 0) {
      msg += "<b>LOSING MONEY:</b>\n" + losses.map((l) => `- ${l}`).join("\n") + "\n\n";
    }
    if (alerts.length > 0) {
      msg += "<b>Low margin:</b>\n" + alerts.map((a) => `- ${a}`).join("\n");
    }
    await sendTelegram(msg);
  } else {
    const total = UPSTREAM_COSTS.reduce((s, c) => s + (c.ourPrice - c.upstreamCost), 0);
    await sendTelegram(
      `<b>Solobank Price Check</b>\nAll ${UPSTREAM_COSTS.length} endpoints profitable.\nTotal margin per full sweep: $${total.toFixed(4)}`,
    );
  }
}

checkPrices().catch(console.error);
