import { NextResponse } from 'next/server';
import { recordRecommendInteraction } from '@/lib/recommend/async-jobs';
import { getClientIdentifier } from '@/lib/rate-limiter';
import { checkServerRateLimit } from '@/lib/server-rate-limiter';
import { logger } from '@/lib/logger';
import { validateRequestOrigin } from '@/lib/csrf-protection';

const ALLOWED_EVENTS = new Set(['results_visible', 'another_recommendation']);
const ALLOWED_VARIANTS = new Set(['A', 'B']);

export async function POST(req: Request) {
  if (!validateRequestOrigin(req)) {
    return NextResponse.json(
      { success: false, tracked: false, error: 'Invalid request origin', code: 'INVALID_ORIGIN' },
      { status: 403 }
    );
  }

  const clientId = getClientIdentifier(req);
  let limit = {
    allowed: true,
    remaining: 30,
    resetAt: new Date(Date.now() + 60_000),
  };

  try {
    limit = await checkServerRateLimit(clientId, {
      windowMs: 60_000,
      maxRequests: 30,
      scope: 'recommend-interaction',
    });
  } catch (error) {
    logger.warn('recommend interaction rate-limit check unavailable; allowing request', {
      error: error instanceof Error ? error.message : String(error),
      clientId,
    });
  }

  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, tracked: false, error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const variantRaw =
    body && typeof body === 'object' && 'variant' in body && typeof (body as { variant?: unknown }).variant === 'string'
      ? (body as { variant: string }).variant
      : undefined;
  const eventRaw =
    body && typeof body === 'object' && 'event' in body && typeof (body as { event?: unknown }).event === 'string'
      ? (body as { event: string }).event
      : undefined;

  if (eventRaw && !ALLOWED_EVENTS.has(eventRaw)) {
    return NextResponse.json(
      { success: false, tracked: false, error: 'Invalid event', code: 'INVALID_EVENT' },
      { status: 400 }
    );
  }

  const variant = variantRaw && ALLOWED_VARIANTS.has(variantRaw) ? variantRaw : undefined;

  try {
    await recordRecommendInteraction(variant);
  } catch (error) {
    logger.warn('recommend interaction metric write failed', {
      error: error instanceof Error ? error.message : String(error),
      variant,
    });

    return NextResponse.json({
      success: true,
      tracked: false,
      warning: 'interaction_tracking_unavailable',
    });
  }

  return NextResponse.json({
    success: true,
    tracked: true,
  });
}
