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
import { Wand2, Heart, Palette, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import StarBorder from '@/components/StarBorder';

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
              <nav className="hidden md:flex items-center gap-3">
                <StarBorder
                  as={Link}
                  href="/style-check"
                  className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/50"
                  color="#a855f7"
                  speed="3s"
                  thickness={10}
                >
                  <div className="flex items-center gap-2 group">
                    <Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform duration-500 ease-out will-change-transform" style={{ color: '#a855f7' }} />
                    <span className="font-medium">Style Check</span>
                  </div>
                </StarBorder>
                
                <StarBorder
                  as={Link}
                  href="/color-match"
                  className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50"
                  color="#3b82f6"
                  speed="3s"
                  thickness={10}
                >
                  <div className="flex items-center gap-2 group">
                    <Palette className="w-4 h-4 group-hover:rotate-12 transition-all duration-500 ease-out will-change-transform" style={{ color: '#3b82f6' }} />
                    <span className="font-medium">Color Match</span>
                  </div>
                </StarBorder>
                
                <StarBorder
                  as={Link}
                  href="/likes"
                  className="cursor-pointer transition-all duration-500 ease-out hover:scale-105 hover:shadow-lg hover:shadow-red-500/50 will-change-transform"
                  color="#ef4444"
                  speed="3s"
                  thickness={10}
                >
                  <div className="flex items-center gap-2 group">
                    <Heart className="w-4 h-4 group-hover:scale-110 transition-all duration-500 ease-out will-change-transform" style={{ color: '#ef4444' }} />
                    <span className="font-medium">Likes</span>
                  </div>
                </StarBorder>

                <StarBorder
                  as={Link}
                  href="/wardrobe"
                  className="cursor-pointer transition-all duration-500 ease-out hover:scale-105 hover:shadow-lg hover:shadow-teal-500/50 will-change-transform"
                  color="#14b8a6"
                  speed="3s"
                  thickness={10}
                >
                  <div className="flex items-center gap-2 group">
                    <Shirt className="w-4 h-4 group-hover:scale-110 transition-all duration-500 ease-out will-change-transform" style={{ color: '#14b8a6' }} />
                    <span className="font-medium">Wardrobe</span>
                  </div>
                </StarBorder>
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

                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="hover:bg-teal-500/10 transition-colors"
                >
                  <Link href="/wardrobe" title="Your Wardrobe">
                    <Shirt className="w-5 h-5 text-teal-500" />
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
