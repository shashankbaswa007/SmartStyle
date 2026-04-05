import type { LoadableError } from '@/lib/loadable-state';

type ErrorLike = {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
  retryAfter?: string | null;
  details?: string;
};

export interface CategorizeErrorOptions {
  fallbackMessage?: string;
  retryAfter?: string | null;
}

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

export function parseRetryAfterMs(retryAfter: string | null | undefined): number | undefined {
  if (!retryAfter) return undefined;

  const numeric = Number(retryAfter);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric * 1000);
  }

  const parsedDate = Date.parse(retryAfter);
  if (!Number.isNaN(parsedDate)) {
    const ms = parsedDate - Date.now();
    return ms > 0 ? ms : undefined;
  }

  return undefined;
}

export function categorizeError(error: unknown, options?: CategorizeErrorOptions): LoadableError {
  const err = (error ?? {}) as ErrorLike;
  const statusCode = typeof err.status === 'number' ? err.status : undefined;
  const retryAfterMs = parseRetryAfterMs(err.retryAfter ?? options?.retryAfter);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      code: 'NETWORK_OFFLINE',
      message: 'You are offline. Reconnect and try again.',
      retryable: true,
    };
  }

  if (err.name === 'AbortError' || err.message === 'ASYNC_FLOW_TIMEOUT') {
    return {
      code: 'TIMEOUT',
      message: 'Request timed out. Please try again.',
      retryable: true,
    };
  }

  if (statusCode === 429) {
    return {
      code: 'RATE_LIMITED',
      message: 'You reached a temporary limit. Please retry shortly.',
      retryable: true,
      retryAfterMs,
      statusCode,
    };
  }

  if (statusCode === 401) {
    return {
      code: 'UNAUTHORIZED',
      message: 'Session expired. Please sign in again.',
      retryable: false,
      statusCode,
    };
  }

  if (statusCode === 403) {
    return {
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
      retryable: false,
      statusCode,
    };
  }

  if (statusCode === 400) {
    return {
      code: 'VALIDATION',
      message: err.message || 'Please check your input and try again.',
      retryable: false,
      statusCode,
    };
  }

  if (statusCode === 503) {
    return {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service is temporarily unavailable. Please try again.',
      retryable: true,
      statusCode,
    };
  }

  if (statusCode && statusCode >= 500) {
    return {
      code: 'SERVER_ERROR',
      message: 'Server error. Please try again shortly.',
      retryable: true,
      statusCode,
    };
  }

  if (err.code === 'permission-denied') {
    return {
      code: 'PERMISSION_DENIED',
      message: 'Permission denied. Please sign in again.',
      retryable: false,
      details: err.details,
    };
  }

  return {
    code: 'UNKNOWN',
    message: err.message || options?.fallbackMessage || DEFAULT_MESSAGE,
    retryable: true,
    details: err.details,
  };
}
