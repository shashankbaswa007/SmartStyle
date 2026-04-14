/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockValidateRequestOrigin = jest.fn<(...args: any[]) => boolean>();
const mockVerifyAdminRequest = jest.fn<(...args: any[]) => Promise<{ uid: string; source: 'claim' | 'allowlist' }>>();

const mockFirestoreGet = jest.fn<(...args: any[]) => Promise<any>>();
const mockFirestoreDelete = jest.fn<(...args: any[]) => Promise<void>>();

const mockLogger = {
  info: jest.fn<(...args: any[]) => void>(),
  warn: jest.fn<(...args: any[]) => void>(),
  error: jest.fn<(...args: any[]) => void>(),
};

class MockAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

jest.mock('@/lib/csrf-protection', () => ({
  validateRequestOrigin: (...args: any[]) => mockValidateRequestOrigin(...args),
}));

jest.mock('@/lib/admin-auth', () => ({
  verifyAdminRequest: (...args: any[]) => mockVerifyAdminRequest(...args),
}));

jest.mock('@/lib/server-auth', () => ({
  AuthError: MockAuthError,
}));

jest.mock('@/lib/firebase-admin', () => ({
  __esModule: true,
  default: {
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          get: (...args: any[]) => mockFirestoreGet(...args),
          delete: (...args: any[]) => mockFirestoreDelete(...args),
        }),
      }),
    }),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { GET, DELETE } from './route';

describe('/api/admin/rate-limits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateRequestOrigin.mockReturnValue(true);
    mockVerifyAdminRequest.mockResolvedValue({ uid: 'admin-user', source: 'claim' });
    mockFirestoreGet.mockResolvedValue({
      exists: true,
      data: () => ({
        count: 1,
        windowStart: {
          toDate: () => new Date('2026-04-14T00:00:00.000Z'),
        },
      }),
    });
    mockFirestoreDelete.mockResolvedValue();
  });

  it('blocks cross-origin requests', async () => {
    mockValidateRequestOrigin.mockReturnValue(false);

    const response = await GET(new Request('http://localhost/api/admin/rate-limits'));

    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated users', async () => {
    mockVerifyAdminRequest.mockRejectedValue(new MockAuthError('Missing authorization token', 401));

    const response = await GET(
      new Request('http://localhost/api/admin/rate-limits', {
        headers: { Origin: 'http://localhost:3000' },
      })
    );

    expect(response.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    mockVerifyAdminRequest.mockRejectedValue(new MockAuthError('Forbidden - Admin access required', 403));

    const response = await GET(
      new Request('http://localhost/api/admin/rate-limits', {
        headers: { Origin: 'http://localhost:3000' },
      })
    );

    expect(response.status).toBe(403);
  });

  it('allows admin user to inspect and reset rate limits', async () => {
    const getResponse = await GET(
      new Request('http://localhost/api/admin/rate-limits', {
        headers: {
          Origin: 'http://localhost:3000',
          Authorization: 'Bearer admin-token',
        },
      })
    );

    expect(getResponse.status).toBe(200);

    const deleteResponse = await DELETE(
      new Request('http://localhost/api/admin/rate-limits', {
        method: 'DELETE',
        headers: {
          Origin: 'http://localhost:3000',
          Authorization: 'Bearer admin-token',
        },
      })
    );

    expect(deleteResponse.status).toBe(200);
    expect(mockLogger.info).toHaveBeenCalled();
  });
});
