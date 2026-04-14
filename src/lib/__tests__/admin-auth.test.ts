/** @jest-environment node */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockVerifyIdToken = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock('@/lib/firebase-admin', () => ({
  __esModule: true,
  default: {
    auth: () => ({
      verifyIdToken: (...args: any[]) => mockVerifyIdToken(...args),
    }),
  },
}));

class MockAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

jest.mock('@/lib/server-auth', () => ({
  AuthError: MockAuthError,
}));

import { verifyAdminRequest } from '@/lib/admin-auth';

const ORIGINAL_ENV = { ...process.env };

function buildRequest(token?: string): Request {
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return new Request('http://localhost/api/admin/test', {
    method: 'GET',
    headers,
  });
}

describe('admin-auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ADMIN_USER_IDS;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects request without bearer token', async () => {
    await expect(verifyAdminRequest(buildRequest())).rejects.toMatchObject({ status: 401 });
  });

  it('rejects invalid token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(verifyAdminRequest(buildRequest('bad-token'))).rejects.toMatchObject({ status: 401 });
  });

  it('accepts admin=true custom claim', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-1', admin: true });

    await expect(verifyAdminRequest(buildRequest('good-token'))).resolves.toMatchObject({
      uid: 'user-1',
      source: 'claim',
    });
  });

  it('accepts allowlisted uid without admin claim', async () => {
    process.env.ADMIN_USER_IDS = 'uid-allowlisted,uid-another';
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-allowlisted' });

    await expect(verifyAdminRequest(buildRequest('good-token'))).resolves.toMatchObject({
      uid: 'uid-allowlisted',
      source: 'allowlist',
    });
  });

  it('rejects non-admin, non-allowlisted uid', async () => {
    process.env.ADMIN_USER_IDS = 'uid-allowlisted';
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid-basic-user' });

    await expect(verifyAdminRequest(buildRequest('good-token'))).rejects.toMatchObject({ status: 403 });
  });
});
