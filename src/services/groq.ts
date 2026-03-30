import type { ServiceConfig } from "../types/index.js";

export const groq: ServiceConfig = {
  name: "groq",
  displayName: "Groq",
  baseUrl: "https://api.groq.com",
  authHeader: "Authorization",
  authPrefix: "Bearer ",
  apiKeyEnv: "GROQ_API_KEY",
  endpoints: [
    { path: "/openai/v1/chat/completions", method: "POST", priceUsd: "0.002", description: "Fast LLM inference (Llama, Mixtral)" },
    { path: "/openai/v1/embeddings", method: "POST", priceUsd: "0.001", description: "Text embeddings" },
  ],
};
