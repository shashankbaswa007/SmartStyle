'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { RATE_LIMIT_SCOPES } from '@/lib/usage-limits';
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
  const [usage, setUsage] = useState<UsageWindow>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const hasTaskStartedRef = useRef(false);
  const hasTaskCompletedRef = useRef(false);
  const lastForcedRefreshFailureAtRef = useRef(0);
  const authUserRef = useRef<User | null>(null);
  const userIdRef = useRef<string | null>(null);

  const fetchUsageForUser = useCallback(async (uid?: string | null): Promise<boolean> => {
    const tokenUser = authUserRef.current || auth.currentUser;
    const activeUser = uid || tokenUser?.uid;
    if (!activeUser || !tokenUser) {
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

      if (!recommendUsage) {
        setUsageError('Daily limits are temporarily unavailable. Please retry.');
        hasTaskCompletedRef.current = true;
        return false;
      }

      hasTaskCompletedRef.current = true;
      return true;
    } catch (error) {
      setUsage(null);
      const typed = error as { message?: string };
      setUsageError(typed?.message || 'Unable to load usage status. Please try again.');
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
        setUserId(null);
        userIdRef.current = null;
        hasTaskStartedRef.current = false;
        hasTaskCompletedRef.current = false;
        setUsage(null);
        setUsageLoading(false);
        setUsageError(null);
        return;
      }

      setUserId(user.uid);
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
    if (!userId) return;
    void fetchUsageForUser(userId);
  }, [fetchUsageForUser, userId]);

  useEffect(() => {
    const onUsageConsumed = (event: Event) => {
      const customEvent = event as CustomEvent<{ scope?: string }>;
      if (customEvent.detail?.scope === RATE_LIMIT_SCOPES.recommend) {
        void fetchUsageForUser(userIdRef.current);
      }
    };

    window.addEventListener('usage:consumed', onUsageConsumed as EventListener);
    return () => window.removeEventListener('usage:consumed', onUsageConsumed as EventListener);
  }, [fetchUsageForUser]);

  useEffect(() => {
    return () => {
      const currentUserId = userIdRef.current;
      if (!currentUserId || !hasTaskStartedRef.current || hasTaskCompletedRef.current) return;

      void logUxEvent(currentUserId, 'drop_off', {
        flow: 'style_check_usage',
        step: 'abandoned_before_completion',
        reason: 'navigation_or_unmount',
      });
    };
  }, []);

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
