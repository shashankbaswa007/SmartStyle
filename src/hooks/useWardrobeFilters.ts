'use client';

import { useCallback, useMemo, useState } from 'react';
import type { WardrobeItemData } from '@/lib/wardrobeService';

export const CONTEXT_MODES = ['all', 'work', 'casual', 'travel', 'weather', 'occasion'] as const;
export type ContextMode = typeof CONTEXT_MODES[number];

export const SORT_OPTIONS = ['recent', 'most-worn', 'least-worn', 'never-worn', 'alphabetical'] as const;
export type SortOption = typeof SORT_OPTIONS[number];

interface UseWardrobeFiltersParams {
  wardrobeItems: WardrobeItemData[];
  selectedFilter: string;
  contextMode: ContextMode;
}

export function useWardrobeFilters({
  wardrobeItems,
  selectedFilter,
  contextMode,
}: UseWardrobeFiltersParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [groupByColor, setGroupByColor] = useState(false);

  const applyContextFilter = useCallback((items: WardrobeItemData[]) => {
    if (contextMode === 'all') return items;

    return items.filter((item) => {
      const occasions = item.occasions || [];
      const season = item.season || [];

      switch (contextMode) {
        case 'work':
          return occasions.includes('business') || occasions.includes('formal');
        case 'casual':
          return occasions.includes('casual');
        case 'travel':
          return occasions.includes('casual') || item.itemType === 'shoes' || item.itemType === 'outerwear';
        case 'weather':
          return season.length > 0;
        case 'occasion':
          return occasions.includes('formal') || occasions.includes('party');
        default:
          return true;
      }
    });
  }, [contextMode]);

  const applySearchFilter = useCallback((items: WardrobeItemData[]) => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const searchableFields = [
        item.description,
        item.itemType,
        item.category,
        item.brand,
        item.notes,
        ...(item.occasions || []),
        ...(item.season || []),
      ]
        .filter(Boolean)
        .map((field) => field?.toLowerCase() || '');

      return searchableFields.some((field) => field.includes(query));
    });
  }, [searchQuery]);

  const applySorting = useCallback((items: WardrobeItemData[]) => {
    const sorted = [...items];

    switch (sortBy) {
      case 'most-worn':
        return sorted.sort((a, b) => (b.wornCount || 0) - (a.wornCount || 0));
      case 'least-worn':
        return sorted.sort((a, b) => (a.wornCount || 0) - (b.wornCount || 0));
      case 'never-worn':
        return sorted
          .filter((item) => !item.wornCount || item.wornCount === 0)
          .concat(sorted.filter((item) => item.wornCount && item.wornCount > 0));
      case 'alphabetical':
        return sorted.sort((a, b) => (a.description || '').localeCompare(b.description || ''));
      case 'recent':
      default:
        return sorted.sort((a, b) => {
          const dateA = typeof a.addedDate === 'number' ? a.addedDate : 0;
          const dateB = typeof b.addedDate === 'number' ? b.addedDate : 0;
          return dateB - dateA;
        });
    }
  }, [sortBy]);

  const filteredItems = useMemo(() => {
    let items = selectedFilter === 'all'
      ? wardrobeItems
      : wardrobeItems.filter((item) => item.itemType === selectedFilter);

    items = applyContextFilter(items);
    items = applySearchFilter(items);
    items = applySorting(items);

    return items;
  }, [applyContextFilter, applySearchFilter, applySorting, selectedFilter, wardrobeItems]);

  const groupItemsByColor = useCallback((items: WardrobeItemData[]) => {
    const colorGroups: { [key: string]: WardrobeItemData[] } = {};

    items.forEach((item) => {
      const primaryColor = item.dominantColors?.[0] || '#808080';
      if (!colorGroups[primaryColor]) {
        colorGroups[primaryColor] = [];
      }
      colorGroups[primaryColor].push(item);
    });

    return Object.entries(colorGroups)
      .map(([color, groupedItems]) => ({
        color,
        items: groupedItems,
        count: groupedItems.length,
      }))
      .sort((a, b) => b.count - a.count);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    groupByColor,
    setGroupByColor,
    filteredItems,
    applyContextFilter,
    groupItemsByColor,
  };
}
