export type MotionLayer = 'critical' | 'primary' | 'secondary' | 'decorative';

export const MOTION_EASING = {
  smooth: [0.22, 1, 0.36, 1] as const,
  graceful: [0.25, 0.46, 0.45, 0.94] as const,
  emphasis: [0.34, 1.2, 0.64, 1] as const,
  linear: 'linear' as const,
};

export const MOTION_DURATION = {
  instant: 0.1,
  fast: 0.18,
  normal: 0.35,
  slow: 0.55,
  cinematic: 0.85,
} as const;

export const MOTION_STAGGER = {
  tight: 0.05,
  normal: 0.1,
  relaxed: 0.16,
} as const;

const REDUCED_MOTION_SCALE: Record<MotionLayer, number> = {
  critical: 1,
  primary: 0.45,
  secondary: 0.3,
  decorative: 0,
};

export function getMotionDuration(
  duration: number,
  prefersReducedMotion: boolean,
  layer: MotionLayer = 'primary'
): number {
  if (!prefersReducedMotion) {
    return duration;
  }

  return duration * REDUCED_MOTION_SCALE[layer];
}

export function shouldSkipMotion(
  prefersReducedMotion: boolean,
  layer: MotionLayer = 'decorative'
): boolean {
  return prefersReducedMotion && REDUCED_MOTION_SCALE[layer] === 0;
}
