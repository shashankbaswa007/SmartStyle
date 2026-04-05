'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getUserPreferences,
  getRecommendationHistory,
} from '@/lib/personalization';
import type { UserPreferences, RecommendationHistory } from '@/lib/personalization';
import { getLikedOutfits } from '@/lib/likedOutfits';
import type { LikedOutfitData } from '@/lib/likedOutfits';
import { getWardrobeItems } from '@/lib/wardrobeService';
import type { WardrobeItemData } from '@/lib/wardrobeService';
import { getUxEventMetrics, type UxEventMetrics } from '@/lib/ux-events';

interface AnalyticsDataResult {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  preferences: UserPreferences | null;
  history: RecommendationHistory[];
  likedOutfits: LikedOutfitData[];
  wardrobeItems: WardrobeItemData[];
  uxMetrics: UxEventMetrics | null;
  loadAnalytics: (isRefresh?: boolean) => Promise<void>;
}

export function useAnalyticsData(userId?: string): AnalyticsDataResult {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [history, setHistory] = useState<RecommendationHistory[]>([]);
  const [likedOutfits, setLikedOutfits] = useState<LikedOutfitData[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItemData[]>([]);
  const [uxMetrics, setUxMetrics] = useState<UxEventMetrics | null>(null);

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      if (!userId) {
        setPreferences(null);
        setHistory([]);
        setLikedOutfits([]);
        setWardrobeItems([]);
        setUxMetrics(null);
        return;
      }

      const [prefs, recs, liked, wardrobe, ux] = await Promise.all([
        getUserPreferences(userId),
        getRecommendationHistory(userId, 100),
        getLikedOutfits(userId),
        getWardrobeItems(userId).catch(() => [] as WardrobeItemData[]),
        getUxEventMetrics(userId, 30),
      ]);

      setPreferences(prefs);
      setHistory(recs);
      setLikedOutfits(liked);
      setWardrobeItems(wardrobe);
      setUxMetrics(ux);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return {
    loading,
    refreshing,
    error,
    preferences,
    history,
    likedOutfits,
    wardrobeItems,
    uxMetrics,
    loadAnalytics,
  };
}
