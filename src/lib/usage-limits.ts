export const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

// Strategy: derive a local-day window from client offset, then keep that
// window stable until it expires (no mid-window shifts from header jitter).
export const USAGE_TIMEZONE_STRATEGY = 'client-offset-local-day-window-freeze' as const;

const MAX_TZ_OFFSET_MINUTES = 14 * 60;

export function normalizeTimezoneOffsetMinutes(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value as number);
  if (rounded < -MAX_TZ_OFFSET_MINUTES || rounded > MAX_TZ_OFFSET_MINUTES) {
    return 0;
  }
  return rounded;
}

export function getTimezoneOffsetMinutesFromRequest(request: Request): number {
  const raw = request.headers.get('x-timezone-offset-minutes') ?? request.headers.get('x-timezone-offset');
  if (!raw) return 0;

  const parsed = Number(raw);
  return normalizeTimezoneOffsetMinutes(parsed);
}

export const USAGE_LIMITS = {
  recommend: 10,
  wardrobeOutfit: 10,
  wardrobeUpload: 10,
} as const;

export const USAGE_IDEMPOTENCY_WINDOW_MS = 15 * 60 * 1000;

export const RATE_LIMIT_SCOPES = {
  recommend: 'recommend',
  wardrobeOutfit: 'wardrobe-outfit',
  wardrobeUpload: 'wardrobe-upload',
} as const;
