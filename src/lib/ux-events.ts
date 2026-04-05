import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type UxEventName =
  | 'task_started'
  | 'task_completed'
  | 'step_viewed'
  | 'retry_clicked'
  | 'error_shown'
  | 'recovered_from_error'
  | 'drop_off';

export interface UxEventPayload {
  flow: string;
  step?: string;
  reason?: string;
  success?: boolean;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface UxEventMetrics {
  taskStarted: number;
  taskCompleted: number;
  retryClicked: number;
  errorShown: number;
  recoveredFromError: number;
  dropOff: number;
  completionRate: number;
  recoveryRate: number;
  retrySuccessRate: number;
}

const EMPTY_METRICS: UxEventMetrics = {
  taskStarted: 0,
  taskCompleted: 0,
  retryClicked: 0,
  errorShown: 0,
  recoveredFromError: 0,
  dropOff: 0,
  completionRate: 0,
  recoveryRate: 0,
  retrySuccessRate: 0,
};

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return ((value as { toMillis: () => number }).toMillis());
  }
  if (typeof value === 'number') return value;
  return null;
}

export async function logUxEvent(
  userId: string | null | undefined,
  name: UxEventName,
  payload: UxEventPayload
): Promise<void> {
  if (!userId) return;

  try {
    await addDoc(collection(db, 'users', userId, 'uxEvents'), {
      name,
      ...payload,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Best-effort telemetry only; no user-flow interruption.
  }
}

export async function getUxEventMetrics(userId: string, lookbackDays: number = 30): Promise<UxEventMetrics> {
  if (!userId) return EMPTY_METRICS;

  try {
    const q = query(
      collection(db, 'users', userId, 'uxEvents'),
      orderBy('createdAt', 'desc'),
      limit(800)
    );

    const snapshot = await getDocs(q);
    const since = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

    let taskStarted = 0;
    let taskCompleted = 0;
    let retryClicked = 0;
    let errorShown = 0;
    let recoveredFromError = 0;
    let dropOff = 0;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as { name?: UxEventName; createdAt?: unknown };
      const createdAtMs = toMillis(data.createdAt);
      if (createdAtMs && createdAtMs < since) return;

      switch (data.name) {
        case 'task_started':
          taskStarted += 1;
          break;
        case 'task_completed':
          taskCompleted += 1;
          break;
        case 'retry_clicked':
          retryClicked += 1;
          break;
        case 'error_shown':
          errorShown += 1;
          break;
        case 'recovered_from_error':
          recoveredFromError += 1;
          break;
        case 'drop_off':
          dropOff += 1;
          break;
        default:
          break;
      }
    });

    const completionRate = taskStarted > 0 ? (taskCompleted / taskStarted) * 100 : 0;
    const recoveryRate = errorShown > 0 ? (recoveredFromError / errorShown) * 100 : 0;
    const retrySuccessRate = retryClicked > 0 ? (recoveredFromError / retryClicked) * 100 : 0;

    return {
      taskStarted,
      taskCompleted,
      retryClicked,
      errorShown,
      recoveredFromError,
      dropOff,
      completionRate: Math.round(completionRate),
      recoveryRate: Math.round(recoveryRate),
      retrySuccessRate: Math.round(retrySuccessRate),
    };
  } catch {
    return EMPTY_METRICS;
  }
}
