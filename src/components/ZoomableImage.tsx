/**
 * Zoomable Image Component
 * Implements pinch-to-zoom with smooth animations
 */
'use client';

import * as React from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ZoomableImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  enableFullscreen?: boolean;
}

export const ZoomableImage: React.FC<ZoomableImageProps> = ({
  src,
  alt,
  width = 800,
  height = 1000,
  className,
  enableFullscreen = true,
}) => {
  const { triggerHaptic } = useHapticFeedback();
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const openFullscreen = React.useCallback(() => {
    setIsFullscreen(true);
    triggerHaptic('light');
  }, [triggerHaptic]);

  const closeFullscreen = React.useCallback(() => {
    setIsFullscreen(false);
    triggerHaptic('light');
  }, [triggerHaptic]);

  return (
    <>
      {/* Regular image with click to zoom */}
      <div
        className={cn('relative cursor-zoom-in', className)}
        onClick={enableFullscreen ? openFullscreen : undefined}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="rounded-lg"
        />
        {enableFullscreen && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white p-2 rounded-full">
            <Maximize2 size={20} />
          </div>
        )}
      </div>

      {/* Fullscreen zoomable view */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeFullscreen}
          >
            {/* Close button */}
            <button
              className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors"
              onClick={closeFullscreen}
            >
              <X size={24} />
            </button>

            {/* Zoomable image */}
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit
              wheel={{ step: 0.1 }}
              pinch={{ step: 5 }}
              doubleClick={{ mode: 'toggle', step: 0.5 }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* Zoom controls */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-white/10 backdrop-blur-sm p-2 rounded-full">
                    <button
                      className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        zoomOut();
                        triggerHaptic('light');
                      }}
                    >
                      <ZoomOut size={20} />
                    </button>
                    <button
                      className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetTransform();
                        triggerHaptic('light');
                      }}
                    >
                      <Maximize2 size={20} />
                    </button>
                    <button
                      className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        zoomIn();
                        triggerHaptic('light');
                      }}
                    >
                      <ZoomIn size={20} />
                    </button>
                  </div>

                  <TransformComponent
                    wrapperStyle={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Image
                      src={src}
                      alt={alt}
                      width={width}
                      height={height}
                      className="max-w-full max-h-full object-contain"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
