import admin from '@/lib/firebase-admin';
import type { NextRequest } from 'next/server';

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

function extractBearerToken(request: Request | NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export async function verifyBearerToken(request: Request | NextRequest): Promise<string> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new AuthError('Unauthorized - Missing bearer token', 401);
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new AuthError('Unauthorized - Invalid authentication token', 401);
  }
}

export async function verifyBearerTokenMatchesUser(
  request: Request | NextRequest,
  expectedUserId: string
): Promise<void> {
  const uid = await verifyBearerToken(request);
  if (uid !== expectedUserId) {
    throw new AuthError('Forbidden - User ID mismatch', 403);
  }
}
