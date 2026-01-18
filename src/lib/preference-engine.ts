/**
 * Preference Engine - Advanced Personalization System
 * 
 * Analyzes user's historical interactions to extract actionable preference profiles.
 * Powers the personalized recommendation system with multi-dimensional preference analysis.
 */

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
} from 'firebase/firestore';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ColorPreference {
  hex: string;
  name: string;
  weight: number;
  frequency: number;
  recencyWeight: number;
}

export interface ColorPreferences {
  favoriteColors: ColorPreference[];
  dislikedColors: ColorPreference[];
  provenCombinations: string[][];
  intensityPreference: 'vibrant' | 'muted' | 'balanced';
  temperaturePreference: 'warm' | 'cool' | 'neutral';
  confidence: number;
}

export interface StylePreference {
  name: string;
  weight: number;
  frequency: number;
  consistency: number;
}

export interface OccasionStyleMap {
  office: StylePreference[];
  casual: StylePreference[];
  party: StylePreference[];
  ethnic: StylePreference[];
}

export interface StylePreferences {
  topStyles: StylePreference[];
  fitPreferences: string[];
  patternPreferences: string[];
  silhouettePreferences: string[];
  occasionStyles: OccasionStyleMap;
  styleConsistency: number;
  confidence: number;
}

export interface SeasonalPreference {
  colors: string[];
  fabrics: string[];
  styles: string[];
}

export interface SeasonalPreferences {
  summer: SeasonalPreference;
  winter: SeasonalPreference;
  monsoon: SeasonalPreference;
  seasonalShifts: string[];
  confidence: number;
}

export interface ShoppingBehavior {
  priceRangeComfort: { min: number; max: number };
  averagePrice: number;
  preferredPlatforms: { name: string; percentage: number }[];
  fabricPreferences: string[];
  brandStyleAffinity: string[];
  confidence: number;
}

export interface ComprehensivePreferences {
  colors: ColorPreferences;
  styles: StylePreferences;
  seasonal: SeasonalPreferences;
  shopping: ShoppingBehavior;
  overallConfidence: number;
  totalInteractions: number;
  lastUpdated: Date;
}

// ============================================
// CONFIDENCE SCORING
// ============================================

/**
 * Calculate confidence score based on total interactions
 * More interactions = higher confidence in personalization
 */
export function calculateConfidenceScore(interactionCount: number): number {
  if (interactionCount < 10) return 20; // LOW - exploratory phase
  if (interactionCount < 25) return 50; // MEDIUM - patterns emerging
  if (interactionCount < 50) return 75; // HIGH - clear preferences
  return 95; // VERY HIGH - hyper-personalized
}

/**
 * Apply recency weighting to interactions
 * Recent interactions matter more than old ones
 */
function getRecencyWeight(timestamp: Date): number {
  const now = new Date();
  const daysSince = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSince <= 30) return 1.0;   // Last 30 days: 100%
  if (daysSince <= 90) return 0.75;  // 30-90 days: 75%
  if (daysSince <= 180) return 0.5;  // 90-180 days: 50%
  return 0.25;                       // 180+ days: 25%
}

// ============================================
// COLOR PREFERENCE EXTRACTION
// ============================================

/**
 * Analyze user's color preferences from historical interactions
 * Extracts favorite colors, disliked colors, successful combinations
 */
