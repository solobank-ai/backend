import type { GatewayRouteConfig, ResolvedGatewayRoute, ServiceMeta, EndpointDefinition } from "../types/index.js";

import { USDC_MINT } from "../constants.js";

// ── Service metadata ──

const serviceMeta: ServiceMeta[] = [
  { id: "alphavantage", name: "Alpha Vantage", description: "Stock quotes, symbol search, and daily OHLCV.", categories: ["finance", "market-data"] },
  { id: "anthropic", name: "Anthropic", description: "Claude messages behind Solana x402.", categories: ["ai", "llm"] },
  { id: "assemblyai", name: "AssemblyAI", description: "Speech transcription and transcript lookup.", categories: ["ai", "audio"] },
  { id: "brave", name: "Brave Search", description: "Web, image, news, video, and summarizer search.", categories: ["search", "web"] },
  { id: "cohere", name: "Cohere", description: "Chat, embeddings, and reranking.", categories: ["ai", "llm"] },
  { id: "coingecko", name: "CoinGecko", description: "Crypto prices, markets, and trending assets.", categories: ["crypto", "market-data"] },
  { id: "deepl", name: "DeepL", description: "High-quality translation.", categories: ["translation", "nlp"] },
  { id: "deepseek", name: "DeepSeek", description: "DeepSeek chat completions.", categories: ["ai", "llm"] },
  { id: "elevenlabs", name: "ElevenLabs", description: "Speech and sound generation.", categories: ["ai", "audio"] },
  { id: "exa", name: "Exa", description: "Search and content retrieval APIs.", categories: ["search", "web"] },
  { id: "fal", name: "fal.ai", description: "Hosted generative media models.", categories: ["ai", "image", "audio"] },
  { id: "firecrawl", name: "Firecrawl", description: "Scrape, crawl, map, and extract web data.", categories: ["web", "data"] },
  { id: "gemini", name: "Google Gemini", description: "Gemini generation and embeddings.", categories: ["ai", "llm"] },
  { id: "googlemaps", name: "Google Maps", description: "Geocoding, search, and directions.", categories: ["maps", "data"] },
  { id: "groq", name: "Groq", description: "Fast chat and transcription APIs.", categories: ["ai", "llm"] },
  { id: "hunter", name: "Hunter", description: "Email/domain discovery and verification.", categories: ["sales", "data"] },
  { id: "ipinfo", name: "IPinfo", description: "IP intelligence lookup.", categories: ["network", "data"] },
  { id: "jina", name: "Jina AI", description: "Reader endpoints for web content.", categories: ["web", "ai"] },
  { id: "judge0", name: "Judge0", description: "Code execution and language listing.", categories: ["compute", "code"] },
  { id: "mistral", name: "Mistral", description: "Chat completions and embeddings.", categories: ["ai", "llm"] },
  { id: "newsapi", name: "NewsAPI", description: "Headlines and article search.", categories: ["news", "search"] },
  { id: "openai", name: "OpenAI", description: "Chat, embeddings, images, and audio.", categories: ["ai", "llm"] },
  { id: "openweather", name: "OpenWeather", description: "Current weather and forecasts.", categories: ["weather", "data"] },
  { id: "pdfshift", name: "PDFShift", description: "HTML-to-PDF conversion.", categories: ["documents", "rendering"] },
  { id: "perplexity", name: "Perplexity", description: "Web-grounded chat completions.", categories: ["ai", "search"] },
  { id: "replicate", name: "Replicate", description: "Prediction creation and status lookup.", categories: ["ai", "media"] },
  { id: "resend", name: "Resend", description: "Email send and batch send.", categories: ["communication", "email"] },
  { id: "screenshot", name: "ScreenshotOne", description: "Screenshot capture API.", categories: ["web", "media"] },
  { id: "serpapi", name: "SerpApi", description: "Search, locations, and flights.", categories: ["search", "travel"] },
  { id: "serper", name: "Serper", description: "Google search and image search.", categories: ["search"] },
  { id: "together", name: "Together AI", description: "Chat, embeddings, and image generation.", categories: ["ai", "llm"] },
  { id: "translate", name: "Google Translate", description: "Translation and language detection.", categories: ["translation", "nlp"] },
  { id: "stability", name: "Stability AI", description: "Image generation with Stable Diffusion models.", categories: ["ai", "image"] },
  { id: "huggingface", name: "Hugging Face", description: "Serverless inference for thousands of models.", categories: ["ai", "llm"] },
  { id: "ai21", name: "AI21 Labs", description: "Jamba chat completions and summarization.", categories: ["ai", "llm"] },
  { id: "runway", name: "Runway", description: "AI video generation from text and images.", categories: ["ai", "media"] },
  { id: "twilio", name: "Twilio", description: "SMS messaging.", categories: ["communication"] },
  { id: "sendgrid", name: "SendGrid", description: "Transactional email delivery.", categories: ["communication", "email"] },
  { id: "birdeye", name: "Birdeye", description: "Solana DeFi token prices, OHLCV, and trades.", categories: ["crypto", "market-data"] },
  { id: "dexscreener", name: "DexScreener", description: "DEX pair and token data across chains.", categories: ["crypto", "market-data"] },
  { id: "helius", name: "Helius", description: "Solana enhanced transactions and DAS API.", categories: ["crypto", "data"] },
  { id: "jupiter", name: "Jupiter", description: "Solana token pricing and swap quotes.", categories: ["crypto", "market-data"] },
  { id: "notion", name: "Notion", description: "Query and create pages in Notion.", categories: ["data"] },
  { id: "linear", name: "Linear", description: "Issue tracking via GraphQL API.", categories: ["data", "code"] },
  { id: "airtable", name: "Airtable", description: "Read and write Airtable records.", categories: ["data"] },
  { id: "clearbit", name: "Clearbit", description: "Person and company data enrichment.", categories: ["sales", "data"] },
  { id: "wolfram", name: "Wolfram Alpha", description: "Computational knowledge and math.", categories: ["data", "compute"] },
  { id: "polygon", name: "Polygon.io", description: "Real-time stock and crypto market data.", categories: ["finance", "market-data"] },
  { id: "openrouter", name: "OpenRouter", description: "Unified access to 100+ LLMs.", categories: ["ai", "llm"] },
  { id: "crunchbase", name: "Crunchbase", description: "Startup and company funding data.", categories: ["data", "finance"] },
  { id: "tavily", name: "Tavily", description: "AI-optimized web search for agents.", categories: ["search", "ai"] },
  { id: "pinecone", name: "Pinecone", description: "Vector database for embeddings.", categories: ["ai", "data"] },
];

