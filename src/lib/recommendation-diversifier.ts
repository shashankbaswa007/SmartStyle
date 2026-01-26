/**
 * Recommendation Diversifier - Phase 6
 * 
 * Implements 70-20-10 diversification rule to balance personalization with exploration:
 * - Position 1 (70%): Safe bet - 90-100% match with user preferences
 * - Position 2 (20%): Adjacent exploration - 70-89% match, slightly stretch boundaries
 * - Position 3 (10%): Learning boundary - 50-69% match, discover new styles
 * 
 * Prevents echo chamber effect and style stagnation.
 */

import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { ComprehensivePreferences } from './preference-engine';
import type { Blocklists, BlocklistItem, TemporaryBlockItem } from './blocklist-manager';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface OutfitMatch {
  outfit: any; // The outfit object
  matchScore: number; // 0-100
  matchBreakdown: {
    colorMatch: number; // 0-100
    styleMatch: number; // 0-100
    occasionMatch: number; // 0-100
    seasonalMatch: number; // 0-100
  };
  matchCategory: 'perfect' | 'great' | 'exploring';
  explanation: string;
}

export interface DiversificationConfig {
  perfectMatchTarget: number; // 90-100% (Position 1)
  greatMatchTarget: number; // 70-89% (Position 2)
  exploringMatchTarget: number; // 50-69% (Position 3)
  adaptiveExplorationBonus: number; // +/- adjustment based on user response
  antiRepetitionEnabled: boolean;
}

export interface AntiRepetitionCache {
  userId: string;
  recentColorCombos: Array<{ combo: string[]; timestamp: Date }>; // 30-day cache
  recentStyles: Array<{ style: string; timestamp: Date }>; // 15-day cache
  recentOccasions: Array<{ occasion: string; timestamp: Date }>; // 7-day cache
  lastUpdated: Date;
}

export interface ExplorationMetrics {
  userId: string;
  totalExplorationShown: number;
  totalExplorationLiked: number;
  totalExplorationWorn: number;
  explorationSuccessRate: number; // Percentage
  adaptiveExplorationLevel: number; // 0-100 (current exploration aggressiveness)
  lastAdjusted: Date;
}

export interface PatternLockStatus {
  userId: string;
  isLocked: boolean;
  lockReason?: string;
  dominantColor?: string; // Color user is stuck on
  dominantStyle?: string; // Style user is stuck on
  lockStartDate?: Date;
  forceExplorationPercentage: number; // 0-40%
}

// ============================================
// MATCH SCORE CALCULATION
// ============================================

/**
 * Calculate comprehensive match score for an outfit
 * Returns 0-100 score with detailed breakdown
 */
export function calculateOutfitMatchScore(
  outfit: {
    colorPalette?: string[];
    colors?: string[];
    styleType?: string;
    style?: string;
    occasion?: string;
    items?: string[];
    description?: string;
  },
  userPreferences: ComprehensivePreferences,
  userBlocklists: Blocklists
): OutfitMatch {
  // Extract outfit properties
  const outfitColors = [...(outfit.colorPalette || []), ...(outfit.colors || [])];
  const outfitStyle = outfit.styleType || outfit.style || 'casual';
  const outfitOccasion = outfit.occasion || 'casual';

  // 1. Color Match Score (35% weight)
  const colorMatch = calculateColorMatch(outfitColors, userPreferences);

  // 2. Style Match Score (30% weight)
  const styleMatch = calculateStyleMatch(outfitStyle, userPreferences);

  // 3. Occasion Match Score (20% weight)
  const occasionMatch = calculateOccasionMatch(outfitOccasion, userPreferences);

  // 4. Seasonal Match Score (15% weight)
  const seasonalMatch = calculateSeasonalMatch(outfitColors, outfitStyle, userPreferences);

  // Weighted total score
  const matchScore = Math.round(
    colorMatch * 0.35 +
    styleMatch * 0.30 +
    occasionMatch * 0.20 +
    seasonalMatch * 0.15
  );

  // Apply blocklist penalties
  const penalizedScore = applyBlocklistPenalties(matchScore, outfit, userBlocklists);

  // Determine category
  let matchCategory: 'perfect' | 'great' | 'exploring';
  if (penalizedScore >= 90) matchCategory = 'perfect';
  else if (penalizedScore >= 70) matchCategory = 'great';
  else matchCategory = 'exploring';

  // Generate explanation
  const explanation = generateMatchExplanation(
    penalizedScore,
    { colorMatch, styleMatch, occasionMatch, seasonalMatch },
    userPreferences
  );

  return {
    outfit,
    matchScore: penalizedScore,
    matchBreakdown: {
      colorMatch,
      styleMatch,
      occasionMatch,
      seasonalMatch,
    },
    matchCategory,
    explanation,
  };
}

