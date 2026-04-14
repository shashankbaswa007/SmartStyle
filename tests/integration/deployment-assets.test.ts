import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('deployment assets smoke', () => {
  const root = process.cwd();

  it('includes required PWA files in public', () => {
    const requiredFiles = [
      'public/manifest.json',
      'public/offline.html',
      'public/sw.js',
      'public/icons/icon-192x192.png',
      'public/icons/icon-512x512.png',
      'public/icons/icon-maskable-192x192.png',
      'public/icons/icon-maskable-512x512.png',
    ];

    for (const file of requiredFiles) {
      expect(existsSync(join(root, file))).toBe(true);
    }
  });

  it('keeps brand asset version consistent across branding, manifest, and service worker', () => {
    const brandingSource = readFileSync(join(root, 'src/lib/branding.ts'), 'utf8');
    const versionMatch = brandingSource.match(/BRAND_ASSET_VERSION\s*=\s*'([^']+)'/);
    expect(versionMatch).toBeTruthy();

    const version = versionMatch?.[1] || '';
    expect(version.length).toBeGreaterThan(0);

    const layoutSource = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8');
    expect(layoutSource).toContain("withBrandAssetVersion('/manifest.json')");

    const manifestRaw = readFileSync(join(root, 'public/manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestRaw) as {
      icons?: Array<{ src?: string }>;
      shortcuts?: Array<{ icons?: Array<{ src?: string }> }>;
    };

    const iconSources = (manifest.icons || []).map((icon) => icon.src || '').filter(Boolean);
    expect(iconSources.length).toBeGreaterThan(0);
    for (const src of iconSources) {
      expect(src).toContain(`?v=${version}`);
    }

    const shortcutIconSources = (manifest.shortcuts || [])
      .flatMap((shortcut) => shortcut.icons || [])
      .map((icon) => icon.src || '')
      .filter(Boolean);
    for (const src of shortcutIconSources) {
      expect(src).toContain(`?v=${version}`);
    }

    const swSource = readFileSync(join(root, 'public/sw.js'), 'utf8');
    expect(swSource).toContain(`const BRAND_ASSET_VERSION = '${version}'`);
    expect(swSource).toContain('/manifest.json?v=${BRAND_ASSET_VERSION}');
    expect(swSource).toContain('const BRANDING_NETWORK_FIRST = true');
  });

  it('retains recommend metrics endpoints and wardrobe suggest loading UI', () => {
    const requiredSourceFiles = [
      'src/app/api/recommend/metrics/route.ts',
      'src/app/api/recommend/metrics/snapshot/route.ts',
      'src/app/wardrobe/suggest/loading.tsx',
    ];

    for (const file of requiredSourceFiles) {
      expect(existsSync(join(root, file))).toBe(true);
    }
  });
});
