import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequestOrigin } from '@/lib/csrf-protection';
import { getFirestore } from '@/lib/firebase-admin';
import { AuthError, verifyFirebaseIdToken } from '@/lib/server-auth';
import { logger } from '@/lib/logger';

const SESSION_COOKIE_NAME = 'smartstyle-session';
const IMAGE_PREFIX_COMPARE_LENGTH = 200;

const likesShoppingLinksSchema = z.object({
  amazon: z.string().nullable().optional(),
  tatacliq: z.string().nullable().optional(),
  myntra: z.string().nullable().optional(),
});

const likesItemShoppingLinkSchema = z.object({
  item: z.string().min(1),
  amazon: z.string(),
  tatacliq: z.string(),
  myntra: z.string(),
});

const likesOutfitSchema = z.object({
  imageUrl: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  items: z.array(z.string()).default([]),
  colorPalette: z.array(z.string()).default([]),
  styleType: z.string().optional(),
  occasion: z.string().optional(),
  shoppingLinks: likesShoppingLinksSchema.optional(),
  itemShoppingLinks: z.array(likesItemShoppingLinkSchema).optional(),
  likedAt: z.number().optional(),
});

const saveLikeRequestSchema = z.object({
  recommendationId: z.string().min(1),
  outfit: likesOutfitSchema,
});

type AuthResolution = {
  uid: string;
  source: 'bearer' | 'session';
};

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function getSessionTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieParts = cookieHeader.split(';').map((part) => part.trim());
  const sessionPair = cookieParts.find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!sessionPair) return null;

  try {
    const rawToken = sessionPair.slice(`${SESSION_COOKIE_NAME}=`.length);
    const token = rawToken ? decodeURIComponent(rawToken) : '';
    return token || null;
  } catch {
    return null;
  }
}

async function resolveAuthenticatedUser(request: Request, requestId: string): Promise<AuthResolution> {
  const bearerToken = extractBearerToken(request);
  if (bearerToken) {
    const uid = await verifyFirebaseIdToken(bearerToken, { allowDevFallback: true });
    if (uid) {
      return { uid, source: 'bearer' };
    }

    logger.warn('Likes POST: bearer token verification failed', {
      requestId,
    });
  }

  const sessionToken = getSessionTokenFromCookie(request);
  if (sessionToken) {
    const uid = await verifyFirebaseIdToken(sessionToken, { allowDevFallback: true });
    if (uid) {
      return { uid, source: 'session' };
    }

    logger.warn('Likes POST: session cookie verification failed', {
      requestId,
      hasSessionCookie: true,
    });
  }

  logger.warn('Likes POST unauthorized: no valid bearer/session token', {
    requestId,
    hasAuthorizationHeader: !!request.headers.get('authorization'),
    hasSessionCookie: !!sessionToken,
  });

  throw new AuthError('Unauthorized - Missing or invalid authentication session', 401);
}

function normalizeLikeOutfitData(
  parsedBody: z.infer<typeof saveLikeRequestSchema>
) {
  const { recommendationId, outfit } = parsedBody;

  return {
    imageUrl: outfit.imageUrl,
    title: outfit.title,
    description: outfit.description || outfit.title,
    items: Array.isArray(outfit.items) ? outfit.items : [],
    colorPalette: Array.isArray(outfit.colorPalette) ? outfit.colorPalette : [],
    styleType: outfit.styleType || '',
    occasion: outfit.occasion || '',
    shoppingLinks: {
      amazon: outfit.shoppingLinks?.amazon || null,
      tatacliq: outfit.shoppingLinks?.tatacliq || null,
      myntra: outfit.shoppingLinks?.myntra || null,
    },
    itemShoppingLinks: Array.isArray(outfit.itemShoppingLinks) ? outfit.itemShoppingLinks : [],
    likedAt: Number.isFinite(outfit.likedAt) ? Number(outfit.likedAt) : Date.now(),
    wornAt: null,
    recommendationId,
  };
}

