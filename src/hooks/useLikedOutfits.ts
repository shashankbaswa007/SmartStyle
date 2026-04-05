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
  const currentAuthUidRef = useRef<string | null>(null);

  const loadLikedOutfits = useCallback(async () => {
    const activeUid = currentAuthUidRef.current;
    if (!activeUid) return [];

    const outfits = await getLikedOutfits(activeUid);
    return outfits
      .filter((outfit): outfit is LikedOutfit => Boolean(outfit.id))
      .map((outfit) => ({ ...outfit, id: outfit.id! }));
  }, []);

  const handleLoadSuccess = useCallback((data: LikedOutfit[]) => {
    setLikedOutfits(data);
    hasTaskCompletedRef.current = true;
    void logUxEvent(currentAuthUidRef.current, 'task_completed', {
      flow: 'likes_load',
      step: 'likes_loaded',
      success: true,
      metadata: {
        count: data.length,
      },
    });
  }, []);

  const handleLoadError = useCallback((error: ReturnType<typeof categorizeError>) => {
    void logUxEvent(currentAuthUidRef.current, 'error_shown', {
      flow: 'likes_load',
      step: 'likes_load_failed',
      reason: error.code,
    });
  }, []);

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

  const executeRef = useRef(execute);
  const resetRef = useRef(reset);

  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);

  useEffect(() => {
    resetRef.current = reset;
  }, [reset]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthChecked(true);

      if (!user) {
        currentAuthUidRef.current = null;
        setUserId(null);
        setIsAuthenticated(false);
        setLikedOutfits([]);
        hasTaskStartedRef.current = false;
        hasTaskCompletedRef.current = false;
        resetRef.current();
        return;
      }

      if (currentAuthUidRef.current === user.uid) {
        return;
      }

      currentAuthUidRef.current = user.uid;

      setUserId(user.uid);
      setIsAuthenticated(true);
      void logUxEvent(user.uid, 'task_started', {
        flow: 'likes_load',
        step: 'likes_load_requested',
      });
      hasTaskStartedRef.current = true;
      hasTaskCompletedRef.current = false;
      void executeRef.current();
    });

    return () => unsubscribe();
  }, []);

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
