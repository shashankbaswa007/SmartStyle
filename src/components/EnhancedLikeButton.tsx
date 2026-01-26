/**
 * Enhanced Like Button with Animations
 * Features: heart bounce, particle burst, optimistic updates, haptic feedback
 */
'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { likeButtonVariants, heartParticleVariants } from '@/lib/animation-config';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';

interface LikeButtonProps {
  isLiked: boolean;
  onToggle: () => Promise<boolean>;
  likeCount?: number;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
};

export const EnhancedLikeButton: React.FC<LikeButtonProps> = ({
  isLiked: initialIsLiked,
  onToggle,
  likeCount: initialLikeCount = 0,
  showCount = false,
  size = 'md',
  className,
}) => {
  const { triggerHaptic } = useHapticFeedback();
  const [showParticles, setShowParticles] = React.useState(false);
  const [animateHeart, setAnimateHeart] = React.useState(false);

  // Optimistic updates for like state
  const {
    value: isLiked,
    isLoading,
    update: updateLike,
  } = useOptimisticUpdate(initialIsLiked);

  const [likeCount, setLikeCount] = React.useState(initialLikeCount);

  const handleLikeToggle = React.useCallback(async () => {
    if (isLoading) return;

    // Calculate optimistic like count
    const optimisticIsLiked = !isLiked;
    const optimisticCount = optimisticIsLiked ? likeCount + 1 : likeCount - 1;

    // Update UI immediately (optimistic)
    setLikeCount(optimisticCount);

    // Trigger animations and haptic feedback
    if (optimisticIsLiked) {
      setAnimateHeart(true);
      setShowParticles(true);
      triggerHaptic('success');
      
      // Hide particles after animation
      setTimeout(() => {
        setShowParticles(false);
        setAnimateHeart(false);
      }, 800);
    } else {
      triggerHaptic('light');
    }

    // Perform actual API call with optimistic update
    await updateLike(optimisticIsLiked, async () => {
      const result = await onToggle();
      return result;
    });
  }, [isLiked, isLoading, likeCount, updateLike, onToggle, triggerHaptic]);

  return (
    <div className={cn('relative inline-flex items-center gap-2', className)}>
      <motion.button
        className={cn(
          'relative inline-flex items-center justify-center rounded-full',
          'transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          sizeClasses[size],
          isLiked
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
        )}
        onClick={handleLikeToggle}
        disabled={isLoading}
        variants={likeButtonVariants}
        initial="initial"
        animate={animateHeart ? 'liked' : 'initial'}
        whileTap="tap"
        style={{ willChange: 'transform' }}
      >
        <Heart
          className={cn(
            'transition-all duration-200',
            isLiked && 'fill-current'
          )}
          size={iconSizes[size]}
        />

        {/* Particle burst effect */}
        <AnimatePresence>
          {showParticles && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 flex items-center justify-center"
                  custom={i}
                  variants={heartParticleVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Heart
                    className="text-red-500 fill-current"
                    size={iconSizes[size] / 2}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Like count with count-up animation */}
      {showCount && (
        <motion.span
          key={likeCount}
          className="text-sm font-medium text-muted-foreground"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {likeCount}
        </motion.span>
      )}
    </div>
  );
};