// ── Enabled services (expand as you add API keys) ──

export const enabledServiceIds = new Set([
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "groq",
  "cohere",
  "mistral",
  "perplexity",
  "together",
  "fal",
  "firecrawl",
  "brave",
  "exa",
  "serper",
  "serpapi",
  "newsapi",
  "alphavantage",
  "coingecko",
  "openweather",
  "googlemaps",
  "translate",
  "deepl",
  "resend",
  "elevenlabs",
  "assemblyai",
  "judge0",
  "hunter",
  "ipinfo",
  "jina",
  "replicate",
  "screenshot",
  "pdfshift",
  "stability",
  "huggingface",
  "ai21",
  "runway",
  "twilio",
  "sendgrid",
  "birdeye",
  "dexscreener",
  "helius",
  "jupiter",
  "notion",
  "linear",
  "airtable",
  "clearbit",
  "wolfram",
  "polygon",
  "openrouter",
  "crunchbase",
  "tavily",
  "pinecone",
]);

// ── Helpers ──

function bearer(envName: string) {
  const key = process.env[envName];
  if (!key) throw new Error(`Missing API key: ${envName}`);
  return `Bearer ${key}`;
}

const jsonAccept = { accept: "application/json" };

export function getMissingRequiredEnv(route: GatewayRouteConfig) {
  return (route.requiredEnv ?? []).filter((name) => {
    const value = process.env[name];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export function isRouteConfigured(route: GatewayRouteConfig) {
  return getMissingRequiredEnv(route).length === 0;
}

// ── All gateway routes ──

const allGatewayRoutes: GatewayRouteConfig[] = [
  // OpenAI
  { service: "openai", path: "/v1/chat/completions", description: "Chat completions", price: "0.01", requiredEnv: ["OPENAI_API_KEY"], resolveUpstream: () => "https://api.openai.com/v1/chat/completions", resolveHeaders: () => ({ authorization: bearer("OPENAI_API_KEY") }) },
  { service: "openai", path: "/v1/embeddings", description: "Create embeddings", price: "0.001", requiredEnv: ["OPENAI_API_KEY"], resolveUpstream: () => "https://api.openai.com/v1/embeddings", resolveHeaders: () => ({ authorization: bearer("OPENAI_API_KEY") }) },
  { service: "openai", path: "/v1/images/generations", description: "Generate images", price: "0.05", requiredEnv: ["OPENAI_API_KEY"], resolveUpstream: () => "https://api.openai.com/v1/images/generations", resolveHeaders: () => ({ authorization: bearer("OPENAI_API_KEY") }) },
  { service: "openai", path: "/v1/audio/transcriptions", description: "Transcribe audio", price: "0.01", requiredEnv: ["OPENAI_API_KEY"], resolveUpstream: () => "https://api.openai.com/v1/audio/transcriptions", resolveHeaders: () => ({ authorization: bearer("OPENAI_API_KEY") }) },
  { service: "openai", path: "/v1/audio/speech", description: "Generate speech", price: "0.02", requiredEnv: ["OPENAI_API_KEY"], resolveUpstream: () => "https://api.openai.com/v1/audio/speech", resolveHeaders: () => ({ authorization: bearer("OPENAI_API_KEY") }) },

  // Anthropic
  { service: "anthropic", path: "/v1/messages", description: "Claude messages", price: "0.01", requiredEnv: ["ANTHROPIC_API_KEY"], resolveUpstream: () => "https://api.anthropic.com/v1/messages", resolveHeaders: () => ({ "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01" }) },

  // Gemini
  { service: "gemini", path: "/v1beta/models/gemini-2.5-flash", description: "Gemini 2.5 Flash", price: "0.005", requiredEnv: ["GEMINI_API_KEY"], resolveUpstream: () => "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", resolveHeaders: () => ({ "x-goog-api-key": process.env.GEMINI_API_KEY }) },
  { service: "gemini", path: "/v1beta/models/gemini-2.5-pro", description: "Gemini 2.5 Pro", price: "0.02", requiredEnv: ["GEMINI_API_KEY"], resolveUpstream: () => "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-05-06:generateContent", resolveHeaders: () => ({ "x-goog-api-key": process.env.GEMINI_API_KEY }) },
  { service: "gemini", path: "/v1beta/models/embedding-001", description: "Text embeddings", price: "0.001", requiredEnv: ["GEMINI_API_KEY"], resolveUpstream: () => "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent", resolveHeaders: () => ({ "x-goog-api-key": process.env.GEMINI_API_KEY }) },

  // DeepSeek
  { service: "deepseek", path: "/v1/chat/completions", description: "DeepSeek chat completions", price: "0.005", resolveUpstream: () => "https://api.deepseek.com/chat/completions", resolveHeaders: () => ({ authorization: bearer("DEEPSEEK_API_KEY") }) },

  // Groq
  { service: "groq", path: "/v1/chat/completions", description: "Groq chat completions", price: "0.005", resolveUpstream: () => "https://api.groq.com/openai/v1/chat/completions", resolveHeaders: () => ({ authorization: bearer("GROQ_API_KEY") }) },
  { service: "groq", path: "/v1/audio/transcriptions", description: "Groq transcription", price: "0.005", resolveUpstream: () => "https://api.groq.com/openai/v1/audio/transcriptions", resolveHeaders: () => ({ authorization: bearer("GROQ_API_KEY") }) },

  // Cohere
  { service: "cohere", path: "/v1/chat", description: "Cohere chat", price: "0.005", resolveUpstream: () => "https://api.cohere.com/v2/chat", resolveHeaders: () => ({ authorization: bearer("COHERE_API_KEY") }) },
  { service: "cohere", path: "/v1/embed", description: "Cohere embeddings", price: "0.005", resolveUpstream: () => "https://api.cohere.com/v2/embed", resolveHeaders: () => ({ authorization: bearer("COHERE_API_KEY") }) },
  { service: "cohere", path: "/v1/rerank", description: "Cohere rerank", price: "0.005", resolveUpstream: () => "https://api.cohere.com/v2/rerank", resolveHeaders: () => ({ authorization: bearer("COHERE_API_KEY") }) },

  // Mistral
  { service: "mistral", path: "/v1/chat/completions", description: "Mistral chat", price: "0.005", resolveUpstream: () => "https://api.mistral.ai/v1/chat/completions", resolveHeaders: () => ({ authorization: bearer("MISTRAL_API_KEY") }) },
  { service: "mistral", path: "/v1/embeddings", description: "Mistral embeddings", price: "0.005", resolveUpstream: () => "https://api.mistral.ai/v1/embeddings", resolveHeaders: () => ({ authorization: bearer("MISTRAL_API_KEY") }) },

  // Perplexity
  { service: "perplexity", path: "/v1/chat/completions", description: "Perplexity Sonar chat", price: "0.01", resolveUpstream: () => "https://api.perplexity.ai/chat/completions", resolveHeaders: () => ({ authorization: bearer("PERPLEXITY_API_KEY") }) },

  // Together AI
  { service: "together", path: "/v1/chat/completions", description: "Together chat completions", price: "0.005", resolveUpstream: () => "https://api.together.xyz/v1/chat/completions", resolveHeaders: () => ({ authorization: bearer("TOGETHER_API_KEY") }) },
  { service: "together", path: "/v1/images/generations", description: "Together image generation", price: "0.03", resolveUpstream: () => "https://api.together.xyz/v1/images/generations", resolveHeaders: () => ({ authorization: bearer("TOGETHER_API_KEY") }) },
  { service: "together", path: "/v1/embeddings", description: "Together embeddings", price: "0.001", resolveUpstream: () => "https://api.together.xyz/v1/embeddings", resolveHeaders: () => ({ authorization: bearer("TOGETHER_API_KEY") }) },

  // fal.ai
  { service: "fal", path: "/fal-ai/flux/dev", description: "Flux Dev image generation", price: "0.03", resolveUpstream: () => "https://fal.run/fal-ai/flux/dev", resolveHeaders: () => ({ authorization: `Key ${process.env.FAL_KEY ?? ""}` }) },
  { service: "fal", path: "/fal-ai/flux-pro", description: "Flux Pro image generation", price: "0.05", resolveUpstream: () => "https://fal.run/fal-ai/flux-pro", resolveHeaders: () => ({ authorization: `Key ${process.env.FAL_KEY ?? ""}` }) },
  { service: "fal", path: "/fal-ai/flux-realism", description: "Flux Realism image generation", price: "0.03", resolveUpstream: () => "https://fal.run/fal-ai/flux-realism", resolveHeaders: () => ({ authorization: `Key ${process.env.FAL_KEY ?? ""}` }) },
  { service: "fal", path: "/fal-ai/recraft-20b", description: "Recraft 20B image generation", price: "0.03", resolveUpstream: () => "https://fal.run/fal-ai/recraft-20b", resolveHeaders: () => ({ authorization: `Key ${process.env.FAL_KEY ?? ""}` }) },
  { service: "fal", path: "/fal-ai/whisper", description: "Whisper transcription", price: "0.01", resolveUpstream: () => "https://fal.run/fal-ai/whisper", resolveHeaders: () => ({ authorization: `Key ${process.env.FAL_KEY ?? ""}` }) },

  // Firecrawl
  { service: "firecrawl", path: "/v1/scrape", description: "Scrape a URL", price: "0.01", requiredEnv: ["FIRECRAWL_API_KEY"], resolveUpstream: () => "https://api.firecrawl.dev/v1/scrape", resolveHeaders: () => ({ authorization: bearer("FIRECRAWL_API_KEY") }) },
  { service: "firecrawl", path: "/v1/crawl", description: "Crawl a site", price: "0.05", requiredEnv: ["FIRECRAWL_API_KEY"], resolveUpstream: () => "https://api.firecrawl.dev/v1/crawl", resolveHeaders: () => ({ authorization: bearer("FIRECRAWL_API_KEY") }) },
  { service: "firecrawl", path: "/v1/map", description: "Map website URLs", price: "0.01", requiredEnv: ["FIRECRAWL_API_KEY"], resolveUpstream: () => "https://api.firecrawl.dev/v1/map", resolveHeaders: () => ({ authorization: bearer("FIRECRAWL_API_KEY") }) },
  { service: "firecrawl", path: "/v1/extract", description: "Extract structured data", price: "0.02", requiredEnv: ["FIRECRAWL_API_KEY"], resolveUpstream: () => "https://api.firecrawl.dev/v1/extract", resolveHeaders: () => ({ authorization: bearer("FIRECRAWL_API_KEY") }) },

  // Brave Search
  { service: "brave", path: "/v1/web/search", description: "Web search", price: "0.007", requiredEnv: ["BRAVE_SEARCH_API_KEY"], upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://api.search.brave.com/res/v1/web/search", resolveHeaders: () => ({ ...jsonAccept, "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY }) },
  { service: "brave", path: "/v1/images/search", description: "Image search", price: "0.007", requiredEnv: ["BRAVE_SEARCH_API_KEY"], upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://api.search.brave.com/res/v1/images/search", resolveHeaders: () => ({ ...jsonAccept, "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY }) },
  { service: "brave", path: "/v1/news/search", description: "News search", price: "0.007", requiredEnv: ["BRAVE_SEARCH_API_KEY"], upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://api.search.brave.com/res/v1/news/search", resolveHeaders: () => ({ ...jsonAccept, "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY }) },
  { service: "brave", path: "/v1/videos/search", description: "Video search", price: "0.007", requiredEnv: ["BRAVE_SEARCH_API_KEY"], upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://api.search.brave.com/res/v1/videos/search", resolveHeaders: () => ({ ...jsonAccept, "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY }) },
  { service: "brave", path: "/v1/summarizer/search", description: "Summarized search", price: "0.01", requiredEnv: ["BRAVE_SEARCH_API_KEY"], upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://api.search.brave.com/res/v1/summarizer/search", resolveHeaders: () => ({ ...jsonAccept, "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY }) },

  // Exa
  { service: "exa", path: "/v1/search", description: "Exa search", price: "0.005", resolveUpstream: () => "https://api.exa.ai/search", resolveHeaders: () => ({ "x-api-key": process.env.EXA_API_KEY }) },
  { service: "exa", path: "/v1/contents", description: "Exa contents", price: "0.005", resolveUpstream: () => "https://api.exa.ai/contents", resolveHeaders: () => ({ "x-api-key": process.env.EXA_API_KEY }) },

  // Serper
  { service: "serper", path: "/v1/search", description: "Serper web search", price: "0.005", resolveUpstream: () => "https://google.serper.dev/search", resolveHeaders: () => ({ "x-api-key": process.env.SERPER_API_KEY }) },
  { service: "serper", path: "/v1/images", description: "Serper image search", price: "0.005", resolveUpstream: () => "https://google.serper.dev/images", resolveHeaders: () => ({ "x-api-key": process.env.SERPER_API_KEY }) },

  // SerpApi
  { service: "serpapi", path: "/v1/search", description: "SerpApi search", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://serpapi.com/search.json?engine=google&api_key=${process.env.SERPAPI_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },
  { service: "serpapi", path: "/v1/locations", description: "SerpApi locations", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://serpapi.com/locations.json?api_key=${process.env.SERPAPI_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },
  { service: "serpapi", path: "/v1/flights", description: "SerpApi Google Flights", price: "0.01", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://serpapi.com/search.json?engine=google_flights&api_key=${process.env.SERPAPI_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },

  // NewsAPI
  { service: "newsapi", path: "/v1/headlines", description: "Top headlines", price: "0.02", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://newsapi.org/v2/top-headlines", resolveHeaders: () => ({ "x-api-key": process.env.NEWSAPI_API_KEY }) },
  { service: "newsapi", path: "/v1/search", description: "Article search", price: "0.02", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://newsapi.org/v2/everything", resolveHeaders: () => ({ "x-api-key": process.env.NEWSAPI_API_KEY }) },

  // Alpha Vantage
  { service: "alphavantage", path: "/v1/quote", description: "Global quote", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&apikey=${process.env.ALPHAVANTAGE_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },
  { service: "alphavantage", path: "/v1/search", description: "Symbol search", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&apikey=${process.env.ALPHAVANTAGE_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },
  { service: "alphavantage", path: "/v1/daily", description: "Daily time series", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&apikey=${process.env.ALPHAVANTAGE_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },

  // CoinGecko
  { service: "coingecko", path: "/v1/price", description: "Simple price lookup", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.coingecko.com/api/v3/simple/price?x_cg_demo_api_key=${process.env.COINGECKO_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },
  { service: "coingecko", path: "/v1/markets", description: "Coin markets", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.coingecko.com/api/v3/coins/markets?x_cg_demo_api_key=${process.env.COINGECKO_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },
  { service: "coingecko", path: "/v1/trending", description: "Trending coins", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.coingecko.com/api/v3/search/trending?x_cg_demo_api_key=${process.env.COINGECKO_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },

  // OpenWeather
  { service: "openweather", path: "/v1/weather", description: "Current weather", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.openweathermap.org/data/2.5/weather?appid=${process.env.OPENWEATHER_API_KEY ?? ""}&units=metric`, resolveHeaders: () => ({}) },
  { service: "openweather", path: "/v1/forecast", description: "5-day forecast", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.openweathermap.org/data/2.5/forecast?appid=${process.env.OPENWEATHER_API_KEY ?? ""}&units=metric`, resolveHeaders: () => ({}) },

  // Google Maps
  { service: "googlemaps", path: "/v1/geocode", description: "Geocoding", price: "0.01", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://maps.googleapis.com/maps/api/geocode/json?key=${process.env.GOOGLE_MAPS_API_KEY ?? ""}`, resolveHeaders: () => ({}) },
  { service: "googlemaps", path: "/v1/places", description: "Places text search", price: "0.01", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://maps.googleapis.com/maps/api/place/textsearch/json?key=${process.env.GOOGLE_MAPS_API_KEY ?? ""}`, resolveHeaders: () => ({}) },
  { service: "googlemaps", path: "/v1/directions", description: "Directions", price: "0.01", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://maps.googleapis.com/maps/api/directions/json?key=${process.env.GOOGLE_MAPS_API_KEY ?? ""}`, resolveHeaders: () => ({}) },

  // Google Translate
  { service: "translate", path: "/v1/translate", description: "Translate text", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY ?? ""}`, resolveHeaders: () => ({}) },
  { service: "translate", path: "/v1/detect", description: "Detect language", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://translation.googleapis.com/language/translate/v2/detect?key=${process.env.GOOGLE_TRANSLATE_API_KEY ?? ""}`, resolveHeaders: () => ({}) },

  // DeepL
  { service: "deepl", path: "/v1/translate", description: "DeepL translation", price: "0.03", resolveUpstream: () => "https://api.deepl.com/v2/translate", resolveHeaders: () => ({ authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY ?? ""}` }) },

  // Resend
  { service: "resend", path: "/v1/emails", description: "Send one email", price: "0.005", resolveUpstream: () => "https://api.resend.com/emails", resolveHeaders: () => ({ authorization: bearer("RESEND_API_KEY") }) },
  { service: "resend", path: "/v1/emails/batch", description: "Send batch emails", price: "0.01", resolveUpstream: () => "https://api.resend.com/emails/batch", resolveHeaders: () => ({ authorization: bearer("RESEND_API_KEY") }) },

  // ElevenLabs
  { service: "elevenlabs", path: "/v1/sound-generation", description: "Sound generation", price: "0.08", resolveUpstream: () => "https://api.elevenlabs.io/v1/sound-generation", resolveHeaders: () => ({ "xi-api-key": process.env.ELEVENLABS_API_KEY }) },
  { service: "elevenlabs", path: "/v1/text-to-speech/:voiceId", description: "Text to speech", price: "0.08", resolveUpstream: (p) => `https://api.elevenlabs.io/v1/text-to-speech/${p.voiceId}`, resolveHeaders: () => ({ "xi-api-key": process.env.ELEVENLABS_API_KEY }) },

  // AssemblyAI
  { service: "assemblyai", path: "/v1/transcribe", description: "Create transcript job", price: "0.02", resolveUpstream: () => "https://api.assemblyai.com/v2/transcript", resolveHeaders: () => ({ authorization: process.env.ASSEMBLYAI_API_KEY }) },
  { service: "assemblyai", path: "/v1/result/:id", description: "Fetch transcript result", price: "0.001", upstreamMethod: "GET", resolveUpstream: (p) => `https://api.assemblyai.com/v2/transcript/${p.id}`, resolveHeaders: () => ({ authorization: process.env.ASSEMBLYAI_API_KEY }) },

  // Judge0
  { service: "judge0", path: "/v1/languages", description: "List languages", price: "0.001", resolveUpstream: () => "https://judge0-ce.p.rapidapi.com/languages", resolveHeaders: () => ({ "x-rapidapi-host": "judge0-ce.p.rapidapi.com", "x-rapidapi-key": process.env.RAPIDAPI_KEY }) },
  { service: "judge0", path: "/v1/submissions", description: "Create submission", price: "0.005", resolveUpstream: () => "https://judge0-ce.p.rapidapi.com/submissions", resolveHeaders: () => ({ "x-rapidapi-host": "judge0-ce.p.rapidapi.com", "x-rapidapi-key": process.env.RAPIDAPI_KEY }) },

  // Hunter
  { service: "hunter", path: "/v1/search", description: "Domain search", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.hunter.io/v2/domain-search?api_key=${process.env.HUNTER_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },
  { service: "hunter", path: "/v1/verify", description: "Email verifier", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.hunter.io/v2/email-verifier?api_key=${process.env.HUNTER_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },

  // IPinfo
  { service: "ipinfo", path: "/v1/lookup/:ip", description: "IP info lookup", price: "0.005", upstreamMethod: "GET", resolveUpstream: (p) => `https://ipinfo.io/${p.ip}?token=${process.env.IPINFO_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },

  // Jina
  { service: "jina", path: "/v1/read/:target", description: "Jina reader", price: "0.005", upstreamMethod: "GET", resolveUpstream: (p) => `https://r.jina.ai/${p.target}`, resolveHeaders: () => ({ authorization: bearer("JINA_API_KEY") }) },

  // Replicate
  { service: "replicate", path: "/v1/predictions", description: "Create prediction", price: "0.03", resolveUpstream: () => "https://api.replicate.com/v1/predictions", resolveHeaders: () => ({ authorization: bearer("REPLICATE_API_KEY") }) },
  { service: "replicate", path: "/v1/predictions/status/:id", description: "Prediction status", price: "0.001", upstreamMethod: "GET", resolveUpstream: (p) => `https://api.replicate.com/v1/predictions/${p.id}`, resolveHeaders: () => ({ authorization: bearer("REPLICATE_API_KEY") }) },

  // ScreenshotOne
  { service: "screenshot", path: "/v1/capture", description: "Capture webpage screenshot", price: "0.01", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.screenshotone.com/take?access_key=${process.env.SCREENSHOTONE_API_KEY ?? ""}`, resolveHeaders: () => ({ accept: "image/png" }) },

  // PDFShift
  { service: "pdfshift", path: "/v1/convert", description: "Convert HTML to PDF", price: "0.01", resolveUpstream: () => "https://api.pdfshift.io/v3/convert/pdf", resolveHeaders: () => ({ "x-api-key": process.env.PDFSHIFT_API_KEY }) },

  // Stability AI
  { service: "stability", path: "/v1/generate/sd3", description: "SD3 image generation", price: "0.08", resolveUpstream: () => "https://api.stability.ai/v2beta/stable-image/generate/sd3", resolveHeaders: () => ({ authorization: bearer("STABILITY_API_KEY") }) },
  { service: "stability", path: "/v1/generate/core", description: "Stable Image Core", price: "0.05", resolveUpstream: () => "https://api.stability.ai/v2beta/stable-image/generate/core", resolveHeaders: () => ({ authorization: bearer("STABILITY_API_KEY") }) },
  { service: "stability", path: "/v1/generate/ultra", description: "Stable Image Ultra", price: "0.10", resolveUpstream: () => "https://api.stability.ai/v2beta/stable-image/generate/ultra", resolveHeaders: () => ({ authorization: bearer("STABILITY_API_KEY") }) },

  // Hugging Face
  { service: "huggingface", path: "/v1/models/:modelId", description: "Run model inference", price: "0.005", resolveUpstream: (p) => `https://api-inference.huggingface.co/models/${p.modelId}`, resolveHeaders: () => ({ authorization: bearer("HUGGINGFACE_API_KEY") }) },

  // AI21 Labs
  { service: "ai21", path: "/v1/chat/completions", description: "Chat completions", price: "0.01", resolveUpstream: () => "https://api.ai21.com/studio/v1/chat/completions", resolveHeaders: () => ({ authorization: bearer("AI21_API_KEY") }) },
  { service: "ai21", path: "/v1/summarize", description: "Text summarization", price: "0.005", resolveUpstream: () => "https://api.ai21.com/studio/v1/summarize", resolveHeaders: () => ({ authorization: bearer("AI21_API_KEY") }) },

  // Runway
  { service: "runway", path: "/v1/image_to_video", description: "Image-to-video generation", price: "0.10", resolveUpstream: () => "https://api.dev.runwayml.com/v1/image_to_video", resolveHeaders: () => ({ authorization: bearer("RUNWAYML_API_SECRET") }) },
  { service: "runway", path: "/v1/tasks/:id", description: "Check generation status", price: "0.001", upstreamMethod: "GET", resolveUpstream: (p) => `https://api.dev.runwayml.com/v1/tasks/${p.id}`, resolveHeaders: () => ({ authorization: bearer("RUNWAYML_API_SECRET") }) },

  // Twilio
  { service: "twilio", path: "/v1/messages", description: "Send SMS", price: "0.02", requiredEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"], resolveUpstream: () => `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, resolveHeaders: () => ({ authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}` }) },

  // SendGrid
  { service: "sendgrid", path: "/v1/mail/send", description: "Send email", price: "0.005", resolveUpstream: () => "https://api.sendgrid.com/v3/mail/send", resolveHeaders: () => ({ authorization: bearer("SENDGRID_API_KEY") }) },

  // Birdeye
  { service: "birdeye", path: "/v1/price", description: "Token price", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://public-api.birdeye.so/defi/price", resolveHeaders: () => ({ "x-api-key": process.env.BIRDEYE_API_KEY, ...jsonAccept }) },
  { service: "birdeye", path: "/v1/ohlcv", description: "OHLCV candle data", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://public-api.birdeye.so/defi/ohlcv", resolveHeaders: () => ({ "x-api-key": process.env.BIRDEYE_API_KEY, ...jsonAccept }) },
  { service: "birdeye", path: "/v1/trades", description: "Token trade history", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://public-api.birdeye.so/defi/txs/token", resolveHeaders: () => ({ "x-api-key": process.env.BIRDEYE_API_KEY, ...jsonAccept }) },

  // DexScreener
  { service: "dexscreener", path: "/v1/pairs/:chainId/:tokenAddress", description: "Get token pairs", price: "0.005", upstreamMethod: "GET", resolveUpstream: (p) => `https://api.dexscreener.com/token-pairs/v1/${p.chainId}/${p.tokenAddress}`, resolveHeaders: () => jsonAccept },
  { service: "dexscreener", path: "/v1/tokens/:tokenAddresses", description: "Multi-token lookup", price: "0.005", upstreamMethod: "GET", resolveUpstream: (p) => `https://api.dexscreener.com/tokens/v1/${p.tokenAddresses}`, resolveHeaders: () => jsonAccept },

  // Helius
  { service: "helius", path: "/v1/transactions", description: "Parse enhanced transactions", price: "0.005", resolveUpstream: () => `https://api.helius.xyz/v0/transactions?api-key=${process.env.HELIUS_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },
  { service: "helius", path: "/v1/addresses/:address/transactions", description: "Address history", price: "0.005", upstreamMethod: "GET", resolveUpstream: (p) => `https://api.helius.xyz/v0/addresses/${p.address}/transactions?api-key=${process.env.HELIUS_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },

  // Jupiter
  { service: "jupiter", path: "/v1/price", description: "Token price lookup", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://api.jup.ag/price/v2", resolveHeaders: () => jsonAccept },
  { service: "jupiter", path: "/v1/quote", description: "Swap quote", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://api.jup.ag/quote/v6", resolveHeaders: () => jsonAccept },

  // Notion
  { service: "notion", path: "/v1/databases/:databaseId/query", description: "Query database", price: "0.005", resolveUpstream: (p) => `https://api.notion.com/v1/databases/${p.databaseId}/query`, resolveHeaders: () => ({ authorization: bearer("NOTION_API_KEY"), "notion-version": "2022-06-28" }) },
  { service: "notion", path: "/v1/pages", description: "Create page", price: "0.005", resolveUpstream: () => "https://api.notion.com/v1/pages", resolveHeaders: () => ({ authorization: bearer("NOTION_API_KEY"), "notion-version": "2022-06-28" }) },
  { service: "notion", path: "/v1/search", description: "Search workspace", price: "0.005", resolveUpstream: () => "https://api.notion.com/v1/search", resolveHeaders: () => ({ authorization: bearer("NOTION_API_KEY"), "notion-version": "2022-06-28" }) },

  // Linear
  { service: "linear", path: "/v1/graphql", description: "GraphQL query", price: "0.005", resolveUpstream: () => "https://api.linear.app/graphql", resolveHeaders: () => ({ authorization: process.env.LINEAR_API_KEY }) },

  // Airtable
  { service: "airtable", path: "/v1/bases/:baseId/:tableId", description: "List records", price: "0.005", upstreamMethod: "GET", resolveUpstream: (p) => `https://api.airtable.com/v0/${p.baseId}/${p.tableId}`, resolveHeaders: () => ({ authorization: bearer("AIRTABLE_API_KEY") }) },

  // Clearbit
  { service: "clearbit", path: "/v1/people/find", description: "Enrich person by email", price: "0.02", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://person.clearbit.com/v2/people/find", resolveHeaders: () => ({ authorization: bearer("CLEARBIT_API_KEY") }) },
  { service: "clearbit", path: "/v1/companies/find", description: "Enrich company by domain", price: "0.02", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => "https://company.clearbit.com/v2/companies/find", resolveHeaders: () => ({ authorization: bearer("CLEARBIT_API_KEY") }) },

  // Wolfram Alpha
  { service: "wolfram", path: "/v1/query", description: "Full computation query", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.wolframalpha.com/v2/query?appid=${process.env.WOLFRAM_APP_ID ?? ""}&output=json`, resolveHeaders: () => jsonAccept },
  { service: "wolfram", path: "/v1/short", description: "Short answer", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.wolframalpha.com/v1/result?appid=${process.env.WOLFRAM_APP_ID ?? ""}`, resolveHeaders: () => ({}) },

  // Polygon.io
  { service: "polygon", path: "/v1/prev/:ticker", description: "Previous close", price: "0.005", upstreamMethod: "GET", resolveUpstream: (p) => `https://api.polygon.io/v2/aggs/ticker/${p.ticker}/prev?apiKey=${process.env.POLYGON_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },
  { service: "polygon", path: "/v1/tickers", description: "Ticker search", price: "0.005", upstreamMethod: "GET", bodyToQuery: true, resolveUpstream: () => `https://api.polygon.io/v3/reference/tickers?apiKey=${process.env.POLYGON_API_KEY ?? ""}`, resolveHeaders: () => jsonAccept },

  // OpenRouter
  { service: "openrouter", path: "/v1/chat/completions", description: "Chat completions (any model)", price: "0.01", resolveUpstream: () => "https://openrouter.ai/api/v1/chat/completions", resolveHeaders: () => ({ authorization: bearer("OPENROUTER_API_KEY") }) },
  { service: "openrouter", path: "/v1/models", description: "List available models", price: "0.001", upstreamMethod: "GET", resolveUpstream: () => "https://openrouter.ai/api/v1/models", resolveHeaders: () => ({ authorization: bearer("OPENROUTER_API_KEY") }) },

  // Crunchbase
  { service: "crunchbase", path: "/v1/organizations/:permalink", description: "Organization lookup", price: "0.02", upstreamMethod: "GET", resolveUpstream: (p) => `https://api.crunchbase.com/api/v4/entities/organizations/${p.permalink}`, resolveHeaders: () => ({ "x-cb-user-key": process.env.CRUNCHBASE_API_KEY }) },

  // Tavily
  { service: "tavily", path: "/v1/search", description: "AI search", price: "0.005", resolveUpstream: () => "https://api.tavily.com/search", resolveHeaders: () => ({}) },
  { service: "tavily", path: "/v1/extract", description: "Extract URL content", price: "0.005", resolveUpstream: () => "https://api.tavily.com/extract", resolveHeaders: () => ({}) },

  // Pinecone
  { service: "pinecone", path: "/v1/query", description: "Query vectors", price: "0.005", requiredEnv: ["PINECONE_API_KEY", "PINECONE_INDEX_HOST"], resolveUpstream: () => `https://${process.env.PINECONE_INDEX_HOST}/query`, resolveHeaders: () => ({ "api-key": process.env.PINECONE_API_KEY }) },
  { service: "pinecone", path: "/v1/vectors/upsert", description: "Upsert vectors", price: "0.005", requiredEnv: ["PINECONE_API_KEY", "PINECONE_INDEX_HOST"], resolveUpstream: () => `https://${process.env.PINECONE_INDEX_HOST}/vectors/upsert`, resolveHeaders: () => ({ "api-key": process.env.PINECONE_API_KEY }) },
];

// ── Filter to enabled services ──

export const gatewayRoutes = allGatewayRoutes.filter((r) => enabledServiceIds.has(r.service));

// ── Path matching with :param support ──

/** Reject path params containing traversal or internal-network patterns */
function sanitizeParam(value: string): string | null {
  const decoded = decodeURIComponent(value);
  // Block path traversal
  if (decoded.includes("..") || decoded.includes("//")) return null;
  // Block SSRF to internal networks
  if (/^https?:\/\/(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|localhost|\[::1\])/i.test(decoded)) return null;
  return decoded;
}

function matchPath(pattern: string, actualPath: string): { matched: boolean; params: Record<string, string> } {
  const patternParts = pattern.split("/").filter(Boolean);
  const actualParts = actualPath.split("/").filter(Boolean);

  if (patternParts.length !== actualParts.length) {
    return { matched: false, params: {} };
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      const sanitized = sanitizeParam(actualParts[i]);
      if (sanitized === null) return { matched: false, params: {} };
      params[patternParts[i].slice(1)] = sanitized;
    } else if (patternParts[i] !== actualParts[i]) {
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}

export function resolveGatewayRoute(actualPath: string): ResolvedGatewayRoute | null {
  for (const route of gatewayRoutes) {
    const match = matchPath(`/${route.service}${route.path}`, actualPath);
    if (match.matched) {
      return { ...route, params: match.params };
    }
  }
  return null;
}

// ── Build /services catalog ──

export function buildServices(network: "mainnet-beta" | "devnet" = "mainnet-beta") {
  const currency = network === "devnet" ? "SOL" : "USDC";
  return serviceMeta
    .filter((s) => enabledServiceIds.has(s.id))
    .map((service) => {
      const endpoints: EndpointDefinition[] = gatewayRoutes
        .filter((r) => r.service === service.id && isRouteConfigured(r))
        .map((r) => ({ method: (r.upstreamMethod ?? "POST") as "GET" | "POST", path: r.path, description: r.description, price: r.price }));

      return {
        id: service.id,
        name: service.name,
        description: service.description,
        categories: service.categories,
        chain: "solana" as const,
        currency,
        endpoints,
      };
    })
    .filter((s) => s.endpoints.length > 0);
}
