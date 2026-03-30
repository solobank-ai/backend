import type { ServiceConfig } from "../types/index.js";

export const openai: ServiceConfig = {
  name: "openai",
  displayName: "OpenAI",
  baseUrl: "https://api.openai.com",
  authHeader: "Authorization",
  authPrefix: "Bearer ",
  apiKeyEnv: "OPENAI_API_KEY",
  endpoints: [
    { path: "/v1/chat/completions", method: "POST", priceUsd: "0.01", description: "Chat completions (GPT-4o, GPT-4, etc.)" },
    { path: "/v1/embeddings", method: "POST", priceUsd: "0.001", description: "Text embeddings" },
    { path: "/v1/images/generations", method: "POST", priceUsd: "0.05", description: "Image generation (DALL-E)" },
    { path: "/v1/audio/transcriptions", method: "POST", priceUsd: "0.01", description: "Audio transcription (Whisper)" },
    { path: "/v1/audio/speech", method: "POST", priceUsd: "0.02", description: "Text-to-speech" },
  ],
};
