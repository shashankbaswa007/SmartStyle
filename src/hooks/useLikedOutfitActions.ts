'use client';

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from '@/hooks/use-toast';
import { markLikedOutfitAsWorn, removeLikedOutfit } from '@/lib/likedOutfits';
import { updatePreferencesFromWear } from '@/lib/preference-engine';
import type { LikedOutfit } from '@/hooks/useLikedOutfits';

interface UseLikedOutfitActionsParams {
  userId: string | null;
  setLikedOutfits: Dispatch<SetStateAction<LikedOutfit[]>>;
}

interface UseLikedOutfitActionsResult {
  markingWornId: string | null;
  handleRemoveLike: (outfitId: string, outfitTitle: string) => Promise<void>;
  handleMarkAsWorn: (outfit: LikedOutfit) => Promise<void>;
}

function getCurrentSeason(): 'summer' | 'winter' | 'monsoon' {
  const month = new Date().getMonth() + 1;
  if (month >= 6 && month <= 9) return 'monsoon';
  if (month >= 11 || month <= 2) return 'winter';
  return 'summer';
}

export function useLikedOutfitActions({ userId, setLikedOutfits }: UseLikedOutfitActionsParams): UseLikedOutfitActionsResult {
  const [markingWornId, setMarkingWornId] = useState<string | null>(null);

  const handleRemoveLike = useCallback(async (outfitId: string, outfitTitle: string) => {
    if (!userId) return;

    try {
      const result = await removeLikedOutfit(userId, outfitId);

      if (result.success) {
        setLikedOutfits((prev) => prev.filter((outfit) => outfit.id !== outfitId));

        toast({
          title: 'Removed from likes',
          description: `"${outfitTitle}" has been removed from your favorites.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to remove',
          description: result.message,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to remove outfit from likes',
      });
    }
  }, [setLikedOutfits, userId]);

  const handleMarkAsWorn = useCallback(async (outfit: LikedOutfit) => {
    if (!userId || !outfit.id || outfit.wornAt) return;

    setMarkingWornId(outfit.id);
    try {
      const season = getCurrentSeason();
      const prefResult = await updatePreferencesFromWear(userId, {
        colorPalette: outfit.colorPalette,
        items: outfit.items,
        styleType: outfit.styleType,
        occasion: outfit.occasion,
        description: outfit.description,
        title: outfit.title,
      }, {
        occasion: outfit.occasion || 'casual',
        season,
      });

      if (!prefResult.success) {
        throw new Error(prefResult.message || 'Failed to update preferences');
      }

      const wearResult = await markLikedOutfitAsWorn(userId, outfit.id);
      if (!wearResult.success) {
        throw new Error(wearResult.message || 'Failed to save worn state');
      }

      setLikedOutfits((prev) => prev.map((item) =>
        item.id === outfit.id ? { ...item, wornAt: Date.now() } : item
      ));

      toast({
        title: 'Marked as worn',
        description: `We'll use ${outfit.title} as a strong preference signal for future recommendations.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to mark outfit as worn',
      });
    } finally {
      setMarkingWornId(null);
    }
  }, [setLikedOutfits, userId]);

  return {
    markingWornId,
    handleRemoveLike,
    handleMarkAsWorn,
  };
}
