import { NextResponse } from 'next/server';
import { z } from 'zod';
import admin from '@/lib/firebase-admin';

const sessionSchema = z.object({
  idToken: z.string().min(1),
});

const SESSION_COOKIE_NAME = 'smartstyle-session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 days
const SESSION_EXPIRES_MS = SESSION_MAX_AGE_SECONDS * 1000;

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = sessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { idToken } = parsed.data;

    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.uid) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    const sessionCookie = await admin.auth().createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to establish session' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
