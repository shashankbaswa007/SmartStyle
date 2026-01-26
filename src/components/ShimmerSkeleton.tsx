/**
 * Enhanced Shimmer Skeleton Loader
 * GPU-accelerated skeleton with smooth shimmer effect for zero layout shifts
 */
'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ShimmerSkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'rectangular' | 'circular' | 'text';
  animation?: 'pulse' | 'shimmer' | 'none';
}

export const ShimmerSkeleton = ({
  className,
  width = '100%',
  height = '100%',
  variant = 'rectangular',
  animation = 'shimmer',
}: ShimmerSkeletonProps) => {
  const baseClasses = 'bg-muted';
  
  const variantClasses = {
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
    text: 'rounded',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    shimmer: 'shimmer-effect',
    none: '',
  };

  return (
    <motion.div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        willChange: animation !== 'none' ? 'opacity' : undefined,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    />
  );
};

/**
 * Outfit Card Skeleton with exact dimensions for zero layout shift
 */
export const OutfitCardSkeletonEnhanced = () => {
  return (
    <motion.div
      className="w-full bg-card rounded-xl border border-border overflow-hidden shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ contain: 'layout paint' }} // CSS containment for performance
    >
      {/* Fixed aspect ratio image skeleton */}
      <div className="relative w-full aspect-[3/4] overflow-hidden">
        <ShimmerSkeleton className="absolute inset-0" />
      </div>

      {/* Content section with fixed heights */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <ShimmerSkeleton height={24} className="w-3/4" variant="text" />
        
        {/* Description lines */}
        <div className="space-y-2">
          <ShimmerSkeleton height={16} className="w-full" variant="text" />
          <ShimmerSkeleton height={16} className="w-5/6" variant="text" />
          <ShimmerSkeleton height={16} className="w-4/6" variant="text" />
        </div>

        {/* Color palette section - fixed height 120px */}
        <div className="pt-3">
          <ShimmerSkeleton height={12} className="w-24 mb-2" variant="text" />
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <ShimmerSkeleton
                key={i}
                width={40}
                height={40}
                variant="circular"
              />
            ))}
          </div>
        </div>

        {/* Shopping links section - fixed minimum height 80px */}
        <div className="pt-3 min-h-[80px]">
          <ShimmerSkeleton height={12} className="w-32 mb-2" variant="text" />
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <ShimmerSkeleton
                key={i}
                className="flex-1"
                height={36}
              />
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-3">
          <ShimmerSkeleton className="flex-1" height={40} />
          <ShimmerSkeleton className="flex-1" height={40} />
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Grid of outfit card skeletons with stagger animation
 */
export const OutfitSkeletonGridEnhanced = ({ count = 3 }: { count?: number }) => {
  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
    >
      {[...Array(count)].map((_, i) => (
        <OutfitCardSkeletonEnhanced key={i} />
      ))}
    </motion.div>
  );
};

/**
 * Image skeleton with exact aspect ratio
 */
export const ImageSkeleton = ({
  aspectRatio = '1/1',
  className,
}: {
  aspectRatio?: string;
  className?: string;
}) => {
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-lg', className)}
      style={{ aspectRatio }}
    >
      <ShimmerSkeleton className="absolute inset-0" />
    </div>
  );
};

/**
 * Profile skeleton for navbar
 */
export const ProfileSkeleton = () => {
  return (
    <div className="flex items-center gap-3">
      <ShimmerSkeleton width={32} height={32} variant="circular" />
      <div className="hidden md:block space-y-2">
        <ShimmerSkeleton width={100} height={12} variant="text" />
        <ShimmerSkeleton width={80} height={10} variant="text" />
      </div>
    </div>
  );
};

/**
 * Chart skeleton with fixed container
 */
export const ChartSkeleton = ({
  height = 300,
  className,
}: {
  height?: number;
  className?: string;
}) => {
  return (
    <div className={cn('w-full', className)} style={{ height: `${height}px` }}>
      <ShimmerSkeleton className="w-full h-full" />
    </div>
  );
};

/**
 * Text skeleton for loading text content
 */
export const TextSkeleton = ({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {[...Array(lines)].map((_, i) => (
        <ShimmerSkeleton
          key={i}
          height={16}
          className={cn(
            'w-full',
            i === lines - 1 && 'w-3/4' // Last line is shorter
          )}
          variant="text"
        />
      ))}
    </div>
  );
};
