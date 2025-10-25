'use client';

/**
 * User Profile Dropdown - Top-right corner navigation
 * 
 * Features:
 * - User avatar with profile photo
 * - Dropdown menu with Account Settings and Sign Out
 * - Smooth animations and transitions
 * - Handles sign-out with confirmation
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthProvider';
import { signOut } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Settings, Loader2, BarChart3, Wand2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function UserProfileDropdown() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  /**
   * Handle sign-out action
   * - Signs user out from Firebase
   * - Redirects to authentication page
   * - Shows confirmation toast
   */
  const handleSignOut = async () => {
    setSignOutLoading(true);
    
    try {
      const { success, error } = await signOut();
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Sign Out Failed',
          description: error,
        });
        setSignOutLoading(false);
        return;
      }

      if (success) {
        toast({
          title: 'Signed Out',
          description: 'You have been signed out successfully',
        });
        
        // Redirect to auth page
        router.push('/auth');
      }
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred',
      });
      setSignOutLoading(false);
    }
  };

  /**
   * Handle account settings navigation
   * Navigates to the account settings page
   */
  const handleAccountSettings = () => {
    setDropdownOpen(false);
    router.push('/account-settings');
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center w-10 h-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't show dropdown if user is not authenticated
  if (!user) {
    return null;
  }

  // Get user initials for avatar fallback
  const userInitials = user.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all"
        >
          <Avatar className="h-10 w-10 border-2 border-accent/20 hover:border-accent/40 transition-colors cursor-pointer">
            <AvatarImage 
              src={user.photoURL || undefined} 
              alt={user.displayName || 'User'} 
            />
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </motion.button>
      </DropdownMenuTrigger>

      <AnimatePresence>
        {dropdownOpen && (
          <DropdownMenuContent
            align="end"
            className="w-64 mt-2"
            asChild
            forceMount
          >
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {/* User Info Section */}
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none">
                    {user.displayName || 'User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {/* Navigation Links */}
              <DropdownMenuItem
                onClick={() => {
                  setDropdownOpen(false);
                  router.push('/style-check');
                }}
                className="cursor-pointer"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                <span>Style Check</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setDropdownOpen(false);
                  router.push('/analytics');
                }}
                className="cursor-pointer"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                <span>Analytics</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Account Settings */}
              <DropdownMenuItem
                onClick={handleAccountSettings}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Account Settings</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Sign Out */}
              <DropdownMenuItem
                onClick={handleSignOut}
                disabled={signOutLoading}
                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                {signOutLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </>
                )}
              </DropdownMenuItem>
            </motion.div>
          </DropdownMenuContent>
        )}
      </AnimatePresence>
    </DropdownMenu>
  );
}
