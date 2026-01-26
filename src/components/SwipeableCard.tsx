/**
 * Swipeable Card Component
 * Enables swipe gestures for like/dislike actions with haptic feedback
 */
'use client';

import * as React from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Heart, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  className?: string;
}

const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY = 500;

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = SWIPE_THRESHOLD,
  className,
}) => {
  const { triggerHaptic } = useHapticFeedback();
  const x = useMotionValue(0);
  const [swipeDirection, setSwipeDirection] = React.useState<'left' | 'right' | null>(null);

  // Transform x position to rotation for natural card movement
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  
  // Transform x position to opacity for action indicators
  const leftOpacity = useTransform(x, [-threshold, 0], [1, 0]);
  const rightOpacity = useTransform(x, [0, threshold], [0, 1]);

  const handleDragEnd = React.useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset, velocity } = info;
      const swipeVelocity = velocity.x;
      const swipeOffset = offset.x;

      // Check if swipe threshold is met
      if (Math.abs(swipeOffset) > threshold || Math.abs(swipeVelocity) > SWIPE_VELOCITY) {
        if (swipeOffset > 0) {
          // Swipe right - Add to favorites
          triggerHaptic('success');
          onSwipeRight?.();
        } else {
          // Swipe left - Not my style
          triggerHaptic('medium');
          onSwipeLeft?.();
        }
      } else {
        // Return to center
        setSwipeDirection(null);
      }
    },
    [threshold, onSwipeLeft, onSwipeRight, triggerHaptic]
  );

  const handleDrag = React.useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset } = info;
      
      // Update swipe direction for visual feedback
      if (Math.abs(offset.x) > threshold * 0.5) {
        const newDirection = offset.x > 0 ? 'right' : 'left';
        if (newDirection !== swipeDirection) {
          setSwipeDirection(newDirection);
          triggerHaptic('light');
        }
      } else if (swipeDirection !== null) {
        setSwipeDirection(null);
      }
    },
    [threshold, swipeDirection, triggerHaptic]
  );

  return (
    <motion.div
      className={cn('relative touch-pan-y', className)}
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
    >
      {/* Swipe left indicator */}
      <motion.div
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-red-500 text-white p-3 rounded-full shadow-lg"
        style={{ opacity: leftOpacity }}
      >
        <X size={24} />
      </motion.div>

      {/* Swipe right indicator */}
      <motion.div
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-green-500 text-white p-3 rounded-full shadow-lg"
        style={{ opacity: rightOpacity }}
      >
        <Heart size={24} className="fill-current" />
      </motion.div>

      {children}
    </motion.div>
  );
};
