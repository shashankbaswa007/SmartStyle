'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface PageStatusAlertProps {
  title: string;
  description: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  retryDisabled?: boolean;
  retryLabel?: string;
  className?: string;
}

export default function PageStatusAlert({
  title,
  description,
  onRetry,
  isRetrying = false,
  retryDisabled = false,
  retryLabel = 'Retry',
  className,
}: PageStatusAlertProps) {
  return (
    <div className={className}>
      <Alert variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
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
