/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockVerifyBearerToken = jest.fn<(...args: any[]) => Promise<string>>();
const mockGetServerRateLimitStatus = jest.fn<(...args: any[]) => Promise<any>>();

class MockAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

jest.mock('@/lib/server-auth', () => ({
  verifyBearerToken: (...args: any[]) => mockVerifyBearerToken(...args),
  AuthError: MockAuthError,
}));

jest.mock('@/lib/server-rate-limiter', () => ({
  getServerRateLimitStatus: (...args: any[]) => mockGetServerRateLimitStatus(...args),
}));

import { GET } from './route';

describe('GET /api/usage-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyBearerToken.mockResolvedValue('user-1');
    mockGetServerRateLimitStatus
      .mockResolvedValueOnce({ limit: 10, used: 0, remaining: 10, resetAt: new Date('2026-04-10T00:00:00.000Z') })
      .mockResolvedValueOnce({ limit: 10, used: 1, remaining: 9, resetAt: new Date('2026-04-10T00:00:00.000Z') })
      .mockResolvedValueOnce({ limit: 10, used: 2, remaining: 8, resetAt: new Date('2026-04-10T00:00:00.000Z') });
  });

  it('returns canonical and legacy usage scope keys with sanitized values', async () => {
    const response = await GET(
      new Request('http://localhost/api/usage-status', {
        headers: {
          authorization: 'Bearer token',
          'x-timezone-offset-minutes': '-330',
        },
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.usage.recommend.remaining).toBe(10);
    expect(payload.usage['wardrobe-outfit'].remaining).toBe(9);
    expect(payload.usage['wardrobe-upload'].remaining).toBe(8);

    // Backward compatibility aliases during rollout.
    expect(payload.usage.wardrobeOutfit.remaining).toBe(9);
    expect(payload.usage.wardrobeUpload.remaining).toBe(8);
  });

  it('returns auth error payload when token is invalid', async () => {
    mockVerifyBearerToken.mockRejectedValue(new MockAuthError('Unauthorized', 401));

    const response = await GET(
      new Request('http://localhost/api/usage-status', {
        headers: {
          authorization: 'Bearer invalid',
        },
      })
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.code).toBe('UNAUTHORIZED');
  });
});
