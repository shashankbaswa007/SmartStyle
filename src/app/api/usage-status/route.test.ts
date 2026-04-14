/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockVerifyBearerToken = jest.fn<(...args: any[]) => Promise<string>>();
const mockVerifyFirebaseIdToken = jest.fn<(...args: any[]) => Promise<string | null>>();
const mockGetServerRateLimitStatus = jest.fn<(...args: any[]) => Promise<any>>();
const mockVerifySessionCookie = jest.fn<(...args: any[]) => Promise<{ uid: string }>>();

class MockAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

jest.mock('@/lib/server-auth', () => ({
  verifyBearerToken: (...args: any[]) => mockVerifyBearerToken(...args),
  verifyFirebaseIdToken: (...args: any[]) => mockVerifyFirebaseIdToken(...args),
  AuthError: MockAuthError,
}));

jest.mock('@/lib/firebase-admin', () => ({
  __esModule: true,
  default: {
    auth: () => ({
      verifySessionCookie: (...args: any[]) => mockVerifySessionCookie(...args),
    }),
  },
}));

jest.mock('@/lib/server-rate-limiter', () => ({
  getServerRateLimitStatus: (...args: any[]) => mockGetServerRateLimitStatus(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn<(...args: any[]) => void>(),
    warn: jest.fn<(...args: any[]) => void>(),
    error: jest.fn<(...args: any[]) => void>(),
  },
}));

import { GET } from './route';

describe('GET /api/usage-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyBearerToken.mockResolvedValue('user-1');
    mockVerifyFirebaseIdToken.mockResolvedValue('user-1');
    mockVerifySessionCookie.mockResolvedValue({ uid: 'user-1' });
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
    expect(payload.errorCategory).toBe('UNKNOWN_ERROR');
  });

  it('uses session cookie fallback when bearer verification fails', async () => {
    mockVerifyBearerToken.mockRejectedValue(new MockAuthError('Unauthorized', 401));
    mockVerifySessionCookie.mockResolvedValue({ uid: 'user-from-session' });

    const response = await GET(
      new Request('http://localhost/api/usage-status', {
        headers: {
          cookie: 'smartstyle-session=session-cookie-token',
          'x-timezone-offset-minutes': '-330',
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mockGetServerRateLimitStatus).toHaveBeenCalledWith(
      'user-from-session',
      expect.objectContaining({ scope: 'recommend' })
    );
  });

  it('falls back to verifyFirebaseIdToken when session-cookie admin verification fails', async () => {
    mockVerifyBearerToken.mockRejectedValue(new MockAuthError('Unauthorized', 401));
    mockVerifySessionCookie.mockRejectedValue(new Error('admin unavailable'));
    mockVerifyFirebaseIdToken.mockResolvedValue('user-from-id-token');

    const response = await GET(
      new Request('http://localhost/api/usage-status', {
        headers: {
          cookie: 'smartstyle-session=session-cookie-token',
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mockVerifyFirebaseIdToken).toHaveBeenCalledWith('session-cookie-token', { allowDevFallback: true });
  });

  it('returns 401 instead of 500 for malformed session cookies', async () => {
    mockVerifyBearerToken.mockRejectedValue(new MockAuthError('Unauthorized', 401));

    const response = await GET(
      new Request('http://localhost/api/usage-status', {
        headers: {
          cookie: 'smartstyle-session=%E0%A4%A',
        },
      })
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.code).toBe('UNAUTHORIZED');
  });

  it('uses session fallback when bearer verification throws non-auth error', async () => {
    mockVerifyBearerToken.mockRejectedValue(new Error('auth provider temporarily unavailable'));
    mockVerifySessionCookie.mockResolvedValue({ uid: 'user-from-session-non-auth-failure' });

    const response = await GET(
      new Request('http://localhost/api/usage-status', {
        headers: {
          cookie: 'smartstyle-session=session-cookie-token',
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mockGetServerRateLimitStatus).toHaveBeenCalledWith(
      'user-from-session-non-auth-failure',
      expect.objectContaining({ scope: 'recommend' })
    );
  });

  it('returns a strict failure payload on internal server errors without synthetic usage values', async () => {
    mockGetServerRateLimitStatus.mockReset();
    mockGetServerRateLimitStatus.mockRejectedValue(new Error('database unavailable'));

    const response = await GET(
      new Request('http://localhost/api/usage-status', {
        headers: {
          authorization: 'Bearer token',
        },
      })
    );

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.code).toBe('USAGE_STATUS_FAILED');
    expect(payload.errorCategory).toBe('UNKNOWN_ERROR');
    expect(payload.usage).toBeUndefined();
  });

  it('returns degraded usage payload with backend diagnostic for Firebase Admin initialization failures', async () => {
    mockGetServerRateLimitStatus.mockReset();
    mockGetServerRateLimitStatus.mockRejectedValue(new Error('Firebase Admin SDK not initialized'));

    const response = await GET(
      new Request('http://localhost/api/usage-status', {
        headers: {
          authorization: 'Bearer token',
        },
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.degraded).toBe(true);
    expect(payload.backendAvailable).toBe(false);
    expect(payload.code).toBe('USAGE_BACKEND_UNAVAILABLE');
    expect(['ENV_MISCONFIGURED', 'BACKEND_UNAVAILABLE']).toContain(payload.errorCategory);
    expect(payload.diagnostic).toBe('FIREBASE_ADMIN_NOT_INITIALIZED');
    expect(payload.usage.recommend.limit).toBe(10);
    expect(payload.usage['wardrobe-outfit'].limit).toBe(10);
    expect(payload.usage['wardrobe-upload'].limit).toBe(10);
  });
});
