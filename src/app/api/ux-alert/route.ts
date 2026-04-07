import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequestOrigin } from '@/lib/csrf-protection';

const uxAlertSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(['warning', 'critical']),
  issues: z.array(z.string()).min(1),
  completionRate: z.number(),
  recoveryRate: z.number(),
  retrySuccessRate: z.number(),
  dropOffRate: z.number(),
  source: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    if (!validateRequestOrigin(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = uxAlertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid alert payload' }, { status: 400 });
    }

    const webhook = process.env.UX_ALERT_WEBHOOK_URL;
    if (!webhook) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'ux_health_alert',
          environment: process.env.NODE_ENV || 'unknown',
          timestamp: new Date().toISOString(),
          ...parsed.data,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to send UX alert' }, { status: 500 });
  }
}
