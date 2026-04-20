export const BRAND = {
  name: 'SmartStyle',
  tagline: 'Tailored by intelligence',
  themeColor: '#0A1411',
  radius: {
    card: 28,
    panel: 22,
    control: 12,
  },
  colors: {
    core: '#0A1411',
    coreDeep: '#050D0A',
    accent: '#0D6A60',
    glow: '#1A8B7E',
    trace: '#6F6488',
    ink: '#05080A',
    frost: '#F5F7F4',
    mist: '#D1E8E2',
  },
  logo: {
    wordmark: {
      letterSpacing: '-0.02em',
      accentLetterSpacing: '-0.01em',
    },
    size: {
      tiny: 18,
      small: 24,
      medium: 34,
      large: 56,
      hero: 80,
    },
  },
  motion: {
    introMs: 2100,
    introReducedMs: 260,
    introBuildMs: 680,
    introRevealMs: 760,
    introFadeMs: 420,
  },
} as const;

export const INTRO_STORAGE_KEY = 'smartstyle_intro_seen';
export const INTRO_REPLAY_QUERY = 'replayIntro';
export const APP_LOADER_SESSION_KEY = 'smartstyle:app-loader:shown';
export const BRAND_ASSET_VERSION = '2026-04-20.2';

export function withBrandAssetVersion(path: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${encodeURIComponent(BRAND_ASSET_VERSION)}`;
}
