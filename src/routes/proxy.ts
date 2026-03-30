import { Hono } from "hono";
import type { ServiceConfig, ServiceEndpoint } from "../types/index.js";

const proxy = new Hono();

proxy.all("*", async (c) => {
  const service = (c as any).get("service") as ServiceConfig;
  const endpoint = (c as any).get("endpoint") as ServiceEndpoint;
  const apiKey = (c as any).get("apiKey") as string;
  const wildcardPath = "/" + (c.req.param("path") || "");

  // Build upstream URL
  const upstreamUrl = service.baseUrl + wildcardPath;

  // Build headers
  const headers: Record<string, string> = {
    [service.authHeader]: service.authPrefix + apiKey,
    "Content-Type": c.req.header("content-type") ?? "application/json",
  };

  // Anthropic requires version header
  if (service.name === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
  }

  // Forward request to upstream
  const upstream = await fetch(upstreamUrl, {
    method: c.req.method,
    headers,
    body: c.req.method !== "GET" ? c.req.raw.body : undefined,
  });

  // Stream response back
  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);

  // Add payment receipt header
  responseHeaders.set("x-payment-status", "confirmed");
  responseHeaders.set("x-payment-signature", (c as any).get("txSignature") as string);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
});

export { proxy };
