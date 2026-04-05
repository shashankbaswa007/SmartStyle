'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { LoadableError, LoadableStatus } from '@/lib/loadable-state';

interface AsyncFlowStateProps {
  status: LoadableStatus;
  title?: string;
  description?: string;
  error?: LoadableError | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  retryDisabled?: boolean;
  retryLabel?: string;
  loadingLabel?: string;
  className?: string;
}

export default function AsyncFlowState({
  status,
  title,
  description,
  error,
  onRetry,
  isRetrying = false,
  retryDisabled = false,
  retryLabel = 'Retry',
  loadingLabel = 'Loading...',
  className,
}: AsyncFlowStateProps) {
  if (status !== 'error' && status !== 'loading' && status !== 'retrying') {
    return null;
  }

  if (status === 'loading' || status === 'retrying') {
    return (
      <div className={className}>
        <Alert>
          <AlertTitle>{title || 'Loading'}</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingLabel}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const resolvedTitle = title || 'Something went wrong';
  const resolvedDescription = error?.message || description || 'Please try again.';

  return (
    <div className={className}>
      <Alert variant="destructive">
        <AlertTitle>{resolvedTitle}</AlertTitle>
        <AlertDescription>{resolvedDescription}</AlertDescription>
      </Alert>
      {onRetry && (
        <div className="mt-3 flex justify-center">
          <Button onClick={onRetry} disabled={retryDisabled || isRetrying}>
            {isRetrying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              retryLabel
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
