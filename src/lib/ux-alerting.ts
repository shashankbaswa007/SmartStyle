export interface UxHealthAlertPayload {
  userId: string;
  status: 'warning' | 'critical';
  issues: string[];
  completionRate: number;
  recoveryRate: number;
  retrySuccessRate: number;
  dropOffRate: number;
  source: string;
}

export async function sendUxHealthAlert(payload: UxHealthAlertPayload): Promise<void> {
  try {
    await fetch('/api/ux-alert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best-effort alerting only.
  }
}
