import { db, auth } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc, updateDoc, serverTimestamp, increment, onSnapshot } from 'firebase/firestore';
import { logDeletion } from './audit-log';
import type { OptimizedImages } from './image-optimization';
import { invalidateUserCache } from './recommendations-cache';

export interface WardrobeItemData {
  id?: string;
  imageUrl: string; // Legacy: single image (for backward compatibility)
  images?: OptimizedImages; // New: multi-resolution images (thumbnail, medium, full)
  itemType: 'top' | 'bottom' | 'dress' | 'shoes' | 'accessory' | 'outerwear';
  category?: string; // e.g., "t-shirt", "jeans", "sneakers"
  brand?: string;
  description: string;
  dominantColors: string[]; // Hex color codes extracted from image
  season?: ('spring' | 'summer' | 'fall' | 'winter')[];
  occasions?: ('casual' | 'formal' | 'party' | 'business' | 'sports')[];
  purchaseDate?: string;
  addedDate: number;
  wornCount: number;
  lastWornDate?: number;
  tags?: string[];
  notes?: string;
  isActive: boolean;
  colorsProcessed?: boolean; // Indicates if colors were extracted (vs placeholder)
  lastUpdated?: number; // Timestamp of last update
}

export interface WardrobeOutfitData {
  id?: string;
  name: string;
  itemIds: string[]; // References to wardrobeItems
  occasion: string;
  season?: string;
  confidence: number;
  aiReasoning: string;
  createdDate: number;
  usedCount: number;
  lastUsedDate?: number;
  userRating?: number; // 1-5 stars
}

/**
 * Add a wardrobe item to user's collection
 * @param userId - The user's ID
 * @param itemData - Complete item data to save
 * @returns Success status with item ID
 */
export async function addWardrobeItem(
  userId: string,
  itemData: Omit<WardrobeItemData, 'id' | 'addedDate' | 'wornCount' | 'isActive'>
): Promise<{ success: boolean; message: string; itemId?: string }> {
  
  try {
    // Validate userId
    if (!userId || userId.trim() === '' || userId === 'anonymous') {
      return {
        success: false,
        message: 'Please sign in to add items to your wardrobe',
      };
    }

    // Validate item data
    if (!itemData.imageUrl || !itemData.itemType || !itemData.description) {
      return {
        success: false,
        message: 'Image, item type, and description are required',
      };
    }

    // Verify auth state
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      return {
        success: false,
        message: 'Authentication mismatch. Please sign in again.',
      };
    }

    const itemsRef = collection(db, 'users', userId, 'wardrobeItems');
    
    const dataToSave = {
      imageUrl: itemData.imageUrl,
      images: itemData.images || undefined, // New: optimized images (thumbnail, medium, full)
      itemType: itemData.itemType,
      category: itemData.category || '',
      brand: itemData.brand || '',
      description: itemData.description,
      dominantColors: itemData.dominantColors || [],
      season: itemData.season || [],
      occasions: itemData.occasions || [],
      purchaseDate: itemData.purchaseDate || '',
      addedDate: Date.now(),
      wornCount: 0,
      lastWornDate: null,
      tags: itemData.tags || [],
      notes: itemData.notes || '',
      isActive: true,
    };

    const docRef = await addDoc(itemsRef, dataToSave);

    // Invalidate recommendations cache since wardrobe changed
    invalidateUserCache(userId);

    return {
      success: true,
      message: 'Item added to wardrobe successfully',
      itemId: docRef.id,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add item',
    };
  }
}

/**
 * Get all wardrobe items for a user with optional filters
 * @param userId - The user's ID
 * @param filters - Optional filters for itemType, season, occasion
 * @returns Array of wardrobe items
 */
