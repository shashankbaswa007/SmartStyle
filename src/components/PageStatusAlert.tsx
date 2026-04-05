'use client';

import AsyncFlowState from '@/components/AsyncFlowState';

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
    <AsyncFlowState
      status="error"
      title={title}
      description={description}
      onRetry={onRetry}
      isRetrying={isRetrying}
      retryDisabled={retryDisabled}
      retryLabel={retryLabel}
      className={className}
    />
  );
}