/**
 * Calculate color match score (0-100)
 */
function calculateColorMatch(
  outfitColors: string[],
  preferences: ComprehensivePreferences
): number {
  if (outfitColors.length === 0) return 50; // Neutral if no colors

  const favoriteColors = preferences.colors.favoriteColors.map(c => c.name.toLowerCase());
  const dislikedColors = preferences.colors.dislikedColors.map(c => c.name.toLowerCase());

  let matchPoints = 0;
  let totalPoints = outfitColors.length * 100;

  outfitColors.forEach(color => {
    const normalizedColor = color.toLowerCase().trim();
    
    // Check favorite colors
    const favoriteMatch = favoriteColors.find(fav => 
      normalizedColor.includes(fav) || fav.includes(normalizedColor)
    );
    
    if (favoriteMatch) {
      const colorPref = preferences.colors.favoriteColors.find(c => 
        c.name.toLowerCase() === favoriteMatch
      );
      matchPoints += colorPref ? Math.min(colorPref.weight * 10, 100) : 80;
    }
    // Check disliked colors
    else if (dislikedColors.some(dis => normalizedColor.includes(dis) || dis.includes(normalizedColor))) {
      matchPoints += 20; // Low score for disliked colors
    }
    // Neutral color
    else {
      matchPoints += 50;
    }
  });

  return Math.min(100, Math.round((matchPoints / totalPoints) * 100));
}

/**
 * Calculate style match score (0-100)
 */
function calculateStyleMatch(
  outfitStyle: string,
  preferences: ComprehensivePreferences
): number {
  const normalizedStyle = outfitStyle.toLowerCase().trim();
  
  // Check if style matches top preferences
  const styleMatch = preferences.styles.topStyles.find(s => 
    normalizedStyle.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(normalizedStyle)
  );

  if (styleMatch) {
    // Higher weight = better match
    return Math.min(100, Math.round(styleMatch.weight * 10));
  }

  // Check if it's a related style
  const relatedKeywords = ['casual', 'formal', 'smart', 'elegant', 'modern', 'classic'];
  if (relatedKeywords.some(kw => normalizedStyle.includes(kw))) {
    return 60; // Neutral score for common styles
  }

  return 50; // Default neutral score
}

/**
 * Calculate occasion match score (0-100)
 */
function calculateOccasionMatch(
  outfitOccasion: string,
  preferences: ComprehensivePreferences
): number {
  const normalizedOccasion = outfitOccasion.toLowerCase().trim();
  
  // Check occasion-specific preferences
  const occasionMap = preferences.styles.occasionStyles;
  const matchingOccasion = occasionMap[normalizedOccasion as keyof typeof occasionMap];

  if (matchingOccasion && matchingOccasion.length > 0) {
    // Calculate average weight of occasion styles
    const avgWeight = matchingOccasion.reduce((sum, style) => sum + style.weight, 0) / matchingOccasion.length;
    return Math.min(100, Math.round(avgWeight * 10));
  }

  return 70; // Default good score (occasions are less critical)
}

/**
 * Calculate seasonal match score (0-100)
 */
function calculateSeasonalMatch(
  outfitColors: string[],
  outfitStyle: string,
  preferences: ComprehensivePreferences
): number {
  const currentMonth = new Date().getMonth() + 1;
  let currentSeason: 'summer' | 'winter' | 'monsoon';

  if (currentMonth >= 6 && currentMonth <= 9) currentSeason = 'monsoon';
  else if (currentMonth >= 11 || currentMonth <= 2) currentSeason = 'winter';
  else currentSeason = 'summer';

  const seasonalPrefs = preferences.seasonal[currentSeason];
  
  // Check if outfit colors match seasonal preferences
  let matchCount = 0;
  outfitColors.forEach(color => {
    const normalizedColor = color.toLowerCase().trim();
    if (seasonalPrefs.colors.some(sc => normalizedColor.includes(sc) || sc.includes(normalizedColor))) {
      matchCount++;
    }
  });

  const colorSeasonalScore = outfitColors.length > 0 
    ? (matchCount / outfitColors.length) * 100 
    : 50;

  // Check if style matches seasonal preferences
  const normalizedStyle = outfitStyle.toLowerCase();
  const styleSeasonalScore = seasonalPrefs.styles.some(ss => 
    normalizedStyle.includes(ss) || ss.includes(normalizedStyle)
  ) ? 90 : 60;

  return Math.round((colorSeasonalScore + styleSeasonalScore) / 2);
}

