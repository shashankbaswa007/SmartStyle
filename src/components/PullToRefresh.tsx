/**
 * Pull to Refresh Component
 * Implements native-like pull-to-refresh with rubber band physics
 */
'use client';

import * as React from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  className?: string;
}

const PULL_THRESHOLD = 80;
const MAX_PULL = 150;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  threshold = PULL_THRESHOLD,
  className,
}) => {
  const { triggerHaptic } = useHapticFeedback();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [canRefresh, setCanRefresh] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);

  // Transform pull distance to indicator opacity and rotation
  const indicatorOpacity = useTransform(y, [0, threshold], [0, 1]);
  const indicatorRotate = useTransform(y, [0, threshold], [0, 180]);
  const indicatorScale = useTransform(y, [0, threshold, MAX_PULL], [0.5, 1, 1.2]);

  const handleDragStart = React.useCallback(() => {
    // Only allow pull to refresh when at the top of the page
    const scrollTop = containerRef.current?.scrollTop || window.scrollY;
    return scrollTop === 0;
  }, []);

  const handleDrag = React.useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset } = info;
      
      // Check if we've reached the refresh threshold
      if (offset.y >= threshold && !canRefresh && !isRefreshing) {
        setCanRefresh(true);
        triggerHaptic('medium');
      } else if (offset.y < threshold && canRefresh) {
        setCanRefresh(false);
        triggerHaptic('light');
      }
    },
    [threshold, canRefresh, isRefreshing, triggerHaptic]
  );

  const handleDragEnd = React.useCallback(
    async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const { offset } = info;

      if (offset.y >= threshold && !isRefreshing) {
        // Trigger refresh
        setIsRefreshing(true);
        triggerHaptic('success');
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setCanRefresh(false);
        }
      }
    },
    [threshold, isRefreshing, onRefresh, triggerHaptic]
  );

  return (
    <motion.div
      ref={containerRef}
      className={cn('relative', className)}
      style={{ y }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.4, bottom: 0 }}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
    >
      {/* Pull indicator */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 top-0 -translate-y-full pb-4 flex items-center justify-center"
        style={{
          opacity: indicatorOpacity,
          scale: indicatorScale,
        }}
      >
        <div className="bg-primary text-primary-foreground rounded-full p-3 shadow-lg">
          {isRefreshing ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <motion.div style={{ rotate: indicatorRotate }}>
              <ArrowDown size={24} />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Content */}
      <div className={cn(isRefreshing && 'pointer-events-none opacity-70')}>
        {children}
      </div>
    </motion.div>
  );
};
