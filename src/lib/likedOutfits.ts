import { db, auth } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { logDeletion } from './audit-log';

export interface LikedOutfitData {
  id?: string; // Add optional id field for document ID
  imageUrl: string;
  title: string;
  description: string;
  items: string[];
  colorPalette: string[];
  styleType?: string; // Fashion style category
  occasion?: string; // Suitable occasion
  shoppingLinks: {
    amazon: string | null;
    tatacliq: string | null; // Replaced Nykaa with TATA CLiQ
    myntra: string | null;
  };
  itemShoppingLinks?: Array<{
    item: string;
    amazon: string;
    tatacliq: string;
    myntra: string;
  }>; // Individual item shopping links
  likedAt: number;
  recommendationId: string;
}

/**
 * Save a liked outfit to Firebase with duplicate prevention
 * @param userId - The user's ID
 * @param outfitData - Complete outfit data to save
 * @returns Success status
 */
export async function saveLikedOutfit(
  userId: string,
  outfitData: LikedOutfitData
): Promise<{ success: boolean; message: string; isDuplicate?: boolean }> {
  console.log('🔥🔥🔥 ===== SAVE LIKED OUTFIT FUNCTION CALLED =====');
  console.log('🔥 UserId:', userId);
  console.log('🔥 OutfitData:', outfitData);
  
  try {
    console.log('🔍 saveLikedOutfit called with:', {
      userId,
      hasTitle: !!outfitData.title,
      hasImageUrl: !!outfitData.imageUrl,
      title: outfitData.title,
      imageUrlPreview: outfitData.imageUrl?.substring(0, 50) + '...',
      itemsCount: outfitData.items?.length || 0,
      colorsCount: outfitData.colorPalette?.length || 0,
    });

    // Validate userId
    if (!userId || userId.trim() === '' || userId === 'anonymous') {
      console.error('❌ Invalid userId:', userId);
      return {
        success: false,
        message: 'Please sign in to save outfits to your favorites',
        isDuplicate: false,
      };
    }

    // Validate outfit data
    if (!outfitData.title || !outfitData.imageUrl) {
      console.error('❌ Invalid outfit data:', {
        hasTitle: !!outfitData.title,
        hasImageUrl: !!outfitData.imageUrl,
      });
      return {
        success: false,
        message: 'Outfit title and image are required',
        isDuplicate: false,
      };
    }

    // Validate imageUrl format
    if (!outfitData.imageUrl.startsWith('http') && !outfitData.imageUrl.startsWith('data:')) {
      console.error('❌ Invalid imageUrl format:', outfitData.imageUrl.substring(0, 50));
      return {
        success: false,
        message: 'Invalid image URL format',
        isDuplicate: false,
      };
    }

    console.log('📁 Creating Firestore reference: users/' + userId + '/likedOutfits');
    console.log('🔍 Firebase db object:', db);
    console.log('🔍 Current auth user:', auth.currentUser?.uid);
    
    // Verify auth state
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      console.error('❌ Auth mismatch - current user:', auth.currentUser?.uid, 'expected:', userId);
      return {
        success: false,
        message: 'Authentication mismatch. Please sign in again.',
        isDuplicate: false,
      };
    }

    // Check for duplicates using title only (imageUrl is too large for Firestore queries)
    const likesRef = collection(db, 'users', userId, 'likedOutfits');
    const duplicateQuery = query(
      likesRef,
      where('title', '==', outfitData.title)
    );
    
    console.log('🔍 Checking for duplicates...');
    const duplicateSnapshot = await getDocs(duplicateQuery);
    
    // Check if any of the matching titles have the same imageUrl
    // (We do this client-side since imageUrl is too large for Firestore queries)
    const isDuplicate = duplicateSnapshot.docs.some(doc => {
      const data = doc.data();
      // For data URIs, compare just the first 200 chars (header + format info)
      const existingPrefix = data.imageUrl?.substring(0, 200) || '';
      const newPrefix = outfitData.imageUrl.substring(0, 200);
      return existingPrefix === newPrefix;
    });
    
    if (isDuplicate) {
      console.log('⚠️ Duplicate found, outfit already liked');
      return {
        success: true,
        message: 'This outfit is already in your likes',
        isDuplicate: true,
      };
    }

    console.log('💾 Saving outfit to Firestore directly...');
    console.log('📦 Data to save:', {
      ...outfitData,
      imageUrl: outfitData.imageUrl.substring(0, 100) + '...',
      hasItems: !!outfitData.items,
      itemsLength: outfitData.items?.length,
      hasColorPalette: !!outfitData.colorPalette,
      colorPaletteLength: outfitData.colorPalette?.length,
    });
    
    // Save directly to Firestore without complex validation
    // This is simpler and avoids validation schema mismatches
    const dataToSave = {
      imageUrl: outfitData.imageUrl,
      title: outfitData.title,
      description: outfitData.description,
      items: outfitData.items || [],
      colorPalette: outfitData.colorPalette || [],
      styleType: outfitData.styleType || '',
      occasion: outfitData.occasion || '',
      shoppingLinks: outfitData.shoppingLinks || {
        amazon: null,
        tatacliq: null,
        myntra: null,
      },
      itemShoppingLinks: outfitData.itemShoppingLinks || [],
      likedAt: Date.now(),
      recommendationId: outfitData.recommendationId || '',
    };
    
    console.log('💾 Attempting to save to Firestore at path: users/' + userId + '/likedOutfits');
    console.log('💾 Data keys being saved:', Object.keys(dataToSave));
    console.log('💾 Firestore collection reference created');
    
    try {
      const docRef = await addDoc(likesRef, dataToSave);
      console.log('✅ Outfit saved successfully with ID:', docRef.id);
      console.log('🔗 Document path: users/' + userId + '/likedOutfits/' + docRef.id);
      
      // Verify the save by reading it back
      console.log('🔍 Verifying save by reading back...');
      const verifyQuery = query(likesRef, where('title', '==', outfitData.title));
      const verifySnapshot = await getDocs(verifyQuery);
      console.log('✅ Verification: Found', verifySnapshot.size, 'documents with this title');
      
      return {
        success: true,
        message: 'Outfit saved to likes successfully',
        isDuplicate: false,
      };
    } catch (firestoreError) {
      console.error('❌ Firestore save failed:', firestoreError);
      if (firestoreError && typeof firestoreError === 'object') {
        if ('code' in firestoreError) {
          console.error('❌ Error code:', firestoreError.code);
        }
        if ('message' in firestoreError) {
          console.error('❌ Error message:', firestoreError.message);
        }
      }
      throw firestoreError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('❌ Error saving liked outfit:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
    });
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to save outfit';
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'permission-denied') {
        userMessage = 'Permission denied. Please sign in again.';
      } else if (error.code === 'unavailable') {
        userMessage = 'Database temporarily unavailable. Please try again.';
      }
    } else if (error instanceof Error) {
      userMessage = error.message;
    }
    
    return {
      success: false,
      message: userMessage,
      isDuplicate: false,
    };
  }
}

