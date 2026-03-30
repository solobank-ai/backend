import Redis from "ioredis";
const RedisClient = (Redis as any).default ?? Redis;

const TX_PREFIX = "mpp:tx:";
const TX_TTL = 86400; // 24 hours

export function createRedisClient(url: string) {
  const redis = new RedisClient(url, { maxRetriesPerRequest: 3 });

  return {
    async isUsed(signature: string): Promise<boolean> {
      const exists = await redis.exists(TX_PREFIX + signature);
      return exists === 1;
    },

    async markUsed(signature: string): Promise<void> {
      await redis.set(TX_PREFIX + signature, "1", "EX", TX_TTL);
    },

    async disconnect(): Promise<void> {
      await redis.quit();
    },
  };
}

export type RedisStore = ReturnType<typeof createRedisClient>;
