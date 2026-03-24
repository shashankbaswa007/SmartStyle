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
import dynamic from 'next/dynamic';
import { BrandedLogo } from '@/components/auth/BrandedLogo';
const StarBorder = dynamic(() => import('@/components/StarBorder'), { ssr: false });


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
            className="z-10 shrink-0 transition-opacity hover:opacity-95"
          >
            <BrandedLogo animatedRings={true} showWordmark showTagline className="origin-left scale-[0.82] sm:scale-[0.9]" />
          </Link>

          {/* Right side: Navigation + Profile */}
          <div className="flex items-center gap-2 sm:gap-6">
            {/* Desktop Navigation - Only show if authenticated */}
            {user ? (
              <nav className="hidden md:flex items-center gap-3">
                <StarBorder
                  as={Link}
                  href="/style-check"
                  className="group cursor-pointer rounded-full px-4 py-1.5 transition-all duration-300 hover:bg-white/3"
                  color="#8b5cf6"
                  speed="8s"
                  thickness={1}
                >
                  <div className="flex flex-row items-center justify-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 text-purple-400/80 transition-all duration-400 group-hover:scale-105 group-hover:text-purple-300/95"
                    >
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                    </svg>
                    <span className="text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
                      Style Check
                    </span>

                  </div>
                </StarBorder>
                
                <StarBorder
                  as={Link}
                  href="/color-match"
                  className="group cursor-pointer rounded-full px-4 py-1.5 transition-all duration-300 hover:bg-white/3"
                  color="#8b5cf6"
                  speed="8s"
                  thickness={1}
                >
                  <div className="flex flex-row items-center justify-center gap-2">
                    <Palette 
                      className="h-4 w-4 text-violet-400/80 transition-all duration-400 ease-out will-change-transform group-hover:scale-105 group-hover:text-violet-300/95" 
                    />
                    <span className="text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
                      Color Match
                    </span>
                  </div>
                </StarBorder>
                
                <StarBorder
                  as={Link}
                  href="/likes"
                  className="group cursor-pointer rounded-full px-4 py-1.5 transition-all duration-300 hover:bg-white/3"
                  color="#8b5cf6"
                  speed="8s"
                  thickness={1}
                >
                  <div className="flex flex-row items-center justify-center gap-2">
                    <Heart 
                      className="h-4 w-4 text-violet-400/80 fill-transparent transition-all duration-400 ease-in-out will-change-transform group-hover:scale-105 group-hover:fill-violet-400/70" 
                    />
                    
                    <span className="text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
                      Likes
                    </span>
                    
                  </div>
                </StarBorder>

                <StarBorder
                  as={Link}
                  href="/wardrobe"
                  className="group cursor-pointer rounded-full px-4 py-1.5 transition-all duration-300 hover:bg-white/3"
                  color="#8b5cf6"
                  speed="8s"
                  thickness={1}
                >
                  <div className="flex flex-row items-center justify-center gap-2">
                    <Shirt 
                      className="h-4 w-4 text-purple-400/80 fill-none transition-all duration-500 ease-out will-change-transform group-hover:scale-105 group-hover:text-purple-300/95 group-hover:fill-purple-500/20" 
                    />
                    <span className="text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
                      Wardrobe
                    </span>
                    
                  </div>
                </StarBorder>
              </nav>
            ) : (
              <div className="hidden md:block">
                <Button
                  variant="outline"
                  onClick={() => router.push('/auth')}
                  className="h-10 rounded-full border border-white/18 bg-slate-950/55 px-5 text-[12px] uppercase tracking-[0.14em] text-slate-100/90 shadow-[0_10px_24px_rgba(2,6,23,0.32)] backdrop-blur-md transition-all duration-300 hover:-translate-y-[1px] hover:border-teal-300/55 hover:bg-slate-900/70 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Enter Studio
                </Button>
              </div>
            )}

            {/* Mobile Navigation - Icon Only - Only show if authenticated */}
            {user ? (
              <div className="flex md:hidden items-center gap-1">
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-accent/10 transition-colors"
                >
                  <Link href="/style-check" title="Style Check">
                    <Wand2 className="w-4 h-4 text-accent" />
                  </Link>
                </Button>
                
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-purple-500/10 transition-colors"
                >
                  <Link href="/color-match" title="Color Match">
                    <Palette className="w-4 h-4 text-purple-500" />
                  </Link>
                </Button>
                
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-violet-500/10 transition-colors"
                >
                  <Link href="/likes" title="Your Likes">
                    <Heart className="w-4 h-4 text-violet-500" />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-purple-500/10 transition-colors"
                >
                  <Link href="/wardrobe" title="Your Wardrobe">
                    <Shirt className="w-4 h-4 text-purple-500" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex md:hidden">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/auth')}
                  className="rounded-full border border-white/18 bg-slate-950/55 px-3 text-[11px] uppercase tracking-[0.12em] text-slate-100/90 backdrop-blur-md transition-all duration-300 hover:border-teal-300/55 hover:bg-slate-900/70 hover:text-white"
                >
                  Enter
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
