/**
 * Blocklist Manager - Negative Preference System
 * 
 * Manages user's negative preferences (what they DON'T like) with three-tier system:
 * - Hard Blocklist: Never show these (explicit dislikes)
 * - Soft Blocklist: Deprioritize these (ignored patterns)
 * - Temporary Blocklist: Anti-repetition cache (recently shown)
 */

import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { doc, getDoc, updateDoc, setDoc, Timestamp, arrayUnion } from 'firebase/firestore';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface BlocklistItem {
  value: string; // color hex, style name, pattern name
  reason: string;
  addedAt: Date;
  count?: number; // For soft blocklist tracking
}

export interface TemporaryBlockItem {
  outfitData: {
    colorCombination: string; // "navy|orange|cream"
    styleKeywords: string[];
  };
  recommendedAt: Date;
  expiresAt: Date;
}

export interface Blocklists {
  hardBlocklist: {
    colors: BlocklistItem[];
    styles: BlocklistItem[];
    patterns: BlocklistItem[];
    fits: BlocklistItem[];
  };
  softBlocklist: {
    colors: BlocklistItem[];
    styles: BlocklistItem[];
  };
  temporaryBlocklist: {
    recentRecommendations: TemporaryBlockItem[];
  };
}

// ============================================
// FETCH BLOCKLISTS
// ============================================

/**
 * Get all blocklists for a user
 */
export async function getBlocklists(userId: string): Promise<Blocklists> {
  try {
    const prefsRef = doc(db, 'userPreferences', userId);
    const prefsDoc = await getDoc(prefsRef);

    if (prefsDoc.exists()) {
      const data = prefsDoc.data();
      const blocklists = data.blocklists || {};

      // Clean expired temporary items
      if (blocklists.temporaryBlocklist?.recentRecommendations) {
        const now = new Date();
        blocklists.temporaryBlocklist.recentRecommendations =
          blocklists.temporaryBlocklist.recentRecommendations.filter((item: any) => {
            const expiresAt = item.expiresAt?.toDate?.() || new Date(item.expiresAt);
            return expiresAt > now;
          });
      }

      return normalizeBlocklists(blocklists);
    }

    return getEmptyBlocklists();
  } catch (error) {
    logger.error('❌ [Blocklist] Failed to fetch blocklists:', error);
    return getEmptyBlocklists();
  }
}

/**
 * Normalize blocklists structure (convert Firestore Timestamps to Dates)
 */
function normalizeBlocklists(data: any): Blocklists {
  const convertItem = (item: any): BlocklistItem => ({
    value: item.value || item,
    reason: item.reason || 'User preference',
    addedAt: item.addedAt?.toDate?.() || new Date(item.addedAt || Date.now()),
    count: item.count,
  });

  const convertTempItem = (item: any): TemporaryBlockItem => ({
    outfitData: item.outfitData || { colorCombination: '', styleKeywords: [] },
    recommendedAt: item.recommendedAt?.toDate?.() || new Date(item.recommendedAt || Date.now()),
    expiresAt: item.expiresAt?.toDate?.() || new Date(item.expiresAt || Date.now()),
  });

  return {
    hardBlocklist: {
      colors: (data.hardBlocklist?.colors || []).map(convertItem),
      styles: (data.hardBlocklist?.styles || []).map(convertItem),
      patterns: (data.hardBlocklist?.patterns || []).map(convertItem),
      fits: (data.hardBlocklist?.fits || []).map(convertItem),
    },
    softBlocklist: {
      colors: (data.softBlocklist?.colors || []).map(convertItem),
      styles: (data.softBlocklist?.styles || []).map(convertItem),
    },
    temporaryBlocklist: {
      recentRecommendations: (data.temporaryBlocklist?.recentRecommendations || []).map(convertTempItem),
    },
  };
}

// ============================================
// HARD BLOCKLIST MANAGEMENT
// ============================================

/**
 * Add item to hard blocklist (never show this)
 */
export async function addToHardBlocklist(
  userId: string,
  type: 'colors' | 'styles' | 'patterns' | 'fits',
  value: string,
  reason: string
): Promise<void> {
  try {
    const prefsRef = doc(db, 'userPreferences', userId);
    const item: BlocklistItem = {
      value,
      reason,
      addedAt: new Date(),
    };

    await updateDoc(prefsRef, {
      [`blocklists.hardBlocklist.${type}`]: arrayUnion(item),
      updatedAt: Timestamp.now(),
    });

    logger.log(`✅ [Blocklist] Added to hard blocklist: ${type}/${value}`);
  } catch (error) {
    logger.error('❌ [Blocklist] Failed to add to hard blocklist:', error);
  }
}

/**
 * Remove item from hard blocklist
 */
