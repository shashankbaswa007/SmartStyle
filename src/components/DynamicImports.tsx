
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

// Define types for the components
interface TextPressureProps {
  text?: string;
  fontFamily?: string;
  fontUrl?: string;
  width?: boolean;
  weight?: boolean;
  italic?: boolean;
  alpha?: boolean;
  flex?: boolean;
  stroke?: boolean;
  scale?: boolean;
  textColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  className?: string;
  minFontSize?: number;
  alphaParticles?: boolean;
  padding?: string;
}

interface SplashCursorProps {
  // Add props if needed
}

interface ParticlesProps {
  className?: string;
  particleCount?: number;
  particleColors?: string[];
  particleSpread?: number;
  speed?: number;
  particleBaseSize?: number;
  moveParticlesOnHover?: boolean;
  alphaParticles?: boolean;
  disableRotation?: boolean;
}

export const DynamicTextPressure = dynamic(
  () => import('@/components/TextPressure').then(mod => (mod as any).TextPressure ?? (mod as any).default), 
  { ssr: false }
) as ComponentType<TextPressureProps>;

export const DynamicSplashCursor = dynamic(
  () => import('@/components/SplashCursor').then(mod => (mod as any).SplashCursor ?? (mod as any).default), 
  { ssr: false }
) as ComponentType<SplashCursorProps>;

export const DynamicSilk = dynamic(
  () => import('@/components/Particles').then(mod => (mod as any).Particles ?? (mod as any).default), 
  { ssr: false }
) as ComponentType<ParticlesProps>;

