'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getWardrobeItems, type WardrobeItemData } from '@/lib/wardrobeService';
import { RATE_LIMIT_SCOPES, USAGE_LIMITS } from '@/lib/usage-limits';
import { logUxEvent } from '@/lib/ux-events';
import { fetchUsageStatus } from '@/lib/usage-status-service';
import {
  parseUsageConsumedStorageValue,
  USAGE_CONSUMED_EVENT,
  USAGE_CONSUMED_STORAGE_KEY,
} from '@/lib/usage-events';

type UsageWindow = { remaining: number; limit: number; resetAt?: string };

function debugWardrobeUsage(message: string, context: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[usage-sync][wardrobe]', message, context);
}

interface UseWardrobeDataResult {
  wardrobeItems: WardrobeItemData[];
  setWardrobeItems: Dispatch<SetStateAction<WardrobeItemData[]>>;
  loading: boolean;
  userId: string | null;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  isOnline: boolean;
  lastUpdated: number | null;
  isSyncing: boolean;
  usageLimits: {
    wardrobeOutfit?: UsageWindow;
    wardrobeUpload?: UsageWindow;
  };
  usageLoading: boolean;
  usageError: string | null;
  isOutfitLimitReached: boolean;
  isUploadLimitReached: boolean;
  refreshWardrobe: (options?: { silent?: boolean; preserveExistingOnError?: boolean }) => Promise<void>;
  fetchUsageLimits: (uid?: string | null) => Promise<void>;
}

const FETCH_TIMEOUT_MS = 10_000;

