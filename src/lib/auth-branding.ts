/**
 * SmartStyle Authentication Branding System
 *
 * Single source of truth for the auth logo lockup and loading reveal timings.
 * The logo internals are intentionally identical across header, login card,
 * and loading flows. Context-specific sizing should happen only via wrapper
 * scale, never by changing mark/wordmark internals.
 */

export const AUTH_LOGO_LOCKUP = {
  markRoot: 'relative h-12 w-12 overflow-visible',
  outerRing:
    'absolute inset-[-10px] rounded-full border-2 border-emerald-200/72 border-r-transparent border-b-emerald-100/20 shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_0_18px_rgba(16,185,129,0.3)]',
  middleRing:
    'absolute inset-[-5px] rounded-full border-[1.5px] border-teal-200/68 border-t-transparent border-l-teal-100/20 shadow-[0_0_14px_rgba(20,184,166,0.24)]',
  innerRing:
    'absolute inset-[-1px] rounded-full border-[1.5px] border-slate-200/56 border-l-transparent border-t-slate-100/24 shadow-[0_0_10px_rgba(20,184,166,0.18)]',
  center:
    'absolute inset-[7px] z-10 flex items-center justify-center rounded-full border border-white/24 bg-gradient-to-br from-emerald-300/22 via-teal-300/16 to-slate-300/18 shadow-[0_0_18px_rgba(16,185,129,0.24)]',
  glyph: 'relative font-headline text-[14px] font-semibold leading-none tracking-[0.07em] text-slate-50',
  glyphEcho: 'pointer-events-none absolute -inset-x-[1px] top-[1px] opacity-0 blur-[0.45px]',
  wordmark: 'font-headline text-[1.42rem] font-semibold leading-none tracking-[-0.02em] text-slate-50',
  tagline: 'mt-[2px] font-body text-[10px] uppercase tracking-[0.16em] text-emerald-100/68',
  gap: 'gap-2.5',
};

export const AUTH_LOGO_MOTION = {
  outerDuration: 3,
  middleDuration: 5,
  innerDuration: 8,
};

export const AUTH_LOGO_CONFIG = {
  glyph: {
    font: 'font-headline',
    weight: 'font-semibold',
    style: '',
    letter: 'SS',
    glyphOpacity: 'opacity-25',
    glyphBlur: 'blur-[0.45px]',
  },
  wordmark: {
    font: 'font-headline',
    weight: 'font-semibold',
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
  primaryCyan: 'rgba(13,106,96,0.28)',
  secondaryIndigo: 'rgba(26,139,126,0.22)',
  accentTeal: 'rgba(111,100,136,0.07)',
  darkBg: '#050D0A',
  cardBg: 'bg-black/65',
};
