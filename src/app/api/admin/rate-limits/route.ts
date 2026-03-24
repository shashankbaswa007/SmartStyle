import { NextResponse } from 'next/server';
import { verifyBearerToken, AuthError } from '@/lib/server-auth';
import admin from '@/lib/firebase-admin';

/**
 * Admin endpoint to inspect and reset rate limit records
 * Used for debugging issues where quotas show incorrectly
 */

async function verifyAdminToken(request: Request): Promise<string> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    throw new AuthError('Missing authorization token', 401);
  }

  const auth = admin.auth();
  try {
    const decodedToken = await auth.verifyIdToken(token);
    // In production, you'd check for admin claims here
    // For now, we just verify it's a valid token
    return decodedToken.uid;
  } catch (error) {
    throw new AuthError('Invalid or expired token', 401);
  }
}

export async function GET(request: Request) {
  try {
    const userId = await verifyAdminToken(request);
    const scopes = ['recommend', 'wardrobe-outfit', 'wardrobe-upload'];
    
    const db = admin.firestore();
    const results: Record<string, any> = {};
    
    // Get all rate limit records for this user
    for (const scope of scopes) {
      const docId = `${scope}:${userId}`;
      const snap = await db.collection('rateLimits').doc(docId).get();
      
      if (snap.exists) {
        const data = snap.data();
        results[scope] = {
          exists: true,
          count: data?.count || 0,
          windowStart: data?.windowStart?.toDate?.().toISOString() || 'invalid',
        };
      } else {
        results[scope] = {
          exists: false,
          count: 0,
          windowStart: null,
        };
      }
    }
    
    return NextResponse.json({
      userId,
      rateLimits: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to fetch rate limits' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await verifyAdminToken(request);
    const scopes = ['recommend', 'wardrobe-outfit', 'wardrobe-upload'];
    
    const db = admin.firestore();
    
    // Delete all rate limit records for this user
    for (const scope of scopes) {
      const docId = `${scope}:${userId}`;
      await db.collection('rateLimits').doc(docId).delete();
    }
    
    return NextResponse.json({
      success: true,
      message: `Reset rate limits for user ${userId}`,
      scopes: scopes,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to reset rate limits' }, { status: 500 });
  }
}
