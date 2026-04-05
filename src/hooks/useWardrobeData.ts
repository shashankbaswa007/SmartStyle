'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getWardrobeItems, type WardrobeItemData } from '@/lib/wardrobeService';
import { RATE_LIMIT_SCOPES, USAGE_LIMITS } from '@/lib/usage-limits';
import { logUxEvent } from '@/lib/ux-events';

type UsageWindow = { remaining: number; limit: number; resetAt?: string };

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
  const hasTaskStartedRef = useRef(false);
  const hasTaskCompletedRef = useRef(false);
  const lastForcedRefreshFailureAtRef = useRef(0);

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
    const activeUser = uid || auth.currentUser?.uid;
    if (!activeUser || !auth.currentUser) {
      setUsageLimits({});
      setUsageLoading(false);
      return;
    }

    try {
      setUsageLoading(true);
      const fetchUsageStatus = async (forceRefreshToken = false) => {
        const idToken = await auth.currentUser!.getIdToken(forceRefreshToken);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 6000);
        try {
          return await fetch('/api/usage-status', {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${idToken}`,
              'Cache-Control': 'no-cache',
            },
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }
      };

      let response = await fetchUsageStatus(false);
      if (response.status === 401) {
        if (Date.now() - lastForcedRefreshFailureAtRef.current < 120_000) {
          setUsageLimits({});
          return;
        }

        try {
          response = await fetchUsageStatus(true);
        } catch {
          lastForcedRefreshFailureAtRef.current = Date.now();
          setUsageLimits({});
          return;
        }
      }

      if (!response.ok) {
        setUsageLimits({});
        return;
      }

      const data = await response.json();
      setUsageLimits({
        wardrobeOutfit: data?.usage?.[RATE_LIMIT_SCOPES.wardrobeOutfit]
          ? {
              remaining: data.usage[RATE_LIMIT_SCOPES.wardrobeOutfit].remaining,
              limit: data.usage[RATE_LIMIT_SCOPES.wardrobeOutfit].limit,
              resetAt: data.usage[RATE_LIMIT_SCOPES.wardrobeOutfit].resetAt,
            }
          : undefined,
        wardrobeUpload: data?.usage?.[RATE_LIMIT_SCOPES.wardrobeUpload]
          ? {
              remaining: data.usage[RATE_LIMIT_SCOPES.wardrobeUpload].remaining,
              limit: data.usage[RATE_LIMIT_SCOPES.wardrobeUpload].limit,
              resetAt: data.usage[RATE_LIMIT_SCOPES.wardrobeUpload].resetAt,
            }
          : undefined,
      });
    } catch {
      setUsageLimits({});
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
      if (user) {
        setUserId(user.uid);
        void fetchWardrobeItems(user.uid, { silent: false, preserveExistingOnError: true });
      } else {
        setUserId(null);
        hasTaskStartedRef.current = false;
        hasTaskCompletedRef.current = false;
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchWardrobeItems]);

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
    if (!userId) return;
    void fetchUsageLimits(userId);
  }, [fetchUsageLimits, userId]);

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
    const onUsageConsumed = (event: Event) => {
      const customEvent = event as CustomEvent<{ scope?: string }>;
      if (customEvent.detail?.scope === RATE_LIMIT_SCOPES.wardrobeOutfit || customEvent.detail?.scope === RATE_LIMIT_SCOPES.wardrobeUpload) {
        void fetchUsageLimits(userId);
      }
    };

    window.addEventListener('usage:consumed', onUsageConsumed as EventListener);
    return () => window.removeEventListener('usage:consumed', onUsageConsumed as EventListener);
  }, [fetchUsageLimits, userId]);

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
    isOutfitLimitReached,
    isUploadLimitReached,
    refreshWardrobe,
    fetchUsageLimits,
  };
}
