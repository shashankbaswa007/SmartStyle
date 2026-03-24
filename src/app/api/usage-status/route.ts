import { NextResponse } from 'next/server';
import { verifyBearerToken, AuthError } from '@/lib/server-auth';
import { getServerRateLimitStatus } from '@/lib/server-rate-limiter';
import { DAILY_WINDOW_MS, RATE_LIMIT_SCOPES, USAGE_LIMITS } from '@/lib/usage-limits';

export async function GET(request: Request) {
  try {
    const userId = await verifyBearerToken(request);

    const [recommend, wardrobeOutfit, wardrobeUpload] = await Promise.all([
      getServerRateLimitStatus(userId, {
        scope: RATE_LIMIT_SCOPES.recommend,
        windowMs: DAILY_WINDOW_MS,
        maxRequests: USAGE_LIMITS.recommend,
      }),
      getServerRateLimitStatus(userId, {
        scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
        windowMs: DAILY_WINDOW_MS,
        maxRequests: USAGE_LIMITS.wardrobeOutfit,
      }),
      getServerRateLimitStatus(userId, {
        scope: RATE_LIMIT_SCOPES.wardrobeUpload,
        windowMs: DAILY_WINDOW_MS,
        maxRequests: USAGE_LIMITS.wardrobeUpload,
      }),
    ]);

    return NextResponse.json({
      success: true,
      usage: {
        recommend,
        wardrobeOutfit,
        wardrobeUpload,
      },
    });
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
        error: 'Failed to fetch usage status',
        code: 'USAGE_STATUS_FAILED',
      },
      { status: 500 }
    );
  }
}
