import { Hono } from "hono";
import { getAllServices } from "../services/registry.js";

const services = new Hono();

services.get("/", (c) => {
  const catalog = getAllServices().map((service) => ({
    name: service.name,
    displayName: service.displayName,
    endpoints: service.endpoints.map((ep) => ({
      method: ep.method,
      path: `/${service.name}${ep.path}`,
      priceUsd: ep.priceUsd,
      description: ep.description,
    })),
  }));

  const totalEndpoints = catalog.reduce((sum, s) => sum + s.endpoints.length, 0);

  return c.json({
    network: "solana-mainnet",
    currency: "USDC",
    totalServices: catalog.length,
    totalEndpoints,
    services: catalog,
  });
});

export { services };
