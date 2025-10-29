'use client';

/**
 * Header Navigation Component
 * 
 * Features:
 * - App logo/title
 * - Navigation buttons for main features (only for authenticated users)
 * - User profile dropdown
 * - Prevents navigation when not authenticated
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserProfileDropdown } from '@/components/auth/UserProfileDropdown';
import { useAuth } from '@/components/auth/AuthProvider';
import { Wand2, Heart, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const handleProtectedNavigation = (e: React.MouseEvent, href: string) => {
    if (!user) {
      e.preventDefault();
      toast({
        variant: 'destructive',
        title: 'Authentication Required',
        description: 'Please sign in to access this page.',
      });
      router.push('/auth');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-2 text-2xl font-bold font-headline text-foreground transition-colors hover:text-accent z-10"
          >
            <Wand2 className="w-6 h-6 text-accent" />
            SmartStyle
          </Link>

          {/* Right side: Navigation + Profile */}
          <div className="flex items-center gap-6">
            {/* Desktop Navigation - Only show if authenticated */}
            {user ? (
              <nav className="hidden md:flex items-center gap-4">
                <Button
                  asChild
                  variant="ghost"
                  className="hover:bg-accent/10 transition-colors"
                >
                  <Link href="/style-check">
                    <Wand2 className="w-4 h-4 mr-2" />
                    Style Check
                  </Link>
                </Button>
                
                <Button
                  asChild
                  variant="ghost"
                  className="hover:bg-purple-500/10 transition-colors"
                >
                  <Link href="/color-match">
                    <Palette className="w-4 h-4 mr-2" />
                    Color Match
                  </Link>
                </Button>
                
                <Button
                  asChild
                  variant="ghost"
                  className="hover:bg-red-500/10 transition-colors"
                >
                  <Link href="/likes">
                    <Heart className="w-4 h-4 mr-2" />
                    Likes
                  </Link>
                </Button>
              </nav>
            ) : (
              <div className="hidden md:block">
                <Button
                  variant="outline"
                  onClick={() => router.push('/auth')}
                  className="border-accent/30 hover:border-accent hover:bg-accent/10"
                >
                  Sign In to Access Features
                </Button>
              </div>
            )}

            {/* Mobile Navigation - Icon Only - Only show if authenticated */}
            {user ? (
              <div className="flex md:hidden items-center gap-3">
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="hover:bg-accent/10 transition-colors"
                >
                  <Link href="/style-check" title="Style Check">
                    <Wand2 className="w-5 h-5 text-accent" />
                  </Link>
                </Button>
                
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="hover:bg-purple-500/10 transition-colors"
                >
                  <Link href="/color-match" title="Color Match">
                    <Palette className="w-5 h-5 text-purple-500" />
                  </Link>
                </Button>
                
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="hover:bg-red-500/10 transition-colors"
                >
                  <Link href="/likes" title="Your Likes">
                    <Heart className="w-5 h-5 text-red-500" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex md:hidden">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/auth')}
                  className="border-accent/30 hover:border-accent hover:bg-accent/10"
                >
                  Sign In
                </Button>
              </div>
            )}

            {/* User Profile Dropdown */}
            <UserProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}
