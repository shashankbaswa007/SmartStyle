import { NextResponse } from 'next/server';
import { recordRecommendInteraction } from '@/lib/recommend/async-jobs';
import { getClientIdentifier } from '@/lib/rate-limiter';
import { checkServerRateLimit } from '@/lib/server-rate-limiter';

const ALLOWED_EVENTS = new Set(['results_visible', 'another_recommendation']);
const ALLOWED_VARIANTS = new Set(['A', 'B']);

export async function POST(req: Request) {
  const clientId = getClientIdentifier(req);
  const limit = await checkServerRateLimit(clientId, {
    windowMs: 60_000,
    maxRequests: 30,
    scope: 'recommend-interaction',
  });

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

  await recordRecommendInteraction(variant);

  return NextResponse.json({
    success: true,
    tracked: true,
  });
}
