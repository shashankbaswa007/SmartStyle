import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';
import { validateRequestOrigin } from '@/lib/csrf-protection';
import { verifyFirebaseIdToken } from '@/lib/server-auth';

const SESSION_COOKIE_NAME = 'smartstyle-session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 days

function getSessionTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieParts = cookieHeader.split(';').map((part) => part.trim());
  const sessionPair = cookieParts.find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!sessionPair) return null;

  try {
    const rawToken = sessionPair.slice(`${SESSION_COOKIE_NAME}=`.length);
    const token = rawToken ? decodeURIComponent(rawToken) : '';
    return token || null;
  } catch {
    return null;
  }
}

async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const decoded = await admin.auth().verifySessionCookie(token);
    return decoded.uid;
  } catch {
    // Fall through for environments storing an ID token in the same cookie.
  }

  return verifyFirebaseIdToken(token, { allowDevFallback: true });
}

function applySessionCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function GET(request: Request) {
  const token = getSessionTokenFromCookie(request);
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const uid = await verifySessionToken(token);
  if (!uid) {
    const response = NextResponse.json({ authenticated: false }, { status: 200 });
    clearSessionCookie(response);
    return response;
  }

  return NextResponse.json({ authenticated: true, uid }, { status: 200 });
}

export async function POST(request: Request) {
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const idToken = typeof (body as { idToken?: unknown })?.idToken === 'string'
    ? (body as { idToken: string }).idToken.trim()
    : '';

  if (!idToken) {
    return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
  }

  const uid = await verifyFirebaseIdToken(idToken, { allowDevFallback: true });
  if (!uid) {
    return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
  }

  let cookieToken = idToken;
  try {
    const expiresInMs = SESSION_MAX_AGE_SECONDS * 1000;
    cookieToken = await admin.auth().createSessionCookie(idToken, { expiresIn: expiresInMs });
  } catch {
    // If Admin session-cookie minting is unavailable, keep using ID token cookie fallback.
  }

  const response = NextResponse.json({ ok: true, uid }, { status: 200 });
  applySessionCookie(response, cookieToken);
  return response;
}

export async function DELETE(request: Request) {
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  clearSessionCookie(response);
  return response;
}