export async function analyzeColorPreferences(userId: string): Promise<ColorPreferences> {
  console.log('🎨 [Preference Engine] Analyzing color preferences for:', userId);

  try {
    // Fetch liked outfits
    const likedRef = collection(db, 'users', userId, 'likedOutfits');
    const likedQuery = query(likedRef, orderBy('likedAt', 'desc'), firestoreLimit(100));
    const likedSnapshot = await getDocs(likedQuery);

    // Fetch worn outfits
    const wornRef = collection(db, 'users', userId, 'outfitUsage');
    const wornQuery = query(wornRef, orderBy('usedAt', 'desc'), firestoreLimit(100));
    const wornSnapshot = await getDocs(wornQuery);

    // Fetch user interactions for ignored data
    const interactionsRef = collection(db, 'userInteractions', userId, 'sessions');
    const interactionsQuery = query(interactionsRef, orderBy('timestamp', 'desc'), firestoreLimit(50));
    const interactionsSnapshot = await getDocs(interactionsQuery);

    // Track color occurrences with weights
    const colorWeights = new Map<string, {
      weight: number;
      frequency: number;
      recencySum: number;
      name: string;
    }>();

    // Process liked outfits
    likedSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const timestamp = new Date(data.likedAt || Date.now());
      const recencyWeight = getRecencyWeight(timestamp);
      
      const colors = data.colorPalette || [];
      colors.forEach((color: string) => {
        const hex = normalizeColorToHex(color);
        const current = colorWeights.get(hex) || { weight: 0, frequency: 0, recencySum: 0, name: color };
        
        current.weight += 2 * recencyWeight; // +2 for likes
        current.frequency += 1;
        current.recencySum += recencyWeight;
        
        colorWeights.set(hex, current);
      });
    });

    // Process worn outfits (strongest signal)
    wornSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const timestamp = new Date(data.usedAt || Date.now());
      const recencyWeight = getRecencyWeight(timestamp);
      
      const colors = data.colorPalette || data.colors || [];
      colors.forEach((color: string) => {
        const hex = normalizeColorToHex(color);
        const current = colorWeights.get(hex) || { weight: 0, frequency: 0, recencySum: 0, name: color };
        
        current.weight += 5 * recencyWeight; // +5 for wears (strongest signal)
        current.frequency += 1;
        current.recencySum += recencyWeight;
        
        colorWeights.set(hex, current);
      });
    });

    // Process ignored sessions (negative signal)
    interactionsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.outcome === 'ignored_all' && data.recommendations) {
        const timestamp = data.timestamp?.toDate?.() || new Date();
        const recencyWeight = getRecencyWeight(timestamp);
        
        data.recommendations.forEach((rec: any) => {
          const colors = rec.colorPalette || [];
          colors.forEach((color: string) => {
            const hex = normalizeColorToHex(color);
            const current = colorWeights.get(hex) || { weight: 0, frequency: 0, recencySum: 0, name: color };
            
            current.weight -= 0.5 * recencyWeight; // -0.5 for ignores
            
            colorWeights.set(hex, current);
          });
        });
      }
    });

    // Sort by weight and extract top/bottom colors
    const sortedColors = Array.from(colorWeights.entries())
      .map(([hex, data]) => ({
        hex,
        name: data.name,
        weight: data.weight,
        frequency: data.frequency,
        recencyWeight: data.recencySum / Math.max(data.frequency, 1),
      }))
      .sort((a, b) => b.weight - a.weight);

    const favoriteColors = sortedColors.filter(c => c.weight > 0).slice(0, 5);
    const dislikedColors = sortedColors.filter(c => c.weight < 0).slice(-5).reverse();

    // Extract proven color combinations
    const combinations = extractColorCombinations(likedSnapshot, wornSnapshot);

    // Calculate intensity and temperature preferences
    const intensityPreference = calculateIntensityPreference(favoriteColors);
    const temperaturePreference = calculateTemperaturePreference(favoriteColors);

    const confidence = calculateConfidenceScore(
      likedSnapshot.size + wornSnapshot.size + interactionsSnapshot.size
    );

    console.log('✅ [Preference Engine] Color analysis complete:', {
      favoriteCount: favoriteColors.length,
      dislikedCount: dislikedColors.length,
      combinations: combinations.length,
      confidence,
    });

    return {
      favoriteColors,
      dislikedColors,
      provenCombinations: combinations,
      intensityPreference,
      temperaturePreference,
      confidence,
    };
  } catch (error) {
    console.error('❌ [Preference Engine] Color analysis failed:', error);
    return getDefaultColorPreferences();
  }
}

/**
 * Extract successful color combinations from liked/worn outfits
 */
function extractColorCombinations(
  likedSnapshot: any,
  wornSnapshot: any
): string[][] {
  const combinationCounts = new Map<string, number>();

  const processDoc = (docSnap: any) => {
    const data = docSnap.data();
    const colors = (data.colorPalette || data.colors || [])
      .map((c: string) => normalizeColorToHex(c))
      .slice(0, 3);
    
    if (colors.length >= 2) {
      const combKey = colors.sort().join('|');
      combinationCounts.set(combKey, (combinationCounts.get(combKey) || 0) + 1);
    }
  };

  likedSnapshot.forEach(processDoc);
  wornSnapshot.forEach((doc: any) => {
    processDoc(doc);
    // Worn outfits count double
    processDoc(doc);
  });

  return Array.from(combinationCounts.entries())
    .filter(([_, count]) => count >= 2) // Appeared at least twice
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([combKey, _]) => combKey.split('|'));
}

/**
 * Calculate whether user prefers vibrant or muted colors
 */
function calculateIntensityPreference(colors: ColorPreference[]): 'vibrant' | 'muted' | 'balanced' {
  if (colors.length === 0) return 'balanced';
  
  const saturations = colors.map(c => getColorSaturation(c.hex));
  const avgSaturation = saturations.reduce((a, b) => a + b, 0) / saturations.length;
  
  if (avgSaturation > 0.7) return 'vibrant';
  if (avgSaturation < 0.4) return 'muted';
  return 'balanced';
}

/**
 * Calculate whether user prefers warm or cool tones
 */
