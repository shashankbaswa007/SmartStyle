/**
 * Color Palette Service
 * 
 * Manages saved color palettes and their associations with wardrobe items,
 * occasions, and user preferences. Enables users to reuse successful color
 * combinations across their wardrobe.
 */

import { db } from './firebase';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';

export interface SavedColorPalette {
  id?: string;
  userId: string;
  name: string;
  baseColor: {
    hex: string;
    rgb: string;
    name: string;
  };
  harmonyType: string;
  matchColors: Array<{
    hex: string;
    rgb: string;
    name?: string;
    label: string;
    fashionContext?: {
      usage: 'primary' | 'secondary' | 'accent';
      ratio: string;
      clothingItems: string[];
      styleNotes: string;
    };
  }>;
  // Associations
  linkedWardrobeItemIds?: string[]; // IDs of wardrobe items using these colors
  occasions?: string[]; // casual, formal, party, business, sports
  seasons?: string[]; // spring, summer, fall, winter
  // Usage tracking
  usageCount: number;
  lastUsedDate?: Timestamp;
  // User notes
  notes?: string;
  tags?: string[];
  // Metadata
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Save a color palette to user's collection
 */
export async function saveColorPalette(
  userId: string,
  palette: Omit<SavedColorPalette, 'id' | 'userId' | 'createdAt' | 'usageCount'>
): Promise<{ success: boolean; message: string; paletteId?: string }> {
  console.log('🎨 Saving color palette for user:', userId);
  
  try {
    if (!userId || userId.trim() === '') {
      return {
        success: false,
        message: 'Please sign in to save color palettes',
      };
    }

    const palettesRef = collection(db, 'users', userId, 'colorPalettes');
    
    const dataToSave = {
      ...palette,
      userId,
      usageCount: 0,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(palettesRef, dataToSave);
    
    console.log('✅ Color palette saved with ID:', docRef.id);
    return {
      success: true,
      message: 'Color palette saved successfully',
      paletteId: docRef.id,
    };
  } catch (error) {
    console.error('❌ Error saving color palette:', error);
    return {
      success: false,
      message: 'Failed to save color palette. Please try again.',
    };
  }
}

/**
 * Get all saved color palettes for a user
 */
export async function getSavedPalettes(
  userId: string,
  options?: {
    limit?: number;
    linkedToItem?: string; // Filter by wardrobe item ID
    occasion?: string;
    season?: string;
  }
): Promise<SavedColorPalette[]> {
  console.log('🎨 Fetching color palettes for user:', userId);
  
  try {
    if (!userId || userId.trim() === '') {
      console.warn('⚠️ Invalid userId');
      return [];
    }

    const palettesRef = collection(db, 'users', userId, 'colorPalettes');
    let q = query(palettesRef, orderBy('createdAt', 'desc'));

    if (options?.limit) {
      q = query(q, limit(options.limit));
    }

    const querySnapshot = await getDocs(q);
    let palettes: SavedColorPalette[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      palettes.push({
        id: doc.id,
        ...data,
      } as SavedColorPalette);
    });

    // Client-side filtering for complex queries
    if (options?.linkedToItem) {
      palettes = palettes.filter(p => 
        p.linkedWardrobeItemIds?.includes(options.linkedToItem!)
      );
    }

    if (options?.occasion) {
      palettes = palettes.filter(p => 
        p.occasions?.includes(options.occasion!)
      );
    }

    if (options?.season) {
      palettes = palettes.filter(p => 
        p.seasons?.includes(options.season!)
      );
    }

    console.log(`✅ Found ${palettes.length} color palettes`);
    return palettes;
  } catch (error) {
    console.error('❌ Error fetching color palettes:', error);
    return [];
  }
}

/**
 * Link a color palette to a wardrobe item
 */
export async function linkPaletteToWardrobeItem(
  userId: string,
  paletteId: string,
  wardrobeItemId: string
): Promise<{ success: boolean; message: string }> {
  console.log('🔗 Linking palette to wardrobe item:', { paletteId, wardrobeItemId });
  
  try {
    if (!userId || !paletteId || !wardrobeItemId) {
      return {
        success: false,
        message: 'Invalid parameters',
      };
    }

    const paletteRef = doc(db, 'users', userId, 'colorPalettes', paletteId);
    
    // Get current palette
    const palettes = await getSavedPalettes(userId);
    const palette = palettes.find(p => p.id === paletteId);
    
    if (!palette) {
      return {
        success: false,
        message: 'Palette not found',
      };
    }

    // Add item ID if not already linked
    const linkedItems = palette.linkedWardrobeItemIds || [];
    if (!linkedItems.includes(wardrobeItemId)) {
      linkedItems.push(wardrobeItemId);
      
      await updateDoc(paletteRef, {
        linkedWardrobeItemIds: linkedItems,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      success: true,
      message: 'Palette linked to wardrobe item',
    };
  } catch (error) {
    console.error('❌ Error linking palette:', error);
    return {
      success: false,
      message: 'Failed to link palette',
    };
  }
}

/**
 * Update palette usage tracking
 */
export async function trackPaletteUsage(
  userId: string,
  paletteId: string
): Promise<void> {
  try {
    if (!userId || !paletteId) return;

    const paletteRef = doc(db, 'users', userId, 'colorPalettes', paletteId);
    
    await updateDoc(paletteRef, {
      usageCount: increment(1),
      lastUsedDate: serverTimestamp(),
    });
  } catch (error) {
    console.error('❌ Error tracking palette usage:', error);
  }
}

/**
 * Delete a saved color palette
 */
export async function deleteColorPalette(
  userId: string,
  paletteId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!userId || !paletteId) {
      return {
        success: false,
        message: 'Invalid parameters',
      };
    }

    const paletteRef = doc(db, 'users', userId, 'colorPalettes', paletteId);
    await deleteDoc(paletteRef);
    
    return {
      success: true,
      message: 'Palette deleted successfully',
    };
  } catch (error) {
    console.error('❌ Error deleting palette:', error);
    return {
      success: false,
      message: 'Failed to delete palette',
    };
  }
}

/**
 * Get color palettes that match wardrobe item colors
 */
export async function getPalettesMatchingItem(
  userId: string,
  itemColors: string[]
): Promise<SavedColorPalette[]> {
  try {
    const allPalettes = await getSavedPalettes(userId);
    
    // Find palettes with matching colors
    return allPalettes.filter(palette => {
      const paletteColors = [
        palette.baseColor.hex,
        ...palette.matchColors.map(c => c.hex),
      ];
      
      // Check if any palette color matches any item color (with some tolerance)
      return itemColors.some(itemColor => 
        paletteColors.some(paletteColor => 
          colorDistance(itemColor, paletteColor) < 30 // deltaE threshold
        )
      );
    });
  } catch (error) {
    console.error('❌ Error finding matching palettes:', error);
    return [];
  }
}

/**
 * Perceptually-weighted color distance calculation
 * Uses weighted RGB Euclidean (redmean approximation) for better accuracy
 * than simple RGB Euclidean, without requiring chroma.js dependency.
 */
function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  if (!rgb1 || !rgb2) return 100;
  
  // Redmean-weighted Euclidean distance for perceptual accuracy
  const rmean = (rgb1.r + rgb2.r) / 2;
  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;
  
  return Math.sqrt(
    (2 + rmean / 256) * rDiff * rDiff +
    4 * gDiff * gDiff +
    (2 + (255 - rmean) / 256) * bDiff * bDiff
  ) / 3; // Normalize to roughly match deltaE scale
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}
