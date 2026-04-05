'use client';

import { useEffect, useState } from 'react';
import { updateProfile, type User } from 'firebase/auth';
import { updateUserProfile } from '@/lib/userService';

interface SaveProfileResult {
  success: boolean;
  message: string;
}

interface UseAccountProfileEditorResult {
  displayName: string;
  setDisplayName: (value: string) => void;
  saving: boolean;
  saveProfile: () => Promise<SaveProfileResult>;
}

export function useAccountProfileEditor(user: User | null): UseAccountProfileEditorResult {
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setDisplayName('');
      return;
    }

    setDisplayName(user.displayName || '');
  }, [user]);

  const saveProfile = async (): Promise<SaveProfileResult> => {
    if (!user) {
      return {
        success: false,
        message: 'You must be signed in to update your profile.',
      };
    }

    const nextDisplayName = displayName.trim();
    if (!nextDisplayName) {
      return {
        success: false,
        message: 'Display name cannot be empty.',
      };
    }

    setSaving(true);

    try {
      await updateProfile(user, {
        displayName: nextDisplayName,
      });

      await updateUserProfile(user.uid, {
        displayName: nextDisplayName,
        email: user.email || '',
        photoURL: user.photoURL || '',
        provider: 'google' as const,
        createdAt: '',
        lastLoginAt: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Your profile has been updated successfully.',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update profile',
      };
    } finally {
      setSaving(false);
    }
  };

  return {
    displayName,
    setDisplayName,
    saving,
    saveProfile,
  };
}
