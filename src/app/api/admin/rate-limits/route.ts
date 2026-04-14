import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/server-auth';
import admin from '@/lib/firebase-admin';
import { validateRequestOrigin } from '@/lib/csrf-protection';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { logger } from '@/lib/logger';

/**
 * Admin endpoint to inspect and reset rate limit records
 * Used for debugging issues where quotas show incorrectly
 */

export async function GET(request: Request) {
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  try {
    const { uid: userId, source } = await verifyAdminRequest(request);
    logger.info('Admin endpoint access', {
      endpoint: '/api/admin/rate-limits',
      method: 'GET',
      userId,
      authSource: source,
    });
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
  if (!validateRequestOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  try {
    const { uid: userId, source } = await verifyAdminRequest(request);
    logger.info('Admin endpoint access', {
      endpoint: '/api/admin/rate-limits',
      method: 'DELETE',
      userId,
      authSource: source,
    });
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
