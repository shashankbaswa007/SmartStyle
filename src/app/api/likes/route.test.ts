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

import { POST, GET } from './route';

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

describe('GET /api/likes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateRequestOrigin.mockReturnValue(true);
    mockVerifyFirebaseIdToken.mockResolvedValue('user-1');
  });

  it('retrieves liked outfits for authenticated user', async () => {
    const mockOutfits = [
      {
        id: 'like-1',
        title: 'Outfit 1',
        imageUrl: 'https://example.com/1.jpg',
        likedAt: 1000000,
      },
      {
        id: 'like-2',
        title: 'Outfit 2',
        imageUrl: 'https://example.com/2.jpg',
        likedAt: 2000000,
      },
    ];

    const get = jest.fn().mockResolvedValue({
      forEach: (callback: (doc: any) => void) => {
        mockOutfits.forEach((outfit) => {
          callback({
            id: outfit.id,
            data: () => outfit,
          });
        });
      },
    });
    const orderBy = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({ get }),
    });

    const likedOutfitsCollection = { orderBy };
    const userDoc = {
      collection: jest.fn().mockReturnValue(likedOutfitsCollection),
    };
    const usersCollection = {
      doc: jest.fn().mockReturnValue(userDoc),
    };

    mockGetFirestore.mockReturnValue({
      collection: jest.fn().mockReturnValue(usersCollection),
    });

    const response = await GET(
      new Request('http://localhost/api/likes', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(2);
    expect(payload.count).toBe(2);
  });

  it('returns empty array when user has no liked outfits', async () => {
    const get = jest.fn().mockResolvedValue({
      forEach: jest.fn(),
    });
    const orderBy = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({ get }),
    });

    const likedOutfitsCollection = { orderBy };
    const userDoc = {
      collection: jest.fn().mockReturnValue(likedOutfitsCollection),
    };
    const usersCollection = {
      doc: jest.fn().mockReturnValue(userDoc),
    };

    mockGetFirestore.mockReturnValue({
      collection: jest.fn().mockReturnValue(usersCollection),
    });

    const response = await GET(
      new Request('http://localhost/api/likes', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(0);
    expect(payload.count).toBe(0);
  });

  it('returns 401 for unauthorized requests', async () => {
    mockVerifyFirebaseIdToken.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/likes', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.code).toBe('UNAUTHORIZED');
  });

  it('returns graceful degraded payload when Firestore is unavailable', async () => {
    mockGetFirestore.mockImplementation(() => {
      throw new Error('Firestore unavailable');
    });

    const response = await GET(
      new Request('http://localhost/api/likes', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.backendAvailable).toBe(false);
    expect(payload.data).toEqual([]);
    expect(payload.count).toBe(0);
    expect(payload.code).toBe('LIKES_BACKEND_UNAVAILABLE');
  });
});
