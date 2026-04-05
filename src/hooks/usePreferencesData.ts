'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { categorizeError } from '@/lib/error-handler';
import { useAsyncFlow } from '@/hooks/useAsyncFlow';

export interface UserPreferences {
  colorProfiles: Record<string, number>;
  styleProfiles: Record<string, number>;
  occasionProfiles: Record<string, number>;
  seasonalProfiles: Record<string, number>;
  totalLikes: number;
  totalWears: number;
  totalShoppingClicks: number;
  lastUpdated: number | null;
}

export interface BlocklistData {
  hardBlocklist: {
    colors: string[];
    styles: string[];
    items: string[];
  };
  softBlocklist: {
    colors: string[];
    styles: string[];
    items: string[];
  };
  temporaryBlocklist: Array<{
    color?: string;
    style?: string;
    item?: string;
    expiresAt: number | null;
    reason: string;
  }>;
}

interface PreferencesDataPayload {
  preferences: UserPreferences | null;
  blocklists: BlocklistData | null;
}

interface UsePreferencesDataResult {
  user: User | null;
  loading: boolean;
  error: string | null;
  preferences: UserPreferences | null;
  blocklists: BlocklistData | null;
  refreshData: () => Promise<void>;
}

export function usePreferencesData(): UsePreferencesDataResult {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const { loadable, execute, retry, reset, isLoading, isRetrying } = useAsyncFlow<PreferencesDataPayload>({
    operation: async () => {
      if (!user) {
        return {
          preferences: null,
          blocklists: null,
        };
      }

      const [prefDoc, blocklistDoc] = await Promise.all([
        getDoc(doc(db, 'userPreferences', user.uid)),
        getDoc(doc(db, 'userBlocklists', user.uid)),
      ]);

      return {
        preferences: prefDoc.exists() ? (prefDoc.data() as UserPreferences) : null,
        blocklists: blocklistDoc.exists() ? (blocklistDoc.data() as BlocklistData) : null,
      };
    },
    autoLoad: false,
    maxRetries: 1,
    timeoutMs: 10_000,
    initialData: { preferences: null, blocklists: null },
    mapError: (error) => categorizeError(error, { fallbackMessage: 'Failed to load your preferences' }),
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthChecked(true);
      setUser(currentUser);

      if (!currentUser) {
        reset();
        return;
      }

      void execute();
    });

    return () => unsubscribe();
  }, [execute, reset]);

  const refreshData = useCallback(async () => {
    if (!user) return;
    await retry();
  }, [retry, user]);

  return {
    user,
    loading: !authChecked || (Boolean(user) && (isLoading || isRetrying)),
    error: loadable.error?.message || null,
    preferences: loadable.data?.preferences || null,
    blocklists: loadable.data?.blocklists || null,
    refreshData,
  };
}
