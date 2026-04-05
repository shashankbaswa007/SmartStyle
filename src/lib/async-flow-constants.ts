export const DEFAULT_ASYNC_TIMEOUT_MS = 10_000;
export const DEFAULT_ASYNC_MAX_RETRIES = 1;
export const DEFAULT_ASYNC_BASE_BACKOFF_MS = 500;
export const DEFAULT_ASYNC_MAX_BACKOFF_MS = 5_000;

export function getExponentialBackoffMs(
  attempt: number,
  baseMs: number = DEFAULT_ASYNC_BASE_BACKOFF_MS,
  maxMs: number = DEFAULT_ASYNC_MAX_BACKOFF_MS
): number {
  const raw = baseMs * Math.pow(2, attempt);
  return Math.min(raw, maxMs);
}
