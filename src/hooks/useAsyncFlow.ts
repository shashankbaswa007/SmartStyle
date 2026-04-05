'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_ASYNC_MAX_RETRIES, DEFAULT_ASYNC_TIMEOUT_MS, getExponentialBackoffMs } from '@/lib/async-flow-constants';
import { categorizeError } from '@/lib/error-handler';
import { createInitialLoadableState, type LoadableError, type LoadableState } from '@/lib/loadable-state';

type OperationContext = {
  signal: AbortSignal;
  attempt: number;
};

export interface UseAsyncFlowOptions<T> {
  operation: (context: OperationContext) => Promise<T>;
  timeoutMs?: number;
  maxRetries?: number;
  autoLoad?: boolean;
  dependencies?: unknown[];
  initialData?: T | null;
  mapError?: (error: unknown) => LoadableError;
  retryDelayMs?: (attempt: number) => number;
  onSuccess?: (data: T) => void;
  onError?: (error: LoadableError) => void;
}

export interface UseAsyncFlowResult<T> {
  loadable: LoadableState<T>;
  execute: () => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
  isLoading: boolean;
  isRetrying: boolean;
  isError: boolean;
  isSuccess: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getDependencyKey(dependencies: unknown[]): string {
  try {
    return JSON.stringify(dependencies);
  } catch {
    return String(dependencies.length);
  }
}

export function useAsyncFlow<T>({
  operation,
  timeoutMs = DEFAULT_ASYNC_TIMEOUT_MS,
  maxRetries = DEFAULT_ASYNC_MAX_RETRIES,
  autoLoad = true,
  dependencies = [],
  initialData = null,
  mapError,
  retryDelayMs = getExponentialBackoffMs,
  onSuccess,
  onError,
}: UseAsyncFlowOptions<T>): UseAsyncFlowResult<T> {
  const [loadable, setLoadable] = useState<LoadableState<T>>(() => createInitialLoadableState(initialData));
  const mountedRef = useRef(true);
  const dependencyKey = getDependencyKey(dependencies);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort('ASYNC_FLOW_TIMEOUT'), timeoutMs);

      try {
        setLoadable((prev) => ({
          ...prev,
          status: attempt === 0 ? 'loading' : 'retrying',
          error: null,
          retryCount: attempt,
        }));

        const result = await operation({ signal: controller.signal, attempt });

        if (!mountedRef.current) return result;

        setLoadable((prev) => ({
          ...prev,
          status: 'success',
          data: result,
          error: null,
          retryCount: attempt,
          lastUpdated: Date.now(),
        }));
        onSuccess?.(result);
        return result;
      } catch (error) {
        const normalizedError = mapError?.(error) ?? categorizeError(error);
        const shouldRetry = normalizedError.retryable && attempt < maxRetries;

        if (!shouldRetry) {
          if (mountedRef.current) {
            setLoadable((prev) => ({
              ...prev,
              status: 'error',
              error: normalizedError,
              retryCount: attempt,
            }));
            onError?.(normalizedError);
          }
          return null;
        }

        const delayMs = normalizedError.retryAfterMs ?? retryDelayMs(attempt + 1);
        await sleep(delayMs);
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    return null;
  }, [maxRetries, timeoutMs, operation, mapError, onSuccess, onError, retryDelayMs]);

  const retry = useCallback(async () => execute(), [execute]);

  const reset = useCallback(() => {
    setLoadable(createInitialLoadableState(initialData));
  }, [initialData]);

  useEffect(() => {
    if (!autoLoad) return;
    void execute();
  }, [autoLoad, execute, dependencyKey]);

  return {
    loadable,
    execute,
    retry,
    reset,
    isLoading: loadable.status === 'loading',
    isRetrying: loadable.status === 'retrying',
    isError: loadable.status === 'error',
    isSuccess: loadable.status === 'success',
  };
}