/**
 * Get all liked outfits for a user
 * @param userId - The user's ID
 * @returns Array of liked outfits
 */
export async function getLikedOutfits(userId: string): Promise<LikedOutfitData[]> {
  try {
    // Validate userId
    if (!userId || userId.trim() === '' || userId === 'anonymous') {
      console.error('❌ Invalid userId provided to getLikedOutfits:', userId);
      return [];
    }

    console.log('🔍 Fetching liked outfits for user:', userId);

    const likesRef = collection(db, 'users', userId, 'likedOutfits');
    
    // Query with orderBy to sort by most recent first
    const q = query(likesRef, orderBy('likedAt', 'desc'));
    const snapshot = await getDocs(q);
    
    console.log('📊 Found', snapshot.size, 'liked outfits in database');
    
    const outfits: LikedOutfitData[] = [];
    snapshot.forEach((doc) => {
      try {
        const data = doc.data() as LikedOutfitData;
        // Validate essential fields before adding
        if (data && data.title && data.imageUrl) {
          outfits.push({
            ...data,
            id: doc.id, // Include the document ID
          });
        } else {
          console.warn('⚠️ Incomplete outfit data found:', doc.id, {
            hasTitle: !!data?.title,
            hasImageUrl: !!data?.imageUrl,
          });
        }
      } catch (err) {
        console.error('❌ Error parsing outfit document:', doc.id, err);
      }
    });
    
    console.log('✅ Successfully fetched', outfits.length, 'valid liked outfits');
    
    return outfits;
  } catch (error) {
    console.error('❌ Error fetching liked outfits:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
    });
    
    // Return empty array instead of throwing
    return [];
  }
}

/**
 * Remove a liked outfit from the user's collection
 * @param userId - The user's ID
 * @param outfitId - The document ID of the outfit to remove
 * @returns Success status
 */
export async function removeLikedOutfit(
  userId: string,
  outfitId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🗑️ Removing liked outfit:', { userId, outfitId });

    // Validate inputs
    if (!userId || userId.trim() === '' || userId === 'anonymous') {
      console.error('❌ Invalid userId:', userId);
      return {
        success: false,
        message: 'Invalid user ID',
      };
    }

    if (!outfitId || outfitId.trim() === '') {
      console.error('❌ Invalid outfitId:', outfitId);
      return {
        success: false,
        message: 'Invalid outfit ID',
      };
    }

    // Delete the document
    const outfitRef = doc(db, 'users', userId, 'likedOutfits', outfitId);
    await deleteDoc(outfitRef);
    
    console.log('✅ Outfit removed successfully:', outfitId);
    
    return {
      success: true,
      message: 'Outfit removed from likes',
    };
  } catch (error) {
    console.error('❌ Error removing liked outfit:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
    });
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to remove outfit';
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'permission-denied') {
        userMessage = 'Permission denied. Please sign in again.';
      } else if (error.code === 'not-found') {
        userMessage = 'Outfit not found';
      } else if (error.code === 'unavailable') {
        userMessage = 'Database temporarily unavailable. Please try again.';
      }
    } else if (error instanceof Error) {
      userMessage = error.message;
    }
    
    return {
      success: false,
      message: userMessage,
    };
  }
}
