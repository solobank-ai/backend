import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveGatewayRoute,
  getMissingRequiredEnv,
  isRouteConfigured,
  buildServices,
  gatewayRoutes,
  enabledServiceIds,
} from "./registry.js";

describe("resolveGatewayRoute", () => {
  it("resolves /openai/v1/chat/completions", () => {
    const route = resolveGatewayRoute("/openai/v1/chat/completions");
    expect(route).not.toBeNull();
    expect(route!.service).toBe("openai");
    expect(route!.path).toBe("/v1/chat/completions");
    expect(route!.price).toBeDefined();
  });

  it("resolves /anthropic/v1/messages", () => {
    const route = resolveGatewayRoute("/anthropic/v1/messages");
    expect(route).not.toBeNull();
    expect(route!.service).toBe("anthropic");
  });

  it("returns null for unknown path", () => {
    expect(resolveGatewayRoute("/unknown/v1/foo")).toBeNull();
  });

  it("returns null for empty path", () => {
    expect(resolveGatewayRoute("/")).toBeNull();
  });

  it("returns null for partial path match", () => {
    expect(resolveGatewayRoute("/openai/v1")).toBeNull();
  });

  it("resolves routes with path params", () => {
    // Look for a route with :param (e.g. /v1/result/:id)
    const paramRoute = gatewayRoutes.find((r) => r.path.includes(":"));
    if (paramRoute) {
      const route = resolveGatewayRoute(`/${paramRoute.service}${paramRoute.path.replace(/:(\w+)/g, "test-value")}`);
      expect(route).not.toBeNull();
      expect(route!.params).toBeDefined();
    }
  });

  it("blocks path traversal in params", () => {
    const paramRoute = gatewayRoutes.find((r) => r.path.includes(":"));
    if (paramRoute) {
      const malicious = `/${paramRoute.service}${paramRoute.path.replace(/:(\w+)/g, "..%2F..%2Fetc%2Fpasswd")}`;
      const route = resolveGatewayRoute(malicious);
      expect(route).toBeNull();
    }
  });
});

describe("getMissingRequiredEnv", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty array when no requiredEnv", () => {
    const route = { requiredEnv: undefined } as any;
    expect(getMissingRequiredEnv(route)).toEqual([]);
  });

  it("returns missing env vars", () => {
    process.env = { ...originalEnv };
    delete process.env.NONEXISTENT_KEY;
    const route = { requiredEnv: ["NONEXISTENT_KEY"] } as any;
    expect(getMissingRequiredEnv(route)).toEqual(["NONEXISTENT_KEY"]);
  });

  it("returns empty array when env vars are set", () => {
    process.env = { ...originalEnv, MY_KEY: "value" };
    const route = { requiredEnv: ["MY_KEY"] } as any;
    expect(getMissingRequiredEnv(route)).toEqual([]);
  });

  it("treats empty string as missing", () => {
    process.env = { ...originalEnv, EMPTY_KEY: "" };
    const route = { requiredEnv: ["EMPTY_KEY"] } as any;
    expect(getMissingRequiredEnv(route)).toEqual(["EMPTY_KEY"]);
  });

  it("treats whitespace-only as missing", () => {
    process.env = { ...originalEnv, SPACE_KEY: "   " };
    const route = { requiredEnv: ["SPACE_KEY"] } as any;
    expect(getMissingRequiredEnv(route)).toEqual(["SPACE_KEY"]);
  });
});

describe("isRouteConfigured", () => {
  it("returns true when no required env", () => {
    expect(isRouteConfigured({ requiredEnv: undefined } as any)).toBe(true);
  });
});

describe("gatewayRoutes", () => {
  it("has routes defined", () => {
    expect(gatewayRoutes.length).toBeGreaterThan(0);
  });

  it("all routes have required fields", () => {
    for (const route of gatewayRoutes) {
      expect(route.service).toBeTruthy();
      expect(route.path).toBeTruthy();
      expect(route.price).toBeTruthy();
      expect(typeof route.resolveUpstream).toBe("function");
      expect(typeof route.resolveHeaders).toBe("function");
    }
  });

  it("all routes have valid price format (decimal string)", () => {
    for (const route of gatewayRoutes) {
      expect(route.price).toMatch(/^\d+(\.\d+)?$/);
    }
  });

  it("all enabled services have at least one route", () => {
    for (const id of enabledServiceIds) {
      const routes = gatewayRoutes.filter((r) => r.service === id);
      expect(routes.length, `Service ${id} has no routes`).toBeGreaterThan(0);
    }
  });
});

describe("buildServices", () => {
  it("returns only enabled services", () => {
    const services = buildServices();
    for (const svc of services) {
      expect(enabledServiceIds.has(svc.id)).toBe(true);
    }
  });

  it("uses SOL currency on devnet", () => {
    const services = buildServices("devnet");
    for (const svc of services) {
      expect(svc.currency).toBe("SOL");
    }
  });

  it("uses USDC currency on mainnet", () => {
    const services = buildServices("mainnet-beta");
    for (const svc of services) {
      expect(svc.currency).toBe("USDC");
    }
  });

  it("includes chain field as solana", () => {
    const services = buildServices();
    for (const svc of services) {
      expect(svc.chain).toBe("solana");
    }
  });
});
