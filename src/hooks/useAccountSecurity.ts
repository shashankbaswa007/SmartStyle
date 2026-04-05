'use client';

import { useMemo, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  multiFactor,
  updateEmail,
  updatePassword,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { logUxEvent } from '@/lib/ux-events';

interface SecurityActionResult {
  success: boolean;
  message: string;
  requiresReauth?: boolean;
}

interface UseAccountSecurityResult {
  providerId: string;
  isPasswordProvider: boolean;
  isGoogleProvider: boolean;
  mfaFactorCount: number;
  mfaMethods: string[];
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newEmail: string;
  setNewEmail: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  reauthenticating: boolean;
  updatingEmail: boolean;
  updatingPassword: boolean;
  sendingResetLink: boolean;
  reauthenticate: () => Promise<SecurityActionResult>;
  updateEmailAddress: () => Promise<SecurityActionResult>;
  updatePasswordValue: () => Promise<SecurityActionResult>;
  sendResetLink: () => Promise<SecurityActionResult>;
}

function getAuthErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  if (!('code' in error)) return '';
  return String((error as { code?: unknown }).code || '');
}

function providerLabelToMethod(providerId: string): string {
  if (providerId.includes('phone')) return 'Phone';
  if (providerId.includes('google')) return 'Google';
  if (providerId.includes('password')) return 'Password';
  return providerId;
}

