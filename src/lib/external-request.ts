export interface ExternalRetryOptions {
  timeoutMs: number;
  retries: number;
  baseDelayMs?: number;
  retryOnStatuses?: number[];
  operationName?: string;
}

const DEFAULT_RETRYABLE = [408, 425, 429, 500, 502, 503, 504];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredBackoff(baseDelayMs: number, attempt: number): number {
  const exp = Math.min(8, attempt);
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(5000, baseDelayMs * (2 ** exp) + jitter);
}

export async function executeWithTimeoutAndRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: ExternalRetryOptions
): Promise<T> {
  const retryOnStatuses = options.retryOnStatuses || DEFAULT_RETRYABLE;
  const baseDelayMs = options.baseDelayMs ?? 300;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      return await fn(controller.signal);
    } catch (error) {
      const err = error as Error & { status?: number };
      lastError = err;
      const status = (err as any)?.status;
      const timedOut = err?.name === 'AbortError';
      const retryableStatus = typeof status === 'number' && retryOnStatuses.includes(status);
      const retryable = timedOut || retryableStatus || status === undefined;

      if (attempt >= options.retries || !retryable) {
        throw err;
      }

      await sleep(jitteredBackoff(baseDelayMs, attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error(`${options.operationName || 'External operation'} failed`);
}
