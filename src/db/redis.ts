import Redis from "ioredis";
const RedisClient = (Redis as any).default ?? Redis;

const TX_PREFIX = "mpp:tx:";
// Match verifier MAX_TX_AGE (300s) plus margin for clock skew. DB UNIQUE is
// the authoritative replay defense; this is just a fast-path cache.
const TX_TTL = 600; // 10 minutes

export function createRedisClient(url: string) {
  const redis = new RedisClient(url, { maxRetriesPerRequest: 3 });

  return {
    /** Atomic replay protection: returns true if signature is NEW (first use), false if already used. */
    async tryMarkUsed(signature: string): Promise<boolean> {
      const result = await redis.set(TX_PREFIX + signature, "1", "EX", TX_TTL, "NX");
      return result === "OK"; // "OK" = new key set, null = already existed
    },

    async isUsed(signature: string): Promise<boolean> {
      const exists = await redis.exists(TX_PREFIX + signature);
      return exists === 1;
    },

    async disconnect(): Promise<void> {
      await redis.quit();
    },
  };
}

export type RedisStore = ReturnType<typeof createRedisClient>;
