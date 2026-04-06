import { existsSync } from 'fs';
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
});
