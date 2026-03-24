/**
 * SmartStyle Authentication Branding System
 *
 * Single source of truth for the auth logo lockup and loading reveal timings.
 * The logo internals are intentionally identical across header, login card,
 * and loading flows. Context-specific sizing should happen only via wrapper
 * scale, never by changing mark/wordmark internals.
 */

export const AUTH_LOGO_LOCKUP = {
  markRoot: 'relative h-12 w-12',
  outerRing: 'absolute inset-0 rounded-2xl border border-cyan-200/35',
  innerRing: 'absolute inset-[4px] rounded-xl border border-indigo-200/30',
  center:
    'absolute inset-[7px] flex items-center justify-center rounded-lg border border-white/20 bg-gradient-to-br from-cyan-300/20 via-sky-300/14 to-indigo-500/20 shadow-[0_0_20px_rgba(56,189,248,0.3)]',
  glyph: 'relative text-[13px] font-serif font-semibold italic tracking-[0.12em] text-white',
  glyphEcho: 'pointer-events-none absolute -inset-x-1 top-[1px] opacity-40 blur-[0.6px]',
  wordmark: 'font-serif text-[1.6rem] leading-none tracking-[-0.03em] text-white',
  tagline: 'mt-1 text-[10px] uppercase tracking-[0.2em] text-cyan-100/68',
  gap: 'gap-3.5',
};

export const AUTH_LOGO_MOTION = {
  outerDuration: 12,
  innerDuration: 10,
};

export const AUTH_LOGO_CONFIG = {
  glyph: {
    font: 'font-serif',
    weight: 'font-semibold',
    style: 'italic',
    letter: 'SS',
    glyphOpacity: 'opacity-40',
    glyphBlur: 'blur-[0.6px]',
  },
  wordmark: {
    font: 'font-serif',
    weight: 'font-normal',
    text: 'SmartStyle',
  },
  taglines: {
    primary: 'Your Personal Style Assistant',
  },
};

export const AUTH_ANIMATION_CONFIG = {
  // Premium loading reveal sequence
  premiumLoadingStages: {
    atmosphereFadeIn: { start: 0, end: 0.6, label: 'Fade in background' },
    contourLight: { start: 0.5, end: 1.5, label: 'Contour light sweep' },
    markReveal: { start: 1.1, end: 2.2, label: 'Logo mark blur-to-sharp' },
    wordmarkEntrance: { start: 1.9, end: 3.0, label: 'Wordmark reveal' },
    breathingPulse: { start: 2.9, end: 4.2, label: 'Final glow and settle' },
  },
};

export const AUTH_COLORS = {
  primaryCyan: 'rgba(56,189,248,0.3)',
  secondaryIndigo: 'rgba(99,102,241,0.22)',
  accentTeal: 'rgba(20,184,166,0.16)',
  darkBg: '#050813',
  cardBg: 'bg-slate-950/72',
};
