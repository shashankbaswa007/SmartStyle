/**
 * Custom hook for optimistic UI updates
 * Updates UI immediately before API call completes for instant feedback
 */
import { useState, useCallback } from 'react';

interface UseOptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  rollbackDelay?: number;
}

export const useOptimisticUpdate = <T,>(
  initialValue: T,
  options: UseOptimisticUpdateOptions<T> = {}
) => {
  const { onSuccess, onError, rollbackDelay = 3000 } = options;
  const [value, setValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(
    async (
      optimisticValue: T,
      asyncOperation: () => Promise<T>
    ): Promise<void> => {
      // Immediately update UI (optimistic)
      const previousValue = value;
      setValue(optimisticValue);
      setIsLoading(true);
      setError(null);

      try {
        // Perform actual async operation
        const result = await asyncOperation();
        setValue(result);
        setIsLoading(false);
        onSuccess?.(result);
      } catch (err) {
        // Rollback to previous value on error
        setTimeout(() => {
          setValue(previousValue);
        }, rollbackDelay);
        
        const error = err instanceof Error ? err : new Error('Update failed');
        setError(error);
        setIsLoading(false);
        onError?.(error);
      }
    },
    [value, onSuccess, onError, rollbackDelay]
  );

  return { value, isLoading, error, update };
};