export async function getWardrobeItems(
  userId: string,
  filters?: {
    itemType?: WardrobeItemData['itemType'];
    season?: string;
    occasion?: string;
    isActive?: boolean;
  }
): Promise<WardrobeItemData[]> {
  try {
    // Validate userId
    if (!userId || userId.trim() === '' || userId === 'anonymous') {
      return [];
    }


    const itemsRef = collection(db, 'users', userId, 'wardrobeItems');
    
    // Build query with filters
    let q = query(itemsRef, where('isActive', '==', filters?.isActive ?? true), orderBy('addedDate', 'desc'));
    
    if (filters?.itemType) {
      q = query(itemsRef, where('itemType', '==', filters.itemType), where('isActive', '==', true), orderBy('addedDate', 'desc'));
    }

    const snapshot = await getDocs(q);
    
    
    const items: WardrobeItemData[] = [];
    snapshot.forEach((doc) => {
      try {
        const data = doc.data() as WardrobeItemData;
        
        // Apply client-side filters for arrays (season, occasion)
        if (filters?.season && data.season && !data.season.includes(filters.season as any)) {
          return;
        }
        if (filters?.occasion && data.occasions && !data.occasions.includes(filters.occasion as any)) {
          return;
        }
        
        // Validate essential fields before adding
        if (data && data.imageUrl && data.itemType) {
          items.push({
            ...data,
            id: doc.id,
          });
        } else {
        }
      } catch (err) {
      }
    });
    
    
    return items;
  } catch (error) {
    return [];
  }
}

/**
 * Subscribe to wardrobe items for real-time updates (multi-tab/device consistency)
 * @param userId - The user's ID
 * @param filters - Optional filters for itemType, season, occasion
 * @param onItems - Callback invoked with updated items
 * @param onError - Optional error callback
 * @returns Unsubscribe function
 */
export function subscribeToWardrobeItems(
  userId: string,
  filters: {
    itemType?: WardrobeItemData['itemType'];
    season?: string;
    occasion?: string;
    isActive?: boolean;
  } | undefined,
  onItems: (items: WardrobeItemData[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId || userId.trim() === '' || userId === 'anonymous') {
    onItems([]);
    return () => undefined;
  }

  const itemsRef = collection(db, 'users', userId, 'wardrobeItems');
  let q = query(itemsRef, where('isActive', '==', filters?.isActive ?? true), orderBy('addedDate', 'desc'));

  if (filters?.itemType) {
    q = query(itemsRef, where('itemType', '==', filters.itemType), where('isActive', '==', true), orderBy('addedDate', 'desc'));
  }

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: WardrobeItemData[] = [];

      snapshot.forEach((docSnap) => {
        try {
          const data = docSnap.data() as WardrobeItemData;

          // Apply client-side filters for arrays (season, occasion)
          if (filters?.season && data.season && !data.season.includes(filters.season as any)) {
            return;
          }
          if (filters?.occasion && data.occasions && !data.occasions.includes(filters.occasion as any)) {
            return;
          }

          if (data && data.imageUrl && data.itemType) {
            items.push({
              ...data,
              id: docSnap.id,
            });
          } else {
          }
        } catch (err) {
        }
      });

      onItems(items);
    },
    (error) => {
      onError?.(error as Error);
    }
  );

  return unsubscribe;
}

/**
 * Update worn status for a wardrobe item
 * @param userId - The user's ID
 * @param itemId - The item's ID
 * @returns Success status
 */
export async function markItemAsWorn(
  userId: string,
  itemId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!userId || !itemId) {
      return { success: false, message: 'Invalid user or item ID' };
    }

    const itemRef = doc(db, 'users', userId, 'wardrobeItems', itemId);
    
    await updateDoc(itemRef, {
      wornCount: increment(1),
      lastWornDate: Date.now(),
    });

    return { success: true, message: 'Item marked as worn' };
  } catch (error) {
    
    let errorMessage = 'Failed to update item';
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'not-found') {
        errorMessage = 'Item not found';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please sign in again.';
      }
    }
    
    return { success: false, message: errorMessage };
  }
}

/**
 * Delete (soft delete) a wardrobe item
 * @param userId - The user's ID
 * @param itemId - The item's ID
 * @returns Success status
 */
