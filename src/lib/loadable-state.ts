export type LoadableStatus = 'idle' | 'loading' | 'retrying' | 'success' | 'error';

export type LoadableErrorCode =
  | 'NETWORK_OFFLINE'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'PERMISSION_DENIED'
  | 'SERVICE_UNAVAILABLE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface LoadableError {
  code: LoadableErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  statusCode?: number;
  details?: string;
}

export interface LoadableState<T> {
  status: LoadableStatus;
  data: T | null;
  error: LoadableError | null;
  retryCount: number;
  lastUpdated: number | null;
}

export function createInitialLoadableState<T>(initialData: T | null = null): LoadableState<T> {
  return {
    status: 'idle',
    data: initialData,
    error: null,
    retryCount: 0,
    lastUpdated: null,
  };
}
