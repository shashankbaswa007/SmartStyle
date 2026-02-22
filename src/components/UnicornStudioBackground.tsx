'use client';

import { useEffect, useRef, useState } from 'react';

interface UnicornStudioBackgroundProps {
  projectId: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

declare global {
  interface Window {
    UnicornStudio?: {
      isInitialized: boolean;
      init: () => void;
    };
  }
}

export default function UnicornStudioBackground({
  projectId,
  width = '100%',
  height = '100%',
  className = '',
}: UnicornStudioBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (scriptLoadedRef.current) return;

    const loadUnicornStudio = () => {
      if (!window.UnicornStudio) {
        window.UnicornStudio = { isInitialized: false, init: () => {} };

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.33/dist/unicornStudio.umd.js';
        script.async = true;
        
        script.onload = () => {
          if (window.UnicornStudio && !window.UnicornStudio.isInitialized) {
            window.UnicornStudio.init();
            window.UnicornStudio.isInitialized = true;
          }
          setIsLoaded(true);
        };

        script.onerror = () => {
          setIsLoaded(true); // Still show the page even if animation fails
        };

        (document.head || document.body).appendChild(script);
        scriptLoadedRef.current = true;
      } else {
        if (!window.UnicornStudio.isInitialized) {
          window.UnicornStudio.init();
          window.UnicornStudio.isInitialized = true;
        }
        setIsLoaded(true);
      }
    };

    loadUnicornStudio();
  }, []);

  return (
    <>
      {/* Loading fallback with gradient animation */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-pink-600/20 to-blue-600/20 animate-pulse" />
      )}
      
      {/* UnicornStudio container */}
      <div
        ref={containerRef}
        data-us-project={projectId}
        className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
        }}
      />
    </>
  );
}