/**
 * Apply blocklist penalties to match score
 */
function applyBlocklistPenalties(
  baseScore: number,
  outfit: any,
  blocklists: Blocklists
): number {
  let penalizedScore = baseScore;

  const outfitColors = [...(outfit.colorPalette || []), ...(outfit.colors || [])];
  const outfitStyle = outfit.styleType || outfit.style || '';

  // Hard blocklist: Severe penalty (-40 points)
  blocklists.hardBlocklist.colors.forEach((item: BlocklistItem) => {
    if (outfitColors.some((c: string) => c.toLowerCase().includes(item.value.toLowerCase()))) {
      penalizedScore -= 40;
    }
  });

  blocklists.hardBlocklist.styles.forEach((item: BlocklistItem) => {
    if (outfitStyle.toLowerCase().includes(item.value.toLowerCase())) {
      penalizedScore -= 40;
    }
  });

  // Soft blocklist: Moderate penalty (-20 points)
  blocklists.softBlocklist.colors.forEach((item: BlocklistItem) => {
    if (outfitColors.some((c: string) => c.toLowerCase().includes(item.value.toLowerCase()))) {
      penalizedScore -= 20;
    }
  });

  blocklists.softBlocklist.styles.forEach((item: BlocklistItem) => {
    if (outfitStyle.toLowerCase().includes(item.value.toLowerCase())) {
      penalizedScore -= 20;
    }
  });

  // Temporary blocklist: Check recent recommendations
  const colorCombo = outfitColors.join('|').toLowerCase();
  blocklists.temporaryBlocklist.recentRecommendations.forEach((item: TemporaryBlockItem) => {
    const recentCombo = item.outfitData.colorCombination.toLowerCase();
    if (colorCombo.includes(recentCombo) || recentCombo.includes(colorCombo)) {
      penalizedScore -= 10;
    }
  });

  return Math.max(0, Math.min(100, penalizedScore));
}

/**
 * Generate human-readable explanation for match score
 */
function generateMatchExplanation(
  score: number,
  breakdown: { colorMatch: number; styleMatch: number; occasionMatch: number; seasonalMatch: number },
  preferences: ComprehensivePreferences
): string {
  const topColor = preferences.colors.favoriteColors[0]?.name || 'your preferred colors';
  const topStyle = preferences.styles.topStyles[0]?.name || 'your style';

  if (score >= 90) {
    return `💡 Perfect match! This outfit combines ${topColor} and ${topStyle} style—exactly what you love.`;
  } else if (score >= 70) {
    if (breakdown.colorMatch >= 80) {
      return `✨ Great match! Features your favorite colors with a slightly different style to keep things fresh.`;
    } else if (breakdown.styleMatch >= 80) {
      return `✨ Great match! Matches your ${topStyle} style with complementary colors you might enjoy.`;
    } else {
      return `✨ Great match! Balances your preferences with new elements to discover.`;
    }
  } else {
    return `🔍 Exploring new territory! This style could expand your wardrobe with fresh combinations.`;
  }
}

// ============================================
// 70-20-10 DIVERSIFICATION RULE
// ============================================

/**
 * Apply 70-20-10 diversification rule to outfit recommendations
 * Position 1 (Index 0): 90-100% match (Safe bet)
 * Position 2 (Index 1): 70-89% match (Adjacent exploration)
 * Position 3 (Index 2): 50-69% match (Learning boundary)
 */
