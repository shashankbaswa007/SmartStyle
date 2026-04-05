'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { deleteColorPalette, getSavedPalettes, type SavedColorPalette } from '@/lib/colorPaletteService';
import { useAsyncFlow } from '@/hooks/useAsyncFlow';
import { categorizeError } from '@/lib/error-handler';

interface UseSavedPalettesDataResult {
  user: User | null;
  loading: boolean;
  error: string | null;
  palettes: SavedColorPalette[];
  setPalettes: Dispatch<SetStateAction<SavedColorPalette[]>>;
  refreshPalettes: () => Promise<void>;
  deletePalette: (paletteId: string) => Promise<{ success: boolean; message: string }>;
}

export function useSavedPalettesData(): UseSavedPalettesDataResult {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [palettes, setPalettes] = useState<SavedColorPalette[]>([]);

  const { loadable, execute, retry, reset, isLoading, isRetrying } = useAsyncFlow<SavedColorPalette[]>({
    operation: async () => {
      if (!user) return [];
      return await getSavedPalettes(user.uid);
    },
    autoLoad: false,
    initialData: [],
    timeoutMs: 10_000,
    maxRetries: 1,
    mapError: (error) => categorizeError(error, { fallbackMessage: 'Failed to load saved palettes' }),
    onSuccess: (data) => {
      setPalettes(data);
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthChecked(true);
      setUser(currentUser);

      if (!currentUser) {
        setPalettes([]);
        reset();
        return;
      }

      void execute();
    });

    return () => unsubscribe();
  }, [execute, reset]);

  const refreshPalettes = useCallback(async () => {
    if (!user) return;
    await retry();
  }, [retry, user]);

  const deletePalette = useCallback(async (paletteId: string) => {
    if (!user || !paletteId) {
      return {
        success: false,
        message: 'Invalid parameters',
      };
    }

    const result = await deleteColorPalette(user.uid, paletteId);
    if (result.success) {
      setPalettes((prev) => prev.filter((palette) => palette.id !== paletteId));
    }

    return result;
  }, [user]);

  return {
    user,
    loading: !authChecked || (Boolean(user) && (isLoading || isRetrying)),
    error: loadable.error?.message || null,
    palettes,
    setPalettes,
    refreshPalettes,
    deletePalette,
  };
}