function buildLikesBackendUnavailableResponse(
  requestId: string,
  mode: 'read' | 'write'
) {
  if (mode === 'read') {
    return NextResponse.json(
      {
        success: true,
        data: [],
        count: 0,
        backendAvailable: false,
        code: 'LIKES_BACKEND_UNAVAILABLE',
        warning: 'Likes backend is temporarily unavailable',
        requestId,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return NextResponse.json(
    {
      success: false,
      backendAvailable: false,
      code: 'LIKES_BACKEND_UNAVAILABLE',
      error: 'Likes service is temporarily unavailable',
      requestId,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || `likes-${Date.now()}`;

  try {
    if (!validateRequestOrigin(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request origin',
          code: 'INVALID_ORIGIN',
        },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      );
    }

    const parsed = saveLikeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    const auth = await resolveAuthenticatedUser(request, requestId);
    logger.info('Likes POST: authenticated request', {
      requestId,
      userId: auth.uid,
      source: auth.source,
    });

    let db;
    try {
      db = getFirestore();
    } catch (error) {
      logger.error('Likes POST: Firestore Admin unavailable', {
        requestId,
        error,
      });
      return buildLikesBackendUnavailableResponse(requestId, 'write');
    }

    const likesRef = db.collection('users').doc(auth.uid).collection('likedOutfits');
    const normalizedLike = normalizeLikeOutfitData(parsed.data);

    const duplicateSnapshot = await likesRef.where('title', '==', normalizedLike.title).limit(20).get();
    const incomingImagePrefix = normalizedLike.imageUrl.substring(0, IMAGE_PREFIX_COMPARE_LENGTH);

    const isDuplicate = duplicateSnapshot.docs.some((existingDoc: any) => {
      const existingData = existingDoc.data() as { imageUrl?: string };
      const existingPrefix = (existingData.imageUrl || '').substring(0, IMAGE_PREFIX_COMPARE_LENGTH);
      return existingPrefix === incomingImagePrefix;
    });

    if (isDuplicate) {
      return NextResponse.json(
        {
          success: true,
          message: 'This outfit is already in your likes',
          isDuplicate: true,
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const savedDoc = await likesRef.add(normalizedLike);

    logger.info('Likes POST: like saved', {
      requestId,
      userId: auth.uid,
      likeId: savedDoc.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Outfit saved to likes successfully',
        likeId: savedDoc.id,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: 'UNAUTHORIZED',
        },
        { status: error.status }
      );
    }

    logger.error('Likes POST failed unexpectedly', {
      requestId,
      error,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save liked outfit',
        code: 'LIKE_SAVE_FAILED',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') || `likes-get-${Date.now()}`;

  try {
    const auth = await resolveAuthenticatedUser(request, requestId);
    logger.info('Likes GET: authenticated request', {
      requestId,
      userId: auth.uid,
      source: auth.source,
    });

    let db;
    try {
      db = getFirestore();
    } catch (error) {
      logger.error('Likes GET: Firestore Admin unavailable', {
        requestId,
        error,
      });
      return buildLikesBackendUnavailableResponse(requestId, 'read');
    }

    const likesRef = db.collection('users').doc(auth.uid).collection('likedOutfits');
    const snapshot = await likesRef.orderBy('likedAt', 'desc').limit(200).get();

    const outfits: any[] = [];
    snapshot.forEach((doc) => {
      try {
        const data = doc.data();
        // Validate essential fields before adding
        if (data && data.title) {
          outfits.push({
            id: doc.id,
            ...data,
          });
        }
      } catch (error) {
        logger.warn('Likes GET: Failed to parse document', {
          requestId,
          docId: doc.id,
          error,
        });
        // Skip malformed documents
      }
    });

    logger.info('Likes GET: retrieved outfits', {
      requestId,
      userId: auth.uid,
      count: outfits.length,
    });

    return NextResponse.json(
      {
        success: true,
        data: outfits,
        count: outfits.length,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: 'UNAUTHORIZED',
        },
        { status: error.status }
      );
    }

    logger.error('Likes GET failed unexpectedly', {
      requestId,
      error,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve liked outfits',
        code: 'LIKE_RETRIEVAL_FAILED',
      },
      { status: 500 }
    );
  }
}
