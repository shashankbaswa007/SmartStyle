/**
 * Performance Monitoring Utilities
 * Tracks Web Vitals and application performance metrics
 */

import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

// Performance budgets
export const PERFORMANCE_BUDGETS = {
  BUNDLE_SIZE: 200 * 1024, // 200KB
  LCP: 2500, // 2.5s - Largest Contentful Paint
  FID: 100, // 100ms - First Input Delay
  CLS: 0.1, // 0.1 - Cumulative Layout Shift
  TTFB: 600, // 600ms - Time to First Byte
  FCP: 1800, // 1.8s - First Contentful Paint
} as const;

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id?: string;
}

interface PerformanceLog {
  metric: string;
  value: number;
  rating: string;
  url: string;
  userAgent: string;
  timestamp: Timestamp;
  sessionId: string;
}

// Generate session ID (persist across page loads)
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = sessionStorage.getItem('performance_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('performance_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Log performance metric to Firestore (async, non-blocking)
 */
export async function logPerformanceMetric(metric: PerformanceMetric): Promise<void> {
  // Only log poor and needs-improvement metrics to reduce noise
  if (metric.rating === 'good') return;

  try {
    const perfLog: PerformanceLog = {
      metric: metric.name,
      value: Math.round(metric.value),
      rating: metric.rating,
      url: window.location.pathname,
      userAgent: navigator.userAgent,
      timestamp: Timestamp.now(),
      sessionId: getSessionId(),
    };

    // Log to Firestore asynchronously (don't await)
    addDoc(collection(db, 'performanceMetrics'), perfLog).catch(err => {
    });

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
    }
  } catch (error) {
    // Fail silently - don't impact user experience
  }
}

/**
 * Track Web Vitals (LCP, FID, CLS)
 * Call this from _app.tsx or layout.tsx
 */
export function reportWebVitals(metric: PerformanceMetric): void {
  // Determine rating based on metric thresholds
  const { name, value } = metric;
  let rating: 'good' | 'needs-improvement' | 'poor' = 'good';

  switch (name) {
    case 'LCP':
      rating = value > 4000 ? 'poor' : value > 2500 ? 'needs-improvement' : 'good';
      break;
    case 'FID':
      rating = value > 300 ? 'poor' : value > 100 ? 'needs-improvement' : 'good';
      break;
    case 'CLS':
      rating = value > 0.25 ? 'poor' : value > 0.1 ? 'needs-improvement' : 'good';
      break;
    case 'FCP':
      rating = value > 3000 ? 'poor' : value > 1800 ? 'needs-improvement' : 'good';
      break;
    case 'TTFB':
      rating = value > 1500 ? 'poor' : value > 600 ? 'needs-improvement' : 'good';
      break;
    default:
      rating = metric.rating;
  }

  logPerformanceMetric({ ...metric, rating });
}

/**
 * Measure API response time
 */
export function measureApiCall<T>(
  apiName: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  return apiCall().then(
    (result) => {
      const duration = performance.now() - startTime;
      
      if (duration > 2000) {
        // Log slow API calls (> 2s)
        logPerformanceMetric({
          name: `API_${apiName}`,
          value: duration,
          rating: duration > 5000 ? 'poor' : 'needs-improvement',
        });
      }

      if (process.env.NODE_ENV === 'development') {
      }

      return result;
    },
    (error) => {
      const duration = performance.now() - startTime;
      throw error;
    }
  );
}

/**
 * Measure color extraction performance
 */
export function measureColorExtraction(
  imageSize: number,
  duration: number
): void {
  if (duration > 1000) {
    // Log slow color extractions (> 1s)
    logPerformanceMetric({
      name: 'COLOR_EXTRACTION',
      value: duration,
      rating: duration > 3000 ? 'poor' : 'needs-improvement',
    });

  }
}

/**
 * Check if performance budget is exceeded
 */
export function checkPerformanceBudget(
  metric: keyof typeof PERFORMANCE_BUDGETS,
  value: number
): boolean {
  const budget = PERFORMANCE_BUDGETS[metric];
  const exceeded = value > budget;

  if (exceeded && process.env.NODE_ENV === 'development') {
  }

  return !exceeded;
}

/**
 * Preload critical resources
 */
export function preloadCriticalResources(): void {
  if (typeof window === 'undefined') return;

  // Preload critical fonts
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'font';
  link.crossOrigin = 'anonymous';
  link.href = '/fonts/inter-var.woff2';
  document.head.appendChild(link);
}

/**
 * Enable performance observer for monitoring
 */
export function enablePerformanceObserver(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    // Observe long tasks (> 50ms)
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          
          logPerformanceMetric({
            name: 'LONG_TASK',
            value: entry.duration,
            rating: entry.duration > 100 ? 'poor' : 'needs-improvement',
          });
        }
      }
    });

    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    // PerformanceObserver not supported
  }
}
