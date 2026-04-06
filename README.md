# Solobank Gateway

Solana-powered pay-per-call API proxy. Agents pay with on-chain USDC transactions, the gateway verifies and forwards requests to 51 upstream providers.

[![CI](https://github.com/solobank-ai/backend/actions/workflows/ci.yml/badge.svg)](https://github.com/solobank-ai/backend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Live at [mpp.solobank.lol](https://mpp.solobank.lol)

## How It Works

```
Agent                              Gateway                         Provider
  |                                  |                                |
  |-- POST /openai/v1/chat --------->|                                |
  |<--------- 402 + price ----------|                                |
  |                                  |                                |
  |-- pay USDC on Solana ----------->| (Helius RPC)                   |
  |                                  |                                |
  |-- POST + x-payment-signature --->|                                |
  |                                  |-- verify on-chain ------------>|
  |                                  |-- mark signature (Redis) ----->|
  |                                  |-- forward to provider -------->|
  |<--------- 200 + response -------|<--------- response ------------|
```

## Supported Providers (51)

**LLMs**: OpenAI, Anthropic, Gemini, Groq, DeepSeek, Mistral, Perplexity, Together AI, Cohere

**Media**: fal.ai, ElevenLabs, AssemblyAI, Replicate

**Search**: Brave Search, Exa, Serper, SerpApi, Firecrawl, Jina

**Data**: CoinGecko, Alpha Vantage, NewsAPI, OpenWeather, IPinfo

**Productivity**: Google Maps, Google Translate, DeepL, Resend, Hunter, PDFShift, ScreenshotOne

...and more.

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
| `SOLANA_RPC_URL` | No | Helius RPC endpoint |
| `REDIS_URL` | No | Redis connection (default: `redis://localhost:6379`) |
| `DATABASE_URL` | No | PostgreSQL connection |
| `OPENAI_API_KEY` | No | Enable OpenAI endpoints |
| `ANTHROPIC_API_KEY` | No | Enable Anthropic endpoints |

Add API keys for any provider you want to serve.

## API

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /status` | Detailed status (network, providers, DB) |
| `GET /services` | Available services and pricing |
| `POST /:service/*` | Proxied API call (requires MPP payment) |

### Payment Flow (MPP 402)

1. `POST /:service/endpoint` without payment -> `402` with price
2. Agent pays USDC on Solana (SOL on devnet)
3. Retry with `x-payment-signature: <tx-signature>` -> `200`
4. Same signature again -> `409 Conflict` (replay protection)

## Payment Verification

- **Mainnet**: USDC `transferChecked` instruction verification + balance delta cross-check
- **Devnet**: SOL system `transfer` instructions
- **Security**: Instruction-level parsing, TX age limit (5 min), atomic replay protection (Redis + PostgreSQL UNIQUE)

## Development

```bash
npm install
npm run dev             # Dev server with hot reload
npm run build           # Build TypeScript
npm run typecheck       # Type checking
npm test                # 57 unit tests
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

- **Server**: Hono
- **Blockchain**: `@solana/kit` (Helius RPC)
- **Database**: PostgreSQL (`postgres`)
- **Cache**: Redis (`ioredis`)
- **Validation**: Zod
- **Testing**: Vitest
- **Deploy**: Docker + Docker Compose, GitHub Actions CI/CD

## Related Repos

- [solobank-ai/package](https://github.com/solobank-ai/package) -- SDK + MCP + CLI monorepo
- [solobank-ai/mpp-solana](https://github.com/solobank-ai/mpp-solana) -- Solana MPP payment method
- [solobank-ai/solobank_frontend](https://github.com/solobank-ai/solobank_frontend) -- Website
- [solobank-ai/prices-tracker-bot](https://github.com/solobank-ai/prices-tracker-bot) -- Margin monitor

## License

MIT
