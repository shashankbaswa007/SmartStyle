/**
 * AI Personalization Service
 * 
 * Manages user style preferences, recommendation history, and feedback
 * to provide increasingly personalized outfit recommendations over time.
 */

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { userPreferencesCache } from './cache';
import { FirebaseError } from 'firebase/app';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SelectedOutfit {
  title: string;
  colors: string[];
  style: string;
  items: string[];
  occasion: string;
  timestamp: Timestamp;
}

export interface UserPreferences {
  userId: string;
  // Color preferences with weights
  favoriteColors: string[];
  dislikedColors: string[];
  colorWeights?: { [color: string]: number }; // Track preference strength
  // Style preferences with weights
  preferredStyles: string[]; // casual, formal, streetwear, bohemian, etc.
  avoidedStyles: string[];
  styleWeights?: { [style: string]: number }; // Track preference strength
  // Selected outfits (strongest signal)
  selectedOutfits?: SelectedOutfit[];
  // Occasion preferences
  occasionPreferences: {
    [occasion: string]: {
      preferredItems: string[];
      preferredColors: string[];
      notes?: string;
    };
  };
  // Seasonal preferences
  seasonalPreferences: {
    spring: string[];
    summer: string[];
    fall: string[];
    winter: string[];
  };
  // Purchase behavior
  preferredBrands: string[];
  priceRange: {
    min: number;
    max: number;
  };
  // Learning stats
  totalRecommendations: number;
  totalLikes: number;
  totalDislikes: number;
  totalSelections?: number; // Track outfit selections
  accuracyScore: number; // 0-100
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RecommendationHistory {
  id: string;
  userId: string;
  // Recommendation details
  occasion: string;
  weather?: {
    temp: number;
    condition: string;
  };
  season: string;
  recommendations: {
    outfit1: OutfitRecommendation;
    outfit2: OutfitRecommendation;
    outfit3: OutfitRecommendation;
  };
  // User feedback
  feedback?: {
    liked?: string[]; // outfit IDs liked
    disliked?: string[]; // outfit IDs disliked
    selected?: string; // outfit ID selected
    worn?: boolean; // did user actually wear it
    rating?: number; // 1-5 stars
    notes?: string;
  };
  // Context
  imageAnalysis?: {
    colors: string[];
    skinTone: string;
    style: string;
  };
  // Metadata
  createdAt: Timestamp;
  feedbackAt?: Timestamp;
}

export interface OutfitRecommendation {
  id: string;
  items: string[];
  colors: string[];
  style: string;
  description: string;
  imageUrl?: string;
  shoppingLinks?: {
    [item: string]: string | null;
  };
}

export interface StyleInsights {
  topColors: { color: string; count: number }[];
  topStyles: { style: string; count: number }[];
  topOccasions: { occasion: string; count: number }[];
  successRate: number;
  improvementSuggestions: string[];
}

// ============================================
// USER PREFERENCES MANAGEMENT
// ============================================

/**
 * Initialize user preferences when user first signs up
 */
export async function initializeUserPreferences(userId: string): Promise<void> {
  const prefsRef = doc(db, 'userPreferences', userId);
  const prefsDoc = await getDoc(prefsRef);

  if (!prefsDoc.exists()) {
    const initialPrefs: UserPreferences = {
      userId,
      favoriteColors: [],
      dislikedColors: [],
      colorWeights: {},
      preferredStyles: [],
      avoidedStyles: [],
      styleWeights: {},
      selectedOutfits: [],
      occasionPreferences: {},
      seasonalPreferences: {
        spring: [],
        summer: [],
        fall: [],
        winter: [],
      },
      preferredBrands: [],
      priceRange: {
        min: 0,
        max: 10000,
      },
      totalRecommendations: 0,
      totalLikes: 0,
      totalDislikes: 0,
      totalSelections: 0,
      accuracyScore: 50, // Start neutral
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(prefsRef, initialPrefs);
    console.log('✅ User preferences initialized for:', userId);
  }
}

/**
 * Get user preferences with caching for faster responses
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    if (!userId) {
      console.warn('⚠️ No userId provided to getUserPreferences');
      return null;
    }

    // Check cache first
    const cached = userPreferencesCache.get({ userId });
    if (cached) {
      console.log('✅ User preferences loaded from cache');
      return cached;
    }

    const prefsRef = doc(db, 'userPreferences', userId);
    const prefsDoc = await getDoc(prefsRef);

    if (prefsDoc.exists()) {
      const prefs = prefsDoc.data() as UserPreferences;
      // Cache for 1 hour
      userPreferencesCache.set({ userId }, prefs, 60);
      return prefs;
    }

    // Initialize if doesn't exist
    console.log('📝 Initializing new user preferences for:', userId);
    await initializeUserPreferences(userId);
    const newPrefsDoc = await getDoc(prefsRef);
    
    if (newPrefsDoc.exists()) {
      const newPrefs = newPrefsDoc.data() as UserPreferences;
      // Cache the new preferences
      userPreferencesCache.set({ userId }, newPrefs, 60);
      return newPrefs;
    }
    
    return null;
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'permission-denied') {
      console.warn('🔒 Personalization skipped: missing Firestore permissions for current user context.');
    } else {
      console.error('❌ Error fetching user preferences:', error);
    }
    // Don't throw - return null to allow app to continue without personalization
    return null;
  }
}

/**
 * Update user preferences and invalidate cache
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): Promise<void> {
  try {
    const prefsRef = doc(db, 'userPreferences', userId);
    await updateDoc(prefsRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
    
    // Invalidate cache when preferences are updated
    userPreferencesCache.clear();
    console.log('🔄 User preferences cache cleared after update');
  } catch (error) {
    console.error('Error updating user preferences:', error);
    throw error;
  }
}

// ============================================
// RECOMMENDATION HISTORY
// ============================================

/**
 * Save recommendation to history
 */
export async function saveRecommendation(
  userId: string,
  recommendation: Omit<RecommendationHistory, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  try {
    const historyRef = collection(db, 'recommendationHistory');
    const docRef = doc(historyRef);

    const historyEntry: RecommendationHistory = {
      id: docRef.id,
      userId,
      ...recommendation,
      createdAt: Timestamp.now(),
    };

    await setDoc(docRef, historyEntry);

    // Update user stats
    const prefsRef = doc(db, 'userPreferences', userId);
    await updateDoc(prefsRef, {
      totalRecommendations: increment(1),
      updatedAt: Timestamp.now(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error saving recommendation:', error);
    throw error;
  }
}

/**
 * Submit feedback for a recommendation
 */
export async function submitRecommendationFeedback(
  recommendationId: string,
  userId: string,
  feedback: RecommendationHistory['feedback']
): Promise<void> {
  try {
    const historyRef = doc(db, 'recommendationHistory', recommendationId);
    await updateDoc(historyRef, {
      feedback,
      feedbackAt: Timestamp.now(),
    });

    // Update user preferences based on feedback
    await updatePreferencesFromFeedback(userId, recommendationId, feedback);
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
}

/**
 * Get user's recommendation history
 */
export async function getRecommendationHistory(
  userId: string,
  limitCount: number = 20
): Promise<RecommendationHistory[]> {
  try {
    const historyRef = collection(db, 'recommendationHistory');
    const q = query(
      historyRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as RecommendationHistory);
  } catch (error) {
    console.error('Error fetching recommendation history:', error);
    return [];
  }
}

// ============================================
// PREFERENCE LEARNING
// ============================================

/**
 * Update user preferences based on feedback
 */
async function updatePreferencesFromFeedback(
  userId: string,
  recommendationId: string,
  feedback: RecommendationHistory['feedback']
): Promise<void> {
  try {
    const prefs = await getUserPreferences(userId);
    if (!prefs) return;

    const historyRef = doc(db, 'recommendationHistory', recommendationId);
    const historyDoc = await getDoc(historyRef);
    if (!historyDoc.exists()) return;

    const history = historyDoc.data() as RecommendationHistory;
    const updates: Partial<UserPreferences> = {};

    // Process likes
    if (feedback?.liked && feedback.liked.length > 0) {
      const likedOutfits = feedback.liked.map(id => {
        if (id === 'outfit1') return history.recommendations.outfit1;
        if (id === 'outfit2') return history.recommendations.outfit2;
        return history.recommendations.outfit3;
      });

      // Extract colors from liked outfits
      const likedColors = likedOutfits.flatMap(o => o.colors);
      const colorCounts = new Map<string, number>();
      likedColors.forEach(color => {
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
      });

      // Add frequently liked colors to favorites
      const newFavoriteColors = [...prefs.favoriteColors];
      colorCounts.forEach((count, color) => {
        if (count >= 2 && !newFavoriteColors.includes(color)) {
          newFavoriteColors.push(color);
        }
      });
      updates.favoriteColors = newFavoriteColors.slice(0, 20); // Keep top 20

      // Extract styles from liked outfits
      const likedStyles = likedOutfits.map(o => o.style);
      const styleCounts = new Map<string, number>();
      likedStyles.forEach(style => {
        styleCounts.set(style, (styleCounts.get(style) || 0) + 1);
      });

      const newPreferredStyles = [...prefs.preferredStyles];
      styleCounts.forEach((count, style) => {
        if (!newPreferredStyles.includes(style)) {
          newPreferredStyles.push(style);
        }
      });
      updates.preferredStyles = newPreferredStyles.slice(0, 10);

      updates.totalLikes = prefs.totalLikes + feedback.liked.length;
    }

    // Process dislikes
    if (feedback?.disliked && feedback.disliked.length > 0) {
      const dislikedOutfits = feedback.disliked.map(id => {
        if (id === 'outfit1') return history.recommendations.outfit1;
        if (id === 'outfit2') return history.recommendations.outfit2;
        return history.recommendations.outfit3;
      });

      // Extract colors to avoid
      const dislikedColors = dislikedOutfits.flatMap(o => o.colors);
      const newDislikedColors = [...prefs.dislikedColors];
      dislikedColors.forEach(color => {
        if (!newDislikedColors.includes(color)) {
          newDislikedColors.push(color);
        }
      });
      updates.dislikedColors = newDislikedColors.slice(0, 20);

      // Extract styles to avoid
      const dislikedStyles = dislikedOutfits.map(o => o.style);
      const newAvoidedStyles = [...prefs.avoidedStyles];
      dislikedStyles.forEach(style => {
        if (!newAvoidedStyles.includes(style)) {
          newAvoidedStyles.push(style);
        }
      });
      updates.avoidedStyles = newAvoidedStyles.slice(0, 10);

      updates.totalDislikes = prefs.totalDislikes + feedback.disliked.length;
    }

    // Update occasion preferences
    if (feedback?.selected && history.occasion) {
      const selectedOutfit = feedback.selected === 'outfit1' 
        ? history.recommendations.outfit1
        : feedback.selected === 'outfit2'
        ? history.recommendations.outfit2
        : history.recommendations.outfit3;

      const occasionPrefs = { ...prefs.occasionPreferences };
      if (!occasionPrefs[history.occasion]) {
        occasionPrefs[history.occasion] = {
          preferredItems: [],
          preferredColors: [],
        };
      }

      // Add items and colors from selected outfit
      selectedOutfit.items.forEach(item => {
        if (!occasionPrefs[history.occasion].preferredItems.includes(item)) {
          occasionPrefs[history.occasion].preferredItems.push(item);
        }
      });

      selectedOutfit.colors.forEach(color => {
        if (!occasionPrefs[history.occasion].preferredColors.includes(color)) {
          occasionPrefs[history.occasion].preferredColors.push(color);
        }
      });

      updates.occasionPreferences = occasionPrefs;
    }

    // Calculate accuracy score
    const totalFeedback = (updates.totalLikes || prefs.totalLikes) + 
                         (updates.totalDislikes || prefs.totalDislikes);
    if (totalFeedback > 0) {
      const likes = updates.totalLikes || prefs.totalLikes;
      updates.accuracyScore = Math.round((likes / totalFeedback) * 100);
    }

    // Apply updates
    await updateUserPreferences(userId, updates);
  } catch (error) {
    console.error('Error updating preferences from feedback:', error);
  }
}

/**
 * Track when user selects an outfit to use
 * This is the strongest signal for personalization (weight: 3.0)
 */
export async function trackOutfitSelection(
  userId: string,
  recommendationId: string,
  outfitId: 'outfit1' | 'outfit2' | 'outfit3'
): Promise<void> {
  console.log('📝 trackOutfitSelection called with:', { userId, recommendationId, outfitId });
  
  try {
    // Get the recommendation details from the user's nested collection
    const historyRef = doc(db, `users/${userId}/recommendationHistory`, recommendationId);
    console.log('🔍 Fetching recommendation from Firestore...', recommendationId);
    const historyDoc = await getDoc(historyRef);
    
    if (!historyDoc.exists()) {
      console.error('❌ Recommendation not found in Firestore:', recommendationId);
      throw new Error('Recommendation not found');
    }

    console.log('✅ Recommendation found:', historyDoc.id);
    const history = historyDoc.data() as RecommendationHistory;
    const selectedOutfit = history.recommendations[outfitId];
    console.log('👔 Selected outfit details:', selectedOutfit);

    // Get user preferences
    console.log('🔍 Fetching user preferences...', userId);
    const prefs = await getUserPreferences(userId);
    if (!prefs) {
      console.error('❌ User preferences not found:', userId);
      return;
    }
    console.log('✅ User preferences found');

    // Create selected outfit record
    const selectedOutfitRecord: SelectedOutfit = {
      title: selectedOutfit.description || `${selectedOutfit.style} outfit`,
      colors: selectedOutfit.colors,
      style: selectedOutfit.style,
      items: selectedOutfit.items,
      occasion: history.occasion,
      timestamp: Timestamp.now(),
    };
    console.log('📦 Created outfit record:', selectedOutfitRecord);

    // Update selected outfits array (keep last 10)
    const selectedOutfits = prefs.selectedOutfits || [];
    selectedOutfits.unshift(selectedOutfitRecord);
    const updatedSelectedOutfits = selectedOutfits.slice(0, 10);

    // Update color weights (selections have weight 3.0)
    const colorWeights = prefs.colorWeights || {};
    selectedOutfit.colors.forEach(color => {
      colorWeights[color] = (colorWeights[color] || 0) + 3.0;
    });

    // Update style weights (selections have weight 3.0)
    const styleWeights = prefs.styleWeights || {};
    styleWeights[selectedOutfit.style] = (styleWeights[selectedOutfit.style] || 0) + 3.0;

    // Update favorite colors based on weights
    const favoriteColors = Object.entries(colorWeights)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([color]) => color);

    // Update preferred styles based on weights
    const preferredStyles = Object.entries(styleWeights)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([style]) => style);

    // Update preferences
    console.log('💾 Updating user preferences in Firestore...');
    await updateUserPreferences(userId, {
      selectedOutfits: updatedSelectedOutfits,
      colorWeights,
      styleWeights,
      favoriteColors,
      preferredStyles,
      totalSelections: (prefs.totalSelections || 0) + 1,
    });
    console.log('✅ User preferences updated');

    // Update recommendation history with selection
    console.log('💾 Updating recommendation history...');
    await updateDoc(historyRef, {
      'feedback.selected': outfitId,
      feedbackAt: Timestamp.now(),
    });
    console.log('✅ Recommendation history updated');

    console.log('✅ Outfit selection tracked successfully');
  } catch (error) {
    console.error('❌ Error tracking outfit selection:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    throw error;
  }
}

/**
 * Calculate preference strength for colors and styles
 * Returns weighted preferences based on user actions
 */
export function getPreferenceStrength(prefs: UserPreferences): {
  strongColors: string[];
  strongStyles: string[];
  avoidColors: string[];
  avoidStyles: string[];
} {
  const colorWeights = prefs.colorWeights || {};
  const styleWeights = prefs.styleWeights || {};

  // Strong preferences (weight > 2.0)
  const strongColors = Object.entries(colorWeights)
    .filter(([, weight]) => weight >= 2.0)
    .sort(([, a], [, b]) => b - a)
    .map(([color]) => color);

  const strongStyles = Object.entries(styleWeights)
    .filter(([, weight]) => weight >= 2.0)
    .sort(([, a], [, b]) => b - a)
    .map(([style]) => style);

  return {
    strongColors,
    strongStyles,
    avoidColors: prefs.dislikedColors,
    avoidStyles: prefs.avoidedStyles,
  };
}

// ============================================
// STYLE INSIGHTS & ANALYTICS
// ============================================

/**
 * Get style insights for user
 */
export async function getStyleInsights(userId: string): Promise<StyleInsights> {
  try {
    const prefs = await getUserPreferences(userId);
    const history = await getRecommendationHistory(userId, 50);

    if (!prefs) {
      return {
        topColors: [],
        topStyles: [],
        topOccasions: [],
        successRate: 0,
        improvementSuggestions: [],
      };
    }

    // Analyze top colors
    const colorCounts = new Map<string, number>();
    prefs.favoriteColors.forEach(color => {
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    });
    const topColors = Array.from(colorCounts.entries())
      .map(([color, count]) => ({ color, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Analyze top styles
    const styleCounts = new Map<string, number>();
    prefs.preferredStyles.forEach(style => {
      styleCounts.set(style, (styleCounts.get(style) || 0) + 1);
    });
    const topStyles = Array.from(styleCounts.entries())
      .map(([style, count]) => ({ style, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Analyze top occasions
    const occasionCounts = new Map<string, number>();
    history.forEach(rec => {
      if (rec.occasion) {
        occasionCounts.set(rec.occasion, (occasionCounts.get(rec.occasion) || 0) + 1);
      }
    });
    const topOccasions = Array.from(occasionCounts.entries())
      .map(([occasion, count]) => ({ occasion, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate success rate
    const successRate = prefs.accuracyScore;

    // Generate improvement suggestions
    const improvementSuggestions: string[] = [];
    if (prefs.totalRecommendations < 5) {
      improvementSuggestions.push('Try more recommendations to help us learn your style');
    }
    if (successRate < 60) {
      improvementSuggestions.push('Give us more feedback to improve recommendations');
    }
    if (prefs.favoriteColors.length < 3) {
      improvementSuggestions.push('Explore different colors to expand your style');
    }

    return {
      topColors,
      topStyles,
      topOccasions,
      successRate,
      improvementSuggestions,
    };
  } catch (error) {
    console.error('Error getting style insights:', error);
    return {
      topColors: [],
      topStyles: [],
      topOccasions: [],
      successRate: 0,
      improvementSuggestions: [],
    };
  }
}

// ============================================
// SEASONAL & CONTEXTUAL RECOMMENDATIONS
// ============================================

/**
 * Get current season based on date
 */
export function getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

/**
 * Get personalized context for AI recommendations
 */
export async function getPersonalizationContext(userId?: string, occasion?: string): Promise<{
  preferences: UserPreferences | null;
  season: string;
  occasionPrefs?: UserPreferences['occasionPreferences'][string];
  selectedOutfits?: SelectedOutfit[];
  preferenceStrength?: ReturnType<typeof getPreferenceStrength>;
}> {
  const season = getCurrentSeason();
  
  if (!userId) {
    return {
      preferences: null,
      season,
      occasionPrefs: undefined,
      selectedOutfits: undefined,
      preferenceStrength: undefined,
    };
  }

  const preferences = await getUserPreferences(userId);
  
  let occasionPrefs;
  if (occasion && preferences?.occasionPreferences[occasion]) {
    occasionPrefs = preferences.occasionPreferences[occasion];
  }

  // Get selected outfits (last 5 for context)
  const selectedOutfits = preferences?.selectedOutfits?.slice(0, 5);

  // Calculate preference strength
  const preferenceStrength = preferences ? getPreferenceStrength(preferences) : undefined;

  return {
    preferences,
    season,
    occasionPrefs,
    selectedOutfits,
    preferenceStrength,
  };
}

