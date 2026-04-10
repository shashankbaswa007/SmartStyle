/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockVerifyBearerToken = jest.fn<(...args: any[]) => Promise<string>>();
const mockVerifyFirebaseIdToken = jest.fn<(...args: any[]) => Promise<string | null>>();
const mockVerifySessionCookie = jest.fn<(...args: any[]) => Promise<{ uid: string }>>();
const mockReserveServerRateLimit = jest.fn<(...args: any[]) => Promise<any>>();

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
  reserveServerRateLimit: (...args: any[]) => mockReserveServerRateLimit(...args),
}));

import { enforceRecommendAuth } from './request-guard';

describe('enforceRecommendAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts matching bearer token user', async () => {
    mockVerifyBearerToken.mockResolvedValue('user-1');

    await expect(
      enforceRecommendAuth(
        new Request('http://localhost/api/recommend', {
          headers: {
            authorization: 'Bearer token',
          },
        }),
        'user-1'
      )
    ).resolves.toBe('user-1');
  });

  it('falls back to session cookie user when bearer token is invalid', async () => {
    mockVerifyBearerToken.mockRejectedValue(new MockAuthError('Unauthorized', 401));
    mockVerifySessionCookie.mockResolvedValue({ uid: 'user-from-session' });

    await expect(
      enforceRecommendAuth(
        new Request('http://localhost/api/recommend', {
          headers: {
            cookie: 'smartstyle-session=session-token',
          },
        }),
        'user-from-session'
      )
    ).resolves.toBe('user-from-session');
  });

  it('falls back to verifyFirebaseIdToken when verifySessionCookie fails', async () => {
    mockVerifyBearerToken.mockRejectedValue(new MockAuthError('Unauthorized', 401));
    mockVerifySessionCookie.mockRejectedValue(new Error('admin unavailable'));
    mockVerifyFirebaseIdToken.mockResolvedValue('user-from-id-token');

    await expect(
      enforceRecommendAuth(
        new Request('http://localhost/api/recommend', {
          headers: {
            cookie: 'smartstyle-session=session-token',
          },
        }),
        'user-from-id-token'
      )
    ).resolves.toBe('user-from-id-token');

    expect(mockVerifyFirebaseIdToken).toHaveBeenCalledWith('session-token', { allowDevFallback: false });
  });

  it('rejects mismatched user id even when authenticated', async () => {
    mockVerifyBearerToken.mockResolvedValue('user-a');

    await expect(
      enforceRecommendAuth(
        new Request('http://localhost/api/recommend', {
          headers: {
            authorization: 'Bearer token',
          },
        }),
        'user-b'
      )
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns the original auth error when bearer and session fallback both fail', async () => {
    mockVerifyBearerToken.mockRejectedValue(new MockAuthError('Unauthorized - Invalid authentication token', 401));
    mockVerifySessionCookie.mockRejectedValue(new Error('invalid session cookie'));
    mockVerifyFirebaseIdToken.mockResolvedValue(null);

    await expect(
      enforceRecommendAuth(
        new Request('http://localhost/api/recommend', {
          headers: {
            authorization: 'Bearer bad-token',
            cookie: 'smartstyle-session=bad-session',
          },
        }),
        'user-1'
      )
    ).rejects.toMatchObject({ status: 401 });
  });
});
