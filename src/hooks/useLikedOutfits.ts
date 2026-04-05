'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getLikedOutfits, type LikedOutfitData } from '@/lib/likedOutfits';
import { categorizeError } from '@/lib/error-handler';
import { useAsyncFlow } from '@/hooks/useAsyncFlow';

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

  const {
    loadable,
    execute,
    retry,
    reset,
    isLoading,
    isRetrying,
  } = useAsyncFlow<LikedOutfit[]>({
    operation: async () => {
      if (!userId) return [];

      const outfits = await getLikedOutfits(userId);
      return outfits
        .filter((outfit): outfit is LikedOutfit => Boolean(outfit.id))
        .map((outfit) => ({ ...outfit, id: outfit.id! }));
    },
    autoLoad: false,
    initialData: [],
    maxRetries: 1,
    timeoutMs: 10_000,
    mapError: (error) => categorizeError(error, { fallbackMessage: 'Failed to load your liked outfits' }),
    onSuccess: (data) => {
      setLikedOutfits(data);
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthChecked(true);

      if (!user) {
        setUserId(null);
        setIsAuthenticated(false);
        setLikedOutfits([]);
        reset();
        return;
      }

      setUserId(user.uid);
      setIsAuthenticated(true);
      void execute();
    });

    return () => unsubscribe();
  }, [execute, reset]);

  const refreshLikedOutfits = useCallback(async () => {
    if (!userId) return;
    await retry();
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
