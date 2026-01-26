/**
 * Smooth UI Components - Central Export
 * Export all smooth animation components for easy import
 */

// Hooks
export { useIntersectionAnimation, fadeInUpVariants, fadeInVariants, scaleInVariants, slideInFromLeftVariants, slideInFromRightVariants } from '@/hooks/useIntersectionAnimation';
export { useHapticFeedback } from '@/hooks/useHapticFeedback';
export { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';
export { useColorWorker } from '@/hooks/useColorWorker';

// Animation Configuration
export * from '@/lib/animation-config';

// Skeleton Loaders
export {
  ShimmerSkeleton,
  OutfitCardSkeletonEnhanced,
  OutfitSkeletonGridEnhanced,
  ImageSkeleton,
  ProfileSkeleton,
  ChartSkeleton,
  TextSkeleton,
} from '@/components/ShimmerSkeleton';

// Enhanced Components
export { AnimatedButton } from '@/components/AnimatedButton';
export { EnhancedLikeButton } from '@/components/EnhancedLikeButton';
export { EnhancedOutfitCard, OutfitCardGrid } from '@/components/EnhancedOutfitCard';

// Mobile Gestures
export { SwipeableCard } from '@/components/SwipeableCard';
export { PullToRefresh } from '@/components/PullToRefresh';
export { ZoomableImage } from '@/components/ZoomableImage';

// Animations
export { AnimatedToast, useAnimatedToast } from '@/components/AnimatedToast';
export { PageTransition, ScrollReveal } from '@/components/PageTransition';

// Performance
export { VirtualizedList, VirtualizedGrid } from '@/components/VirtualizedList';
