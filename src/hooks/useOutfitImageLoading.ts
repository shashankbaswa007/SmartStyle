'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type ImageState = 'loading' | 'loaded' | 'error' | 'placeholder';

interface OutfitLike {
  id: string;
  imageUrl?: string;
}

interface UseOutfitImageLoadingResult {
  placeholderImage: string;
  imageStates: Map<string, ImageState>;
  imageRetryCount: Map<string, number>;
  getSafeImageUrl: (url?: string) => string;
  markImageLoaded: (outfitId: string) => void;
  markImageError: (outfitId: string) => void;
  retryImageLoad: (outfitId: string) => void;
}

const DEFAULT_PLACEHOLDER_IMAGE = 'https://via.placeholder.com/800x1000/6366f1/ffffff?text=Outfit+Preview';

export function useOutfitImageLoading(outfits: OutfitLike[]): UseOutfitImageLoadingResult {
  const [imageStates, setImageStates] = useState<Map<string, ImageState>>(new Map());
  const [imageRetryCount, setImageRetryCount] = useState<Map<string, number>>(new Map());

  const placeholderImage = useMemo(() => DEFAULT_PLACEHOLDER_IMAGE, []);

  const getSafeImageUrl = useCallback((url?: string): string => {
    if (!url) return placeholderImage;
    if (url.startsWith('data:')) return url;
    try {
      const parsed = new URL(url);
      return parsed.toString();
    } catch {
      return placeholderImage;
    }
  }, [placeholderImage]);

  useEffect(() => {
    const states = new Map<string, ImageState>();
    outfits.forEach((outfit) => {
      const safeUrl = getSafeImageUrl(outfit.imageUrl);
      if (safeUrl === placeholderImage) {
        states.set(outfit.id, 'placeholder');
      } else if (safeUrl.startsWith('data:')) {
        states.set(outfit.id, 'loaded');
      } else {
        states.set(outfit.id, 'loading');
      }
    });

    setImageStates(states);
    setImageRetryCount(new Map());
  }, [getSafeImageUrl, outfits, placeholderImage]);

  useEffect(() => {
    const hasLoadingImages = Array.from(imageStates.values()).some((state) => state === 'loading');
    if (!hasLoadingImages) return;

    const timeoutId = window.setTimeout(() => {
      setImageStates((prev) => {
        let changed = false;
        const next = new Map(prev);
        prev.forEach((state, outfitId) => {
          if (state === 'loading') {
            next.set(outfitId, 'error');
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 15_000);

    return () => window.clearTimeout(timeoutId);
  }, [imageStates]);

  const markImageLoaded = useCallback((outfitId: string) => {
    setImageStates((prev) => {
      const next = new Map(prev);
      next.set(outfitId, 'loaded');
      return next;
    });
  }, []);

  const markImageError = useCallback((outfitId: string) => {
    setImageStates((prev) => {
      const next = new Map(prev);
      next.set(outfitId, 'error');
      return next;
    });
  }, []);

  const retryImageLoad = useCallback((outfitId: string) => {
    const currentRetries = imageRetryCount.get(outfitId) || 0;
    if (currentRetries >= 1) {
      markImageError(outfitId);
      return;
    }

    setImageRetryCount((prev) => {
      const next = new Map(prev);
      next.set(outfitId, currentRetries + 1);
      return next;
    });

    setImageStates((prev) => {
      const next = new Map(prev);
      next.set(outfitId, 'loading');
      return next;
    });
  }, [imageRetryCount, markImageError]);

  return {
    placeholderImage,
    imageStates,
    imageRetryCount,
    getSafeImageUrl,
    markImageLoaded,
    markImageError,
    retryImageLoad,
  };
}
