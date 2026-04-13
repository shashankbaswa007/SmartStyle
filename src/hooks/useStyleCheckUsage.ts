'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { RATE_LIMIT_SCOPES } from '@/lib/usage-limits';
import { logUxEvent } from '@/lib/ux-events';
import { fetchUsageStatus } from '@/lib/usage-status-service';
import {
  parseUsageConsumedStorageValue,
  USAGE_CONSUMED_EVENT,
  USAGE_CONSUMED_STORAGE_KEY,
} from '@/lib/usage-events';

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

function debugStyleCheckUsage(message: string, context: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[usage-sync][style-check]', message, context);
}

export function useStyleCheckUsage(): UseStyleCheckUsageResult {
  const [usage, setUsage] = useState<UsageWindow>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const hasTaskStartedRef = useRef(false);
  const hasTaskCompletedRef = useRef(false);
  const lastForcedRefreshFailureAtRef = useRef(0);
  const authUserRef = useRef<User | null>(null);
  const userIdRef = useRef<string | null>(null);
  const resetRefreshTimerRef = useRef<number | null>(null);

  const clearResetRefreshTimer = useCallback(() => {
    if (resetRefreshTimerRef.current !== null) {
      window.clearTimeout(resetRefreshTimerRef.current);
      resetRefreshTimerRef.current = null;
    }
  }, []);

  const fetchUsageForUser = useCallback(async (uid?: string | null): Promise<boolean> => {
    const tokenUser = authUserRef.current || auth.currentUser;
    const activeUser = uid || tokenUser?.uid;
    if (!activeUser || !tokenUser) {
      debugStyleCheckUsage('no_active_user_for_usage_fetch', {
        uid,
      });
      setUsage(null);
      setUsageError(null);
      setUsageLoading(false);
      return false;
    }

    try {
      setUsageLoading(true);
      setUsageError(null);
      const data = await fetchUsageStatus({
        user: tokenUser,
        scopes: [RATE_LIMIT_SCOPES.recommend],
        lastForcedRefreshFailureAtRef,
      });
      const recommendUsage = data.usage[RATE_LIMIT_SCOPES.recommend] || null;
      setUsage(recommendUsage);

      debugStyleCheckUsage('usage_applied_from_backend', {
        activeUser,
        requestId: data.requestId,
        timezoneStrategy: data.timezoneStrategy,
        usage: recommendUsage,
      });

      if (!recommendUsage) {
        setUsageError('Daily limits are temporarily unavailable. Please retry.');
        hasTaskCompletedRef.current = true;
        return false;
      }

      hasTaskCompletedRef.current = true;
      return true;
    } catch (error) {
      const typed = error as { message?: string };
      setUsageError(typed?.message || 'Unable to load usage status. Please try again.');

      debugStyleCheckUsage('usage_fetch_failed', {
        activeUser,
        error: typed?.message || String(error),
      });

      hasTaskCompletedRef.current = true;
      return false;
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authUserRef.current = user;
      if (!user) {
        userIdRef.current = null;
        hasTaskStartedRef.current = false;
        hasTaskCompletedRef.current = false;
        setUsage(null);
        setUsageLoading(false);
        setUsageError(null);
        return;
      }

      userIdRef.current = user.uid;

      void logUxEvent(user.uid, 'task_started', {
        flow: 'style_check_usage',
        step: 'usage_load_requested',
      });
      hasTaskStartedRef.current = true;
      hasTaskCompletedRef.current = false;
      void fetchUsageForUser(user.uid).then((success) => {
        if (!success) {
          void logUxEvent(user.uid, 'error_shown', {
            flow: 'style_check_usage',
            step: 'usage_load_failed',
            reason: 'initial_fetch_failed',
          });
          return;
        }

        void logUxEvent(user.uid, 'task_completed', {
          flow: 'style_check_usage',
          step: 'usage_loaded',
          success: true,
        });
      });
    });

    return () => {
      unsubscribe();
    };
  }, [fetchUsageForUser]);

  useEffect(() => {
    const onUsageConsumed = (scope?: string) => {
      if (scope === RATE_LIMIT_SCOPES.recommend) {
        void fetchUsageForUser(userIdRef.current);
      }
    };

    const onUsageConsumedEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ scope?: string }>;
      onUsageConsumed(customEvent.detail?.scope);
    };

    const onUsageConsumedStorage = (event: StorageEvent) => {
      if (event.key !== USAGE_CONSUMED_STORAGE_KEY || !event.newValue) {
        return;
      }

      const detail = parseUsageConsumedStorageValue(event.newValue);
      onUsageConsumed(detail?.scope);
    };

    window.addEventListener(USAGE_CONSUMED_EVENT, onUsageConsumedEvent as EventListener);
    window.addEventListener('storage', onUsageConsumedStorage);
    return () => {
      window.removeEventListener(USAGE_CONSUMED_EVENT, onUsageConsumedEvent as EventListener);
      window.removeEventListener('storage', onUsageConsumedStorage);
    };
  }, [fetchUsageForUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    clearResetRefreshTimer();

    const resetAt = usage?.resetAt;
    if (!resetAt) return;

    const resetAtMs = new Date(resetAt).getTime();
    if (Number.isNaN(resetAtMs)) return;

    const delayMs = Math.max(0, resetAtMs - Date.now() + 1_200);
    resetRefreshTimerRef.current = window.setTimeout(() => {
      void fetchUsageForUser(userIdRef.current);
    }, delayMs);

    return clearResetRefreshTimer;
  }, [clearResetRefreshTimer, fetchUsageForUser, usage?.resetAt]);

  useEffect(() => {
    return () => {
      clearResetRefreshTimer();
      const currentUserId = userIdRef.current;
      if (!currentUserId || !hasTaskStartedRef.current || hasTaskCompletedRef.current) return;

      void logUxEvent(currentUserId, 'drop_off', {
        flow: 'style_check_usage',
        step: 'abandoned_before_completion',
        reason: 'navigation_or_unmount',
      });
    };
  }, [clearResetRefreshTimer]);

  const isStyleCheckLimitReached = !usageLoading && !!usage && usage.remaining <= 0;

  const fetchUsage = useCallback(async () => {
    const uid = userIdRef.current;
    if (uid) {
      void logUxEvent(uid, 'retry_clicked', {
        flow: 'style_check_usage',
        step: 'manual_retry',
      });
    }

    const recovered = await fetchUsageForUser(uid);
    if (uid && recovered) {
      void logUxEvent(uid, 'recovered_from_error', {
        flow: 'style_check_usage',
        step: 'manual_retry_success',
        success: true,
      });
    }
  }, [fetchUsageForUser]);

  return {
    usage,
    usageLoading,
    usageError,
    fetchUsage,
    isStyleCheckLimitReached,
  };
}
