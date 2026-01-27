/**
 * Centralized animation configuration
 * GPU-accelerated animation settings for consistent 60fps performance
 */
import { Transition, Variants } from 'framer-motion';

// ============================================================================
// ANIMATION DURATIONS (in seconds)
// ============================================================================
export const ANIMATION_DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  verySlow: 0.8,
} as const;

// ============================================================================
// EASING FUNCTIONS
// ============================================================================
export const EASING = {
  // Smooth easing for natural motion
  smooth: [0.25, 0.46, 0.45, 0.94],
  // Spring-like bounce
  spring: [0.34, 1.56, 0.64, 1],
  // Sharp entry, smooth exit
  sharpIn: [0.4, 0, 1, 1],
  // Smooth entry, sharp exit
  sharpOut: [0, 0, 0.2, 1],
  // Standard ease
  ease: [0.25, 0.1, 0.25, 1],
} as const;

// ============================================================================
// BUTTON ANIMATIONS
// ============================================================================
export const buttonVariants: Variants = {
  initial: { scale: 1 },
  tap: {
    scale: 0.96,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
  hover: {
    scale: 1.02,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};

// ============================================================================
// CARD ANIMATIONS
// ============================================================================
export const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  hover: {
    y: -8,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};

export const cardStaggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

// ============================================================================
// IMAGE ANIMATIONS
// ============================================================================
export const imageZoomVariants: Variants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
};
    },
  },
};

// ============================================================================
// MODAL/DIALOG ANIMATIONS
// ============================================================================
export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: ANIMATION_DURATION.fast,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: ANIMATION_DURATION.fast,
    },
  },
};

export const modalContentVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: ANIMATION_DURATION.fast,
      ease: EASING.smooth,
    },
  },
};

// ============================================================================
// TOAST/NOTIFICATION ANIMATIONS
// ============================================================================
export const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -50,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.95,
    transition: {
      duration: ANIMATION_DURATION.fast,
    },
  },
};

// ============================================================================
// PAGE TRANSITION ANIMATIONS
// ============================================================================
export const pageTransitionVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: ANIMATION_DURATION.fast,
      ease: EASING.smooth,
    },
  },
};

// ============================================================================
// LOADING ANIMATIONS
// ============================================================================
export const skeletonPulseVariants: Variants = {
  pulse: {
    opacity: [0.4, 0.8, 0.4],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const shimmerVariants: Variants = {
  shimmer: {
    backgroundPosition: ['200% 0', '-200% 0'],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// ============================================================================
// LIKE BUTTON ANIMATIONS
// ============================================================================
export const likeButtonVariants: Variants = {
  initial: { scale: 1 },
  tap: { scale: 0.9 },
  liked: {
    scale: [1, 1.3, 1],
    transition: {
      duration: 0.4,
      times: [0, 0.5, 1],
      ease: EASING.spring,
    },
  },
};

export const heartParticleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0,
  },
  visible: (i: number) => ({
    opacity: [0, 1, 0],
    scale: [0, 1.5, 0],
    x: Math.cos((i * Math.PI) / 4) * 40,
    y: Math.sin((i * Math.PI) / 4) * 40,
    transition: {
      duration: 0.8,
      ease: 'easeOut',
    },
  }),
};

// ============================================================================
// SWIPE GESTURE SETTINGS
// ============================================================================
export const SWIPE_THRESHOLD = 100; // pixels
export const SWIPE_VELOCITY_THRESHOLD = 500; // pixels per second
export const SWIPE_CONFIDENCE_THRESHOLD = 0.2;

// ============================================================================
// SPRING CONFIGURATIONS
// ============================================================================
export const springConfig = {
  gentle: {
    type: 'spring' as const,
    stiffness: 100,
    damping: 15,
  },
  bouncy: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 20,
  },
  snappy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 30,
  },
} as const;

// ============================================================================
// SCROLL REVEAL SETTINGS
// ============================================================================
export const scrollRevealVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 50,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: ANIMATION_DURATION.slow,
      ease: EASING.smooth,
    },
  },
};

export const scrollRevealStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};