export async function removeFromHardBlocklist(
  userId: string,
  type: 'colors' | 'styles' | 'patterns' | 'fits',
  value: string
): Promise<void> {
  try {
    const blocklists = await getBlocklists(userId);
    const updatedItems = blocklists.hardBlocklist[type].filter(item => item.value !== value);

    const prefsRef = doc(db, 'userPreferences', userId);
    await updateDoc(prefsRef, {
      [`blocklists.hardBlocklist.${type}`]: updatedItems,
      updatedAt: Timestamp.now(),
    });

    logger.log(`✅ [Blocklist] Removed from hard blocklist: ${type}/${value}`);
  } catch (error) {
    logger.error('❌ [Blocklist] Failed to remove from hard blocklist:', error);
  }
}

/**
 * Check if item is in hard blocklist
 */
export function isHardBlocked(blocklists: Blocklists, type: 'colors' | 'styles' | 'patterns' | 'fits', value: string): boolean {
  return blocklists.hardBlocklist[type].some(item => 
    item.value.toLowerCase() === value.toLowerCase()
  );
}

// ============================================
// SOFT BLOCKLIST MANAGEMENT
// ============================================

/**
 * Add or increment item in soft blocklist
 */
export async function addToSoftBlocklist(
  userId: string,
  type: 'colors' | 'styles',
  value: string,
  ignoreCount: number = 1
): Promise<void> {
  try {
    const blocklists = await getBlocklists(userId);
    const existingItems = blocklists.softBlocklist[type];
    const existingIndex = existingItems.findIndex(item => item.value === value);

    let updatedItems;
    if (existingIndex >= 0) {
      // Increment count
      updatedItems = [...existingItems];
      updatedItems[existingIndex].count = (updatedItems[existingIndex].count || 0) + ignoreCount;
    } else {
      // Add new item
      updatedItems = [...existingItems, {
        value,
        reason: 'Ignored multiple times',
        addedAt: new Date(),
        count: ignoreCount,
      }];
    }

    const prefsRef = doc(db, 'userPreferences', userId);
    await updateDoc(prefsRef, {
      [`blocklists.softBlocklist.${type}`]: updatedItems,
      updatedAt: Timestamp.now(),
    });

    logger.log(`✅ [Blocklist] Updated soft blocklist: ${type}/${value} (count: ${updatedItems[existingIndex]?.count || ignoreCount})`);
  } catch (error) {
    logger.error('❌ [Blocklist] Failed to add to soft blocklist:', error);
  }
}

/**
 * Get deprioritization weight for soft blocked item
 */
export function getSoftBlockWeight(blocklists: Blocklists, type: 'colors' | 'styles', value: string): number {
  const item = blocklists.softBlocklist[type].find(item => 
    item.value.toLowerCase() === value.toLowerCase()
  );
  
  if (!item) return 1.0; // Not blocked, full weight
  
  const ignoreCount = item.count || 1;
  if (ignoreCount >= 10) return 0.1; // Heavily deprioritized
  if (ignoreCount >= 5) return 0.3;
  return 0.5; // 50% deprioritization
}

// ============================================
// TEMPORARY BLOCKLIST (ANTI-REPETITION)
// ============================================

/**
 * Add outfit to temporary blocklist to prevent repetition
 */
export async function addToTemporaryBlocklist(
  userId: string,
  colorCombination: string[], // e.g., ['#000080', '#FFA500', '#FFFDD0']
  styleKeywords: string[],
  expirationDays: number = 30
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);

    const item: TemporaryBlockItem = {
      outfitData: {
        colorCombination: colorCombination.sort().join('|'),
        styleKeywords,
      },
      recommendedAt: now,
      expiresAt,
    };

    const prefsRef = doc(db, 'userPreferences', userId);
    await updateDoc(prefsRef, {
      'blocklists.temporaryBlocklist.recentRecommendations': arrayUnion(item),
      updatedAt: Timestamp.now(),
    });

    logger.log(`✅ [Blocklist] Added to temporary blocklist (expires: ${expiresAt.toLocaleDateString()})`);
  } catch (error) {
    logger.error('❌ [Blocklist] Failed to add to temporary blocklist:', error);
  }
}

/**
 * Check if color combination was recently recommended
 */
export function wasRecentlyRecommended(blocklists: Blocklists, colorCombination: string[]): boolean {
  const combKey = colorCombination.sort().join('|');
  const now = new Date();

  return blocklists.temporaryBlocklist.recentRecommendations.some(item => {
    if (item.expiresAt < now) return false; // Expired
    return item.outfitData.colorCombination === combKey;
  });
}

/**
 * Clean expired temporary blocklist items
 */
export async function cleanExpiredTemporaryBlocks(userId: string): Promise<void> {
  try {
    const blocklists = await getBlocklists(userId);
    const now = new Date();
    
    const activeItems = blocklists.temporaryBlocklist.recentRecommendations.filter(
      item => item.expiresAt > now
    );

    const prefsRef = doc(db, 'userPreferences', userId);
    await updateDoc(prefsRef, {
      'blocklists.temporaryBlocklist.recentRecommendations': activeItems,
      updatedAt: Timestamp.now(),
    });

    logger.log(`✅ [Blocklist] Cleaned expired temporary blocks`);
  } catch (error) {
    logger.error('❌ [Blocklist] Failed to clean temporary blocks:', error);
  }
}

