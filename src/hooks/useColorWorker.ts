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

  useEffect(() => {
    // Initialize worker
    try {
      workerRef.current = new Worker(
        new URL('/workers/color-extraction.worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch (error) {
      console.error('Failed to initialize color worker:', error);
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

        const handleMessage = (event: MessageEvent<ColorWorkerResponse>) => {
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

        const handleMessage = (event: MessageEvent<ColorWorkerResponse>) => {
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

  return { extractColors, analyzeColorHarmony };
};
