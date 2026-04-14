import admin from '@/lib/firebase-admin';
import { AuthError } from '@/lib/server-auth';

type AdminTokenClaims = {
  admin?: boolean;
};

function extractBearerToken(request: Request): string | null {
  const raw = request.headers.get('Authorization')?.trim() || '';
  if (!raw.startsWith('Bearer ')) {
    return null;
  }

  const token = raw.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function parseAdminUserAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export async function verifyAdminRequest(request: Request): Promise<{ uid: string; source: 'claim' | 'allowlist' }> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new AuthError('Missing authorization token', 401);
  }

  let decoded: { uid: string } & AdminTokenClaims;
  try {
    decoded = await admin.auth().verifyIdToken(token) as { uid: string } & AdminTokenClaims;
  } catch {
    throw new AuthError('Invalid or expired token', 401);
  }

  if (decoded.admin === true) {
    return { uid: decoded.uid, source: 'claim' };
  }

  const adminAllowlist = parseAdminUserAllowlist(process.env.ADMIN_USER_IDS);
  if (adminAllowlist.has(decoded.uid)) {
    return { uid: decoded.uid, source: 'allowlist' };
  }

  throw new AuthError('Forbidden - Admin access required', 403);
}
