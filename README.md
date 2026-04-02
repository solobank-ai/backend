# MPP Gateway

Solana-powered pay-per-call API proxy. Agents pay with on-chain transactions, gateway verifies and forwards requests to upstream providers.

[![CI](https://github.com/decentrathon/backend/actions/workflows/ci.yml/badge.svg)](https://github.com/decentrathon/backend/actions/workflows/ci.yml)

## How It Works

```
Agent                              Gateway                         Provider
  |                                  |                                |
  |-- POST /openai/v1/chat --------->|                                |
  |<--------- 402 + challenge -------|                                |
  |                                  |                                |
  |-- pay on Solana (USDC/SOL) ----->| (devnet RPC)                   |
  |                                  |                                |
  |-- POST + x-payment-signature --->|                                |
  |                                  |-- verify on-chain ------------>|
  |                                  |-- mark signature (Redis) ----->|
  |                                  |-- forward to OpenAI ---------->|
  |<--------- 200 + response -------|<--------- response ------------|
  |                                  |                                |
  |-- POST (same sig) ------------->|                                |
  |<--------- 409 Conflict ---------|  (replay protection)           |
```

## Supported Providers

OpenAI, Anthropic, Gemini, Groq, DeepSeek, Mistral, Perplexity, Together AI, Cohere, fal.ai, ElevenLabs, AssemblyAI, Replicate, Firecrawl, Brave Search, Exa, Serper, SerpApi, NewsAPI, CoinGecko, Alpha Vantage, Google Maps, Google Translate, DeepL, OpenWeather, Hunter, IPinfo, Jina, Resend, PDFShift, ScreenshotOne, and more.

## Quick Start

```bash
cp .env.example .env   # Configure API keys and wallet
docker compose up -d    # Start gateway + PostgreSQL + Redis
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `RECIPIENT_WALLET` | Yes | Solana wallet to receive payments |
| `SOLANA_NETWORK` | No | `mainnet-beta` (default) or `devnet` |
| `SOLANA_RPC_URL` | No | Custom RPC endpoint |
| `REDIS_URL` | No | Redis connection (default: `redis://localhost:6379`) |
| `DATABASE_URL` | No | PostgreSQL connection |
| `OPENAI_API_KEY` | No | Enable OpenAI endpoints |
| `ANTHROPIC_API_KEY` | No | Enable Anthropic endpoints |
| ... | No | Add API keys for each provider |

## API

### Public

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /status` | Detailed status (network, providers, DB) |
| `GET /services` | Available services and pricing |
| `POST /:service/*` | Proxied API call (requires payment) |

### Payment Flow

1. `POST /:service/endpoint` without signature -> `402` with challenge
2. Pay on-chain (USDC on mainnet, SOL on devnet)
3. Retry with `x-payment-signature: <tx-signature>` -> `200`
4. Same signature again -> `409 Conflict`

## Payment Verification

- **Mainnet**: USDC spl-token `transferChecked` instructions + balance delta cross-check
- **Devnet**: SOL system `transfer` instructions
- **Security**: Instruction-level verification, TX age limit (5 min), atomic replay protection (Redis + PostgreSQL UNIQUE)

## Development

```bash
npm install
npm run typecheck   # Type checking
npm test            # 57 unit tests
npm run build       # Build TypeScript
npm run dev         # Dev server with hot reload
```

## Architecture

```
src/
  config/env.ts          # Environment validation (Zod)
  db/postgres.ts         # Transaction logging, stats
  db/redis.ts            # Atomic replay protection
  middleware/mpp.ts       # 402 challenge + payment verification
  verify/solana.ts        # On-chain transaction verification
  services/registry.ts    # Route resolution, service catalog
  routes/                 # Stats, payments admin endpoints
  index.ts               # Hono server, proxy logic
```

## Tech Stack

- `hono` — HTTP framework
- `@solana/kit` — Solana RPC and signature handling
- `postgres` — PostgreSQL client
- `ioredis` — Redis client
- `zod` — Environment validation
- `vitest` — Testing
- Docker + Docker Compose — Deployment

## License

MIT
