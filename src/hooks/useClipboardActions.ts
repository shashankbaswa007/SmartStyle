'use client';

import { useCallback, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseClipboardActionsResult {
  copiedValue: string | null;
  copyToClipboard: (text: string, label: string) => Promise<boolean>;
}

export function useClipboardActions(resetAfterMs: number = 2000): UseClipboardActionsResult {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setCopiedValue(text);
      timeoutRef.current = setTimeout(() => {
        setCopiedValue(null);
      }, resetAfterMs);

      toast({
        title: 'Copied!',
        description: `${label} copied to clipboard`,
      });

      return true;
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to copy',
        description: 'Could not copy to clipboard',
      });
      return false;
    }
  }, [resetAfterMs, toast]);

  return {
    copiedValue,
    copyToClipboard,
  };
}
