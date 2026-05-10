import dotenv from "dotenv";
dotenv.config({ override: false });

import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const envSchema = z.object({
  // Solana
  SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  SOLANA_NETWORK: z.enum(["mainnet-beta", "devnet"]).default("devnet"),
  RECIPIENT_WALLET: z.string().min(32, "RECIPIENT_WALLET is required"),

  // API Keys (optional — only needed for enabled services)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),
  FAL_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),
  SERPAPI_API_KEY: z.string().optional(),
  NEWSAPI_API_KEY: z.string().optional(),
  ALPHAVANTAGE_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  GOOGLE_TRANSLATE_API_KEY: z.string().optional(),
  DEEPL_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ASSEMBLYAI_API_KEY: z.string().optional(),
  RAPIDAPI_KEY: z.string().optional(),
  HUNTER_API_KEY: z.string().optional(),
  IPINFO_API_KEY: z.string().optional(),
  JINA_API_KEY: z.string().optional(),
  REPLICATE_API_KEY: z.string().optional(),
  SCREENSHOTONE_API_KEY: z.string().optional(),
  PDFSHIFT_API_KEY: z.string().optional(),
  PUSHOVER_API_KEY: z.string().optional(),

  // Anthropic version
  ANTHROPIC_VERSION: z.string().default("2023-06-01"),

  // Data stores
  REDIS_URL: z.string().default("redis://localhost:6379"),
  DATABASE_URL: z.string().default("postgresql://localhost:5432/mpp_gateway"),

  // Server
  PORT: z.coerce.number().default(3001),
  ALLOWED_ORIGINS: z.string().optional(),
  MAX_BODY_SIZE_MB: z.coerce.number().default(10),
  ADMIN_TOKEN: isProd
    ? z.string().min(32, "ADMIN_TOKEN must be at least 32 chars in production")
    : z.string().min(32).optional(),
  REDIS_PASSWORD: z.string().optional(),
  RATE_LIMIT_RPM: z.coerce.number().default(60),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
