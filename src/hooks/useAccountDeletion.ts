'use client';

import { useState } from 'react';
import type { User } from 'firebase/auth';
import { logUxEvent } from '@/lib/ux-events';

interface DeleteAccountResult {
  success: boolean;
  message: string;
  requiresReauth: boolean;
}

interface UseAccountDeletionResult {
  deleting: boolean;
  deleteAccount: () => Promise<DeleteAccountResult>;
}

export function useAccountDeletion(user: User | null): UseAccountDeletionResult {
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async (): Promise<DeleteAccountResult> => {
    if (!user) {
      return {
        success: false,
        message: 'You must be signed in to delete your account.',
        requiresReauth: false,
      };
    }

    setDeleting(true);
    let wasSuccessful = false;
    void logUxEvent(user.uid, 'task_started', {
      flow: 'account_deletion',
      step: 'account_deletion_requested',
    });

    try {
      await user.delete();
      wasSuccessful = true;

      return {
        success: true,
        message: 'Your account has been permanently deleted.',
        requiresReauth: false,
      };
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

      if (code === 'auth/requires-recent-login') {
        void logUxEvent(user.uid, 'error_shown', {
          flow: 'account_deletion',
          step: 'account_deletion_requires_reauth',
          reason: code,
        });
        return {
          success: false,
          message: 'Please sign out and sign in again to delete your account.',
          requiresReauth: true,
        };
      }

      void logUxEvent(user.uid, 'error_shown', {
        flow: 'account_deletion',
        step: 'account_deletion_failed',
        reason: code || (error instanceof Error ? error.message : 'unknown'),
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete account',
        requiresReauth: false,
      };
    } finally {
      void logUxEvent(user.uid, 'task_completed', {
        flow: 'account_deletion',
        step: 'account_deletion_finished',
        success: wasSuccessful,
      });
      setDeleting(false);
    }
  };

  return {
    deleting,
    deleteAccount,
  };
}
