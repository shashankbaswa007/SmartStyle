'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { logUxEvent } from '@/lib/ux-events';

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
  const hasTaskStartedRef = useRef(false);
  const hasTaskCompletedRef = useRef(false);

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
        hasTaskStartedRef.current = false;
        hasTaskCompletedRef.current = false;
        return;
      }

      if (isRefresh) {
        void logUxEvent(userId, 'retry_clicked', {
          flow: 'analytics_load',
          step: 'manual_refresh',
        });
      } else {
        void logUxEvent(userId, 'task_started', {
          flow: 'analytics_load',
          step: 'analytics_load_requested',
        });
      }
      hasTaskStartedRef.current = true;
      hasTaskCompletedRef.current = false;

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
      hasTaskCompletedRef.current = true;
      void logUxEvent(userId, 'task_completed', {
        flow: 'analytics_load',
        step: 'analytics_loaded',
        success: true,
        metadata: {
          recommendationCount: recs.length,
          likedCount: liked.length,
          wardrobeCount: wardrobe.length,
        },
      });

      if (isRefresh) {
        void logUxEvent(userId, 'recovered_from_error', {
          flow: 'analytics_load',
          step: 'manual_refresh_success',
          success: true,
        });
      }
    } catch (err) {
      void logUxEvent(userId, 'error_shown', {
        flow: 'analytics_load',
        step: isRefresh ? 'analytics_refresh_failed' : 'analytics_load_failed',
        reason: err instanceof Error ? err.message : 'unknown',
      });
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    return () => {
      if (!userId || !hasTaskStartedRef.current || hasTaskCompletedRef.current) return;

      void logUxEvent(userId, 'drop_off', {
        flow: 'analytics_load',
        step: 'abandoned_before_completion',
        reason: 'navigation_or_unmount',
      });
    };
  }, [userId]);

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