export function applyDiversificationRule(
  outfitMatches: OutfitMatch[]
): OutfitMatch[] {
  if (outfitMatches.length < 3) {
    logger.warn('⚠️ Less than 3 outfits provided, diversification rule cannot be fully applied');
    return outfitMatches;
  }

  // Sort by match score (highest first)
  const sorted = [...outfitMatches].sort((a, b) => b.matchScore - a.matchScore);

  // Check if all scores are identical or very close (no meaningful personalization)
  const scoreRange = sorted[0].matchScore - sorted[sorted.length - 1].matchScore;
  
  if (scoreRange <= 5) {
    // All scores essentially identical - user has no preferences yet
    logger.log('ℹ️ All outfits have similar/identical scores (no personalization data).');
    logger.log(`   Score range: ${sorted[0].matchScore} to ${sorted[sorted.length - 1].matchScore}`);
    logger.log('   Assigning variety categories for display purposes.');
    
    // Return outfits with sequential categories for UX variety
    // AI already generated diverse outfits, we just label them differently
    const diversified = sorted.map((match, index) => ({
      ...match,
      matchCategory: (index === 0 ? 'perfect' : index === 1 ? 'great' : 'exploring') as 'perfect' | 'great' | 'exploring',
    }));

    logger.log('🎯 Diversification applied:', {
      position1: diversified[0].matchScore,
      position2: diversified[1].matchScore,
      position3: diversified[2].matchScore,
    });

    return diversified;
  }

  // Categorize outfits
  const perfectMatches = sorted.filter(m => m.matchScore >= 90);
  const greatMatches = sorted.filter(m => m.matchScore >= 70 && m.matchScore < 90);
  const exploringMatches = sorted.filter(m => m.matchScore >= 50 && m.matchScore < 70);
  const poorMatches = sorted.filter(m => m.matchScore < 50);

  const diversified: OutfitMatch[] = [];

  // Position 1: Perfect match (90-100%)
  if (perfectMatches.length > 0) {
    diversified.push(perfectMatches[0]);
  } else if (greatMatches.length > 0) {
    diversified.push(greatMatches[0]); // Use best available
  } else {
    diversified.push(sorted[0]); // Use highest score available
  }

  // Position 2: Great match (70-89%)
  if (greatMatches.length > 0) {
    diversified.push(greatMatches[0]);
  } else if (perfectMatches.length > 1) {
    diversified.push(perfectMatches[1]); // Second perfect match
  } else if (exploringMatches.length > 0) {
    diversified.push(exploringMatches[0]); // Use exploring if no great matches
  } else {
    diversified.push(sorted[1] || sorted[0]);
  }

  // Position 3: Exploring match (50-69%)
  if (exploringMatches.length > 0) {
    diversified.push(exploringMatches[0]);
  } else if (greatMatches.length > 1) {
    diversified.push(greatMatches[1]); // Second great match
  } else if (poorMatches.length > 0) {
    diversified.push(poorMatches[0]); // Even poor matches for exploration
  } else {
    diversified.push(sorted[2] || sorted[1] || sorted[0]);
  }

  logger.log('🎯 Diversification applied:', {
    position1: diversified[0].matchScore,
    position2: diversified[1]?.matchScore,
    position3: diversified[2]?.matchScore,
  });

  return diversified;
}

// ============================================
// ANTI-REPETITION CACHE
// ============================================

/**
 * Get anti-repetition cache for user
 */
export async function getAntiRepetitionCache(userId: string): Promise<AntiRepetitionCache> {
  try {
    const cacheRef = doc(db, 'antiRepetitionCache', userId);
    const cacheDoc = await getDoc(cacheRef);

    if (cacheDoc.exists()) {
      const data = cacheDoc.data();
      return {
        userId,
        recentColorCombos: data.recentColorCombos || [],
        recentStyles: data.recentStyles || [],
        recentOccasions: data.recentOccasions || [],
        lastUpdated: data.lastUpdated?.toDate() || new Date(),
      };
    }

    // Initialize empty cache
    const emptyCache: AntiRepetitionCache = {
      userId,
      recentColorCombos: [],
      recentStyles: [],
      recentOccasions: [],
      lastUpdated: new Date(),
    };

    await setDoc(cacheRef, {
      ...emptyCache,
      lastUpdated: serverTimestamp(),
    });

    return emptyCache;
  } catch (error: any) {
    if (error?.code !== 'permission-denied') {
      logger.error('❌ Error getting anti-repetition cache:', error);
    }
    return {
      userId,
      recentColorCombos: [],
      recentStyles: [],
      recentOccasions: [],
      lastUpdated: new Date(),
    };
  }
}

/**
 * Add outfit to anti-repetition cache
 */
