'use client';

import { useMemo, useState } from 'react';
import type { SavedColorPalette } from '@/lib/colorPaletteService';

interface UseSavedPaletteFiltersResult {
  filterOccasion: string;
  setFilterOccasion: (value: string) => void;
  filterSeason: string;
  setFilterSeason: (value: string) => void;
  filteredPalettes: SavedColorPalette[];
  clearFilters: () => void;
  occasions: string[];
  seasons: string[];
}

const OCCASIONS = ['all', 'casual', 'formal', 'party', 'business', 'sports', 'date'];
const SEASONS = ['all', 'spring', 'summer', 'fall', 'winter'];

export function useSavedPaletteFilters(palettes: SavedColorPalette[]): UseSavedPaletteFiltersResult {
  const [filterOccasion, setFilterOccasion] = useState<string>('all');
  const [filterSeason, setFilterSeason] = useState<string>('all');

  const filteredPalettes = useMemo(() => {
    return palettes.filter((palette) => {
      const matchesOccasion = filterOccasion === 'all' || palette.occasions?.includes(filterOccasion);
      const matchesSeason = filterSeason === 'all' || palette.seasons?.includes(filterSeason);
      return matchesOccasion && matchesSeason;
    });
  }, [filterOccasion, filterSeason, palettes]);

  const clearFilters = () => {
    setFilterOccasion('all');
    setFilterSeason('all');
  };

  return {
    filterOccasion,
    setFilterOccasion,
    filterSeason,
    setFilterSeason,
    filteredPalettes,
    clearFilters,
    occasions: OCCASIONS,
    seasons: SEASONS,
  };
}
