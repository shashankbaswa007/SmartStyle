'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { RATE_LIMIT_SCOPES } from '@/lib/usage-limits';
import { categorizeError } from '@/lib/error-handler';
import { useAsyncFlow } from '@/hooks/useAsyncFlow';

type UsageWindow = {
  remaining: number;
  limit: number;
  resetAt?: string;
} | null;

interface HttpLikeError {
  status: number;
  message: string;
  retryAfter: string | null;
}

interface UseStyleCheckUsageResult {
  usage: UsageWindow;
  usageLoading: boolean;
  usageError: string | null;
  fetchUsage: () => Promise<void>;
  isStyleCheckLimitReached: boolean;
}

export function useStyleCheckUsage(): UseStyleCheckUsageResult {
  const [authChecked, setAuthChecked] = useState(false);

  const fetchUsageOperation = useCallback(async ({ signal }: { signal: AbortSignal }) => {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }

    const idToken = await user.getIdToken(true);
    const response = await fetch('/api/usage-status', {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Cache-Control': 'no-cache',
      },
      signal,
    });

    if (!response.ok) {
      const error: HttpLikeError = {
        status: response.status,
        message: 'Could not refresh your daily limit right now.',
        retryAfter: response.headers.get('retry-after'),
      };
      throw error;
    }

    const data = await response.json();
    const recommendUsage = data?.usage?.[RATE_LIMIT_SCOPES.recommend];

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
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthChecked(true);
      if (!user) {
        reset();
        return;
      }
      void execute();
    });

    return () => unsubscribe();
  }, [execute, reset]);

  useEffect(() => {
    const onUsageConsumed = (event: Event) => {
      const customEvent = event as CustomEvent<{ scope?: string }>;
      if (customEvent.detail?.scope === RATE_LIMIT_SCOPES.recommend) {
        void execute();
      }
    };

    window.addEventListener('usage:consumed', onUsageConsumed as EventListener);
    return () => window.removeEventListener('usage:consumed', onUsageConsumed as EventListener);
  }, [execute]);

  const usage = loadable.data;
  const usageLoading = !authChecked || isLoading || isRetrying;
  const usageError = loadable.error?.message || null;
  const isStyleCheckLimitReached = !usageLoading && !!usage && usage.remaining <= 0;

  const fetchUsage = useCallback(async () => {
    await execute();
  }, [execute]);

  return {
    usage,
    usageLoading,
    usageError,
    fetchUsage,
    isStyleCheckLimitReached,
  };
}
