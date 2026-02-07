/**
 * Hook to use Color Extraction Web Worker
 * Keeps main thread free for smooth 60fps UI
 */
'use client';

import { useCallback, useRef, useEffect } from 'react';

interface ColorInfo {
  hex: string;
  rgb: [number, number, number];
  percentage: number;
}

interface ColorWorkerResponse {
  type: 'success' | 'error';
  data?: any;
  error?: string;
}

export const useColorWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const [workerAvailable, setWorkerAvailable] = useState(false);

  useEffect(() => {
    // Initialize worker
    try {
      workerRef.current = new Worker(
        new URL('/workers/color-extraction.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      // Test worker availability
      workerRef.current.postMessage({ type: 'ping' });
      
      const handleInit = (event: MessageEvent) => {
        if (event.data.type === 'pong' || event.data.type === 'success' || event.data.type === 'error') {
          setWorkerAvailable(true);
          workerRef.current?.removeEventListener('message', handleInit);
        }
      };
      
      workerRef.current.addEventListener('message', handleInit);
      
      // Set timeout for worker initialization
      setTimeout(() => {
        if (!workerAvailable) {
          console.warn('Color worker initialization timeout - worker may not be available');
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to initialize color worker:', error);
      setWorkerAvailable(false);
    }

    // Cleanup
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const extractColors = useCallback(
    (
      imageData: ImageData,
      options?: { maxColors?: number; quality?: number }
    ): Promise<ColorInfo[]> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        // Set timeout for worker response
        const timeoutId = setTimeout(() => {
          workerRef.current?.removeEventListener('message', handleMessage);
          reject(new Error('Color extraction timeout - operation took too long'));
        }, 10000); // 10 second timeout

        const handleMessage = (event: MessageEvent<ColorWorkerResponse>) => {
          clearTimeout(timeoutId);
          const { type, data, error } = event.data;
          
          if (type === 'success') {
            resolve(data);
          } else {
            reject(new Error(error || 'Color extraction failed'));
          }
          
          workerRef.current?.removeEventListener('message', handleMessage);
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.postMessage({
          type: 'extractColors',
          imageData,
          options,
        });
      });
    },
    []
  );

  const analyzeColorHarmony = useCallback(
    (colors: ColorInfo[]): Promise<{
      harmony: string;
      score: number;
      suggestions: string[];
    }> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        const timeoutId = setTimeout(() => {
          workerRef.current?.removeEventListener('message', handleMessage);
          reject(new Error('Color harmony analysis timeout'));
        }, 5000); // 5 second timeout

        const handleMessage = (event: MessageEvent<ColorWorkerResponse>) => {
          clearTimeout(timeoutId);
          const { type, data, error } = event.data;
          
          if (type === 'success') {
            resolve(data);
          } else {
            reject(new Error(error || 'Color harmony analysis failed'));
          }
          
          workerRef.current?.removeEventListener('message', handleMessage);
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.postMessage({
          type: 'analyzeColorHarmony',
          options: { colors },
        });
      });
    },
    []
  );

  return { extractColors, analyzeColorHarmony, workerAvailable };
};
