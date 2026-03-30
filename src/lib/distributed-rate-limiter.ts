import { featureFlags } from '@/lib/feature-flags';
import { getRedisClient } from '@/lib/redis';

export interface DistributedRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  scope: string;
}

export interface DistributedRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}

const RATE_LIMIT_NAMESPACE = 'smartstyle:v1:ratelimit';

function getWindow(config: DistributedRateLimitConfig) {
  const now = Date.now();
  const windowStartMs = now - (now % config.windowMs);
  const resetAt = new Date(windowStartMs + config.windowMs);
  return { now, windowStartMs, resetAt };
}

function keyFor(scope: string, subject: string, windowStartMs: number): string {
  return `${RATE_LIMIT_NAMESPACE}:${scope}:${subject}:${windowStartMs}`;
}

export async function checkDistributedRateLimit(
  subject: string,
  config: DistributedRateLimitConfig
): Promise<DistributedRateLimitResult | null> {
  if (!featureFlags.redisRateLimit) return null;

  const redis = getRedisClient();
  if (!redis) return null;

  const { now, windowStartMs, resetAt } = getWindow(config);
  const key = keyFor(config.scope, subject, windowStartMs);

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, config.windowMs);
    }

    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);

    return {
      allowed,
      remaining,
      resetAt,
      ...(allowed
        ? {}
        : {
            message: `Rate limit exceeded. Try again in ${Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000))} seconds.`,
          }),
    };
  } catch {
    return null;
  }
}

export async function getDistributedRateLimitStatus(
  subject: string,
  config: DistributedRateLimitConfig
): Promise<{ limit: number; used: number; remaining: number; resetAt: Date } | null> {
  if (!featureFlags.redisRateLimit) return null;

  const redis = getRedisClient();
  if (!redis) return null;

  const { windowStartMs, resetAt } = getWindow(config);
  const key = keyFor(config.scope, subject, windowStartMs);

  try {
    const raw = await redis.get<string | number>(key);
    const used = typeof raw === 'number' ? raw : Number(raw || 0);
    return {
      limit: config.maxRequests,
      used,
      remaining: Math.max(0, config.maxRequests - used),
      resetAt,
    };
  } catch {
    return null;
  }
}
