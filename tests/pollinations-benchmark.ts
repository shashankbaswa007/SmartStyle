#!/usr/bin/env npx tsx
/**
 * Pollinations.ai Image Generation — Benchmark & Validation Test
 *
 * Diagnostic script to measure real-world performance of Pollinations.ai
 * and determine optimal timeout / pipeline structure for production.
 *
 * What it tests:
 *   • Response time (avg, min, max, p95)
 *   • Image validity (binary image vs rate-limit poster vs error page)
 *   • Dimension correctness (portrait 768×1024 expected)
 *   • Content-Type verification
 *   • Cross-prompt image uniqueness (detects repeated identical images)
 *   • Model comparison (flux, gptimage, zimage, klein)
 *
 * Available FREE image models (from GET /image/models):
 *   flux         — Flux Schnell (fast high-quality)
 *   gptimage     — GPT Image 1 Mini (OpenAI)
 *   zimage       — Z-Image Turbo (6B Flux + 2x upscaling)
 *   klein        — FLUX.2 Klein 4B (fast)
 *   klein-large  — FLUX.2 Klein 9B (higher quality)
 *   imagen-4     — Imagen 4 alpha (Google)
 *
 * NOTE: "turbo" does NOT exist — returns HTTP 400. Use "zimage" for turbo.
 *
 * Run:
 *   npx tsx tests/pollinations-benchmark.ts
 *
 * Environment:
 *   Reads POLLINATIONS_API_KEY from .env (via dotenv).
 *   Runs entirely server-side — no UI, no fallback providers.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createHash } from 'crypto';

// ─── Load env ───────────────────────────────────────────────────────────────
config({ path: resolve(__dirname, '..', '.env') });
config({ path: resolve(__dirname, '..', '.env.local') });

const API_KEY = process.env.POLLINATIONS_API_KEY;
const BASE_URL = 'https://gen.pollinations.ai/image';

// ─── Config ─────────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT = 25_000; // 25s — generous for benchmarking
const WIDTH = 768;
const HEIGHT = 1024;
const MODELS_TO_TEST = ['flux', 'gptimage', 'zimage', 'klein'];

// ─── Test Prompts ───────────────────────────────────────────────────────────
const TEST_PROMPTS = [
  // Prompt 1: Simple male casual
  'a young man wearing a light blue linen shirt with rolled-up sleeves, beige chino shorts, tan leather sandals, walking along a sunlit beach boardwalk, warm natural lighting, full body shot, portrait orientation, clean background',

  // Prompt 2: Female ethnic wear
  'a woman wearing a deep maroon silk saree with golden border, paired with gold jhumka earrings and bangles, standing in a courtyard with soft evening light, full body fashion photography, portrait orientation',

  // Prompt 3: Male streetwear
  'a man wearing an oversized black graphic hoodie, distressed light wash jeans, white chunky sneakers, silver chain necklace, urban street background with graffiti walls, full body shot, portrait orientation, editorial style',
];

// ─── Types ──────────────────────────────────────────────────────────────────
interface BenchmarkResult {
  promptIndex: number;
  promptSnippet: string;
  model: string;
  timeoutMs: number;
  // Timing
  startedAt: string;
  totalTimeMs: number;
  timeToHeadersMs: number | null;
  // Response
  httpStatus: number | null;
  contentType: string | null;
  bodySizeBytes: number | null;
  // Image analysis
  imageWidth: number | null;
  imageHeight: number | null;
  aspectRatio: number | null;
  sha256: string | null;
  // Validation
  verdict: '✅ Valid' | '⚠️ Suspicious' | '❌ Failed';
  notes: string[];
}

// ─── Image dimension parser (from production code) ──────────────────────────
function getImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    if (bytes.length >= 24) {
      const width  = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      return { width, height };
    }
  }
  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let offset = 2;
    while (offset < bytes.length - 9) {
      if (bytes[offset] !== 0xFF) { offset++; continue; }
      const marker = bytes[offset + 1];
      if (marker >= 0xC0 && marker <= 0xC3) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width  = (bytes[offset + 7] << 8) | bytes[offset + 8];
        return { width, height };
      }
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + segmentLength;
    }
  }
  return null;
}

// ─── Detect image format from magic bytes ───────────────────────────────────
function detectFormat(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'PNG';
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'JPEG';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'GIF';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'WEBP';
  // Check if it's text (HTML/JSON error page)
  const textSample = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 100));
  if (textSample.startsWith('<!') || textSample.startsWith('<html')) return 'HTML';
  if (textSample.startsWith('{') || textSample.startsWith('[')) return 'JSON';
  return 'UNKNOWN';
}

// ─── Unique seed generator ──────────────────────────────────────────────────
function randomSeed(): number {
  return (Date.now() + Math.floor(Math.random() * 1_000_000)) % 999_999_999;
}

// ─── Single benchmark run ───────────────────────────────────────────────────
async function benchmarkSingle(
  promptIndex: number,
  prompt: string,
  model: string,
  timeoutMs: number,
): Promise<BenchmarkResult> {
  const promptSnippet = prompt.slice(0, 60) + '…';
  const notes: string[] = [];

  const seed = randomSeed();
  const encodedPrompt = encodeURIComponent(prompt);
  const params = new URLSearchParams({
    model,
    width: String(WIDTH),
    height: String(HEIGHT),
    nologo: 'true',
    enhance: 'false',
    safe: 'true',
    seed: String(seed),
  });
  const url = `${BASE_URL}/${encodedPrompt}?${params}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  let tHeaders: number | null = null;

  try {
    const headers: Record<string, string> = {};
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`;
    } else {
      notes.push('⚠️ No API key — using unauthenticated mode');
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    tHeaders = performance.now() - t0;
    clearTimeout(timer);

    const httpStatus = response.status;
    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      notes.push(`HTTP ${httpStatus}: ${errorBody.slice(0, 150)}`);
      return {
        promptIndex, promptSnippet, model, timeoutMs, startedAt,
        totalTimeMs: Math.round(performance.now() - t0),
        timeToHeadersMs: Math.round(tHeaders),
        httpStatus, contentType, bodySizeBytes: null,
        imageWidth: null, imageHeight: null, aspectRatio: null, sha256: null,
        verdict: '❌ Failed',
        notes,
      };
    }

    // Read full body
    const buffer = await response.arrayBuffer();
    const totalTimeMs = Math.round(performance.now() - t0);
    const bytes = new Uint8Array(buffer);
    const bodySizeBytes = buffer.byteLength;

    // Format detection
    const detectedFormat = detectFormat(bytes);
    if (detectedFormat === 'HTML' || detectedFormat === 'JSON') {
      const text = new TextDecoder().decode(bytes).slice(0, 200);
      notes.push(`Response is ${detectedFormat}, not an image: ${text}`);
      return {
        promptIndex, promptSnippet, model, timeoutMs, startedAt, totalTimeMs,
        timeToHeadersMs: Math.round(tHeaders),
        httpStatus, contentType, bodySizeBytes,
        imageWidth: null, imageHeight: null, aspectRatio: null, sha256: null,
        verdict: '❌ Failed',
        notes,
      };
    }

    notes.push(`Format: ${detectedFormat}`);

    // Hash for uniqueness comparison
    const sha256 = createHash('sha256').update(bytes).digest('hex').slice(0, 16);

    // Dimensions
    const dims = getImageDimensions(bytes);
    const imageWidth = dims?.width ?? null;
    const imageHeight = dims?.height ?? null;
    const aspectRatio = imageWidth && imageHeight ? +(imageWidth / imageHeight).toFixed(3) : null;

    // ── Validation ──────────────────────────────────────────────────────────
    let verdict: BenchmarkResult['verdict'] = '✅ Valid';

    // Size check
    if (bodySizeBytes < 30_000) {
      verdict = '⚠️ Suspicious';
      notes.push(`Image very small (${(bodySizeBytes / 1024).toFixed(1)} KB) — possible placeholder`);
    }

    // Dimension checks
    if (imageWidth && imageHeight) {
      if (aspectRatio! > 0.9) {
        verdict = '⚠️ Suspicious';
        notes.push(`Square/landscape (${imageWidth}×${imageHeight}, ratio ${aspectRatio}) — expected portrait`);
      }
      if (imageWidth < 400 || imageHeight < 600) {
        verdict = '⚠️ Suspicious';
        notes.push(`Dimensions too small (${imageWidth}×${imageHeight})`);
      }
      if (imageWidth === WIDTH && imageHeight === HEIGHT) {
        notes.push(`Dimensions match request (${WIDTH}×${HEIGHT}) ✓`);
      } else {
        notes.push(`Dimensions: ${imageWidth}×${imageHeight} (requested ${WIDTH}×${HEIGHT})`);
      }
    } else {
      notes.push('Could not parse image dimensions');
    }

    // Content-Type check
    if (contentType && !contentType.startsWith('image/')) {
      verdict = '❌ Failed';
      notes.push(`Content-Type is "${contentType}" — not an image`);
    }

    return {
      promptIndex, promptSnippet, model, timeoutMs, startedAt, totalTimeMs,
      timeToHeadersMs: Math.round(tHeaders),
      httpStatus, contentType, bodySizeBytes,
      imageWidth, imageHeight, aspectRatio, sha256,
      verdict, notes,
    };

  } catch (err: any) {
    clearTimeout(timer);
    const totalTimeMs = Math.round(performance.now() - t0);

    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      notes.push(`Timeout after ${(timeoutMs / 1000).toFixed(1)}s`);
      return {
        promptIndex, promptSnippet, model, timeoutMs, startedAt, totalTimeMs,
        timeToHeadersMs: tHeaders ? Math.round(tHeaders) : null,
        httpStatus: null, contentType: null, bodySizeBytes: null,
        imageWidth: null, imageHeight: null, aspectRatio: null, sha256: null,
        verdict: '❌ Failed',
        notes,
      };
    }

    notes.push(`Error: ${err.message}`);
    return {
      promptIndex, promptSnippet, model, timeoutMs, startedAt, totalTimeMs,
      timeToHeadersMs: tHeaders ? Math.round(tHeaders) : null,
      httpStatus: null, contentType: null, bodySizeBytes: null,
      imageWidth: null, imageHeight: null, aspectRatio: null, sha256: null,
      verdict: '❌ Failed',
      notes,
    };
  }
}

// ─── Print helpers ──────────────────────────────────────────────────────────
function hrLine(char = '─', len = 90) { return char.repeat(len); }

function printResultDetail(r: BenchmarkResult, index: number) {
  console.log(`\n${hrLine('━')}`);
  console.log(`  ${r.verdict}  Test #${index + 1} — model=${r.model}, timeout=${r.timeoutMs / 1000}s`);
  console.log(hrLine('━'));
  console.log(`  Prompt:       ${r.promptSnippet}`);
  console.log(`  Started:      ${r.startedAt}`);
  console.log(`  Total time:   ${r.totalTimeMs}ms (${(r.totalTimeMs / 1000).toFixed(2)}s)`);
  if (r.timeToHeadersMs !== null) {
    console.log(`  Time→headers: ${r.timeToHeadersMs}ms (${(r.timeToHeadersMs / 1000).toFixed(2)}s)`);
  }
  console.log(`  HTTP status:  ${r.httpStatus ?? 'N/A'}`);
  console.log(`  Content-Type: ${r.contentType ?? 'N/A'}`);
  console.log(`  Body size:    ${r.bodySizeBytes !== null ? `${(r.bodySizeBytes / 1024).toFixed(1)} KB` : 'N/A'}`);
  if (r.imageWidth && r.imageHeight) {
    console.log(`  Dimensions:   ${r.imageWidth} × ${r.imageHeight} (ratio ${r.aspectRatio})`);
  }
  if (r.sha256) {
    console.log(`  SHA-256:      ${r.sha256}…`);
  }
  if (r.notes.length > 0) {
    console.log(`  Notes:`);
    r.notes.forEach(n => console.log(`    • ${n}`));
  }
}

function printSummaryTable(results: BenchmarkResult[]) {
  console.log(`\n\n${'═'.repeat(110)}`);
  console.log('  SUMMARY TABLE');
  console.log('═'.repeat(110));

  // Header
  const hdr = [
    '#'.padEnd(4),
    'Model'.padEnd(10),
    'Prompt'.padEnd(8),
    'Time'.padEnd(9),
    '→Hdrs'.padEnd(8),
    'HTTP'.padEnd(5),
    'Size'.padEnd(10),
    'Dims'.padEnd(13),
    'Verdict'.padEnd(15),
  ].join(' │ ');
  console.log(`  ${hdr}`);
  console.log(`  ${'─'.repeat(hdr.length)}`);

  // Rows
  results.forEach((r, i) => {
    const row = [
      `${i + 1}`.padEnd(4),
      r.model.padEnd(10),
      `P${r.promptIndex + 1}`.padEnd(8),
      `${(r.totalTimeMs / 1000).toFixed(2)}s`.padEnd(9),
      (r.timeToHeadersMs !== null ? `${(r.timeToHeadersMs / 1000).toFixed(2)}s` : '---').padEnd(8),
      `${r.httpStatus ?? '---'}`.padEnd(5),
      (r.bodySizeBytes !== null ? `${(r.bodySizeBytes / 1024).toFixed(0)} KB` : '---').padEnd(10),
      (r.imageWidth && r.imageHeight ? `${r.imageWidth}×${r.imageHeight}` : '---').padEnd(13),
      r.verdict.padEnd(15),
    ].join(' │ ');
    console.log(`  ${row}`);
  });

  console.log('═'.repeat(110));
}

function printStatistics(results: BenchmarkResult[]) {
  const successful = results.filter(r => r.verdict === '✅ Valid');
  const suspicious = results.filter(r => r.verdict === '⚠️ Suspicious');
  const failed = results.filter(r => r.verdict === '❌ Failed');

  console.log(`\n${'═'.repeat(70)}`);
  console.log('  STATISTICS');
  console.log('═'.repeat(70));
  console.log(`  Total tests:     ${results.length}`);
  console.log(`  ✅ Valid:         ${successful.length}`);
  console.log(`  ⚠️  Suspicious:   ${suspicious.length}`);
  console.log(`  ❌ Failed:        ${failed.length}`);
  console.log(`  Success rate:    ${(((successful.length + suspicious.length) / results.length) * 100).toFixed(0)}%`);

  const usable = [...successful, ...suspicious];
  if (usable.length > 0) {
    const times = usable.map(r => r.totalTimeMs).sort((a, b) => a - b);
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    const min = times[0];
    const max = times[times.length - 1];
    const p95 = times[Math.ceil(times.length * 0.95) - 1];
    const median = times[Math.floor(times.length / 2)];

    console.log(`\n  Timing (successful requests only):`);
    console.log(`    Min:     ${(min / 1000).toFixed(2)}s`);
    console.log(`    Avg:     ${(avg / 1000).toFixed(2)}s`);
    console.log(`    Median:  ${(median / 1000).toFixed(2)}s`);
    console.log(`    P95:     ${(p95 / 1000).toFixed(2)}s`);
    console.log(`    Max:     ${(max / 1000).toFixed(2)}s`);

    // Header times
    const headerTimes = usable.filter(r => r.timeToHeadersMs !== null).map(r => r.timeToHeadersMs!);
    if (headerTimes.length > 0) {
      const avgH = headerTimes.reduce((s, t) => s + t, 0) / headerTimes.length;
      console.log(`\n  Time-to-headers (avg):  ${(avgH / 1000).toFixed(2)}s`);
      console.log(`  Body download (avg):    ${((avg - avgH) / 1000).toFixed(2)}s`);
    }

    // Per-model breakdown
    const modelGroups = new Map<string, number[]>();
    usable.forEach(r => {
      const arr = modelGroups.get(r.model) || [];
      arr.push(r.totalTimeMs);
      modelGroups.set(r.model, arr);
    });
    if (modelGroups.size > 1) {
      console.log(`\n  Per-model timing:`);
      modelGroups.forEach((times, model) => {
        const modelAvg = times.reduce((s, t) => s + t, 0) / times.length;
        const modelMin = Math.min(...times);
        const modelMax = Math.max(...times);
        const total = results.filter(r => r.model === model).length;
        console.log(`    ${model.padEnd(12)} avg=${(modelAvg / 1000).toFixed(2)}s  min=${(modelMin / 1000).toFixed(2)}s  max=${(modelMax / 1000).toFixed(2)}s  (${times.length}/${total} ok)`);
      });
    }
  }

  // Uniqueness check
  const hashes = results.filter(r => r.sha256).map(r => r.sha256!);
  const uniqueHashes = new Set(hashes);
  if (hashes.length > 1) {
    console.log(`\n  Image uniqueness:`);
    console.log(`    Total images:     ${hashes.length}`);
    console.log(`    Unique hashes:    ${uniqueHashes.size}`);
    if (uniqueHashes.size < hashes.length) {
      console.log(`    ⚠️  DUPLICATES DETECTED — ${hashes.length - uniqueHashes.size} repeated images`);
    } else {
      console.log(`    ✅ All images are unique`);
    }
  }

  console.log('═'.repeat(70));
}

function printRecommendations(results: BenchmarkResult[]) {
  const usable = results.filter(r => r.verdict === '✅ Valid' || r.verdict === '⚠️ Suspicious');
  const failed = results.filter(r => r.verdict === '❌ Failed');

  console.log(`\n${'═'.repeat(70)}`);
  console.log('  RECOMMENDATIONS FOR PRODUCTION');
  console.log('═'.repeat(70));

  if (usable.length === 0) {
    console.log('  ❌ No successful requests — Pollinations may be down or');
    console.log('     misconfigured. Check API key, network, and service status.');
    console.log('═'.repeat(70));
    return;
  }

  const times = usable.map(r => r.totalTimeMs).sort((a, b) => a - b);
  const max = times[times.length - 1];
  const p95 = times[Math.ceil(times.length * 0.95) - 1];
  const avg = times.reduce((s, t) => s + t, 0) / times.length;

  // Best model
  const modelStats = new Map<string, { avg: number; count: number; total: number }>();
  MODELS_TO_TEST.forEach(model => {
    const modelResults = results.filter(r => r.model === model);
    const modelSuccess = modelResults.filter(r => r.verdict === '✅ Valid' || r.verdict === '⚠️ Suspicious');
    if (modelSuccess.length > 0) {
      const modelAvg = modelSuccess.reduce((s, r) => s + r.totalTimeMs, 0) / modelSuccess.length;
      modelStats.set(model, { avg: modelAvg, count: modelSuccess.length, total: modelResults.length });
    }
  });

  if (modelStats.size > 0) {
    console.log(`\n  Best model:`);
    const sorted = [...modelStats.entries()].sort((a, b) => {
      // Sort by success rate first, then by speed
      const rateA = a[1].count / a[1].total;
      const rateB = b[1].count / b[1].total;
      if (Math.abs(rateA - rateB) > 0.15) return rateB - rateA;
      return a[1].avg - b[1].avg;
    });
    sorted.forEach(([model, stats], i) => {
      const rate = ((stats.count / stats.total) * 100).toFixed(0);
      const marker = i === 0 ? ' ← RECOMMENDED' : '';
      console.log(`    ${model.padEnd(12)} avg=${(stats.avg / 1000).toFixed(2)}s  success=${rate}%${marker}`);
    });
  }

  // Timeout recommendation
  const recommendedTimeout = Math.ceil((p95 * 1.3) / 1000) * 1000; // 30% buffer over P95
  console.log(`\n  Timeout:`);
  console.log(`    P95 response time:     ${(p95 / 1000).toFixed(2)}s`);
  console.log(`    Max response time:     ${(max / 1000).toFixed(2)}s`);
  console.log(`    → Recommended timeout: ${(recommendedTimeout / 1000).toFixed(0)}s (P95 + 30% buffer)`);

  // Pipeline strategy
  console.log(`\n  Pipeline strategy:`);
  if (avg < 5_000) {
    console.log(`    Avg ${(avg / 1000).toFixed(1)}s → ✅ Parallel generation is ideal`);
    console.log(`    3 outfits in parallel: ~${(max / 1000).toFixed(1)}s total`);
    console.log(`    Budget: ${Math.ceil(max * 1.3 / 1000)}s`);
  } else if (avg < 12_000) {
    console.log(`    Avg ${(avg / 1000).toFixed(1)}s → ✅ Parallel OK, budget=${Math.ceil(max * 1.3 / 1000)}s`);
    console.log(`    Consider: generate first image immediately, lazy-load remaining 2`);
  } else {
    console.log(`    Avg ${(avg / 1000).toFixed(1)}s → ⚠️ Too slow for synchronous generation`);
    console.log(`    Recommendation: show placeholders, stream images via SSE/polling`);
  }

  // Reliability
  const successRate = (usable.length / results.length) * 100;
  console.log(`\n  Reliability:`);
  if (successRate >= 80) {
    console.log(`    ${successRate.toFixed(0)}% success → ✅ Production-viable as primary provider`);
  } else if (successRate >= 50) {
    console.log(`    ${successRate.toFixed(0)}% success → ⚠️ Usable but needs fallback provider`);
  } else {
    console.log(`    ${successRate.toFixed(0)}% success → ❌ NOT recommended as primary provider`);
  }

  // Timeouts
  const timeouts = failed.filter(r => r.notes.some(n => n.includes('Timeout')));
  if (timeouts.length > 0) {
    console.log(`\n  Timeouts: ${timeouts.length} request(s) timed out`);
    const timeoutValues = [...new Set(timeouts.map(r => r.timeoutMs))];
    timeoutValues.forEach(t => {
      const count = timeouts.filter(r => r.timeoutMs === t).length;
      console.log(`    ${t / 1000}s timeout → ${count} failure(s)`);
    });
  }

  // HTTP errors
  const httpErrors = failed.filter(r => r.httpStatus && r.httpStatus >= 400);
  if (httpErrors.length > 0) {
    console.log(`\n  HTTP errors:`);
    httpErrors.forEach(r => {
      console.log(`    ${r.model} → HTTP ${r.httpStatus}: ${r.notes.find(n => n.includes('HTTP'))?.slice(0, 80) ?? ''}`);
    });
  }

  // Production config snippet
  if (modelStats.size > 0) {
    const bestModel = [...modelStats.entries()].sort((a, b) => {
      const rateA = a[1].count / a[1].total;
      const rateB = b[1].count / b[1].total;
      if (Math.abs(rateA - rateB) > 0.15) return rateB - rateA;
      return a[1].avg - b[1].avg;
    })[0];
    console.log(`\n  ┌──────────────────────────────────────────┐`);
    console.log(`  │  Suggested production config:            │`);
    console.log(`  │    model:   '${bestModel[0]}'${' '.repeat(Math.max(0, 24 - bestModel[0].length))}│`);
    console.log(`  │    timeout: ${(recommendedTimeout / 1000).toFixed(0)}s${' '.repeat(Math.max(0, 27 - String((recommendedTimeout / 1000).toFixed(0)).length))}│`);
    console.log(`  │    budget:  ${Math.ceil(max * 1.5 / 1000)}s (for 3 parallel images)${' '.repeat(Math.max(0, 4))}│`);
    console.log(`  └──────────────────────────────────────────┘`);
  }

  console.log('═'.repeat(70));
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║   Pollinations.ai Image Generation — Benchmark & Validation      ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log();

  // Pre-flight checks
  console.log('🔧 Pre-flight checks:');
  console.log(`   API Key:    ${API_KEY ? `${API_KEY.slice(0, 6)}…${API_KEY.slice(-4)} (${API_KEY.length} chars)` : '❌ NOT SET'}`);
  console.log(`   Base URL:   ${BASE_URL}`);
  console.log(`   Dimensions: ${WIDTH}×${HEIGHT}`);
  console.log(`   Prompts:    ${TEST_PROMPTS.length}`);
  console.log(`   Models:     ${MODELS_TO_TEST.join(', ')}`);
  console.log(`   Timeout:    ${DEFAULT_TIMEOUT / 1000}s per request`);
  console.log();

  if (!API_KEY) {
    console.error('❌ POLLINATIONS_API_KEY not found in .env or .env.local');
    console.error('   Set it before running this benchmark.');
    process.exit(1);
  }

  const allResults: BenchmarkResult[] = [];
  let testNum = 0;

  // ── Phase 1: Test each model with prompt #1 ──────────────────────────────
  console.log(`${'▓'.repeat(70)}`);
  console.log(`  PHASE 1: Model comparison — ${MODELS_TO_TEST.length} models, prompt #1`);
  console.log('▓'.repeat(70));

  for (const model of MODELS_TO_TEST) {
    testNum++;
    console.log(`\n⏳ [${testNum}] Model "${model}", prompt #1...`);
    const result = await benchmarkSingle(0, TEST_PROMPTS[0], model, DEFAULT_TIMEOUT);
    allResults.push(result);
    printResultDetail(result, allResults.length - 1);
  }

  // Determine the best model(s) so far
  const workingModels = MODELS_TO_TEST.filter(m =>
    allResults.some(r => r.model === m && (r.verdict === '✅ Valid' || r.verdict === '⚠️ Suspicious'))
  );

  if (workingModels.length === 0) {
    console.log('\n⚠️  No models produced valid images with prompt #1. Retrying all with prompt #2...');
    for (const model of MODELS_TO_TEST) {
      testNum++;
      console.log(`\n⏳ [${testNum}] Model "${model}", prompt #2...`);
      const result = await benchmarkSingle(1, TEST_PROMPTS[1], model, DEFAULT_TIMEOUT);
      allResults.push(result);
      printResultDetail(result, allResults.length - 1);
      if (result.verdict === '✅ Valid' || result.verdict === '⚠️ Suspicious') {
        workingModels.push(model);
      }
    }
  }

  // ── Phase 2: Stress test the working model(s) with all 3 prompts ──────────
  const modelsToStress = workingModels.length > 0
    ? workingModels.slice(0, 3) // Up to 3 working models
    : MODELS_TO_TEST.slice(0, 2); // Fallback: first 2

  console.log(`\n${'▓'.repeat(70)}`);
  console.log(`  PHASE 2: Full prompt sweep — model(s): ${modelsToStress.join(', ')}`);
  console.log('▓'.repeat(70));

  for (const model of modelsToStress) {
    for (let pi = 0; pi < TEST_PROMPTS.length; pi++) {
      // Skip already-tested combinations
      const alreadyTested = allResults.some(r => r.model === model && r.promptIndex === pi);
      if (alreadyTested) continue;

      testNum++;
      console.log(`\n⏳ [${testNum}] Model "${model}", prompt #${pi + 1}...`);
      const result = await benchmarkSingle(pi, TEST_PROMPTS[pi], model, DEFAULT_TIMEOUT);
      allResults.push(result);
      printResultDetail(result, allResults.length - 1);
    }
  }

  // ── Reports ───────────────────────────────────────────────────────────────
  printSummaryTable(allResults);
  printStatistics(allResults);
  printRecommendations(allResults);

  // Exit with error code if no images succeeded
  const successCount = allResults.filter(r => r.verdict === '✅ Valid' || r.verdict === '⚠️ Suspicious').length;
  if (successCount === 0) {
    console.log('\n❌ All tests failed — check API key, network, and Pollinations status.');
    process.exit(1);
  }

  console.log(`\n✅ Benchmark complete — ${successCount}/${allResults.length} succeeded\n`);
}

main().catch((err) => {
  console.error('\n💥 Benchmark crashed:', err);
  process.exit(1);
});
