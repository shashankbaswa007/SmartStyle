import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';

export interface LikedOutfitData {
  id?: string; // Add optional id field for document ID
  imageUrl: string;
  title: string;
  description: string;
  items: string[];
  colorPalette: string[];
  shoppingLinks: {
    amazon: string | null;
    tatacliq: string | null; // Replaced Nykaa with TATA CLiQ
    myntra: string | null;
  };
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

    // Check for duplicates
    const likesRef = collection(db, 'users', userId, 'likedOutfits');
    const duplicateQuery = query(
      likesRef,
      where('title', '==', outfitData.title),
      where('imageUrl', '==', outfitData.imageUrl)
    );
    
    console.log('🔍 Checking for duplicates...');
    const duplicateSnapshot = await getDocs(duplicateQuery);
    
    if (!duplicateSnapshot.empty) {
      console.log('⚠️ Duplicate found, outfit already liked');
      return {
        success: true,
        message: 'This outfit is already in your likes',
        isDuplicate: true,
      };
    }

    console.log('💾 Saving outfit to Firestore...');
    console.log('📦 Data to save:', {
      ...outfitData,
      imageUrl: outfitData.imageUrl.substring(0, 50) + '...',
    });
    
    // Save the outfit
    const docRef = await addDoc(likesRef, outfitData);
    console.log('✅ Outfit saved successfully with ID:', docRef.id);
    console.log('🔗 Document path: users/' + userId + '/likedOutfits/' + docRef.id);
    
    return {
      success: true,
      message: 'Outfit saved to likes successfully',
      isDuplicate: false,
    };
  } catch (error) {
    console.error('❌ Error saving liked outfit:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any)?.code,
    });
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to save outfit';
    if ((error as any)?.code === 'permission-denied') {
      userMessage = 'Permission denied. Please sign in again.';
    } else if ((error as any)?.code === 'unavailable') {
      userMessage = 'Database temporarily unavailable. Please try again.';
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
      code: (error as any)?.code,
    });
    
    // Return empty array instead of throwing
    return [];
  }
}
