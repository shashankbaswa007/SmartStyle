'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MotionLayer, getMotionDuration, shouldSkipMotion } from '@/lib/premium-motion';

type MotionContextValue = {
  prefersReducedMotion: boolean;
  duration: (seconds: number, layer?: MotionLayer) => number;
  skip: (layer?: MotionLayer) => boolean;
};

const MotionContext = createContext<MotionContextValue | null>(null);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    setPrefersReducedMotion(media.matches);
    media.addEventListener('change', handleChange);

    return () => media.removeEventListener('change', handleChange);
  }, []);

  const value = useMemo<MotionContextValue>(
    () => ({
      prefersReducedMotion,
      duration: (seconds: number, layer: MotionLayer = 'primary') =>
        getMotionDuration(seconds, prefersReducedMotion, layer),
      skip: (layer: MotionLayer = 'decorative') =>
        shouldSkipMotion(prefersReducedMotion, layer),
    }),
    [prefersReducedMotion]
  );

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotionSettings() {
  const context = useContext(MotionContext);

  if (!context) {
    throw new Error('useMotionSettings must be used within MotionProvider');
  }

  return context;
}
