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
                  // 1. Changed to 'rounded-full' to match your other nav pills
                  // 2. Removed the heavy drop-shadows to keep the header clean
                  className="group cursor-pointer rounded-full px-5 py-2 transition-all duration-300 hover:bg-white/5"
                  color="#a855f7"
                  speed="4s" // Calmed the animation speed down slightly
                  thickness={10} // Thinned the border for a more elegant, premium look
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
                      className="h-4 w-4 text-purple-400 transition-all duration-500 group-hover:rotate-90 group-hover:scale-110 group-hover:text-purple-300"
                    >
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                    </svg>
                    {/* THE TEXT: Removed the heavy gradient. Uses a clean, slightly muted white that brightens on hover */}
                    <span className="text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
                      Style Check
                    </span>
                    
                    {/* THE SYMBOL: Kept the sparkle, but removed the complex custom SVG gradient. 
                        Uses standard Tailwind text colors for a cleaner render. */}
                    

                  </div>
                </StarBorder>
                
                <StarBorder
                  as={Link}
                  href="/color-match"
                  // 1. Moved 'group' here. Changed to rounded-full. Removed the heavy shadows/scaling.
                  className="group cursor-pointer rounded-full px-5 py-2 transition-all duration-300 hover:bg-white/5"
                  color="#3b82f6" // Keeps your blue theme
                  speed="4s" // Slowed down from 3s to match the elegant vibe
                  thickness={10} // Reduced from 10 to 2 to match the clean navigation style
                >
                  {/* 2. Inner wrapper enforcing the layout */}
                  <div className="flex flex-row items-center justify-center gap-2">
                    
                    {/* THE SYMBOL: Using your Lucide icon, but styled with Tailwind for hover effects */}
                    <Palette 
                      className="h-4 w-4 text-blue-400 transition-all duration-500 ease-out will-change-transform group-hover:rotate-12 group-hover:scale-110 group-hover:text-blue-300" 
                    />
                    
                    {/* THE TEXT: Muted white that turns pure white on hover */}
                    <span className="text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
                      Color Match
                    </span>
                    
                  </div>
                </StarBorder>
                
                <StarBorder
                  as={Link}
                  href="/likes"
                  className="group cursor-pointer rounded-full px-5 py-2 transition-all duration-300 hover:bg-white/5"
                  color="#ef4444" 
                  speed="4s"
                  thickness={2} 
                >
                  <div className="flex flex-row items-center justify-center gap-2">
                    
                    {/* THE SYMBOL: 
                        1. Swapped pinkish colors for true 'red-500'.
                        2. Changed duration to '1000' (1 second) for a slow, satisfying fill.
                        3. Used 'fill-transparent' to ensure a smooth transition.
                    */}
                    <Heart 
                      className="h-4 w-4 text-red-500 fill-transparent transition-all duration-400 ease-in-out will-change-transform group-hover:scale-110 group-hover:fill-red-500" 
                    />
                    
                    <span className="text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
                      Likes
                    </span>
                    
                  </div>
                </StarBorder>

                <StarBorder
                  as={Link}
                  href="/wardrobe"
                  className="group cursor-pointer rounded-full px-5 py-2 transition-all duration-300 hover:bg-white/5"
                  color="#14b8a6" // Keeps your teal theme
                  speed="4s"
                  thickness={10}
                >
                  {/* Inner wrapper enforcing the layout */}
                  <div className="flex flex-row items-center justify-center gap-2">
                    
                    {/* THE SYMBOL: Removed inline CSS. Uses Tailwind text colors and adds a subtle fill on hover */}
                    <Shirt 
                      className="h-4 w-4 text-teal-400 fill-none transition-all duration-500 ease-out will-change-transform group-hover:scale-110 group-hover:text-teal-300 group-hover:fill-teal-500/30" 
                    />
                    
                    {/* THE TEXT: Muted white that turns pure white on hover */}
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
