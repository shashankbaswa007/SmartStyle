/**
 * Custom hook for scroll-triggered animations using Intersection Observer
 * Animates elements when they enter the viewport for smooth scroll experiences
 */
import { useInView } from 'react-intersection-observer';
import { useAnimation, Variant } from 'framer-motion';
import { useEffect } from 'react';

interface UseIntersectionAnimationOptions {
  threshold?: number;
  triggerOnce?: boolean;
  delay?: number;
}

export const useIntersectionAnimation = (
  options: UseIntersectionAnimationOptions = {}
) => {
  const { threshold = 0.3, triggerOnce = true, delay = 0 } = options;
  const controls = useAnimation();
  const [ref, inView] = useInView({
    threshold,
    triggerOnce,
  });

  useEffect(() => {
    if (inView) {
      const timer = setTimeout(() => {
        controls.start('visible');
      }, delay);
      return () => clearTimeout(timer);
    } else if (!triggerOnce) {
      controls.start('hidden');
    }
  }, [controls, inView, triggerOnce, delay]);

  return { ref, controls, inView };
};

// Predefined animation variants for common patterns
export const fadeInUpVariants: Record<string, Variant> = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for smooth feel
    },
  },
};

export const fadeInVariants: Record<string, Variant> = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4 },
  },
};

export const scaleInVariants: Record<string, Variant> = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.34, 1.56, 0.64, 1], // Spring-like easing
    },
  },
};

export const slideInFromLeftVariants: Record<string, Variant> = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

export const slideInFromRightVariants: Record<string, Variant> = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};
