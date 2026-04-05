'use client';

import { useState } from 'react';
import type { User } from 'firebase/auth';

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

    try {
      await user.delete();

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
        return {
          success: false,
          message: 'Please sign out and sign in again to delete your account.',
          requiresReauth: true,
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete account',
        requiresReauth: false,
      };
    } finally {
      setDeleting(false);
    }
  };

  return {
    deleting,
    deleteAccount,
  };
}
