/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockVerifyFirebaseIdToken = jest.fn<(...args: any[]) => Promise<string | null>>();
const mockValidateRequestOrigin = jest.fn<(...args: any[]) => boolean>();
const mockGetFirestore = jest.fn<(...args: any[]) => any>();
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

jest.mock('@/lib/server-auth', () => ({
  verifyFirebaseIdToken: (...args: any[]) => mockVerifyFirebaseIdToken(...args),
  AuthError: MockAuthError,
}));

jest.mock('@/lib/csrf-protection', () => ({
  validateRequestOrigin: (...args: any[]) => mockValidateRequestOrigin(...args),
}));

jest.mock('@/lib/firebase-admin', () => ({
  getFirestore: (...args: any[]) => mockGetFirestore(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { POST } from './route';

function createMockFirestore({
  duplicateDocs,
}: {
  duplicateDocs: Array<{ imageUrl?: string }>;
}) {
  const get = jest.fn().mockResolvedValue({
    docs: duplicateDocs.map((docData) => ({
      data: () => docData,
    })),
  });
  const limit = jest.fn().mockReturnValue({ get });
  const where = jest.fn().mockReturnValue({ limit });
  const add = jest.fn().mockResolvedValue({ id: 'like-doc-1' });

  const likedOutfitsCollection = {
    where,
    add,
  };
  const userDoc = {
    collection: jest.fn().mockReturnValue(likedOutfitsCollection),
  };
  const usersCollection = {
    doc: jest.fn().mockReturnValue(userDoc),
  };

  return {
    firestore: {
      collection: jest.fn().mockReturnValue(usersCollection),
    },
    spies: {
      where,
      limit,
      get,
      add,
    },
  };
}

describe('POST /api/likes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateRequestOrigin.mockReturnValue(true);
    mockVerifyFirebaseIdToken.mockResolvedValue('user-1');

    const { firestore } = createMockFirestore({ duplicateDocs: [] });
    mockGetFirestore.mockReturnValue(firestore);
  });

  it('saves a like when bearer token is valid', async () => {
    const { firestore, spies } = createMockFirestore({ duplicateDocs: [] });
    mockGetFirestore.mockReturnValue(firestore);

    const response = await POST(
      new Request('http://localhost/api/likes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          recommendationId: 'rec_123',
          outfit: {
            imageUrl: 'https://example.com/outfit.jpg',
            title: 'Weekend Casual',
            description: 'Relaxed look',
            items: ['White Tee', 'Blue Jeans'],
            colorPalette: ['#ffffff', '#1d4ed8'],
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.likeId).toBe('like-doc-1');
    expect(spies.add).toHaveBeenCalledTimes(1);
  });

  it('falls back to session cookie when bearer token is missing', async () => {
    const { firestore, spies } = createMockFirestore({ duplicateDocs: [] });
    mockGetFirestore.mockReturnValue(firestore);

    const response = await POST(
      new Request('http://localhost/api/likes', {
        method: 'POST',
        headers: {
          cookie: 'smartstyle-session=session-cookie-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          recommendationId: 'rec_123',
          outfit: {
            imageUrl: 'https://example.com/outfit.jpg',
            title: 'Session Auth Outfit',
            description: 'Session fallback',
            items: ['Top'],
            colorPalette: ['#000000'],
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockVerifyFirebaseIdToken).toHaveBeenCalledWith('session-cookie-token', { allowDevFallback: true });
    expect(spies.add).toHaveBeenCalledTimes(1);
  });

  it('returns duplicate response without saving a new document', async () => {
    const { firestore, spies } = createMockFirestore({
      duplicateDocs: [{ imageUrl: 'https://example.com/outfit-duplicate.jpg?size=small' }],
    });
    mockGetFirestore.mockReturnValue(firestore);

    const response = await POST(
      new Request('http://localhost/api/likes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          recommendationId: 'rec_123',
          outfit: {
            imageUrl: 'https://example.com/outfit-duplicate.jpg?size=small',
            title: 'Weekend Casual',
            description: 'Relaxed look',
            items: ['White Tee', 'Blue Jeans'],
            colorPalette: ['#ffffff', '#1d4ed8'],
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.isDuplicate).toBe(true);
    expect(spies.add).not.toHaveBeenCalled();
  });

  it('returns unauthorized when both bearer and session are invalid', async () => {
    mockVerifyFirebaseIdToken.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/likes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer invalid-token',
          cookie: 'smartstyle-session=invalid-cookie-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          recommendationId: 'rec_123',
          outfit: {
            imageUrl: 'https://example.com/outfit.jpg',
            title: 'Secure Look',
            description: 'No auth',
            items: ['Top'],
            colorPalette: ['#000000'],
          },
        }),
      })
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 on invalid origin', async () => {
    mockValidateRequestOrigin.mockReturnValue(false);

    const response = await POST(
      new Request('http://localhost/api/likes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          recommendationId: 'rec_123',
          outfit: {
            imageUrl: 'https://example.com/outfit.jpg',
            title: 'Blocked Origin',
            description: 'Should fail',
            items: ['Top'],
            colorPalette: ['#000000'],
          },
        }),
      })
    );

    expect(response.status).toBe(403);
  });
});
