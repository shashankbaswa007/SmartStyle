'use client';

/**
 * Account Settings Page
 * 
 * Allows users to:
 * - View and edit profile information
 * - Update display name
 * - View email and authentication provider
 * - Delete account (with confirmation)
 */

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAccountProfileEditor } from '@/hooks/useAccountProfileEditor';
import { useAccountDeletion } from '@/hooks/useAccountDeletion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { 
  Loader2, 
  User, 
  Mail, 
  Shield, 
  Calendar,
  ArrowLeft,
  Save,
  Trash2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function AccountSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { displayName, setDisplayName, saving, saveProfile } = useAccountProfileEditor(user);
  const { deleting, deleteAccount } = useAccountDeletion(user);

  /**
   * Handle profile update
   * - Updates Firebase Auth profile
   * - Updates Firestore user document
   */
  const handleSaveProfile = async () => {
    const result = await saveProfile();

    if (result.success) {
      toast({
        title: 'Profile Updated',
        description: result.message,
      });
      return;
    }

    toast({
      variant: 'destructive',
      title: 'Update Failed',
      description: result.message,
    });
  };

  /**
   * Handle account deletion
   * - Deletes user from Firebase Auth
   * - Signs out and redirects to auth page
   * Note: Firestore cleanup should be done via Cloud Function
   */
  const handleDeleteAccount = async () => {
    const result = await deleteAccount();

    if (result.success) {
      toast({
        title: 'Account Deleted',
        description: result.message,
      });
      router.push('/auth');
      return;
    }

    if (result.requiresReauth) {
      toast({
        variant: 'destructive',
        title: 'Re-authentication Required',
        description: result.message,
      });
      return;
    }

    toast({
      variant: 'destructive',
      title: 'Deletion Failed',
      description: result.message,
    });
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if user is not authenticated
  if (!user) {
    return null;
  }

  // Get user initials for avatar fallback
  const userInitials = user.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user.email?.charAt(0).toUpperCase() || 'U';

  // Get provider display name
  const providerName = user.providerData[0]?.providerId?.includes('google')
    ? 'Google'
    : 'Email';

  // Format creation date
  const createdAt = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </motion.div>

        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            Account Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your profile and account preferences
          </p>
        </motion.div>

        <div className="grid gap-6">
          {/* Profile Information Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and profile photo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-accent/20">
                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-2xl font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Your profile photo is managed by your {providerName} account
                    </p>
                  </div>
                </div>

                {/* Display Name */}
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="max-w-md"
                  />
                </div>

                {/* Email (Read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="email"
                      value={user.email || ''}
                      disabled
                      className="max-w-md"
                    />
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed directly. Managed by {providerName}.
                  </p>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving || !displayName.trim()}
                  className="bg-gradient-to-r from-accent to-primary"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Account Information Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Account Information
                </CardTitle>
                <CardDescription>
                  View your account details and authentication method
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Authentication Provider */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-accent/5 border border-accent/10">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Authentication Provider</p>
                      <p className="text-sm text-muted-foreground">{providerName}</p>
                    </div>
                  </div>
                </div>

                {/* Account Created */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-accent/5 border border-accent/10">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Member Since</p>
                      <p className="text-sm text-muted-foreground">{createdAt}</p>
                    </div>
                  </div>
                </div>

                {/* User ID (for debugging) */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-accent/5 border border-accent/10">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">User ID</p>
                      <p className="text-xs text-muted-foreground font-mono">{user.uid}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Danger Zone Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions that affect your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                    <div>
                      <h3 className="font-semibold text-destructive">Delete Account</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deleting}
                        >
                          {deleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Delete'
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account
                            and remove all your data from our servers, including:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>Profile information</li>
                              <li>Style recommendations</li>
                              <li>All saved preferences</li>
                            </ul>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAccount}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Yes, Delete My Account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
