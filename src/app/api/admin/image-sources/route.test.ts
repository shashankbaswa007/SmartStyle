/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockValidateRequestOrigin = jest.fn<(...args: any[]) => boolean>();
const mockVerifyAdminRequest = jest.fn<(...args: any[]) => Promise<{ uid: string; source: 'claim' | 'allowlist' }>>();

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

jest.mock('@/lib/image-generation', () => ({
  isPollinationsAuthenticated: () => false,
  generateOutfitImageWithFallback: jest.fn(),
}));

jest.mock('@/lib/together-image', () => ({
  isTogetherAvailable: () => false,
  generateWithTogether: jest.fn(),
}));

jest.mock('@/lib/replicate-image', () => ({
  isReplicateAvailable: () => false,
  generateWithReplicate: jest.fn(),
}));

jest.mock('@/lib/smart-image-generation', () => ({
  generateImageWithRetry: jest.fn().mockResolvedValue('data:image/svg+xml;base64,PHN2Zy8+'),
}));

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { GET } from './route';

describe('/api/admin/image-sources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateRequestOrigin.mockReturnValue(true);
    mockVerifyAdminRequest.mockResolvedValue({ uid: 'admin-user', source: 'claim' });
  });

  it('blocks cross-origin requests', async () => {
    mockValidateRequestOrigin.mockReturnValue(false);

    const response = await GET(new Request('http://localhost/api/admin/image-sources?probe=0'));

    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated users', async () => {
    mockVerifyAdminRequest.mockRejectedValue(new MockAuthError('Missing authorization token', 401));

    const response = await GET(
      new Request('http://localhost/api/admin/image-sources?probe=0', {
        headers: { Origin: 'http://localhost:3000' },
      })
    );

    expect(response.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    mockVerifyAdminRequest.mockRejectedValue(new MockAuthError('Forbidden - Admin access required', 403));

    const response = await GET(
      new Request('http://localhost/api/admin/image-sources?probe=0', {
        headers: { Origin: 'http://localhost:3000' },
      })
    );

    expect(response.status).toBe(403);
  });

  it('allows admin users to access image-source status', async () => {
    const response = await GET(
      new Request('http://localhost/api/admin/image-sources?probe=0', {
        headers: {
          Origin: 'http://localhost:3000',
          Authorization: 'Bearer admin-token',
        },
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(mockLogger.info).toHaveBeenCalled();
  });
});
