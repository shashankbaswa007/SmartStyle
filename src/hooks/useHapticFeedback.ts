/**
 * Custom hook for haptic feedback on mobile devices
 * Provides tactile responses for key interactions
 */
import { useCallback } from 'react';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error';

export const useHapticFeedback = () => {
  const triggerHaptic = useCallback((pattern: HapticPattern = 'light') => {
    // Check if the Vibration API is supported
    if (!navigator.vibrate) {
      return;
    }

    // Different vibration patterns for different feedback types
    const patterns: Record<HapticPattern, number | number[]> = {
      light: 10,
      medium: 30,
      heavy: 50,
      success: [10, 50, 10], // Double tap pattern
      error: [50, 100, 50], // Strong double pulse
    };

    try {
      navigator.vibrate(patterns[pattern]);
    } catch (error) {
      // Silently fail if vibration is not supported or blocked
    }
  }, []);

  return { triggerHaptic };
};
