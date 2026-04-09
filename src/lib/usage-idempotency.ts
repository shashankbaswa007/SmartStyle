import crypto from 'crypto';
import { USAGE_IDEMPOTENCY_WINDOW_MS } from '@/lib/usage-limits';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`);

  return `{${entries.join(',')}}`;
}

function sanitizeKey(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 120);
}

export function getIdempotencyKeyFromHeaders(request: Request): string | null {
  const explicit = request.headers.get('x-idempotency-key') || request.headers.get('idempotency-key');
  if (!explicit) return null;

  const sanitized = sanitizeKey(explicit);
  return sanitized.length > 0 ? sanitized : null;
}

export function buildUsageIdempotencyKey(params: {
  scope: string;
  userId: string;
  payload: unknown;
  request: Request;
}): string {
  const headerKey = getIdempotencyKeyFromHeaders(params.request);
  if (headerKey) {
    return `${params.scope}:${params.userId}:${headerKey}`;
  }

  const bucket = Math.floor(Date.now() / USAGE_IDEMPOTENCY_WINDOW_MS);
  const canonical = stableStringify(params.payload);
  const digest = crypto
    .createHash('sha256')
    .update(`${params.scope}:${params.userId}:${bucket}:${canonical}`)
    .digest('hex')
    .slice(0, 40);

  return `${params.scope}:${params.userId}:${digest}`;
}
