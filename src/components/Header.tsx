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
import { UserProfileDropdown } from '@/components/auth/UserProfileDropdown';
import { useAuth } from '@/components/auth/AuthProvider';
import { Wand2, Heart, Palette, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import AnimatedLogo from '@/components/AnimatedLogo';
const StarBorder = dynamic(() => import('@/components/StarBorder'), { ssr: false });


export function Header() {
  const { user } = useAuth();
  const navMotionClass =
    'transform-gpu transition-[transform,box-shadow,background-color] duration-300 ease-out hover:scale-[1.04] hover:shadow-[0_8px_24px_rgba(13,106,96,0.24)] active:scale-[0.97]';
  const mobileMotionClass =
    'transform-gpu transition-[transform,box-shadow,background-color] duration-200 ease-out hover:scale-[1.05] hover:shadow-[0_8px_20px_rgba(13,106,96,0.2)] active:scale-[0.97]';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          {/* Logo */}
          <Link 
            href="/" 
            className="z-10 shrink-0 transition-opacity hover:opacity-95"
          >
            <AnimatedLogo size={56} className="origin-left scale-[0.84] sm:scale-100" />
          </Link>

          {/* Right side: Navigation + Profile */}
          <div className="flex items-center gap-2 sm:gap-6">
            {/* Desktop Navigation - Only show if authenticated */}
            {user ? (
              <nav className="hidden md:flex items-center gap-3">
                <StarBorder
                  as={Link}
                  href="/style-check"
                  className={`group cursor-pointer rounded-full px-4 py-1.5 hover:bg-white/3 ${navMotionClass}`}
                  color="#0d6a60"
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
                      className="h-4 w-4 text-teal-400/80 transition-[transform,color] duration-500 ease-out will-change-transform group-hover:rotate-180 group-hover:scale-105 group-hover:text-teal-300/95"
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
                  className={`group cursor-pointer rounded-full px-4 py-1.5 hover:bg-white/3 ${navMotionClass}`}
                  color="#0d6a60"
                  speed="8s"
                  thickness={1}
                >
                  <div className="flex flex-row items-center justify-center gap-2">
                    <Palette 
                      className="h-4 w-4 text-emerald-400/80 transition-[transform,color] duration-500 ease-out will-change-transform group-hover:-translate-y-0.5 group-hover:rotate-6 group-hover:scale-105 group-hover:text-emerald-300/95" 
                    />
                    <span className="text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
                      Color Match
                    </span>
                  </div>
                </StarBorder>
                
                <StarBorder
                  as={Link}
                  href="/likes"
                  className={`group cursor-pointer rounded-full px-4 py-1.5 hover:bg-white/3 ${navMotionClass}`}
                  color="#0d6a60"
                  speed="8s"
                  thickness={1}
                >
                  <div className="flex flex-row items-center justify-center gap-2">
                    <Heart 
                      className="h-4 w-4 text-emerald-400/80 fill-transparent transition-[transform,fill,color] duration-500 ease-out will-change-transform group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:fill-emerald-400/70 group-hover:text-emerald-300/95" 
                    />
                    
                    <span className="text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
                      Likes
                    </span>
                    
                  </div>
                </StarBorder>

                <StarBorder
                  as={Link}
                  href="/wardrobe"
                  className={`group cursor-pointer rounded-full px-4 py-1.5 hover:bg-white/3 ${navMotionClass}`}
                  color="#0d6a60"
                  speed="8s"
                  thickness={1}
                >
                  <div className="flex flex-row items-center justify-center gap-2">
                    <Shirt 
                      className="h-4 w-4 text-teal-400/80 fill-none transition-[transform,fill,color] duration-500 ease-out will-change-transform group-hover:-translate-y-0.5 group-hover:-rotate-3 group-hover:scale-105 group-hover:text-teal-300/95 group-hover:fill-teal-500/20" 
                    />
                    <span className="text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 group-hover:text-white">
                      Wardrobe
                    </span>
                    
                  </div>
                </StarBorder>
              </nav>
            ) : null}

            {/* Mobile Navigation - Icon Only - Only show if authenticated */}
            {user ? (
              <div className="flex md:hidden items-center gap-1">
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 hover:bg-accent/10 ${mobileMotionClass}`}
                >
                  <Link href="/style-check" title="Style Check">
                    <Wand2 className="w-4 h-4 text-accent" />
                  </Link>
                </Button>
                
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 hover:bg-teal-500/10 ${mobileMotionClass}`}
                >
                  <Link href="/color-match" title="Color Match">
                    <Palette className="w-4 h-4 text-teal-500" />
                  </Link>
                </Button>
                
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 hover:bg-emerald-500/10 ${mobileMotionClass}`}
                >
                  <Link href="/likes" title="Your Likes">
                    <Heart className="w-4 h-4 text-emerald-500" />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 hover:bg-teal-500/10 ${mobileMotionClass}`}
                >
                  <Link href="/wardrobe" title="Your Wardrobe">
                    <Shirt className="w-4 h-4 text-teal-500" />
                  </Link>
                </Button>
              </div>
            ) : null}

            {/* User Profile Dropdown */}
            <UserProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}
