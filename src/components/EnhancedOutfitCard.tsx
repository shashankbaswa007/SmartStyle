/**
 * Enhanced Outfit Card with Smooth Animations
 * Features: stagger effect, lift on hover, image zoom, GPU acceleration
 */
'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { cardVariants, imageZoomVariants } from '@/lib/animation-config';

interface EnhancedOutfitCardProps {
  children: React.ReactNode;
  imageUrl?: string;
  imageAlt?: string;
  className?: string;
  delay?: number;
  /** Mark as true for the first visible card to prioritise image loading */
  priority?: boolean;
  onHover?: () => void;
  onClick?: () => void;
}

// Tiny 4×5 blurred gradient — eliminates the white flash while real image loads
const BLUR_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAFCAIAAADtz6aMAAAAJ0lEQVQI12N4/fY9AwMDIwMDAwMD49Onz/4zMDAwABkMQAIoBwAcqQkVlFp3bAAAAABJRU5ErkJggg==';

export const EnhancedOutfitCard = React.memo<EnhancedOutfitCardProps>(
  ({ children, imageUrl, imageAlt = '', className, delay = 0, priority = false, onHover, onClick }) => {
    return (
      <motion.div
        className={cn(
          'w-full bg-card rounded-xl border border-border overflow-hidden shadow-sm',
          'card-lift-effect',
          'contain-layout-paint', // CSS containment for performance
          className
        )}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        whileHover="hover"
        transition={{ delay }}
        onMouseEnter={onHover}
        onClick={onClick}
        style={{
          willChange: 'transform, box-shadow',
        }}
      >
        {imageUrl && (
          <div className="relative w-full aspect-[3/4] image-zoom-container">
            <motion.div
              className="image-zoom-effect w-full h-full"
              variants={imageZoomVariants}
              initial="initial"
              whileHover="hover"
            >
              <Image
                src={imageUrl}
                alt={imageAlt}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover transition-opacity duration-300"
                loading={priority ? 'eager' : 'lazy'}
                priority={priority}
                quality={80}
                placeholder="blur"
                blurDataURL={BLUR_PLACEHOLDER}
              />
            </motion.div>
          </div>
        )}
        
        <div className="p-4">{children}</div>
      </motion.div>
    );
  }
);

EnhancedOutfitCard.displayName = 'EnhancedOutfitCard';

/**
 * Container for outfit cards with stagger animation
 */
interface OutfitCardGridProps {
  children: React.ReactNode;
  className?: string;
}

export const OutfitCardGrid: React.FC<OutfitCardGridProps> = ({ children, className }) => {
  return (
    <motion.div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
        className
      )}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
            delayChildren: 0.05,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
};
