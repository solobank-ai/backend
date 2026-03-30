import type { ServiceConfig, ServiceEndpoint } from "../types/index.js";
import { openai } from "./openai.js";
import { anthropic } from "./anthropic.js";
import { groq } from "./groq.js";

const services = new Map<string, ServiceConfig>();

for (const service of [openai, anthropic, groq]) {
  services.set(service.name, service);
}

export function getService(name: string): ServiceConfig | undefined {
  return services.get(name);
}

export function findEndpoint(
  service: ServiceConfig,
  path: string,
  method: string
): ServiceEndpoint | undefined {
  return service.endpoints.find(
    (ep) => path.startsWith(ep.path) && ep.method === method.toUpperCase()
  );
}

export function getAllServices(): ServiceConfig[] {
  return Array.from(services.values());
}
