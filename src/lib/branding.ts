export const BRAND = {
  name: 'SmartStyle',
  tagline: 'Tailored by intelligence',
  themeColor: '#4F46E5',
  radius: {
    card: 28,
    panel: 22,
    control: 12,
  },
  colors: {
    core: '#4F46E5',
    coreDeep: '#3730A3',
    accent: '#7C3AED',
    glow: '#14B8A6',
    ink: '#0B1020',
    frost: '#E2E8F0',
    mist: '#C7D2FE',
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
