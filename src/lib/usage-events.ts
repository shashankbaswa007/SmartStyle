export const USAGE_CONSUMED_EVENT = 'usage:consumed';
export const USAGE_CONSUMED_STORAGE_KEY = 'smartstyle:usage:consumed';

export interface UsageConsumedDetail {
  scope?: string;
  eventId?: string;
}

function parseUsageConsumedDetail(value: unknown): UsageConsumedDetail | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { scope?: unknown; eventId?: unknown };

  const scope = typeof candidate.scope === 'string' ? candidate.scope : undefined;
  const eventId = typeof candidate.eventId === 'string' ? candidate.eventId : undefined;

  if (!scope && !eventId) {
    return null;
  }

  return {
    ...(scope ? { scope } : {}),
    ...(eventId ? { eventId } : {}),
  };
}

export function parseUsageConsumedStorageValue(raw: string): UsageConsumedDetail | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parseUsageConsumedDetail(parsed);
  } catch {
    return null;
  }
}

export function emitUsageConsumed(detail: UsageConsumedDetail): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(USAGE_CONSUMED_EVENT, { detail }));

  try {
    window.localStorage.setItem(
      USAGE_CONSUMED_STORAGE_KEY,
      JSON.stringify({
        ...detail,
        ts: Date.now(),
        nonce: Math.random().toString(36).slice(2, 10),
      })
    );
  } catch {
    // Cross-tab sync is best effort.
  }
}
