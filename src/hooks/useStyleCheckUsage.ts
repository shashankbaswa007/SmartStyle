'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { RATE_LIMIT_SCOPES } from '@/lib/usage-limits';
import { categorizeError } from '@/lib/error-handler';
import { useAsyncFlow } from '@/hooks/useAsyncFlow';
import { logUxEvent } from '@/lib/ux-events';
import { fetchUsageStatus } from '@/lib/usage-status-service';

type UsageWindow = {
  remaining: number;
  limit: number;
  resetAt?: string;
} | null;

interface UseStyleCheckUsageResult {
  usage: UsageWindow;
  usageLoading: boolean;
  usageError: string | null;
  fetchUsage: () => Promise<void>;
  isStyleCheckLimitReached: boolean;
}

export function useStyleCheckUsage(): UseStyleCheckUsageResult {
  const [authChecked, setAuthChecked] = useState(false);
  const hasTaskStartedRef = useRef(false);
  const hasTaskCompletedRef = useRef(false);
  const lastForcedRefreshFailureAtRef = useRef(0);
  const inFlightFetchRef = useRef<Promise<UsageWindow | null> | null>(null);
  const lastFetchAtRef = useRef(0);

  const fetchUsageOperation = useCallback(async ({ signal }: { signal: AbortSignal }) => {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }

    if (signal.aborted) return null;

    const data = await fetchUsageStatus({
      user,
      scopes: [RATE_LIMIT_SCOPES.recommend],
      lastForcedRefreshFailureAtRef,
    });
    const recommendUsage = data.usage[RATE_LIMIT_SCOPES.recommend];

    if (!recommendUsage) return null;

    return {
      remaining: recommendUsage.remaining,
      limit: recommendUsage.limit,
      resetAt: recommendUsage.resetAt,
    } as UsageWindow;
  }, []);

  const { loadable, execute, reset, isLoading, isRetrying } = useAsyncFlow<UsageWindow>({
    operation: fetchUsageOperation,
    autoLoad: false,
    maxRetries: 1,
    timeoutMs: 6_000,
    mapError: (error) => categorizeError(error, { fallbackMessage: 'Unable to load usage status. Please try again.' }),
    onSuccess: () => {
      hasTaskCompletedRef.current = true;
      void logUxEvent(auth.currentUser?.uid, 'task_completed', {
        flow: 'style_check_usage',
        step: 'usage_loaded',
        success: true,
      });
    },
    onError: (error) => {
      void logUxEvent(auth.currentUser?.uid, 'error_shown', {
        flow: 'style_check_usage',
        step: 'usage_load_failed',
        reason: error.code,
      });
    },
  });

  const runUsageFetch = useCallback(async () => {
    const now = Date.now();
    if (inFlightFetchRef.current) {
      return await inFlightFetchRef.current;
    }

    // Avoid burst requests from closely spaced auth/events/rerenders.
    if (now - lastFetchAtRef.current < 1500) {
      return null;
    }

    lastFetchAtRef.current = now;
    const promise = execute();
    inFlightFetchRef.current = promise;

    try {
      return await promise;
    } finally {
      inFlightFetchRef.current = null;
    }
  }, [execute]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthChecked(true);
      if (!user) {
        hasTaskStartedRef.current = false;
        hasTaskCompletedRef.current = false;
        reset();
        return;
      }
      void logUxEvent(user.uid, 'task_started', {
        flow: 'style_check_usage',
        step: 'usage_load_requested',
      });
      hasTaskStartedRef.current = true;
      hasTaskCompletedRef.current = false;
      void runUsageFetch();
    });

    return () => unsubscribe();
  }, [reset, runUsageFetch]);

  useEffect(() => {
    const onUsageConsumed = (event: Event) => {
      const customEvent = event as CustomEvent<{ scope?: string }>;
      if (customEvent.detail?.scope === RATE_LIMIT_SCOPES.recommend) {
        void runUsageFetch();
      }
    };

    window.addEventListener('usage:consumed', onUsageConsumed as EventListener);
    return () => window.removeEventListener('usage:consumed', onUsageConsumed as EventListener);
  }, [runUsageFetch]);

  useEffect(() => {
    return () => {
      if (!hasTaskStartedRef.current || hasTaskCompletedRef.current) return;

      void logUxEvent(auth.currentUser?.uid, 'drop_off', {
        flow: 'style_check_usage',
        step: 'abandoned_before_completion',
        reason: 'navigation_or_unmount',
      });
    };
  }, []);

  const usage = loadable.data;
  const usageLoading = !authChecked || isLoading || isRetrying;
  const usageError = loadable.error?.message || null;
  const isStyleCheckLimitReached = !usageLoading && !!usage && usage.remaining <= 0;

  const fetchUsage = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    void logUxEvent(uid, 'retry_clicked', {
      flow: 'style_check_usage',
      step: 'manual_retry',
    });
    const result = await runUsageFetch();
    if (result !== null) {
      void logUxEvent(uid, 'recovered_from_error', {
        flow: 'style_check_usage',
        step: 'manual_retry_success',
        success: true,
      });
    }
  }, [runUsageFetch]);

  return {
    usage,
    usageLoading,
    usageError,
    fetchUsage,
    isStyleCheckLimitReached,
  };
}
