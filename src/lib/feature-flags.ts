function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return !['0', 'false', 'off', 'no'].includes(raw.toLowerCase());
}

export const featureFlags = {
  redisCache: envFlag('ENABLE_REDIS_CACHE', true),
  redisRateLimit: envFlag('ENABLE_REDIS_RATE_LIMIT', true),
  redisDedupLock: envFlag('ENABLE_REDIS_DEDUP_LOCK', true),
  externalRetryWrapper: envFlag('ENABLE_EXTERNAL_RETRY_WRAPPER', true),
  sentry: envFlag('ENABLE_SENTRY', true),
} as const;
