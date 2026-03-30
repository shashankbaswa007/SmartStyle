import { Redis } from '@upstash/redis';

let singleton: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (singleton) return singleton;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }

  singleton = new Redis({ url, token });
  return singleton;
}

export async function isRedisHealthy(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
