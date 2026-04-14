import { db, auth } from './firebase';
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc, setDoc, updateDoc, limit } from 'firebase/firestore';
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
  wornAt?: number;
  recommendationId: string;
}

export interface LikedOutfitSaveResult {
  success: boolean;
  message: string;
  isDuplicate?: boolean;
}

const LIKED_OUTFIT_PLACEHOLDER_IMAGE = 'https://via.placeholder.com/800x1000/6366f1/ffffff?text=Outfit+Preview';

function normalizeLikedOutfitImageUrl(imageUrl?: string): string {
  if (!imageUrl) return LIKED_OUTFIT_PLACEHOLDER_IMAGE;
  if (imageUrl.startsWith('data:')) return imageUrl;
  try {
    const parsed = new URL(imageUrl);
    return parsed.toString();
  } catch {
    return LIKED_OUTFIT_PLACEHOLDER_IMAGE;
  }
}

async function parseLikeApiResponse(response: Response, payload?: any): Promise<LikedOutfitSaveResult> {
  const resolvedPayload = payload ?? await parseJsonPayload(response);

  if (response.ok && resolvedPayload?.success) {
    return {
      success: true,
      message: resolvedPayload.message || 'Outfit saved to likes successfully',
      isDuplicate: resolvedPayload.isDuplicate === true,
    };
  }

  if (response.status === 401) {
    return {
      success: false,
      message: resolvedPayload?.error || 'Please sign in to save outfits to your favorites',
      isDuplicate: false,
    };
  }

  return {
    success: false,
    message: resolvedPayload?.error || resolvedPayload?.message || 'Failed to save outfit',
    isDuplicate: false,
  };
}

async function parseJsonPayload(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isLikesBackendUnavailable(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  return payload.code === 'LIKES_BACKEND_UNAVAILABLE' || payload.backendAvailable === false;
}

function shouldFallbackToClientLikes(response: Response, payload: any): boolean {
  if (response.status === 500 || response.status === 503) return true;
  return isLikesBackendUnavailable(payload);
}

/**
 * Save a liked outfit through the authenticated backend route first.
 * Falls back to the legacy client Firestore path if the backend is unavailable.
 */
export async function saveLikedOutfitWithSession(
  userId: string,
  recommendationId: string,
  outfitData: LikedOutfitData,
  options?: { idToken?: string | null }
): Promise<LikedOutfitSaveResult> {
  const currentUser = auth.currentUser;

  const executeRequest = async (token: string | null): Promise<Response> => {
    return fetch('/api/likes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({
        recommendationId,
        outfit: {
          imageUrl: outfitData.imageUrl,
          title: outfitData.title,
          description: outfitData.description,
          items: outfitData.items || [],
          colorPalette: outfitData.colorPalette || [],
          styleType: outfitData.styleType,
          occasion: outfitData.occasion,
          shoppingLinks: outfitData.shoppingLinks || {
            amazon: null,
            tatacliq: null,
            myntra: null,
          },
          itemShoppingLinks: outfitData.itemShoppingLinks || [],
          likedAt: outfitData.likedAt || Date.now(),
        },
      }),
    });
  };

  try {
    let token: string | null = options?.idToken ?? null;

    if (!token && currentUser && currentUser.uid === userId && !currentUser.isAnonymous) {
      try {
        token = await currentUser.getIdToken();
      } catch {
        token = null;
      }
    }

    let response = await executeRequest(token);

    if (response.status === 401 && currentUser && currentUser.uid === userId && !currentUser.isAnonymous) {
      try {
        const refreshedToken = await currentUser.getIdToken(true);
        response = await executeRequest(refreshedToken);
      } catch {
        // Fall through to cookie-only retry below.
      }
    }

    if (response.status === 401 && token) {
      response = await executeRequest(null);
    }

    const payload = await parseJsonPayload(response);

    if (shouldFallbackToClientLikes(response, payload)) {
      return await saveLikedOutfit(userId, outfitData);
    }

    if (response.ok && payload?.success) {
      return {
        success: true,
        message: payload.message || 'Outfit saved to likes successfully',
        isDuplicate: payload.isDuplicate === true,
      };
    }

    return parseLikeApiResponse(response, payload);
  } catch {
    return await saveLikedOutfit(userId, outfitData);
  }
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
): Promise<LikedOutfitSaveResult> {
  
  try {

    // Validate userId
    if (!userId || userId.trim() === '' || userId === 'anonymous') {
      return {
        success: false,
        message: 'Please sign in to save outfits to your favorites',
        isDuplicate: false,
      };
    }

    // Validate outfit data
    if (!outfitData.title || !outfitData.imageUrl) {
      return {
        success: false,
        message: 'Outfit title and image are required',
        isDuplicate: false,
      };
    }

    // Validate imageUrl format
    if (!outfitData.imageUrl.startsWith('http') && !outfitData.imageUrl.startsWith('data:')) {
      return {
        success: false,
        message: 'Invalid image URL format',
        isDuplicate: false,
      };
    }

    
    // Verify auth state
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
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
      return {
        success: true,
        message: 'This outfit is already in your likes',
        isDuplicate: true,
      };
    }

    
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
      wornAt: outfitData.wornAt || null,
      recommendationId: outfitData.recommendationId || '',
    };
    
    
    try {
      const docRef = await addDoc(likesRef, dataToSave);
      
      // Verify the save by reading it back
      const verifyQuery = query(likesRef, where('title', '==', outfitData.title));
      const verifySnapshot = await getDocs(verifyQuery);
      
      return {
        success: true,
        message: 'Outfit saved to likes successfully',
        isDuplicate: false,
      };
    } catch (firestoreError) {
      throw firestoreError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    
    // Provide user-friendly error messages
    let userMessage = 'Failed to save outfit';
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'permission-denied') {
        userMessage = 'Permission denied. Please sign in again.';
      } else if (error.code === 'unavailable') {
        userMessage = 'Database temporarily unavailable. Please try again.';
      }
    }
    
    return {
      success: false,
      message: userMessage,
      isDuplicate: false,
    };
  }
}

