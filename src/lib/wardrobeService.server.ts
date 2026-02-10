/**
 * Server-side Wardrobe Service using Firebase Admin SDK
 * 
 * This service bypasses Firestore security rules and is intended for
 * use in Server Actions and API routes where the user's authentication
 * has already been verified.
 */

import { getFirestore, FieldValue } from './firebase-admin';
import { WardrobeItemData, WardrobeOutfitData } from './wardrobeService';

/**
 * Get all wardrobe items for a user (server-side with Admin SDK)
 * @param userId - The user's ID (already authenticated)
 * @param filters - Optional filters for itemType, season, occasion
 * @returns Array of wardrobe items
 */
export async function getWardrobeItemsServer(
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
      console.error('❌ Invalid userId provided to getWardrobeItemsServer:', userId);
      return [];
    }

    console.log('🔍 Fetching wardrobe items for user:', userId, 'with filters:', filters);

    const db = getFirestore();
    const itemsRef = db.collection('users').doc(userId).collection('wardrobeItems');
    
    // Build query with filters
    let query = itemsRef.where('isActive', '==', filters?.isActive ?? true).orderBy('addedDate', 'desc');
    
    if (filters?.itemType) {
      query = itemsRef
        .where('itemType', '==', filters.itemType)
        .where('isActive', '==', true)
        .orderBy('addedDate', 'desc');
    }

    const snapshot = await query.get();
    
    console.log('📊 Found', snapshot.size, 'wardrobe items in database');
    
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
          console.warn('⚠️ Incomplete item data found:', doc.id);
        }
      } catch (err) {
        console.error('❌ Error parsing item document:', doc.id, err);
      }
    });
    
    console.log('✅ Successfully fetched', items.length, 'valid wardrobe items');
    
    return items;
  } catch (error) {
    console.error('❌ Error fetching wardrobe items:', error);
    return [];
  }
}

/**
 * Add a wardrobe item (server-side with Admin SDK)
 * @param userId - The user's ID (already authenticated)
 * @param itemData - Complete item data to save
 * @returns Success status with item ID
 */
export async function addWardrobeItemServer(
  userId: string,
  itemData: Omit<WardrobeItemData, 'id' | 'addedDate' | 'wornCount' | 'isActive'>
): Promise<{ success: boolean; message: string; itemId?: string }> {
  console.log('👔 Adding wardrobe item for user (server-side):', userId);
  
  try {
    // Validate userId
    if (!userId || userId.trim() === '' || userId === 'anonymous') {
      console.error('❌ Invalid userId:', userId);
      return {
        success: false,
        message: 'Invalid user ID',
      };
    }

    // Validate item data
    if (!itemData.imageUrl || !itemData.itemType || !itemData.description) {
      console.error('❌ Invalid item data:', {
        hasImageUrl: !!itemData.imageUrl,
        hasItemType: !!itemData.itemType,
        hasDescription: !!itemData.description,
      });
      return {
        success: false,
        message: 'Image, item type, and description are required',
      };
    }

    console.log('💾 Saving wardrobe item to Firestore...');
    const db = getFirestore();
    const itemsRef = db.collection('users').doc(userId).collection('wardrobeItems');
    
    const dataToSave = {
      imageUrl: itemData.imageUrl,
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

    const docRef = await itemsRef.add(dataToSave);
    console.log('✅ Wardrobe item saved with ID:', docRef.id);

    return {
      success: true,
      message: 'Item added to wardrobe successfully',
      itemId: docRef.id,
    };
  } catch (error) {
    console.error('❌ Error adding wardrobe item:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add item',
    };
  }
}

/**
 * Update a wardrobe item (server-side with Admin SDK)
 * @param userId - The user's ID (already authenticated)
 * @param itemId - The item's document ID
 * @param updates - Partial item data to update
 * @returns Success status
 */
export async function updateWardrobeItemServer(
  userId: string,
  itemId: string,
  updates: Partial<WardrobeItemData>
): Promise<{ success: boolean; message: string }> {
  try {
    if (!userId || !itemId) {
      return { success: false, message: 'Invalid userId or itemId' };
    }

    const db = getFirestore();
    const itemRef = db.collection('users').doc(userId).collection('wardrobeItems').doc(itemId);
    
    await itemRef.update({
      ...updates,
      lastUpdated: Date.now(),
    });

    return { success: true, message: 'Item updated successfully' };
  } catch (error) {
    console.error('❌ Error updating wardrobe item:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update item',
    };
  }
}

/**
 * Delete a wardrobe item (server-side with Admin SDK)
 * @param userId - The user's ID (already authenticated)
 * @param itemId - The item's document ID
 * @returns Success status
 */
export async function deleteWardrobeItemServer(
  userId: string,
  itemId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!userId || !itemId) {
      return { success: false, message: 'Invalid userId or itemId' };
    }

    const db = getFirestore();
    const itemRef = db.collection('users').doc(userId).collection('wardrobeItems').doc(itemId);
    
    await itemRef.delete();

    return { success: true, message: 'Item deleted successfully' };
  } catch (error) {
    console.error('❌ Error deleting wardrobe item:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete item',
    };
  }
}

/**
 * Save a wardrobe outfit combination (server-side with Admin SDK)
 * @param userId - The user's ID (already authenticated)
 * @param outfitData - Complete outfit data to save
 * @returns Success status with outfit ID
 */
export async function saveWardrobeOutfitServer(
  userId: string,
  outfitData: Omit<WardrobeOutfitData, 'id' | 'createdDate' | 'usedCount'>
): Promise<{ success: boolean; message: string; outfitId?: string }> {
  try {
    if (!userId) {
      return { success: false, message: 'Invalid user ID' };
    }

    const db = getFirestore();
    const outfitsRef = db.collection('users').doc(userId).collection('wardrobeOutfits');
    
    const dataToSave = {
      ...outfitData,
      createdDate: Date.now(),
      usedCount: 0,
    };

    const docRef = await outfitsRef.add(dataToSave);

    return {
      success: true,
      message: 'Outfit saved successfully',
      outfitId: docRef.id,
    };
  } catch (error) {
    console.error('❌ Error saving wardrobe outfit:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save outfit',
    };
  }
}
