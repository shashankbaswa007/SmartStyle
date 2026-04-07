import admin from '@/lib/firebase-admin';
import type { NextRequest } from 'next/server';
import { createRemoteJWKSet } from 'jose/jwks/remote';
import { jwtVerify } from 'jose/jwt/verify';

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

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

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const withPadding = pad === 0 ? normalized : normalized + '='.repeat(4 - pad);
  return Buffer.from(withPadding, 'base64').toString('utf8');
}

function extractUidFromUnverifiedToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const payloadJson = decodeBase64Url(parts[1]);
    const payload = JSON.parse(payloadJson) as { user_id?: string; sub?: string };
    return payload.user_id || payload.sub || null;
  } catch {
    return null;
  }
}

function canUseDevAuthFallback() {
  return process.env.ALLOW_DEV_AUTH_FALLBACK === '1' && process.env.NODE_ENV !== 'production';
}

async function verifyWithGoogleJwks(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, GOOGLE_JWKS);

    const audience = typeof payload.aud === 'string' ? payload.aud : '';
    const issuer = typeof payload.iss === 'string' ? payload.iss : '';
    const subject = typeof payload.sub === 'string' ? payload.sub : '';

    if (!audience || !issuer || !subject) {
      return null;
    }

    const expectedIssuer = `https://securetoken.google.com/${audience}`;
    if (issuer !== expectedIssuer) {
      return null;
    }

    return subject;
  } catch {
    return null;
  }
}

export async function verifyFirebaseIdToken(
  token: string,
  options?: { allowDevFallback?: boolean }
): Promise<string | null> {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    const jwksUid = await verifyWithGoogleJwks(token);
    if (jwksUid) {
      return jwksUid;
    }

    if (options?.allowDevFallback && canUseDevAuthFallback()) {
      const fallbackUid = extractUidFromUnverifiedToken(token);
      if (fallbackUid) {
        return fallbackUid;
      }
    }

    return null;
  }
}

export async function verifyBearerToken(request: Request | NextRequest): Promise<string> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new AuthError('Unauthorized - Missing bearer token', 401);
  }

  const uid = await verifyFirebaseIdToken(token, { allowDevFallback: true });
  if (!uid) {
    throw new AuthError('Unauthorized - Invalid authentication token', 401);
  }

  return uid;
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