export async function deleteWardrobeItem(
  userId: string,
  itemId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!userId || !itemId) {
      return { success: false, message: 'Invalid user or item ID' };
    }

    const itemRef = doc(db, 'users', userId, 'wardrobeItems', itemId);
    
    // Soft delete - mark as inactive with deletion timestamp
    await updateDoc(itemRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
      deletedTimestamp: Date.now(), // Client-side timestamp for offline support
    });

    // Log deletion for audit (non-critical, fail gracefully)
    try {
      await logDeletion(userId, 'wardrobeItem', itemId, {
        collection: 'wardrobeItems',
        timestamp: new Date().toISOString(),
      });
    } catch (logError) {
      // Continue - deletion succeeded even if logging failed
    }

    // Invalidate recommendations cache since wardrobe changed
    invalidateUserCache(userId);

    return { success: true, message: 'Item removed from wardrobe' };
  } catch (error) {
    
    let errorMessage = 'Failed to delete item';
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'not-found') {
        errorMessage = 'Item not found or already deleted';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please sign in again.';
      }
    }
    
    return { success: false, message: errorMessage };
  }
}

/**
 * Get wardrobe statistics for a user
 * @param userId - The user's ID
 * @returns Wardrobe stats
 */
export async function getWardrobeStats(userId: string): Promise<{
  totalItems: number;
  itemsByType: Record<string, number>;
  mostWornItem?: WardrobeItemData;
  leastWornItems: WardrobeItemData[];
}> {
  try {
    const items = await getWardrobeItems(userId);
    
    const itemsByType: Record<string, number> = {};
    let mostWornItem: WardrobeItemData | undefined;
    
    items.forEach(item => {
      // Count by type
      itemsByType[item.itemType] = (itemsByType[item.itemType] || 0) + 1;
      
      // Track most worn
      if (!mostWornItem || item.wornCount > mostWornItem.wornCount) {
        mostWornItem = item;
      }
    });
    
    // Find least worn items (worn 0 times)
    const leastWornItems = items.filter(item => item.wornCount === 0).slice(0, 5);
    
    return {
      totalItems: items.length,
      itemsByType,
      mostWornItem,
      leastWornItems,
    };
  } catch (error) {
    return {
      totalItems: 0,
      itemsByType: {},
      leastWornItems: [],
    };
  }
}

/**
 * Save a wardrobe outfit combination
 * @param userId - The user's ID
 * @param outfitData - Outfit combination data
 * @returns Success status with outfit ID
 */
export async function saveWardrobeOutfit(
  userId: string,
  outfitData: Omit<WardrobeOutfitData, 'id' | 'createdDate' | 'usedCount'>
): Promise<{ success: boolean; message: string; outfitId?: string }> {
  try {
    if (!userId || userId === 'anonymous') {
      return { success: false, message: 'Please sign in to save outfits' };
    }

    const outfitsRef = collection(db, 'users', userId, 'wardrobeOutfits');
    
    const dataToSave = {
      ...outfitData,
      createdDate: Date.now(),
      usedCount: 0,
      lastUsedDate: null,
    };

    const docRef = await addDoc(outfitsRef, dataToSave);

    return {
      success: true,
      message: 'Outfit combination saved successfully',
      outfitId: docRef.id,
    };
  } catch (error) {
    return { success: false, message: 'Failed to save outfit' };
  }
}

/**
 * Get saved wardrobe outfits for a user
 * @param userId - The user's ID
 * @returns Array of saved outfits
 */
export async function getWardrobeOutfits(userId: string): Promise<WardrobeOutfitData[]> {
  try {
    if (!userId || userId === 'anonymous') {
      return [];
    }

    const outfitsRef = collection(db, 'users', userId, 'wardrobeOutfits');
    const q = query(outfitsRef, orderBy('createdDate', 'desc'));
    const snapshot = await getDocs(q);
    
    const outfits: WardrobeOutfitData[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as WardrobeOutfitData;
      outfits.push({
        ...data,
        id: doc.id,
      });
    });
    
    return outfits;
  } catch (error) {
    return [];
  }
}
