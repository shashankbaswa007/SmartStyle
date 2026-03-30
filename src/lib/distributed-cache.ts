import { featureFlags } from '@/lib/feature-flags';
import { getRedisClient } from '@/lib/redis';

const CACHE_NAMESPACE = 'smartstyle:v1:cache';

function getCacheKey(key: string): string {
  return `${CACHE_NAMESPACE}:${key}`;
}

export async function getDistributedJson<T>(key: string): Promise<T | null> {
  if (!featureFlags.redisCache) return null;

  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const value = await redis.get<string>(getCacheKey(key));
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setDistributedJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!featureFlags.redisCache) return;

  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(getCacheKey(key), JSON.stringify(value), { ex: Math.max(1, ttlSeconds) });
  } catch {
    // Non-critical cache failure.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForDistributedJson<T>(
  key: string,
  options?: { maxWaitMs?: number; pollIntervalMs?: number }
): Promise<T | null> {
  const maxWaitMs = options?.maxWaitMs ?? 2000;
  const pollIntervalMs = options?.pollIntervalMs ?? 250;
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const cached = await getDistributedJson<T>(key);
    if (cached) return cached;
    await sleep(pollIntervalMs);
  }

  return null;
}