// ============================================
// IGNORED SESSION ANALYSIS
// ============================================

/**
 * Analyze ignored session and update soft blocklist if patterns found
 */
export async function analyzeIgnoredSession(
  userId: string,
  ignoredOutfits: Array<{
    colorPalette: string[];
    styleKeywords: string[];
  }>
): Promise<void> {
  if (ignoredOutfits.length < 2) return; // Need at least 2 outfits to find patterns

  logger.log('🔍 [Blocklist] Analyzing ignored session for patterns');

  // Find common colors
  const colorCounts = new Map<string, number>();
  ignoredOutfits.forEach(outfit => {
    outfit.colorPalette.forEach(color => {
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    });
  });

  // Find common styles
  const styleCounts = new Map<string, number>();
  ignoredOutfits.forEach(outfit => {
    outfit.styleKeywords.forEach(style => {
      styleCounts.set(style, (styleCounts.get(style) || 0) + 1);
    });
  });

  const totalOutfits = ignoredOutfits.length;
  const threshold = totalOutfits * 0.7; // 70% similarity

  // Add colors that appear in 70%+ of ignored outfits
  for (const [color, count] of colorCounts.entries()) {
    if (count >= threshold) {
      await addToSoftBlocklist(userId, 'colors', color, 1);
      logger.log(`🔍 [Blocklist] Common ignored color: ${color} (${count}/${totalOutfits} outfits)`);
    }
  }

  // Add styles that appear in 70%+ of ignored outfits
  for (const [style, count] of styleCounts.entries()) {
    if (count >= threshold) {
      await addToSoftBlocklist(userId, 'styles', style, 1);
      logger.log(`🔍 [Blocklist] Common ignored style: ${style} (${count}/${totalOutfits} outfits)`);
    }
  }
}

/**
 * Promote soft blocklist items to hard blocklist if consistently ignored
 */
export async function promoteToHardBlocklist(userId: string): Promise<void> {
  const blocklists = await getBlocklists(userId);

  // Promote colors ignored 10+ times
  for (const item of blocklists.softBlocklist.colors) {
    if ((item.count || 0) >= 10) {
      await addToHardBlocklist(userId, 'colors', item.value, 'Consistently ignored (10+ times)');
      logger.log(`⬆️ [Blocklist] Promoted color to hard blocklist: ${item.value}`);
    }
  }

  // Promote styles ignored 10+ times
  for (const item of blocklists.softBlocklist.styles) {
    if ((item.count || 0) >= 10) {
      await addToHardBlocklist(userId, 'styles', item.value, 'Consistently ignored (10+ times)');
      logger.log(`⬆️ [Blocklist] Promoted style to hard blocklist: ${item.value}`);
    }
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getEmptyBlocklists(): Blocklists {
  return {
    hardBlocklist: {
      colors: [],
      styles: [],
      patterns: [],
      fits: [],
    },
    softBlocklist: {
      colors: [],
      styles: [],
    },
    temporaryBlocklist: {
      recentRecommendations: [],
    },
  };
}

/**
 * Check if outfit passes all blocklist filters
 */
export function passesBlocklistFilters(
  blocklists: Blocklists,
  outfit: {
    colorPalette: string[];
    styleKeywords: string[];
  }
): { passes: boolean; reason?: string } {
  // Check hard blocklist colors
  for (const color of outfit.colorPalette) {
    if (isHardBlocked(blocklists, 'colors', color)) {
      return { passes: false, reason: `Color ${color} is hard blocked` };
    }
  }

  // Check hard blocklist styles
  for (const style of outfit.styleKeywords) {
    if (isHardBlocked(blocklists, 'styles', style)) {
      return { passes: false, reason: `Style ${style} is hard blocked` };
    }
  }

  // Check temporary blocklist
  if (wasRecentlyRecommended(blocklists, outfit.colorPalette)) {
    return { passes: false, reason: 'Color combination recently recommended' };
  }

  return { passes: true };
}

/**
 * Calculate overall outfit score considering soft blocklists
 */
export function calculateOutfitScore(
  blocklists: Blocklists,
  outfit: {
    colorPalette: string[];
    styleKeywords: string[];
  },
  baseScore: number = 100
): number {
  let score = baseScore;

  // Apply soft blocklist penalties
  for (const color of outfit.colorPalette) {
    const weight = getSoftBlockWeight(blocklists, 'colors', color);
    if (weight < 1.0) {
      score *= weight;
    }
  }

  for (const style of outfit.styleKeywords) {
    const weight = getSoftBlockWeight(blocklists, 'styles', style);
    if (weight < 1.0) {
      score *= weight;
    }
  }

  return Math.round(score);
}
