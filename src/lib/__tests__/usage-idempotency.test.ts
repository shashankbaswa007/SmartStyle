import { describe, expect, it, jest } from '@jest/globals';
import { buildUsageIdempotencyKey, getIdempotencyKeyFromHeaders } from '@/lib/usage-idempotency';

function mockRequest(headers?: Record<string, string>): Request {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(headers || {})) {
    normalized.set(key.toLowerCase(), value);
  }

  return {
    headers: {
      get(name: string) {
        return normalized.get(name.toLowerCase()) ?? null;
      },
    } as Headers,
  } as Request;
}

describe('usage idempotency key generation', () => {
  it('prefers explicit header key when provided', () => {
    const request = mockRequest({
      'x-idempotency-key': 'manual-key-123',
    });

    expect(getIdempotencyKeyFromHeaders(request)).toBe('manual-key-123');

    const key = buildUsageIdempotencyKey({
      scope: 'recommend',
      userId: 'user-1',
      payload: { a: 1 },
      request,
    });

    expect(key).toBe('recommend:user-1:manual-key-123');
  });

  it('generates deterministic key for same payload order within same bucket', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const request = mockRequest();

    const keyA = buildUsageIdempotencyKey({
      scope: 'wardrobe-upload',
      userId: 'user-2',
      payload: {
        b: 'two',
        a: 'one',
      },
      request,
    });

    const keyB = buildUsageIdempotencyKey({
      scope: 'wardrobe-upload',
      userId: 'user-2',
      payload: {
        a: 'one',
        b: 'two',
      },
      request,
    });

    expect(keyA).toBe(keyB);
  });
});