export function useWardrobeData(): UseWardrobeDataResult {
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const [usageLimits, setUsageLimits] = useState<{
    wardrobeOutfit?: UsageWindow;
    wardrobeUpload?: UsageWindow;
  }>({});
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);
  const hasTaskStartedRef = useRef(false);
  const hasTaskCompletedRef = useRef(false);
  const lastForcedRefreshFailureAtRef = useRef(0);
  const authUserRef = useRef<User | null>(null);
  const userIdRef = useRef<string | null>(null);
  const usageResetRefreshTimerRef = useRef<number | null>(null);

  const clearUsageResetRefreshTimer = useCallback(() => {
    if (usageResetRefreshTimerRef.current !== null) {
      window.clearTimeout(usageResetRefreshTimerRef.current);
      usageResetRefreshTimerRef.current = null;
    }
  }, []);

  const fetchWardrobeItems = useCallback(async (
    uid: string,
    options?: { silent?: boolean; preserveExistingOnError?: boolean }
  ): Promise<boolean> => {
    const silent = options?.silent ?? false;
    const preserveExistingOnError = options?.preserveExistingOnError ?? false;

    try {
      if (!silent) {
        hasTaskStartedRef.current = true;
        hasTaskCompletedRef.current = false;
        void logUxEvent(uid, 'task_started', {
          flow: 'wardrobe_load',
          step: 'wardrobe_load_requested',
        });
      }

      if (!silent) setLoading(true);
      setIsSyncing(true);
      isSyncingRef.current = true;
      setError(null);

      const items = await Promise.race([
        getWardrobeItems(uid),
        new Promise<WardrobeItemData[]>((_, reject) => {
          window.setTimeout(() => reject(new Error('WARDROBE_FETCH_TIMEOUT')), FETCH_TIMEOUT_MS);
        }),
      ]);

      setWardrobeItems(items);
      setLastUpdated(Date.now());
      if (!silent) {
        hasTaskCompletedRef.current = true;
        void logUxEvent(uid, 'task_completed', {
          flow: 'wardrobe_load',
          step: 'wardrobe_loaded',
          success: true,
          metadata: {
            count: items.length,
          },
        });
      }
      return true;
    } catch (fetchError) {
      let errorMessage = 'Failed to load your wardrobe';
      if (!navigator.onLine) {
        errorMessage = 'You are offline. Reconnect and tap Retry.';
      } else if (fetchError instanceof Error && fetchError.message === 'WARDROBE_FETCH_TIMEOUT') {
        errorMessage = 'Wardrobe request timed out. Please retry.';
      }

      if (fetchError && typeof fetchError === 'object' && 'code' in fetchError) {
        if (fetchError.code === 'permission-denied') {
          errorMessage = 'Permission denied. Please sign in again.';
        } else if (fetchError.code === 'unavailable') {
          errorMessage = 'Service temporarily unavailable. Please try again.';
        }
      }

      setError(errorMessage);
      if (!silent) {
        void logUxEvent(uid, 'error_shown', {
          flow: 'wardrobe_load',
          step: 'wardrobe_load_failed',
          reason: fetchError instanceof Error ? fetchError.message : 'unknown',
        });
      }
      if (!preserveExistingOnError) {
        setWardrobeItems([]);
      }
      return false;
    } finally {
      setLoading(false);
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  }, []);

  const fetchUsageLimits = useCallback(async (uid?: string | null) => {
    const tokenUser = authUserRef.current || auth.currentUser;
    const activeUser = uid || tokenUser?.uid;
    if (!activeUser || !tokenUser) {
      debugWardrobeUsage('no_active_user_for_usage_fetch', {
        uid,
      });
      setUsageLimits({});
      setUsageError(null);
      setUsageLoading(false);
      return;
    }

    try {
      setUsageLoading(true);
      setUsageError(null);
      const data = await fetchUsageStatus({
        user: tokenUser,
        scopes: [RATE_LIMIT_SCOPES.wardrobeOutfit, RATE_LIMIT_SCOPES.wardrobeUpload],
        lastForcedRefreshFailureAtRef,
      });
      const outfitWindow = data.usage[RATE_LIMIT_SCOPES.wardrobeOutfit];
      const uploadWindow = data.usage[RATE_LIMIT_SCOPES.wardrobeUpload];

      setUsageLimits({
        wardrobeOutfit: outfitWindow,
        wardrobeUpload: uploadWindow,
      });

      debugWardrobeUsage('usage_applied_from_backend', {
        activeUser,
        requestId: data.requestId,
        timezoneStrategy: data.timezoneStrategy,
        usage: {
          wardrobeOutfit: outfitWindow,
          wardrobeUpload: uploadWindow,
        },
      });

      if (!outfitWindow || !uploadWindow) {
        setUsageError('Daily limits are temporarily unavailable. Please retry.');
      }
    } catch (error) {
      const typed = error as { message?: string };
      setUsageError(typed?.message || 'Unable to load usage status. Please try again.');

      debugWardrobeUsage('usage_fetch_failed', {
        activeUser,
        error: typed?.message || String(error),
      });
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (userId) {
        void fetchWardrobeItems(userId, { silent: false, preserveExistingOnError: true });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchWardrobeItems, userId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authUserRef.current = user;
      if (user) {
        setUserId(user.uid);
        userIdRef.current = user.uid;
        void fetchWardrobeItems(user.uid, { silent: false, preserveExistingOnError: true });
        void fetchUsageLimits(user.uid);
      } else {
        setUserId(null);
        userIdRef.current = null;
        hasTaskStartedRef.current = false;
        hasTaskCompletedRef.current = false;
        setLoading(false);
        setUsageLimits({});
        setUsageLoading(false);
        setUsageError(null);
      }
    });

    return () => unsubscribe();
  }, [fetchUsageLimits, fetchWardrobeItems]);

  useEffect(() => {
    if (!userId) return;

    void fetchWardrobeItems(userId, { silent: false, preserveExistingOnError: true });
    const pollInterval = setInterval(() => {
      if (!isSyncingRef.current && navigator.onLine) {
        void fetchWardrobeItems(userId, { silent: true, preserveExistingOnError: true });
      }
    }, 45_000);

    return () => clearInterval(pollInterval);
  }, [fetchWardrobeItems, userId]);

  useEffect(() => {
    return () => {
      if (!userId || !hasTaskStartedRef.current || hasTaskCompletedRef.current) return;

      void logUxEvent(userId, 'drop_off', {
        flow: 'wardrobe_load',
        step: 'abandoned_before_completion',
        reason: 'navigation_or_unmount',
      });
    };
  }, [userId]);

  useEffect(() => {
    const onUsageConsumed = (scope?: string) => {
      if (scope === RATE_LIMIT_SCOPES.wardrobeOutfit || scope === RATE_LIMIT_SCOPES.wardrobeUpload) {
        void fetchUsageLimits(userIdRef.current);
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
  }, [fetchUsageLimits]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    clearUsageResetRefreshTimer();

    const resetCandidates = [
      usageLimits.wardrobeOutfit?.resetAt,
      usageLimits.wardrobeUpload?.resetAt,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => new Date(value).getTime())
      .filter((value) => !Number.isNaN(value));

    if (resetCandidates.length === 0) {
      return;
    }

    const nextResetAtMs = Math.min(...resetCandidates);
    const delayMs = Math.max(0, nextResetAtMs - Date.now() + 1_200);

    usageResetRefreshTimerRef.current = window.setTimeout(() => {
      void fetchUsageLimits(userIdRef.current);
    }, delayMs);

    return clearUsageResetRefreshTimer;
  }, [
    clearUsageResetRefreshTimer,
    fetchUsageLimits,
    usageLimits.wardrobeOutfit?.resetAt,
    usageLimits.wardrobeUpload?.resetAt,
  ]);

  useEffect(() => {
    return () => {
      clearUsageResetRefreshTimer();
    };
  }, [clearUsageResetRefreshTimer]);

  const isOutfitLimitReached = !usageLoading && !!usageLimits.wardrobeOutfit && usageLimits.wardrobeOutfit.remaining <= 0;
  const isUploadLimitReached = !usageLoading && !!usageLimits.wardrobeUpload && usageLimits.wardrobeUpload.remaining <= 0;

  const refreshWardrobe = useCallback(async (options?: { silent?: boolean; preserveExistingOnError?: boolean }) => {
    if (!userId) return;
    void logUxEvent(userId, 'retry_clicked', {
      flow: 'wardrobe_load',
      step: 'manual_retry',
    });
    const recovered = await fetchWardrobeItems(userId, options);
    if (recovered) {
      void logUxEvent(userId, 'recovered_from_error', {
        flow: 'wardrobe_load',
        step: 'manual_retry_success',
        success: true,
      });
    }
  }, [fetchWardrobeItems, userId]);

  return {
    wardrobeItems,
    setWardrobeItems,
    loading,
    userId,
    error,
    setError,
    isOnline,
    lastUpdated,
    isSyncing,
    usageLimits,
    usageLoading,
    usageError,
    isOutfitLimitReached,
    isUploadLimitReached,
    refreshWardrobe,
    fetchUsageLimits,
  };
}
