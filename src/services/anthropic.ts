import type { ServiceConfig } from "../types/index.js";

export const anthropic: ServiceConfig = {
  name: "anthropic",
  displayName: "Anthropic",
  baseUrl: "https://api.anthropic.com",
  authHeader: "x-api-key",
  authPrefix: "",
  apiKeyEnv: "ANTHROPIC_API_KEY",
  endpoints: [
    { path: "/v1/messages", method: "POST", priceUsd: "0.01", description: "Claude messages (streaming and non-streaming)" },
    { path: "/v1/embeddings", method: "POST", priceUsd: "0.001", description: "Text embeddings" },
  ],
};
