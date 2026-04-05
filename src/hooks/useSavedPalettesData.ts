'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { deleteColorPalette, getSavedPalettes, type SavedColorPalette } from '@/lib/colorPaletteService';
import { useAsyncFlow } from '@/hooks/useAsyncFlow';
import { categorizeError } from '@/lib/error-handler';
import { logUxEvent } from '@/lib/ux-events';

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
  const hasTaskStartedRef = useRef(false);
  const hasTaskCompletedRef = useRef(false);

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
      hasTaskCompletedRef.current = true;
      void logUxEvent(user?.uid, 'task_completed', {
        flow: 'saved_palettes_load',
        step: 'saved_palettes_loaded',
        success: true,
        metadata: { count: data.length },
      });
    },
    onError: (error) => {
      void logUxEvent(user?.uid, 'error_shown', {
        flow: 'saved_palettes_load',
        step: 'saved_palettes_load_failed',
        reason: error.code,
      });
    },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthChecked(true);
      setUser(currentUser);

      if (!currentUser) {
        setPalettes([]);
        hasTaskStartedRef.current = false;
        hasTaskCompletedRef.current = false;
        reset();
        return;
      }

      void logUxEvent(currentUser.uid, 'task_started', {
        flow: 'saved_palettes_load',
        step: 'saved_palettes_load_requested',
      });
      hasTaskStartedRef.current = true;
      hasTaskCompletedRef.current = false;
      void execute();
    });

    return () => unsubscribe();
  }, [execute, reset]);

  useEffect(() => {
    return () => {
      if (!user?.uid || !hasTaskStartedRef.current || hasTaskCompletedRef.current) return;

      void logUxEvent(user.uid, 'drop_off', {
        flow: 'saved_palettes_load',
        step: 'abandoned_before_completion',
        reason: 'navigation_or_unmount',
      });
    };
  }, [user]);

  const refreshPalettes = useCallback(async () => {
    if (!user) return;
    void logUxEvent(user.uid, 'retry_clicked', {
      flow: 'saved_palettes_load',
      step: 'manual_retry',
    });
    const result = await retry();
    if (result !== null) {
      void logUxEvent(user.uid, 'recovered_from_error', {
        flow: 'saved_palettes_load',
        step: 'manual_retry_success',
        success: true,
      });
    }
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
