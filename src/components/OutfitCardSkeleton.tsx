/**
 * Outfit Card Skeleton Loader
 * 
 * Skeleton component for outfit cards with shimmer animation
 */

import { Skeleton } from "./ui/skeleton";

export function OutfitCardSkeleton() {
  return (
    <div className="relative group">
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
        {/* Image skeleton */}
        <div className="relative h-80 bg-muted overflow-hidden">
          <Skeleton className="h-full w-full shimmer" />
        </div>

        {/* Content skeleton */}
        <div className="p-6 space-y-4">
          {/* Title skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4 shimmer" />
            <Skeleton className="h-4 w-full shimmer" />
            <Skeleton className="h-4 w-5/6 shimmer" />
          </div>

          {/* Color palette skeleton */}
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-8 w-8 rounded-full shimmer" />
            <Skeleton className="h-8 w-8 rounded-full shimmer" />
            <Skeleton className="h-8 w-8 rounded-full shimmer" />
            <Skeleton className="h-8 w-8 rounded-full shimmer" />
          </div>

          {/* Items skeleton */}
          <div className="space-y-2 mt-4">
            <Skeleton className="h-4 w-full shimmer" />
            <Skeleton className="h-4 w-4/5 shimmer" />
            <Skeleton className="h-4 w-3/4 shimmer" />
          </div>

          {/* Buttons skeleton */}
          <div className="flex gap-2 mt-6">
            <Skeleton className="h-10 flex-1 rounded-lg shimmer" />
            <Skeleton className="h-10 w-10 rounded-lg shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Three skeleton cards layout
 */
export function OutfitSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-7xl mx-auto px-4">
      <OutfitCardSkeleton />
      <OutfitCardSkeleton />
      <OutfitCardSkeleton />
    </div>
  );
}