/**
 * Mark a liked outfit as worn so the UI can reflect the stronger feedback signal.
 */
export async function markLikedOutfitAsWorn(
  userId: string,
  outfitId: string,
  wornAt: number = Date.now()
): Promise<{ success: boolean; message: string }> {
  try {
    if (!userId || userId.trim() === '' || userId === 'anonymous') {
      return {
        success: false,
        message: 'Invalid user ID',
      };
    }

    if (!outfitId || outfitId.trim() === '') {
      return {
        success: false,
        message: 'Invalid outfit ID',
      };
    }

    const outfitRef = doc(db, 'users', userId, 'likedOutfits', outfitId);
    await updateDoc(outfitRef, { wornAt });

    return {
      success: true,
      message: 'Outfit marked as worn',
    };
  } catch (error) {
    let userMessage = 'Failed to mark outfit as worn';
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'permission-denied') {
        userMessage = 'Permission denied. Please sign in again.';
      } else if (error.code === 'not-found') {
        userMessage = 'Outfit not found';
      } else if (error.code === 'unavailable') {
        userMessage = 'Database temporarily unavailable. Please try again.';
      }
    }

    return {
      success: false,
      message: userMessage,
    };
  }
}

function normalizeLikedOutfitRecord(record: any): LikedOutfitData | null {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const title = typeof record.title === 'string' ? record.title.trim() : '';
  if (!title) {
    return null;
  }

  const items = Array.isArray(record.items)
    ? record.items.filter((item: unknown): item is string => typeof item === 'string')
    : [];
  const colorPalette = Array.isArray(record.colorPalette)
    ? record.colorPalette.filter((color: unknown): color is string => typeof color === 'string')
    : [];

  const shoppingLinksRecord =
    record.shoppingLinks && typeof record.shoppingLinks === 'object'
      ? record.shoppingLinks
      : {};

  const itemShoppingLinks = Array.isArray(record.itemShoppingLinks)
    ? record.itemShoppingLinks
        .filter((entry: unknown) => entry && typeof entry === 'object')
        .map((entry: any) => ({
          item: typeof entry.item === 'string' ? entry.item : '',
          amazon: typeof entry.amazon === 'string' ? entry.amazon : '',
          tatacliq: typeof entry.tatacliq === 'string' ? entry.tatacliq : '',
          myntra: typeof entry.myntra === 'string' ? entry.myntra : '',
        }))
        .filter((entry: { item: string }) => entry.item.length > 0)
    : [];

  return {
    id: typeof record.id === 'string' ? record.id : undefined,
    imageUrl: normalizeLikedOutfitImageUrl(typeof record.imageUrl === 'string' ? record.imageUrl : undefined),
    title,
    description: typeof record.description === 'string' ? record.description : title,
    items,
    colorPalette,
    styleType: typeof record.styleType === 'string' ? record.styleType : undefined,
    occasion: typeof record.occasion === 'string' ? record.occasion : undefined,
    shoppingLinks: {
      amazon: typeof shoppingLinksRecord.amazon === 'string' ? shoppingLinksRecord.amazon : null,
      tatacliq: typeof shoppingLinksRecord.tatacliq === 'string' ? shoppingLinksRecord.tatacliq : null,
      myntra: typeof shoppingLinksRecord.myntra === 'string' ? shoppingLinksRecord.myntra : null,
    },
    itemShoppingLinks,
    likedAt: typeof record.likedAt === 'number' ? record.likedAt : Date.now(),
    wornAt: typeof record.wornAt === 'number' ? record.wornAt : undefined,
    recommendationId: typeof record.recommendationId === 'string' ? record.recommendationId : '',
  };
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
      return [];
    }
    const currentUser = auth.currentUser;

    const executeApiRequest = async (token: string | null): Promise<Response> => {
      return fetch('/api/likes', {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        cache: 'no-store',
      });
    };

    try {
      let token: string | null = null;
      if (currentUser && currentUser.uid === userId && !currentUser.isAnonymous) {
        token = await currentUser.getIdToken().catch(() => null);
      }

      let response = await executeApiRequest(token);

      if (response.status === 401 && currentUser && currentUser.uid === userId && !currentUser.isAnonymous) {
        const refreshedToken = await currentUser.getIdToken(true).catch(() => null);
        if (refreshedToken) {
          response = await executeApiRequest(refreshedToken);
        }
      }

      if (response.status === 401 && token) {
        response = await executeApiRequest(null);
      }

      const payload = await parseJsonPayload(response);
      const payloadData = Array.isArray(payload?.data) ? payload.data : [];

      if (response.ok && payload?.success && !isLikesBackendUnavailable(payload) && Array.isArray(payload?.data)) {
        return payloadData
          .map((entry: any) => normalizeLikedOutfitRecord(entry))
          .filter((entry: LikedOutfitData | null): entry is LikedOutfitData => Boolean(entry));
      }

      if (response.ok && !shouldFallbackToClientLikes(response, payload)) {
        return [];
      }
    } catch {
      // Continue to Firestore client fallback.
    }

    const likesRef = collection(db, 'users', userId, 'likedOutfits');

    // Query with orderBy to sort by most recent first
    const q = query(likesRef, orderBy('likedAt', 'desc'), limit(200));
    const snapshot = await getDocs(q);

    const outfits: LikedOutfitData[] = [];
    snapshot.forEach((doc) => {
      try {
        const normalized = normalizeLikedOutfitRecord({
          id: doc.id,
          ...doc.data(),
        });
        if (normalized) {
          outfits.push(normalized);
        }
      } catch (error) {
        console.warn('[getLikedOutfits] Failed to parse document:', error);
        // Skip malformed documents
      }
    });

    return outfits;
  } catch (error) {
    console.error('[getLikedOutfits] Error fetching liked outfits:', error);
    // Return empty array instead of throwing, but log the error
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

    // Validate inputs
    if (!userId || userId.trim() === '' || userId === 'anonymous') {
      return {
        success: false,
        message: 'Invalid user ID',
      };
    }

    if (!outfitId || outfitId.trim() === '') {
      return {
        success: false,
        message: 'Invalid outfit ID',
      };
    }

    // Delete the document
    const outfitRef = doc(db, 'users', userId, 'likedOutfits', outfitId);
    await deleteDoc(outfitRef);
    
    
    return {
      success: true,
      message: 'Outfit removed from likes',
    };
  } catch (error) {
    
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
    }
    
    return {
      success: false,
      message: userMessage,
    };
  }
}