export async function addToAntiRepetitionCache(
  userId: string,
  outfit: {
    colorPalette?: string[];
    colors?: string[];
    styleType?: string;
    style?: string;
    occasion?: string;
  }
): Promise<void> {
  try {
    const cache = await getAntiRepetitionCache(userId);
    const now = new Date();

    // Add color combination (30-day cache)
    const colors = [...(outfit.colorPalette || []), ...(outfit.colors || [])].slice(0, 3);
    if (colors.length >= 2) {
      cache.recentColorCombos.push({ combo: colors, timestamp: now });
      // Keep only last 30 days
      cache.recentColorCombos = cache.recentColorCombos.filter(entry => 
        (now.getTime() - entry.timestamp.getTime()) < 30 * 24 * 60 * 60 * 1000
      );
    }

    // Add style (15-day cache)
    const style = outfit.styleType || outfit.style;
    if (style) {
      cache.recentStyles.push({ style, timestamp: now });
      // Keep only last 15 days
      cache.recentStyles = cache.recentStyles.filter(entry =>
        (now.getTime() - entry.timestamp.getTime()) < 15 * 24 * 60 * 60 * 1000
      );
    }

    // Add occasion (7-day cache)
    if (outfit.occasion) {
      cache.recentOccasions.push({ occasion: outfit.occasion, timestamp: now });
      // Keep only last 7 days
      cache.recentOccasions = cache.recentOccasions.filter(entry =>
        (now.getTime() - entry.timestamp.getTime()) < 7 * 24 * 60 * 60 * 1000
      );
    }

    // Update Firestore
    const cacheRef = doc(db, 'antiRepetitionCache', userId);
    await updateDoc(cacheRef, {
      recentColorCombos: cache.recentColorCombos,
      recentStyles: cache.recentStyles,
      recentOccasions: cache.recentOccasions,
      lastUpdated: serverTimestamp(),
    });

    logger.log('✅ Added to anti-repetition cache');
  } catch (error: any) {
    if (error?.code !== 'permission-denied') {
      logger.error('❌ Error adding to anti-repetition cache:', error);
    }
  }
}

/**
 * Check if outfit is too similar to recent recommendations
 */
export function isRepetitive(
  outfit: {
    colorPalette?: string[];
    colors?: string[];
    styleType?: string;
    style?: string;
    occasion?: string;
  },
  cache: AntiRepetitionCache
): boolean {
  const outfitColors = [...(outfit.colorPalette || []), ...(outfit.colors || [])].slice(0, 3);
  const outfitStyle = (outfit.styleType || outfit.style || '').toLowerCase();
  const outfitOccasion = (outfit.occasion || '').toLowerCase();

  // Check color combo repetition (70% similarity threshold)
  const isColorRepetitive = cache.recentColorCombos.some(entry => {
    const matchCount = entry.combo.filter(c => 
      outfitColors.some(oc => oc.toLowerCase().includes(c.toLowerCase()))
    ).length;
    return (matchCount / Math.max(entry.combo.length, outfitColors.length)) >= 0.7;
  });

  // Check style repetition
  const isStyleRepetitive = cache.recentStyles.some(entry =>
    outfitStyle.includes(entry.style.toLowerCase()) || entry.style.toLowerCase().includes(outfitStyle)
  );

  // Check occasion repetition
  const isOccasionRepetitive = cache.recentOccasions.some(entry =>
    outfitOccasion === entry.occasion.toLowerCase()
  );

  return isColorRepetitive && isStyleRepetitive && isOccasionRepetitive;
}

// ============================================
// ADAPTIVE EXPLORATION
// ============================================

/**
 * Get exploration metrics for user
 */
export async function getExplorationMetrics(userId: string): Promise<ExplorationMetrics> {
  try {
    const metricsRef = doc(db, 'explorationMetrics', userId);
    const metricsDoc = await getDoc(metricsRef);

    if (metricsDoc.exists()) {
      const data = metricsDoc.data();
      return {
        userId,
        totalExplorationShown: data.totalExplorationShown || 0,
        totalExplorationLiked: data.totalExplorationLiked || 0,
        totalExplorationWorn: data.totalExplorationWorn || 0,
        explorationSuccessRate: data.explorationSuccessRate || 0,
        adaptiveExplorationLevel: data.adaptiveExplorationLevel || 10, // Start at 10%
        lastAdjusted: data.lastAdjusted?.toDate() || new Date(),
      };
    }

    // Initialize metrics
    const initialMetrics: ExplorationMetrics = {
      userId,
      totalExplorationShown: 0,
      totalExplorationLiked: 0,
      totalExplorationWorn: 0,
      explorationSuccessRate: 0,
      adaptiveExplorationLevel: 10,
      lastAdjusted: new Date(),
    };

    await setDoc(metricsRef, {
      ...initialMetrics,
      lastAdjusted: serverTimestamp(),
    });

    return initialMetrics;
  } catch (error) {
    logger.error('❌ Error getting exploration metrics:', error);
    return {
      userId,
      totalExplorationShown: 0,
      totalExplorationLiked: 0,
      totalExplorationWorn: 0,
      explorationSuccessRate: 0,
      adaptiveExplorationLevel: 10,
      lastAdjusted: new Date(),
    };
  }
}

