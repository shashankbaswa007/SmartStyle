import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { validateRequestOrigin } from '@/lib/csrf-protection';
import { verifyFirebaseIdToken } from '@/lib/server-auth';

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
    if (!validateRequestOrigin(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

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

    const verifiedUid = await verifyFirebaseIdToken(idToken, { allowDevFallback: false });
    if (!verifiedUid) {
      logger.warn('Auth session POST rejected: token verification failed');
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    logger.info('Auth session POST: token received', {
      hasToken: !!idToken,
      tokenLength: idToken.length,
      verifiedUid,
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

  const authenticated = token ? !!(await verifyFirebaseIdToken(token, { allowDevFallback: false })) : false;
  logger.info('Auth session GET: status check', {
    hasSessionCookie: !!token,
    authenticated,
  });

  const response = NextResponse.json({ authenticated });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function DELETE(request: Request) {
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  logger.info('Auth session DELETE: session cookie cleared');
  return response;
}
