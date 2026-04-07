import { NextResponse } from 'next/server';
import { verifyBearerToken, AuthError } from '@/lib/server-auth';
import { checkServerRateLimit } from '@/lib/server-rate-limiter';
import { addWardrobeItemWithCapacityServer } from '@/lib/wardrobeService.server';
import { DAILY_WINDOW_MS, getTimezoneOffsetMinutesFromRequest, RATE_LIMIT_SCOPES, USAGE_LIMITS } from '@/lib/usage-limits';
import { validateRequestOrigin } from '@/lib/csrf-protection';

const MAX_WARDROBE_ITEMS = 300;

interface WardrobeItemPayload {
  userId: string;
  itemData: {
    imageUrl: string;
    images?: {
      thumbnail: string;
      medium: string;
      full: string;
    };
    itemType: 'top' | 'bottom' | 'dress' | 'shoes' | 'accessory' | 'outerwear';
    category?: string;
    brand?: string;
    description: string;
    dominantColors?: string[];
    season?: ('spring' | 'summer' | 'fall' | 'winter')[];
    occasions?: ('casual' | 'formal' | 'party' | 'business' | 'sports')[];
    purchaseDate?: string;
    tags?: string[];
    notes?: string;
  };
}

export async function POST(request: Request) {
  try {
    if (!validateRequestOrigin(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const authenticatedUserId = await verifyBearerToken(request);
    const timezoneOffsetMinutes = getTimezoneOffsetMinutesFromRequest(request);

    let body: WardrobeItemPayload;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { userId, itemData } = body;
    if (!userId || !itemData) {
      return NextResponse.json({ error: 'Missing required fields: userId and itemData' }, { status: 400 });
    }

    if (authenticatedUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden - user mismatch' }, { status: 403 });
    }

    const rateLimit = await checkServerRateLimit(userId, {
      scope: RATE_LIMIT_SCOPES.wardrobeUpload,
      windowMs: DAILY_WINDOW_MS,
      maxRequests: USAGE_LIMITS.wardrobeUpload,
      timezoneOffsetMinutes,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Daily upload limit reached',
          message: rateLimit.message || `You can upload up to ${USAGE_LIMITS.wardrobeUpload} items per day.`,
          remaining: 0,
          resetAt: rateLimit.resetAt.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
          },
        }
      );
    }

    const saveResult = await addWardrobeItemWithCapacityServer(userId, MAX_WARDROBE_ITEMS, {
      imageUrl: itemData.imageUrl,
      images:
        itemData.images?.thumbnail && itemData.images?.medium && itemData.images?.full
          ? {
              thumbnail: itemData.images.thumbnail,
              medium: itemData.images.medium,
              full: itemData.images.full,
            }
          : undefined,
      itemType: itemData.itemType,
      category: itemData.category,
      brand: itemData.brand,
      description: itemData.description,
      dominantColors: itemData.dominantColors || [],
      season: itemData.season,
      occasions: itemData.occasions,
      purchaseDate: itemData.purchaseDate,
      tags: itemData.tags,
      notes: itemData.notes,
    });

    if (!saveResult.success && saveResult.code === 'CAPACITY_REACHED') {
      return NextResponse.json(
        {
          error: 'Wardrobe capacity reached',
          message: `You have reached the current wardrobe capacity of ${MAX_WARDROBE_ITEMS} items. Delete some items before uploading more.`,
        },
        { status: 400 }
      );
    }

    if (!saveResult.success) {
      return NextResponse.json(
        { error: saveResult.message || 'Failed to save wardrobe item' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        itemId: saveResult.itemId,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt.toISOString(),
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
        },
      }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'WARDROBE_ITEM_SAVE_FAILED',
      },
      { status: 500 }
    );
  }
}
