'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getWardrobeItems, type WardrobeItemData } from '@/lib/wardrobeService';
import chroma from 'chroma-js';

interface MatchingWardrobeItemsProps {
  paletteColors: string[]; // Hex color codes from the palette
  onItemClick?: (item: WardrobeItemData) => void;
}

export function MatchingWardrobeItems({
  paletteColors,
  onItemClick,
}: MatchingWardrobeItemsProps) {
  const [user, setUser] = useState<User | null>(null);
  const [matchingItems, setMatchingItems] = useState<WardrobeItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMatchingItems = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(false);

      try {
        const allItems = await getWardrobeItems(user.uid);
        if (!cancelled) {
          const matches = findMatchingItems(allItems, paletteColors);
          setMatchingItems(matches);
        }
      } catch (error) {
        console.error('Error loading matching items:', error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadMatchingItems();
    return () => { cancelled = true; };
  }, [user, paletteColors]);

  const findMatchingItems = (
    items: WardrobeItemData[],
    colors: string[]
  ): WardrobeItemData[] => {
    const DELTA_E_THRESHOLD = 40; // Color matching threshold - allows reasonable matches
    const INPUT_SIMILARITY_THRESHOLD = 35; // Threshold to exclude colors too similar to input
    
    // The first color is the input color
    const inputColor = colors[0];
    
    // Filter out ALL colors that are too similar to the input color
    // This removes not just the input itself, but also tints/shades like "Light Blue", "Navy", etc.
    let complementaryColors: string[] = [];
    try {
      const inputChroma = chroma(inputColor);
      complementaryColors = colors.slice(1).filter((color) => {
        try {
          const colorChroma = chroma(color);
          const deltaE = chroma.deltaE(inputChroma, colorChroma);
          return deltaE >= INPUT_SIMILARITY_THRESHOLD;
        } catch (e) {
          return true; // Keep if we can't parse
        }
      });
    } catch (e) {
      // If input color parsing fails, use all colors except first
      complementaryColors = colors.slice(1);
    }
    
    if (complementaryColors.length === 0) {
      return []; // No complementary colors to match against
    }

    const matched = items.filter((item) => {
      if (!item.dominantColors || item.dominantColors.length === 0) {
        return false;
      }

      // Check if any item color matches any COMPLEMENTARY color
      // (we already filtered out colors similar to input)
      return item.dominantColors.some((itemColor) => {
        try {
          const itemChroma = chroma(itemColor);
          
          // Check if it matches any complementary color
          return complementaryColors.some((complementaryColor) => {
            try {
              const complementaryChroma = chroma(complementaryColor);
              const deltaE = chroma.deltaE(itemChroma, complementaryChroma);
              return deltaE < DELTA_E_THRESHOLD;
            } catch (e) {
              return false;
            }
          });
        } catch (e) {
          return false;
        }
      });
    });
    
    return matched;
  };

  if (!user) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-xl p-6 border-2 border-dashed border-purple-300 dark:border-purple-700">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-purple-400 dark:text-purple-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Connect Your Wardrobe
          </h3>
          <p className="text-muted-foreground text-sm">
            Sign in to see wardrobe items that match this color palette
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-sm border border-border" role="status" aria-label="Loading matching wardrobe items">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
          <div className="h-6 bg-muted rounded w-48 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (matchingItems.length === 0) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-xl p-6 border-2 border-dashed border-blue-300 dark:border-blue-700">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-blue-400 dark:text-blue-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {loadError ? 'Could Not Load Wardrobe' : 'No Matching Items Yet'}
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            {loadError
              ? 'Check your connection and try refreshing the page'
              : 'Add items to your wardrobe to see color matches'}
          </p>
          {!loadError && (
            <a
              href="/wardrobe"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Wardrobe Items
            </a>
          )}
        </div>
      </div>
    );
  }

  const displayItems = isExpanded ? matchingItems : matchingItems.slice(0, 4);

  return (
    <div className="bg-card rounded-xl p-6 shadow-sm border border-border" role="region" aria-label="Matching wardrobe items">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Matching Wardrobe Items
            </h3>
            <p className="text-sm text-muted-foreground">
              {matchingItems.length} {matchingItems.length === 1 ? 'item' : 'items'} from your wardrobe
            </p>
          </div>
        </div>

        {matchingItems.length > 4 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded px-2 py-1"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Show fewer matching items' : `View all ${matchingItems.length} matching items`}
          >
            {isExpanded ? 'Show Less' : `View All (${matchingItems.length})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {displayItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick?.(item)}
            className="group relative aspect-square rounded-lg overflow-hidden bg-muted hover:ring-4 hover:ring-purple-500/50 transition-all focus:outline-none focus:ring-4 focus:ring-purple-500/50"
            aria-label={`${item.description || item.itemType} - matching wardrobe item`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.images?.thumbnail || item.imageUrl}
              alt={item.description || 'Wardrobe item'}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
            
            {/* Item colors overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <div className="flex gap-1.5 mb-2">
                {item.dominantColors?.slice(0, 4).map((color, idx) => (
                  <div
                    key={idx}
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <p className="text-white text-xs font-medium truncate">
                {item.itemType}
              </p>
            </div>

            {/* Match indicator */}
            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
              ✓
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          💡 These items from your wardrobe match the colors in this palette
        </p>
      </div>
    </div>
  );
}
