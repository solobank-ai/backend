import dotenv from "dotenv";
dotenv.config({ override: true });
import { z } from "zod";

const envSchema = z.object({
  SOLANA_RPC_URL: z.string().url().default("https://api.mainnet-beta.solana.com"),
  RECIPIENT_WALLET: z.string().min(32, "RECIPIENT_WALLET is required"),

  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),

  REDIS_URL: z.string().default("redis://localhost:6379"),
  DATABASE_URL: z.string().default("postgresql://localhost:5432/mpp_gateway"),

  PORT: z.coerce.number().default(3001),
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
