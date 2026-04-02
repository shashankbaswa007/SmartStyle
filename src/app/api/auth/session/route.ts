import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const sessionSchema = z.object({
  idToken: z.string().min(1),
});

const SESSION_COOKIE_NAME = 'smartstyle-session';
// Firebase ID tokens are short-lived (~1h), so keep cookie TTL aligned.
const SESSION_MAX_AGE_SECONDS = 60 * 60;

function getCookieDomain(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim();
  return raw ? raw : undefined;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const withPadding = pad === 0 ? normalized : normalized + '='.repeat(4 - pad);
  return Buffer.from(withPadding, 'base64').toString('utf8');
}

function hasPlausibleUnexpiredFirebaseClaims(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;

    const payload = JSON.parse(decodeBase64Url(parts[1])) as {
      sub?: string;
      aud?: string;
      iss?: string;
      exp?: number;
    };

    if (!payload.sub || !payload.aud || !payload.iss || !payload.exp) return false;
    if (Date.now() >= payload.exp * 1000) return false;

    return (
      payload.iss === `https://securetoken.google.com/${payload.aud}` ||
      payload.iss === `https://session.firebase.google.com/${payload.aud}`
    );
  } catch {
    return false;
  }
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: getCookieDomain(),
    maxAge: 0,
  });
}

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const parsed = sessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { idToken } = parsed.data;

    if (!hasPlausibleUnexpiredFirebaseClaims(idToken)) {
      logger.warn('Auth session POST rejected: token missing plausible Firebase claims');
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 });
    }

    logger.info('Auth session POST: token received', {
      hasToken: !!idToken,
      tokenLength: idToken.length,
      cookieDomain: getCookieDomain() || 'host-only',
      secureCookie: process.env.NODE_ENV === 'production',
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: idToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: getCookieDomain(),
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    logger.info('Auth session POST: session cookie created');
    return response;
  } catch {
    logger.error('Auth session POST failed unexpectedly');
    return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieParts = cookieHeader.split(';').map((part) => part.trim());
  const sessionPair = cookieParts.find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  const rawToken = sessionPair ? sessionPair.slice(`${SESSION_COOKIE_NAME}=`.length) : '';
  const token = rawToken ? decodeURIComponent(rawToken) : '';

  const authenticated = token ? hasPlausibleUnexpiredFirebaseClaims(token) : false;
  logger.info('Auth session GET: status check', {
    hasSessionCookie: !!token,
    authenticated,
  });

  const response = NextResponse.json({ authenticated });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  logger.info('Auth session DELETE: session cookie cleared');
  return response;
}
