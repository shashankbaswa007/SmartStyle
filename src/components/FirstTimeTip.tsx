'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Info, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface FirstTimeTipProps {
  storageKey: string;
  title: string;
  description: string;
  bullets?: string[];
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}

export default function FirstTimeTip({
  storageKey,
  title,
  description,
  bullets = [],
  actionHref,
  actionLabel,
  className,
}: FirstTimeTipProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDismissed(localStorage.getItem(storageKey) === '1');
  }, [storageKey]);

  const shouldShow = useMemo(() => !dismissed, [dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, '1');
    }
  };

  if (!shouldShow) return null;

  return (
    <Alert className={className}>
      <Info className="h-4 w-4" />
      <div className="flex w-full items-start justify-between gap-4">
        <div className="min-w-0">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription className="mt-1 space-y-2">
            <p>{description}</p>
            {bullets.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
            {actionHref && actionLabel && (
              <Button asChild size="sm" variant="outline" className="mt-1">
                <Link href={actionHref}>{actionLabel}</Link>
              </Button>
            )}
          </AlertDescription>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleDismiss}
          aria-label="Dismiss tip"
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