export function useAccountSecurity(user: User | null): UseAccountSecurityResult {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reauthenticating, setReauthenticating] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [sendingResetLink, setSendingResetLink] = useState(false);

  const providerId = user?.providerData?.[0]?.providerId || 'unknown';
  const isPasswordProvider = providerId === 'password';
  const isGoogleProvider = providerId.includes('google');
  const isE2EBypassUser =
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === 'true' && user?.uid === 'e2e-bypass-user';

  const mfaMethods = useMemo(() => {
    if (isE2EBypassUser) {
      return [];
    }

    const factors = user ? multiFactor(user).enrolledFactors : [];
    return factors.map((factor) => providerLabelToMethod(factor.factorId));
  }, [isE2EBypassUser, user]);

  const reauthenticate = async (): Promise<SecurityActionResult> => {
    if (!user) {
      return { success: false, message: 'You must be signed in to re-authenticate.' };
    }

    setReauthenticating(true);
    void logUxEvent(user.uid, 'task_started', {
      flow: 'account_security_reauth',
      step: 'reauth_requested',
    });

    try {
      if (isE2EBypassUser) {
        if (currentPassword !== 'correct-password') {
          return {
            success: false,
            message: 'Current password is incorrect.',
            requiresReauth: true,
          };
        }

        return { success: true, message: 'Re-authentication successful.' };
      }

      if (isPasswordProvider) {
        if (!user.email || !currentPassword) {
          return {
            success: false,
            message: 'Current password is required for security changes.',
          };
        }

        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        return { success: true, message: 'Re-authentication successful.' };
      }

      if (isGoogleProvider) {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
        return { success: true, message: 'Google re-authentication successful.' };
      }

      return {
        success: false,
        message: 'This provider is not yet supported for in-app re-authentication.',
      };
    } catch (error) {
      const code = getAuthErrorCode(error);
      void logUxEvent(user.uid, 'error_shown', {
        flow: 'account_security_reauth',
        step: 'reauth_failed',
        reason: code || (error instanceof Error ? error.message : 'unknown'),
      });
      if (code === 'auth/wrong-password') {
        return {
          success: false,
          message: 'Current password is incorrect.',
          requiresReauth: true,
        };
      }
      if (code === 'auth/popup-closed-by-user') {
        return { success: false, message: 'Re-authentication popup was closed before completion.' };
      }
      return { success: false, message: 'Re-authentication failed. Please try again.' };
    } finally {
      void logUxEvent(user.uid, 'task_completed', {
        flow: 'account_security_reauth',
        step: 'reauth_finished',
        success: true,
      });
      setReauthenticating(false);
    }
  };

  const updateEmailAddress = async (): Promise<SecurityActionResult> => {
    if (!user) {
      return { success: false, message: 'You must be signed in to update email.' };
    }

    if (!newEmail.trim()) {
      return { success: false, message: 'New email is required.' };
    }

    if (!newEmail.includes('@')) {
      return { success: false, message: 'Please provide a valid email address.' };
    }

    setUpdatingEmail(true);
    void logUxEvent(user.uid, 'task_started', {
      flow: 'account_security_email_update',
      step: 'email_update_requested',
    });

    try {
      if (isGoogleProvider && !isE2EBypassUser) {
        return {
          success: false,
          message: 'Google-managed accounts should update email through Google Account settings.',
        };
      }

      const reauthResult = await reauthenticate();
      if (!reauthResult.success) {
        return {
          success: false,
          message: reauthResult.message,
          requiresReauth: reauthResult.requiresReauth,
        };
      }

      if (isE2EBypassUser) {
        setNewEmail('');
        return { success: true, message: 'Email updated successfully.' };
      }

      await updateEmail(user, newEmail.trim());
      setNewEmail('');
      return { success: true, message: 'Email updated successfully.' };
    } catch (error) {
      const code = getAuthErrorCode(error);
      void logUxEvent(user.uid, 'error_shown', {
        flow: 'account_security_email_update',
        step: 'email_update_failed',
        reason: code || (error instanceof Error ? error.message : 'unknown'),
      });

      if (code === 'auth/requires-recent-login') {
        return {
          success: false,
          message: 'Please re-authenticate before updating your email.',
          requiresReauth: true,
        };
      }
      if (code === 'auth/email-already-in-use') {
        return { success: false, message: 'This email is already in use by another account.' };
      }
      return { success: false, message: 'Unable to update email right now.' };
    } finally {
      void logUxEvent(user.uid, 'task_completed', {
        flow: 'account_security_email_update',
        step: 'email_update_finished',
        success: true,
      });
      setUpdatingEmail(false);
    }
  };

  const updatePasswordValue = async (): Promise<SecurityActionResult> => {
    if (!user) {
      return { success: false, message: 'You must be signed in to update password.' };
    }

    if (!newPassword) {
      return { success: false, message: 'New password is required.' };
    }

    if (newPassword.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters.' };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, message: 'New password and confirmation do not match.' };
    }

    setUpdatingPassword(true);
    void logUxEvent(user.uid, 'task_started', {
      flow: 'account_security_password_update',
      step: 'password_update_requested',
    });

    try {
      const reauthResult = await reauthenticate();
      if (!reauthResult.success) {
        return {
          success: false,
          message: reauthResult.message,
          requiresReauth: reauthResult.requiresReauth,
        };
      }

      if (isE2EBypassUser) {
        setNewPassword('');
        setConfirmPassword('');
        return { success: true, message: 'Password updated successfully.' };
      }

      await updatePassword(user, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      return { success: true, message: 'Password updated successfully.' };
    } catch (error) {
      const code = getAuthErrorCode(error);
      void logUxEvent(user.uid, 'error_shown', {
        flow: 'account_security_password_update',
        step: 'password_update_failed',
        reason: code || (error instanceof Error ? error.message : 'unknown'),
      });

      if (code === 'auth/requires-recent-login') {
        return {
          success: false,
          message: 'Please re-authenticate before updating your password.',
          requiresReauth: true,
        };
      }
      if (code === 'auth/weak-password') {
        return { success: false, message: 'Please choose a stronger password.' };
      }
      return { success: false, message: 'Unable to update password right now.' };
    } finally {
      void logUxEvent(user.uid, 'task_completed', {
        flow: 'account_security_password_update',
        step: 'password_update_finished',
        success: true,
      });
      setUpdatingPassword(false);
    }
  };

  const sendResetLink = async (): Promise<SecurityActionResult> => {
    if (!user?.email) {
      return { success: false, message: 'No email is associated with this account.' };
    }

    setSendingResetLink(true);
    try {
      if (isE2EBypassUser) {
        return { success: true, message: 'Password reset link sent to your email.' };
      }

      await sendPasswordResetEmail(auth, user.email);
      return { success: true, message: 'Password reset link sent to your email.' };
    } catch {
      return { success: false, message: 'Failed to send reset link. Please try again.' };
    } finally {
      setSendingResetLink(false);
    }
  };

  return {
    providerId,
    isPasswordProvider,
    isGoogleProvider,
    mfaFactorCount: mfaMethods.length,
    mfaMethods,
    currentPassword,
    setCurrentPassword,
    newEmail,
    setNewEmail,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    reauthenticating,
    updatingEmail,
    updatingPassword,
    sendingResetLink,
    reauthenticate,
    updateEmailAddress,
    updatePasswordValue,
    sendResetLink,
  };
}
