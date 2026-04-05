'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getLikedOutfits, type LikedOutfitData } from '@/lib/likedOutfits';
import { categorizeError } from '@/lib/error-handler';
import { useAsyncFlow } from '@/hooks/useAsyncFlow';
import { logUxEvent } from '@/lib/ux-events';

export type LikedOutfit = LikedOutfitData & { id: string };

interface UseLikedOutfitsResult {
  userId: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  likedOutfits: LikedOutfit[];
  setLikedOutfits: Dispatch<SetStateAction<LikedOutfit[]>>;
  refreshLikedOutfits: () => Promise<void>;
}

export function useLikedOutfits(): UseLikedOutfitsResult {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [likedOutfits, setLikedOutfits] = useState<LikedOutfit[]>([]);
  const hasTaskStartedRef = useRef(false);
  const hasTaskCompletedRef = useRef(false);

  const loadLikedOutfits = useCallback(async () => {
    if (!userId) return [];

    const outfits = await getLikedOutfits(userId);
    return outfits
      .filter((outfit): outfit is LikedOutfit => Boolean(outfit.id))
      .map((outfit) => ({ ...outfit, id: outfit.id! }));
  }, [userId]);

  const handleLoadSuccess = useCallback((data: LikedOutfit[]) => {
    setLikedOutfits(data);
    hasTaskCompletedRef.current = true;
    void logUxEvent(userId, 'task_completed', {
      flow: 'likes_load',
      step: 'likes_loaded',
      success: true,
      metadata: {
        count: data.length,
      },
    });
  }, [userId]);

  const handleLoadError = useCallback((error: ReturnType<typeof categorizeError>) => {
    void logUxEvent(userId, 'error_shown', {
      flow: 'likes_load',
      step: 'likes_load_failed',
      reason: error.code,
    });
  }, [userId]);

  const {
    loadable,
    execute,
    retry,
    reset,
    isLoading,
    isRetrying,
  } = useAsyncFlow<LikedOutfit[]>({
    operation: loadLikedOutfits,
    autoLoad: false,
    initialData: [],
    maxRetries: 1,
    timeoutMs: 10_000,
    mapError: (error) => categorizeError(error, { fallbackMessage: 'Failed to load your liked outfits' }),
    onSuccess: handleLoadSuccess,
    onError: handleLoadError,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthChecked(true);

      if (!user) {
        setUserId(null);
        setIsAuthenticated(false);
        setLikedOutfits([]);
        hasTaskStartedRef.current = false;
        hasTaskCompletedRef.current = false;
        reset();
        return;
      }

      setUserId(user.uid);
      setIsAuthenticated(true);
      void logUxEvent(user.uid, 'task_started', {
        flow: 'likes_load',
        step: 'likes_load_requested',
      });
      hasTaskStartedRef.current = true;
      hasTaskCompletedRef.current = false;
      void execute();
    });

    return () => unsubscribe();
  }, [execute, reset]);

  useEffect(() => {
    return () => {
      if (!userId || !hasTaskStartedRef.current || hasTaskCompletedRef.current) return;

      void logUxEvent(userId, 'drop_off', {
        flow: 'likes_load',
        step: 'abandoned_before_completion',
        reason: 'navigation_or_unmount',
      });
    };
  }, [userId]);

  const refreshLikedOutfits = useCallback(async () => {
    if (!userId) return;
    void logUxEvent(userId, 'retry_clicked', {
      flow: 'likes_load',
      step: 'manual_retry',
    });
    const result = await retry();
    if (result !== null) {
      void logUxEvent(userId, 'recovered_from_error', {
        flow: 'likes_load',
        step: 'manual_retry_success',
        success: true,
      });
    }
  }, [retry, userId]);

  return {
    userId,
    isAuthenticated,
    loading: !authChecked || isLoading || isRetrying,
    error: loadable.error?.message || null,
    likedOutfits,
    setLikedOutfits,
    refreshLikedOutfits,
  };
}
