import crypto from 'crypto';
import { featureFlags } from '@/lib/feature-flags';
import { getRedisClient } from '@/lib/redis';

const LOCK_NAMESPACE = 'smartstyle:v1:lock';

export interface DistributedLock {
  key: string;
  token: string;
}

function namespacedKey(key: string): string {
  return `${LOCK_NAMESPACE}:${key}`;
}

export async function acquireDistributedLock(key: string, ttlSeconds: number): Promise<DistributedLock | null> {
  if (!featureFlags.redisDedupLock) return null;

  const redis = getRedisClient();
  if (!redis) return null;

  const token = crypto.randomUUID();
  const redisKey = namespacedKey(key);

  try {
    const ok = await redis.set(redisKey, token, { nx: true, ex: Math.max(1, ttlSeconds) });
    if (ok !== 'OK') return null;
    return { key: redisKey, token };
  } catch {
    return null;
  }
}

export async function releaseDistributedLock(lock: DistributedLock): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const script = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;

  try {
    await redis.eval(script, [lock.key], [lock.token]);
  } catch {
    // Best effort cleanup.
  }
}