function calculateTemperaturePreference(colors: ColorPreference[]): 'warm' | 'cool' | 'neutral' {
  if (colors.length === 0) return 'neutral';
  
  const temperatures = colors.map(c => getColorTemperature(c.hex));
  const avgTemp = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
  
  if (avgTemp > 0.3) return 'warm';
  if (avgTemp < -0.3) return 'cool';
  return 'neutral';
}

// ============================================
// STYLE PREFERENCE EXTRACTION
// ============================================

/**
 * Analyze user's style preferences from historical interactions
 * Extracts preferred styles, fits, patterns segmented by occasion
 */
export async function analyzeStylePreferences(userId: string): Promise<StylePreferences> {
  console.log('👔 [Preference Engine] Analyzing style preferences for:', userId);

  try {
    const likedRef = collection(db, 'users', userId, 'likedOutfits');
    const likedQuery = query(likedRef, orderBy('likedAt', 'desc'), firestoreLimit(100));
    const likedSnapshot = await getDocs(likedQuery);

    const wornRef = collection(db, 'users', userId, 'outfitUsage');
    const wornQuery = query(wornRef, orderBy('usedAt', 'desc'), firestoreLimit(100));
    const wornSnapshot = await getDocs(wornQuery);

    const styleWeights = new Map<string, number>();
    const fitWeights = new Map<string, number>();
    const patternWeights = new Map<string, number>();
    const occasionStyleWeights = {
      office: new Map<string, number>(),
      casual: new Map<string, number>(),
      party: new Map<string, number>(),
      ethnic: new Map<string, number>(),
    };

    const processOutfit = (data: any, weight: number) => {
      const timestamp = new Date(data.likedAt || data.usedAt || Date.now());
      const recencyWeight = getRecencyWeight(timestamp);
      const adjustedWeight = weight * recencyWeight;

      // Extract style keywords
      const description = (data.description || data.title || '').toLowerCase();
      const styleKeywords = extractStyleKeywords(description);
      styleKeywords.forEach(style => {
        styleWeights.set(style, (styleWeights.get(style) || 0) + adjustedWeight);
      });

      // Extract fit preferences
      const fitKeywords = extractFitKeywords(description);
      fitKeywords.forEach(fit => {
        fitWeights.set(fit, (fitWeights.get(fit) || 0) + adjustedWeight);
      });

      // Extract pattern preferences
      const patternKeywords = extractPatternKeywords(description);
      patternKeywords.forEach(pattern => {
        patternWeights.set(pattern, (patternWeights.get(pattern) || 0) + adjustedWeight);
      });

      // Occasion-specific tracking
      const occasion = (data.occasion || 'casual').toLowerCase();
      const occasionKey = mapToOccasionCategory(occasion);
      styleKeywords.forEach(style => {
        const map = occasionStyleWeights[occasionKey];
        map.set(style, (map.get(style) || 0) + adjustedWeight);
      });
    };

    likedSnapshot.forEach(doc => processOutfit(doc.data(), 2));
    wornSnapshot.forEach(doc => processOutfit(doc.data(), 5));

    const topStyles = Array.from(styleWeights.entries())
      .map(([name, weight]) => ({
        name,
        weight,
        frequency: Math.round(weight / 2),
        consistency: calculateStyleConsistency(name, styleWeights),
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    const fitPreferences = Array.from(fitWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const patternPreferences = Array.from(patternWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const occasionStyles = buildOccasionStyleMap(occasionStyleWeights);
    const styleConsistency = calculateOverallStyleConsistency(styleWeights);
    const confidence = calculateConfidenceScore(likedSnapshot.size + wornSnapshot.size);

    console.log('✅ [Preference Engine] Style analysis complete:', {
      topStyles: topStyles.length,
      confidence,
    });

    return {
      topStyles,
      fitPreferences,
      patternPreferences,
      silhouettePreferences: [],
      occasionStyles,
      styleConsistency,
      confidence,
    };
  } catch (error) {
    console.error('❌ [Preference Engine] Style analysis failed:', error);
    return getDefaultStylePreferences();
  }
}

// ============================================
// SEASONAL PREFERENCE EXTRACTION
// ============================================

/**
 * Analyze user's seasonal preferences
 */
export async function analyzeSeasonalPreferences(userId: string): Promise<SeasonalPreferences> {
  console.log('🌦️ [Preference Engine] Analyzing seasonal preferences for:', userId);

  try {
    const likedRef = collection(db, 'users', userId, 'likedOutfits');
    const likedSnapshot = await getDocs(likedRef);

    const wornRef = collection(db, 'users', userId, 'outfitUsage');
    const wornSnapshot = await getDocs(wornRef);

    const seasonalData = {
      summer: { colors: new Map<string, number>(), fabrics: new Map<string, number>(), styles: new Map<string, number>() },
      winter: { colors: new Map<string, number>(), fabrics: new Map<string, number>(), styles: new Map<string, number>() },
      monsoon: { colors: new Map<string, number>(), fabrics: new Map<string, number>(), styles: new Map<string, number>() },
    };

    const processSeasonalDoc = (doc: any, weight: number) => {
      const data = doc.data();
      const timestamp = new Date(data.likedAt || data.usedAt || Date.now());
      const season = getSeason(timestamp);
      const seasonData = seasonalData[season];

      if (seasonData) {
        const colors = data.colorPalette || data.colors || [];
        colors.forEach((color: string) => {
          const hex = normalizeColorToHex(color);
          seasonData.colors.set(hex, (seasonData.colors.get(hex) || 0) + weight);
        });

        const description = (data.description || '').toLowerCase();
        const fabrics = extractFabricKeywords(description);
        fabrics.forEach(fabric => {
          seasonData.fabrics.set(fabric, (seasonData.fabrics.get(fabric) || 0) + weight);
        });

        const styles = extractStyleKeywords(description);
        styles.forEach(style => {
          seasonData.styles.set(style, (seasonData.styles.get(style) || 0) + weight);
        });
      }
    };

    likedSnapshot.forEach(doc => processSeasonalDoc(doc, 2));
    wornSnapshot.forEach(doc => processSeasonalDoc(doc, 5));

    const summer = buildSeasonalPreference(seasonalData.summer);
    const winter = buildSeasonalPreference(seasonalData.winter);
    const monsoon = buildSeasonalPreference(seasonalData.monsoon);

    const seasonalShifts = detectSeasonalShifts(summer, winter, monsoon);
    const confidence = calculateConfidenceScore(likedSnapshot.size + wornSnapshot.size);

    return {
      summer,
      winter,
      monsoon,
      seasonalShifts,
      confidence,
    };
  } catch (error) {
    console.error('❌ [Preference Engine] Seasonal analysis failed:', error);
    return getDefaultSeasonalPreferences();
  }
}

// ============================================
// SHOPPING BEHAVIOR ANALYSIS
// ============================================

/**
 * Analyze user's shopping behavior and price preferences
 */
export async function analyzeShoppingBehavior(userId: string): Promise<ShoppingBehavior> {
  console.log('🛍️ [Preference Engine] Analyzing shopping behavior for:', userId);

  try {
    const interactionsRef = collection(db, 'userInteractions', userId, 'sessions');
    const interactionsQuery = query(interactionsRef, orderBy('timestamp', 'desc'), firestoreLimit(100));
    const interactionsSnapshot = await getDocs(interactionsQuery);

    const platformClicks = new Map<string, number>();
    let totalClicks = 0;

    interactionsSnapshot.forEach(doc => {
      const data = doc.data();
      const actions = data.actions || [];
      
      actions.forEach((action: any) => {
        if (action.type === 'clicked_shopping') {
          const platform = action.platform || 'unknown';
          platformClicks.set(platform, (platformClicks.get(platform) || 0) + 1);
          totalClicks++;
        }
      });
    });

    const preferredPlatforms = Array.from(platformClicks.entries())
      .map(([name, count]) => ({
        name,
        percentage: Math.round((count / Math.max(totalClicks, 1)) * 100),
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Default price range (can be enhanced with actual price extraction)
    const priceRangeComfort = { min: 500, max: 2500 };
    const averagePrice = 1500;

    const confidence = calculateConfidenceScore(interactionsSnapshot.size);

    return {
      priceRangeComfort,
      averagePrice,
      preferredPlatforms,
      fabricPreferences: [],
      brandStyleAffinity: [],
      confidence,
    };
  } catch (error) {
    console.error('❌ [Preference Engine] Shopping analysis failed:', error);
    return getDefaultShoppingBehavior();
  }
}

// ============================================
// COMPREHENSIVE PREFERENCE GETTER
// ============================================

/**
 * Get all user preferences in one call
 */
export async function getComprehensivePreferences(userId: string): Promise<ComprehensivePreferences> {
  console.log('📊 [Preference Engine] Fetching comprehensive preferences for:', userId);

  const [colors, styles, seasonal, shopping] = await Promise.all([
    analyzeColorPreferences(userId),
    analyzeStylePreferences(userId),
    analyzeSeasonalPreferences(userId),
    analyzeShoppingBehavior(userId),
  ]);

  const totalInteractions = Math.max(
    colors.favoriteColors.reduce((sum, c) => sum + c.frequency, 0),
    styles.topStyles.reduce((sum, s) => sum + s.frequency, 0)
  );

  const overallConfidence = calculateConfidenceScore(totalInteractions);

  return {
    colors,
    styles,
    seasonal,
    shopping,
    overallConfidence,
    totalInteractions,
    lastUpdated: new Date(),
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeColorToHex(color: string): string {
  if (color.startsWith('#')) return color.toUpperCase();
  
  const colorMap: Record<string, string> = {
    'black': '#000000', 'white': '#FFFFFF', 'gray': '#808080', 'red': '#FF0000',
    'blue': '#0000FF', 'green': '#008000', 'yellow': '#FFFF00', 'orange': '#FFA500',
    'purple': '#800080', 'pink': '#FFC0CB', 'brown': '#A52A2A', 'navy': '#000080',
    'beige': '#F5F5DC', 'cream': '#FFFDD0', 'coral': '#FF7F50',
  };

  return colorMap[color.toLowerCase()] || '#808080';
}

function getColorSaturation(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  
  if (max === 0) return 0;
  return (max - min) / max;
}

function getColorTemperature(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  
  // Warm colors have more red, cool colors have more blue
  return (rgb.r - rgb.b) / 255;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

function extractStyleKeywords(text: string): string[] {
  const keywords = [
    'casual', 'formal', 'minimalist', 'bohemian', 'ethnic', 'fusion',
    'streetwear', 'vintage', 'modern', 'classic', 'contemporary', 'traditional',
    'chic', 'elegant', 'sporty', 'edgy', 'romantic', 'preppy',
  ];
  
  return keywords.filter(k => text.includes(k));
}

function extractFitKeywords(text: string): string[] {
  const keywords = ['oversized', 'fitted', 'tailored', 'loose', 'relaxed', 'slim', 'regular'];
  return keywords.filter(k => text.includes(k));
}

function extractPatternKeywords(text: string): string[] {
  const keywords = ['solid', 'floral', 'geometric', 'striped', 'printed', 'plain', 'abstract'];
  return keywords.filter(k => text.includes(k));
}

function extractFabricKeywords(text: string): string[] {
  const keywords = ['cotton', 'linen', 'silk', 'wool', 'polyester', 'denim', 'leather', 'chiffon'];
  return keywords.filter(k => text.includes(k));
}

function mapToOccasionCategory(occasion: string): 'office' | 'casual' | 'party' | 'ethnic' {
  if (occasion.includes('office') || occasion.includes('work') || occasion.includes('business')) return 'office';
  if (occasion.includes('party') || occasion.includes('wedding') || occasion.includes('event')) return 'party';
  if (occasion.includes('ethnic') || occasion.includes('traditional') || occasion.includes('festive')) return 'ethnic';
  return 'casual';
}

function getSeason(date: Date): 'summer' | 'winter' | 'monsoon' {
  const month = date.getMonth() + 1; // 1-12
  if (month >= 6 && month <= 9) return 'monsoon';
  if (month >= 4 && month <= 9) return 'summer';
  return 'winter';
}

function calculateStyleConsistency(style: string, weights: Map<string, number>): number {
  const total = Array.from(weights.values()).reduce((a, b) => a + b, 0);
  const styleWeight = weights.get(style) || 0;
  return Math.round((styleWeight / Math.max(total, 1)) * 100);
}

function calculateOverallStyleConsistency(weights: Map<string, number>): number {
  if (weights.size === 0) return 0;
  
  const values = Array.from(weights.values()).sort((a, b) => b - a);
  const topThreeSum = values.slice(0, 3).reduce((a, b) => a + b, 0);
  const total = values.reduce((a, b) => a + b, 0);
  
  return Math.round((topThreeSum / Math.max(total, 1)) * 100);
}

function buildOccasionStyleMap(weights: any): OccasionStyleMap {
  const build = (map: Map<string, number>): StylePreference[] => {
    return Array.from(map.entries())
      .map(([name, weight]) => ({
        name,
        weight,
        frequency: Math.round(weight / 2),
        consistency: 0,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);
  };

  return {
    office: build(weights.office),
    casual: build(weights.casual),
    party: build(weights.party),
    ethnic: build(weights.ethnic),
  };
}

function buildSeasonalPreference(data: any): SeasonalPreference {
  const colors = Array.from(data.colors.entries())
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 5)
    .map((e: any) => e[0]);
  
  const fabrics = Array.from(data.fabrics.entries())
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3)
    .map((e: any) => e[0]);
  
  const styles = Array.from(data.styles.entries())
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3)
    .map((e: any) => e[0]);

  return { colors, fabrics, styles };
}

function detectSeasonalShifts(summer: SeasonalPreference, winter: SeasonalPreference, monsoon: SeasonalPreference): string[] {
  const shifts: string[] = [];
  
  // Compare summer vs winter colors
  const summerColors = new Set(summer.colors);
  const winterColors = new Set(winter.colors);
  const uniqueSummer = summer.colors.filter(c => !winterColors.has(c));
  const uniqueWinter = winter.colors.filter(c => !summerColors.has(c));
  
  if (uniqueSummer.length > 0 && uniqueWinter.length > 0) {
    shifts.push('Color preferences shift between summer and winter seasons');
  }
  
  return shifts;
}

// Default fallbacks
function getDefaultColorPreferences(): ColorPreferences {
  return {
    favoriteColors: [],
    dislikedColors: [],
    provenCombinations: [],
    intensityPreference: 'balanced',
    temperaturePreference: 'neutral',
    confidence: 0,
  };
}

function getDefaultStylePreferences(): StylePreferences {
  return {
    topStyles: [],
    fitPreferences: [],
    patternPreferences: [],
    silhouettePreferences: [],
    occasionStyles: {
      office: [],
      casual: [],
      party: [],
      ethnic: [],
    },
    styleConsistency: 0,
    confidence: 0,
  };
}

function getDefaultSeasonalPreferences(): SeasonalPreferences {
  return {
    summer: { colors: [], fabrics: [], styles: [] },
    winter: { colors: [], fabrics: [], styles: [] },
    monsoon: { colors: [], fabrics: [], styles: [] },
    seasonalShifts: [],
    confidence: 0,
  };
}

function getDefaultShoppingBehavior(): ShoppingBehavior {
  return {
    priceRangeComfort: { min: 500, max: 2500 },
    averagePrice: 1500,
    preferredPlatforms: [],
    fabricPreferences: [],
    brandStyleAffinity: [],
    confidence: 0,
  };
}

// ============================================
// REAL-TIME PREFERENCE UPDATES
// ============================================

import { updateDoc, increment, arrayUnion, serverTimestamp } from 'firebase/firestore';

/**
 * Extract colors from outfit data
 */
function extractColors(outfit: {
  colorPalette?: string[];
  colors?: string[];
  items?: string[];
}): string[] {
  const colors: string[] = [];
  
  // Primary source: colorPalette
  if (outfit.colorPalette && Array.isArray(outfit.colorPalette)) {
    colors.push(...outfit.colorPalette);
  }
  
  // Fallback: colors field
  if (outfit.colors && Array.isArray(outfit.colors)) {
    colors.push(...outfit.colors);
  }
  
  // Extract color names from items (e.g., "navy blue shirt" -> "navy blue")
  if (outfit.items && Array.isArray(outfit.items)) {
    const colorKeywords = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 
                           'navy', 'gray', 'grey', 'beige', 'khaki', 'olive', 'maroon', 'burgundy', 'cream', 'ivory'];
    
    outfit.items.forEach(item => {
      const itemLower = item.toLowerCase();
      colorKeywords.forEach(color => {
        if (itemLower.includes(color)) {
          colors.push(color);
        }
      });
    });
  }
  
  return [...new Set(colors)]; // Remove duplicates
}

/**
 * Extract style types from outfit data
 */
function extractStyles(outfit: {
  styleType?: string;
  style?: string;
  occasion?: string;
  description?: string;
}): string[] {
  const styles: string[] = [];
  
  if (outfit.styleType) styles.push(outfit.styleType.toLowerCase());
  if (outfit.style) styles.push(outfit.style.toLowerCase());
  
  // Extract style keywords from description
  const styleKeywords = ['casual', 'formal', 'business', 'smart', 'elegant', 'bohemian', 'minimalist', 
                         'streetwear', 'vintage', 'modern', 'classic', 'trendy', 'chic', 'sporty'];
  
  const description = (outfit.description || '').toLowerCase();
  styleKeywords.forEach(keyword => {
    if (description.includes(keyword)) {
      styles.push(keyword);
    }
  });
  
  return [...new Set(styles)];
}

/**
 * Update preferences when user LIKES an outfit (+2 weight)
 * Called from frontend when user clicks like button
 */
export async function updatePreferencesFromLike(
  userId: string,
  outfit: {
    colorPalette?: string[];
    colors?: string[];
    items?: string[];
    styleType?: string;
    style?: string;
    occasion?: string;
    description?: string;
    title?: string;
  },
  context: {
    occasion?: string;
    season?: 'summer' | 'winter' | 'monsoon';
  }
): Promise<{ success: boolean; message: string }> {
  try {
    if (!userId) {
      return { success: false, message: 'No userId provided' };
    }

    const prefsRef = doc(db, 'userPreferences', userId);
    const prefsDoc = await getDoc(prefsRef);
    
    if (!prefsDoc.exists()) {
      return { success: false, message: 'User preferences not found' };
    }

    const currentPrefs = prefsDoc.data();
    const colorWeights = currentPrefs.colorWeights || {};
    const styleWeights = currentPrefs.styleWeights || {};
    const provenCombinations = currentPrefs.provenCombinations || [];
    const occasionPreferences = currentPrefs.occasionPreferences || {};
    const seasonalPreferences = currentPrefs.seasonalPreferences || { summer: [], winter: [], monsoon: [] };

    // Extract colors and increment weights by +2
    const colors = extractColors(outfit);
    colors.forEach(color => {
      const normalizedColor = color.toLowerCase().trim();
      colorWeights[normalizedColor] = (colorWeights[normalizedColor] || 0) + 2;
    });

    // Extract styles and increment weights by +2
    const styles = extractStyles(outfit);
    styles.forEach(style => {
      const normalizedStyle = style.toLowerCase().trim();
      styleWeights[normalizedStyle] = (styleWeights[normalizedStyle] || 0) + 2;
    });

    // Add color combination to proven combos (if 2+ colors)
    if (colors.length >= 2) {
      const combo = colors.slice(0, 3).sort(); // Top 3 colors, sorted for consistency
      const comboString = combo.join(',');
      if (!provenCombinations.some((c: string[]) => c.join(',') === comboString)) {
        provenCombinations.push(combo);
      }
    }

    // Update occasion-specific preferences
    if (context.occasion) {
      const occasion = context.occasion.toLowerCase();
      if (!occasionPreferences[occasion]) {
        occasionPreferences[occasion] = { preferredItems: [], preferredColors: [], notes: '' };
      }
      
      // Add colors to occasion preferences
      colors.forEach(color => {
        const normalizedColor = color.toLowerCase().trim();
        if (!occasionPreferences[occasion].preferredColors.includes(normalizedColor)) {
          occasionPreferences[occasion].preferredColors.push(normalizedColor);
        }
      });
      
      // Add items to occasion preferences
      if (outfit.items) {
        outfit.items.forEach(item => {
          if (!occasionPreferences[occasion].preferredItems.includes(item)) {
            occasionPreferences[occasion].preferredItems.push(item);
          }
        });
      }
    }

    // Update seasonal preferences
    if (context.season) {
      const season = context.season;
      if (!seasonalPreferences[season]) {
        seasonalPreferences[season] = [];
      }
      
      colors.forEach(color => {
        const normalizedColor = color.toLowerCase().trim();
        if (!seasonalPreferences[season].includes(normalizedColor)) {
          seasonalPreferences[season].push(normalizedColor);
        }
      });
    }

    // Recalculate accuracy score
    const totalLikes = (currentPrefs.totalLikes || 0) + 1;
    const totalDislikes = currentPrefs.totalDislikes || 0;
    const totalRecommendations = currentPrefs.totalRecommendations || 1;
    const accuracyScore = Math.min(100, Math.round(((totalLikes - totalDislikes) / totalRecommendations) * 100));

    // Update Firestore with atomic operations
    await updateDoc(prefsRef, {
      colorWeights,
      styleWeights,
      provenCombinations,
      occasionPreferences,
      seasonalPreferences,
      totalLikes: increment(1),
      accuracyScore,
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Preferences updated from LIKE: +2 to ${colors.length} colors, +2 to ${styles.length} styles`);
    return { success: true, message: 'Preferences updated from like' };

  } catch (error) {
    console.error('❌ Error updating preferences from like:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Update failed' };
  }
}

/**
 * Update preferences when user WEARS an outfit (+5 weight - strongest signal!)
 * Called from frontend when user marks outfit as worn
 */
export async function updatePreferencesFromWear(
  userId: string,
  outfit: {
    colorPalette?: string[];
    colors?: string[];
    items?: string[];
    styleType?: string;
    style?: string;
    occasion?: string;
    description?: string;
    title?: string;
  },
  context: {
    occasion?: string;
    season?: 'summer' | 'winter' | 'monsoon';
  }
): Promise<{ success: boolean; message: string }> {
  try {
    if (!userId) {
      return { success: false, message: 'No userId provided' };
    }

    const prefsRef = doc(db, 'userPreferences', userId);
    const prefsDoc = await getDoc(prefsRef);
    
    if (!prefsDoc.exists()) {
      return { success: false, message: 'User preferences not found' };
    }

    const currentPrefs = prefsDoc.data();
    const colorWeights = currentPrefs.colorWeights || {};
    const styleWeights = currentPrefs.styleWeights || {};
    const provenCombinations = currentPrefs.provenCombinations || [];
    const occasionPreferences = currentPrefs.occasionPreferences || {};
    const seasonalPreferences = currentPrefs.seasonalPreferences || { summer: [], winter: [], monsoon: [] };

    // Extract colors and increment weights by +5 (WORE is strongest signal!)
    const colors = extractColors(outfit);
    colors.forEach(color => {
      const normalizedColor = color.toLowerCase().trim();
      colorWeights[normalizedColor] = (colorWeights[normalizedColor] || 0) + 5;
    });

    // Extract styles and increment weights by +5
    const styles = extractStyles(outfit);
    styles.forEach(style => {
      const normalizedStyle = style.toLowerCase().trim();
      styleWeights[normalizedStyle] = (styleWeights[normalizedStyle] || 0) + 5;
    });

    // Add color combination to proven combos (with higher priority)
    if (colors.length >= 2) {
      const combo = colors.slice(0, 3).sort();
      const comboString = combo.join(',');
      // Remove if exists and add to front (most recent wear)
      const filteredCombos = provenCombinations.filter((c: string[]) => c.join(',') !== comboString);
      provenCombinations.unshift(combo);
    }

    // Update occasion-specific preferences (wore = strong signal)
    if (context.occasion) {
      const occasion = context.occasion.toLowerCase();
      if (!occasionPreferences[occasion]) {
        occasionPreferences[occasion] = { preferredItems: [], preferredColors: [], notes: 'Worn outfit' };
      }
      
      colors.forEach(color => {
        const normalizedColor = color.toLowerCase().trim();
        if (!occasionPreferences[occasion].preferredColors.includes(normalizedColor)) {
          occasionPreferences[occasion].preferredColors.unshift(normalizedColor); // Add to front
        }
      });
      
      if (outfit.items) {
        outfit.items.forEach(item => {
          if (!occasionPreferences[occasion].preferredItems.includes(item)) {
            occasionPreferences[occasion].preferredItems.unshift(item); // Add to front
          }
        });
      }
    }

    // Update seasonal preferences (wore = strong seasonal signal)
    if (context.season) {
      const season = context.season;
      if (!seasonalPreferences[season]) {
        seasonalPreferences[season] = [];
      }
      
      colors.forEach(color => {
        const normalizedColor = color.toLowerCase().trim();
        // Remove and add to front (most recent wear)
        const filtered = seasonalPreferences[season].filter((c: string) => c !== normalizedColor);
        seasonalPreferences[season] = [normalizedColor, ...filtered];
      });
    }

    // Recalculate accuracy score (wearing = ultimate acceptance)
    const totalSelections = (currentPrefs.totalSelections || 0) + 1;
    const totalRecommendations = currentPrefs.totalRecommendations || 1;
    const accuracyScore = Math.min(100, Math.round((totalSelections / totalRecommendations) * 100));

    // Update Firestore with atomic operations
    await updateDoc(prefsRef, {
      colorWeights,
      styleWeights,
      provenCombinations,
      occasionPreferences,
      seasonalPreferences,
      totalSelections: increment(1),
      accuracyScore: Math.max(currentPrefs.accuracyScore || 0, accuracyScore), // Don't decrease
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Preferences updated from WEAR: +5 to ${colors.length} colors, +5 to ${styles.length} styles`);
    return { success: true, message: 'Preferences updated from wear' };

  } catch (error) {
    console.error('❌ Error updating preferences from wear:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Update failed' };
  }
}

/**
 * Track shopping link click
 * Called when user clicks shopping link (increment shopping behavior data)
 */
export async function trackShoppingClick(
  userId: string,
  platform: 'amazon' | 'myntra' | 'tatacliq',
  item: string,
  estimatedPrice?: number
): Promise<{ success: boolean; message: string }> {
  try {
    if (!userId) {
      return { success: false, message: 'No userId provided' };
    }

    const prefsRef = doc(db, 'userPreferences', userId);
    const prefsDoc = await getDoc(prefsRef);
    
    if (!prefsDoc.exists()) {
      return { success: false, message: 'User preferences not found' };
    }

    const currentPrefs = prefsDoc.data();
    const shoppingClicks = currentPrefs.shoppingClicks || {};
    
    // Track platform clicks
    if (!shoppingClicks[platform]) {
      shoppingClicks[platform] = { count: 0, items: [] };
    }
    shoppingClicks[platform].count += 1;
    
    // Track clicked items
    if (!shoppingClicks[platform].items.includes(item)) {
      shoppingClicks[platform].items.push(item);
    }

    // Update price range if price provided
    const updates: any = {
      shoppingClicks,
      updatedAt: serverTimestamp(),
    };

    if (estimatedPrice && estimatedPrice > 0) {
      const currentMin = currentPrefs.priceRange?.min || 0;
      const currentMax = currentPrefs.priceRange?.max || 10000;
      
      // Adjust price range based on clicked items
      updates.priceRange = {
        min: currentMin === 0 ? estimatedPrice * 0.7 : Math.min(currentMin, estimatedPrice * 0.7),
        max: Math.max(currentMax, estimatedPrice * 1.3),
      };
    }

    await updateDoc(prefsRef, updates);

    console.log(`✅ Shopping click tracked: ${platform} - ${item}`);
    return { success: true, message: 'Shopping click tracked' };

  } catch (error) {
    console.error('❌ Error tracking shopping click:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Tracking failed' };
  }
}
