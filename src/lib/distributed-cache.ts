import { featureFlags } from '@/lib/feature-flags';
import { getRedisClient } from '@/lib/redis';
import { createHash } from 'crypto';
import { getFirestore } from '@/lib/firebase-admin';

const CACHE_NAMESPACE = 'smartstyle:v1:cache';
const FIRESTORE_CACHE_COLLECTION = 'distributedCache';

type FirestoreCacheDoc = {
  key: string;
  value: string;
  expiresAtMs: number;
  updatedAtMs: number;
};

function getCacheKey(key: string): string {
  return `${CACHE_NAMESPACE}:${key}`;
}

function getFirestoreDocId(namespacedKey: string): string {
  return createHash('sha256').update(namespacedKey).digest('hex');
}

async function getFirestoreJson<T>(namespacedKey: string): Promise<T | null> {
  try {
    const db = getFirestore();
    const docRef = db.collection(FIRESTORE_CACHE_COLLECTION).doc(getFirestoreDocId(namespacedKey));
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as Partial<FirestoreCacheDoc> | undefined;
    if (!data || data.key !== namespacedKey || typeof data.value !== 'string') {
      return null;
    }

    const expiresAtMs = typeof data.expiresAtMs === 'number' ? data.expiresAtMs : 0;
    if (expiresAtMs > 0 && Date.now() >= expiresAtMs) {
      void docRef.delete().catch(() => {
        // Best-effort cleanup of expired documents.
      });
      return null;
    }

    return JSON.parse(data.value) as T;
  } catch {
    return null;
  }
}

async function setFirestoreJson<T>(namespacedKey: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    const now = Date.now();
    const db = getFirestore();

    await db
      .collection(FIRESTORE_CACHE_COLLECTION)
      .doc(getFirestoreDocId(namespacedKey))
      .set(
        {
          key: namespacedKey,
          value: serialized,
          expiresAtMs: now + Math.max(1, ttlSeconds) * 1000,
          updatedAtMs: now,
        } as FirestoreCacheDoc,
        { merge: true }
      );
  } catch {
    // Non-critical cache fallback failure.
  }
}

export async function getDistributedJson<T>(key: string): Promise<T | null> {
  if (!featureFlags.redisCache) return null;

  const namespacedKey = getCacheKey(key);

  const redis = getRedisClient();
  if (redis) {
    try {
      const value = await redis.get<string>(namespacedKey);
      if (value) {
        return JSON.parse(value) as T;
      }
    } catch {
      // Fall through to Firestore fallback.
    }
  }

  return getFirestoreJson<T>(namespacedKey);
}

export async function setDistributedJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!featureFlags.redisCache) return;

  const namespacedKey = getCacheKey(key);

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(namespacedKey, JSON.stringify(value), { ex: Math.max(1, ttlSeconds) });
      return;
    } catch {
      // Fall through to Firestore fallback.
    }
  }

  await setFirestoreJson(namespacedKey, value, ttlSeconds);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForDistributedJson<T>(
  key: string,
  options?: { maxWaitMs?: number; pollIntervalMs?: number }
): Promise<T | null> {
  const maxWaitMs = options?.maxWaitMs ?? 2000;
  const pollIntervalMs = options?.pollIntervalMs ?? 250;
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    const cached = await getDistributedJson<T>(key);
    if (cached) return cached;
    await sleep(pollIntervalMs);
  }

  return null;
}
