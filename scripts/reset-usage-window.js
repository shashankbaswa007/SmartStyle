#!/usr/bin/env node

/*
 * One-time operational script to normalize daily usage counters for a user.
 *
 * Default mode is dry-run. Use --apply to persist changes.
 *
 * Example:
 *   node scripts/reset-usage-window.js --uid=<firebase-uid> --timezone-offset=-330 --apply
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

const ENV_FILES = ['.env.local', '.env'];
for (const envFile of ENV_FILES) {
  const fullPath = path.join(process.cwd(), envFile);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath });
  }
}

const DEFAULT_SCOPES = ['recommend', 'wardrobe-outfit', 'wardrobe-upload'];
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_TZ_OFFSET_MINUTES = 14 * 60;

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, value] = arg.slice(2).split('=');
    parsed[key] = value === undefined ? 'true' : value;
  }
  return parsed;
}

function normalizeTimezoneOffsetMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const rounded = Math.round(parsed);
  if (rounded < -MAX_TZ_OFFSET_MINUTES || rounded > MAX_TZ_OFFSET_MINUTES) {
    return 0;
  }
  return rounded;
}

function getCurrentWindowStartMs(windowMs, timezoneOffsetMinutes) {
  const now = Date.now();
  const offsetMs = timezoneOffsetMinutes * 60 * 1000;
  const shiftedNow = now - offsetMs;
  return shiftedNow - (shiftedNow % windowMs) + offsetMs;
}

function ensureAdminInitialized() {
  if (admin.apps.length) return;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required for this script.');
  }

  const credentials = JSON.parse(serviceAccount);
  admin.initializeApp({
    credential: admin.credential.cert(credentials),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || credentials.project_id,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const uid = args.uid;
  const apply = args.apply === 'true';
  const timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(args['timezone-offset']);
  const scopes = (args.scopes ? String(args.scopes).split(',') : DEFAULT_SCOPES)
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (!uid) {
    throw new Error('Missing required argument: --uid=<firebase-uid>');
  }

  ensureAdminInitialized();

  const db = admin.firestore();
  const windowStartMs = getCurrentWindowStartMs(DAILY_WINDOW_MS, timezoneOffsetMinutes);
  const windowStartTs = admin.firestore.Timestamp.fromMillis(windowStartMs);

  console.log('--- Usage Window Reset ---');
  console.log('Mode:', apply ? 'APPLY' : 'DRY-RUN');
  console.log('UID:', uid);
  console.log('Scopes:', scopes.join(', '));
  console.log('Timezone offset minutes:', timezoneOffsetMinutes);
  console.log('Window start (ms):', windowStartMs);

  for (const scope of scopes) {
    const docId = `${scope}:${uid}`;
    const ref = db.collection('rateLimits').doc(docId);
    const snap = await ref.get();

    if (!snap.exists) {
      console.log(`[${scope}] doc missing, skip (${docId})`);
      continue;
    }

    const data = snap.data() || {};
    const storedWindowStart = data.windowStart && typeof data.windowStart.toMillis === 'function'
      ? data.windowStart.toMillis()
      : null;

    const normalized = {
      count: 0,
      windowStart: windowStartTs,
      reservations: {},
      confirmations: {},
    };

    console.log(`[${scope}] found doc ${docId}`);
    console.log(`  storedWindowStart: ${storedWindowStart}`);
    console.log(`  oldCount: ${typeof data.count === 'number' ? data.count : 0}`);
    console.log(`  oldReservations: ${data.reservations ? Object.keys(data.reservations).length : 0}`);
    console.log(`  oldConfirmations: ${data.confirmations ? Object.keys(data.confirmations).length : 0}`);

    if (apply) {
      await ref.set(normalized, { merge: true });
      console.log(`  -> reset applied`);
    } else {
      console.log('  -> dry-run only (no write)');
    }
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error('Failed to reset usage window:', error instanceof Error ? error.message : error);
  process.exit(1);
});