/**
 * Update exploration metrics when user interacts with exploring recommendation
 */
export async function updateExplorationMetrics(
  userId: string,
  action: 'shown' | 'liked' | 'worn'
): Promise<void> {
  try {
    const metrics = await getExplorationMetrics(userId);

    if (action === 'shown') {
      metrics.totalExplorationShown++;
    } else if (action === 'liked') {
      metrics.totalExplorationLiked++;
    } else if (action === 'worn') {
      metrics.totalExplorationWorn++;
    }

    // Calculate success rate
    metrics.explorationSuccessRate = metrics.totalExplorationShown > 0
      ? ((metrics.totalExplorationLiked + metrics.totalExplorationWorn) / metrics.totalExplorationShown) * 100
      : 0;

    // Adjust adaptive exploration level
    if (metrics.explorationSuccessRate >= 30) {
      // User likes exploration, increase it (up to 25%)
      metrics.adaptiveExplorationLevel = Math.min(25, metrics.adaptiveExplorationLevel + 2);
    } else if (metrics.explorationSuccessRate < 15 && metrics.totalExplorationShown > 5) {
      // User doesn't like exploration, decrease it (down to 5%)
      metrics.adaptiveExplorationLevel = Math.max(5, metrics.adaptiveExplorationLevel - 2);
    }

    // Update Firestore
    const metricsRef = doc(db, 'explorationMetrics', userId);
    await updateDoc(metricsRef, {
      totalExplorationShown: metrics.totalExplorationShown,
      totalExplorationLiked: metrics.totalExplorationLiked,
      totalExplorationWorn: metrics.totalExplorationWorn,
      explorationSuccessRate: metrics.explorationSuccessRate,
      adaptiveExplorationLevel: metrics.adaptiveExplorationLevel,
      lastAdjusted: serverTimestamp(),
    });

    logger.log(`✅ Exploration metrics updated: ${metrics.explorationSuccessRate.toFixed(1)}% success, ${metrics.adaptiveExplorationLevel}% level`);
  } catch (error) {
    logger.error('❌ Error updating exploration metrics:', error);
  }
}

// ============================================
// PATTERN LOCK DETECTION
// ============================================

/**
 * Detect if user is stuck in a style pattern (echo chamber)
 */
export async function detectPatternLock(
  userId: string,
  preferences: ComprehensivePreferences
): Promise<PatternLockStatus> {
  try {
    // Analyze if user has extreme preference concentration
    const topColors = preferences.colors.favoriteColors.slice(0, 3);
    const totalColorWeight = preferences.colors.favoriteColors.reduce((sum, c) => sum + c.weight, 0);
    const topColorWeight = topColors.reduce((sum, c) => sum + c.weight, 0);
    const colorConcentration = totalColorWeight > 0 ? (topColorWeight / totalColorWeight) * 100 : 0;

    const topStyles = preferences.styles.topStyles.slice(0, 2);
    const totalStyleWeight = preferences.styles.topStyles.reduce((sum, s) => sum + s.weight, 0);
    const topStyleWeight = topStyles.reduce((sum, s) => sum + s.weight, 0);
    const styleConcentration = totalStyleWeight > 0 ? (topStyleWeight / totalStyleWeight) * 100 : 0;

    // Pattern lock detected if:
    // 1. Top 3 colors account for >85% of all color preferences
    // 2. Top 2 styles account for >80% of all style preferences
    const isLocked = colorConcentration > 85 && styleConcentration > 80;

    if (isLocked) {
      logger.log('⚠️ Pattern lock detected! User stuck in style bubble.');
      return {
        userId,
        isLocked: true,
        lockReason: 'Extreme preference concentration detected',
        dominantColor: topColors[0]?.name,
        dominantStyle: topStyles[0]?.name,
        lockStartDate: new Date(),
        forceExplorationPercentage: 40, // Force 40% exploration
      };
    }

    return {
      userId,
      isLocked: false,
      forceExplorationPercentage: 10, // Normal 10% exploration
    };
  } catch (error) {
    logger.error('❌ Error detecting pattern lock:', error);
    return {
      userId,
      isLocked: false,
      forceExplorationPercentage: 10,
    };
  }
}
