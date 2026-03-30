import { NextResponse } from 'next/server';
import { getRecommendMetrics } from '@/lib/recommend/async-jobs';
import { getFirestore, FieldValue } from '@/lib/firebase-admin';

const COLLECTION = 'experiment_metrics_daily';
const RETENTION_DAYS = 60;
const ROLLING_WINDOW_DAYS = 7;

interface VariantSnapshot {
  completion_rate: number;
  avg_time_to_result: number;
  fallback_rate: number;
  interaction_rate: number;
}

function utcDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function cutoffDateString(retentionDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - retentionDays);
  return utcDateString(date);
}

function readCronSecret(request: Request): string {
  return (
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''
  );
}

function variantSnapshotOrZero(metrics: any, key: 'A' | 'B'): VariantSnapshot {
  const variant = metrics?.variants?.[key];
  return {
    completion_rate: Number(variant?.completion_rate || 0),
    avg_time_to_result: Number(variant?.time_to_result || 0),
    fallback_rate: Number(variant?.fallback_usage_rate || 0),
    interaction_rate: Number(variant?.interaction_rate || 0),
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pickBestVariant(rollingA: VariantSnapshot, rollingB: VariantSnapshot): 'A' | 'B' | 'tie' {
  const score = (value: VariantSnapshot) =>
    value.completion_rate * 0.45 +
    value.interaction_rate * 0.25 +
    (1 - Math.min(1, value.fallback_rate)) * 0.2 +
    (1 - Math.min(1, value.avg_time_to_result / 20_000)) * 0.1;

  const scoreA = score(rollingA);
  const scoreB = score(rollingB);

  if (Math.abs(scoreA - scoreB) < 0.01) return 'tie';
  return scoreA > scoreB ? 'A' : 'B';
}

async function computeRollingSummary(db: FirebaseFirestore.Firestore) {
  const snapshots = await db
    .collection(COLLECTION)
    .orderBy('date', 'desc')
    .limit(ROLLING_WINDOW_DAYS)
    .get();

  const aRows: VariantSnapshot[] = [];
  const bRows: VariantSnapshot[] = [];

  snapshots.docs.forEach((doc) => {
    const data = doc.data();
    const a = data?.variantA;
    const b = data?.variantB;

    if (a) {
      aRows.push({
        completion_rate: Number(a.completion_rate || 0),
        avg_time_to_result: Number(a.avg_time_to_result || 0),
        fallback_rate: Number(a.fallback_rate || 0),
        interaction_rate: Number(a.interaction_rate || 0),
      });
    }

    if (b) {
      bRows.push({
        completion_rate: Number(b.completion_rate || 0),
        avg_time_to_result: Number(b.avg_time_to_result || 0),
        fallback_rate: Number(b.fallback_rate || 0),
        interaction_rate: Number(b.interaction_rate || 0),
      });
    }
  });

  const rollingA: VariantSnapshot = {
    completion_rate: average(aRows.map((r) => r.completion_rate)),
    avg_time_to_result: average(aRows.map((r) => r.avg_time_to_result)),
    fallback_rate: average(aRows.map((r) => r.fallback_rate)),
    interaction_rate: average(aRows.map((r) => r.interaction_rate)),
  };

  const rollingB: VariantSnapshot = {
    completion_rate: average(bRows.map((r) => r.completion_rate)),
    avg_time_to_result: average(bRows.map((r) => r.avg_time_to_result)),
    fallback_rate: average(bRows.map((r) => r.fallback_rate)),
    interaction_rate: average(bRows.map((r) => r.interaction_rate)),
  };

  return {
    windowDays: ROLLING_WINDOW_DAYS,
    variantA: rollingA,
    variantB: rollingB,
    bestPerformingVariant: pickBestVariant(rollingA, rollingB),
  };
}

async function deleteExpiredSnapshots(db: FirebaseFirestore.Firestore): Promise<number> {
  const cutoff = cutoffDateString(RETENTION_DAYS);
  const snapshot = await db
    .collection(COLLECTION)
    .where('date', '<', cutoff)
    .limit(200)
    .get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.RECOMMEND_METRICS_SNAPSHOT_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Snapshot secret is not configured' },
      { status: 500 }
    );
  }

  const providedSecret = readCronSecret(request);
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const db = getFirestore();
  const date = utcDateString();
  const metrics = await getRecommendMetrics();

  const variantA = variantSnapshotOrZero(metrics, 'A');
  const variantB = variantSnapshotOrZero(metrics, 'B');

  const docRef = db.collection(COLLECTION).doc(date);
  await docRef.set(
    {
      date,
      variantA,
      variantB,
      totals: metrics.totals,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const rolling = await computeRollingSummary(db);
  await docRef.set(
    {
      rolling,
      retentionDays: RETENTION_DAYS,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const deletedCount = await deleteExpiredSnapshots(db);

  return NextResponse.json({
    success: true,
    date,
    collection: COLLECTION,
    retentionDays: RETENTION_DAYS,
    deletedCount,
    rolling,
  });
}
