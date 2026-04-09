import { NextResponse } from 'next/server';
import { verifyBearerToken, AuthError } from '@/lib/server-auth';
import { getServerRateLimitStatus } from '@/lib/server-rate-limiter';
import { DAILY_WINDOW_MS, getTimezoneOffsetMinutesFromRequest, RATE_LIMIT_SCOPES, USAGE_LIMITS } from '@/lib/usage-limits';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function sanitizeUsageStatus(status: { limit: number; used: number; remaining: number; resetAt: Date }) {
  const limit = Number.isFinite(status.limit) ? Math.max(0, Math.floor(status.limit)) : 0;
  const used = Number.isFinite(status.used) ? Math.max(0, Math.floor(status.used)) : 0;
  const remainingRaw = Number.isFinite(status.remaining) ? Math.floor(status.remaining) : 0;
  const remaining = Math.max(0, Math.min(limit, remainingRaw));

  return {
    limit,
    used,
    remaining,
    resetAt: status.resetAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const userId = await verifyBearerToken(request);
    const timezoneOffsetMinutes = getTimezoneOffsetMinutesFromRequest(request);

    const [recommend, wardrobeOutfit, wardrobeUpload] = await Promise.all([
      getServerRateLimitStatus(userId, {
        scope: RATE_LIMIT_SCOPES.recommend,
        windowMs: DAILY_WINDOW_MS,
        maxRequests: USAGE_LIMITS.recommend,
        timezoneOffsetMinutes,
      }),
      getServerRateLimitStatus(userId, {
        scope: RATE_LIMIT_SCOPES.wardrobeOutfit,
        windowMs: DAILY_WINDOW_MS,
        maxRequests: USAGE_LIMITS.wardrobeOutfit,
        timezoneOffsetMinutes,
      }),
      getServerRateLimitStatus(userId, {
        scope: RATE_LIMIT_SCOPES.wardrobeUpload,
        windowMs: DAILY_WINDOW_MS,
        maxRequests: USAGE_LIMITS.wardrobeUpload,
        timezoneOffsetMinutes,
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        usage: {
          recommend: sanitizeUsageStatus(recommend),
          [RATE_LIMIT_SCOPES.wardrobeOutfit]: sanitizeUsageStatus(wardrobeOutfit),
          [RATE_LIMIT_SCOPES.wardrobeUpload]: sanitizeUsageStatus(wardrobeUpload),
          // Temporary legacy aliases for backward compatibility during rollout.
          wardrobeOutfit: sanitizeUsageStatus(wardrobeOutfit),
          wardrobeUpload: sanitizeUsageStatus(wardrobeUpload),
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED',
        },
        { status: error.status, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch usage status',
        code: 'USAGE_STATUS_FAILED',
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
