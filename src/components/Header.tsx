'use client';

/**
 * Header Navigation Component
 * 
 * Features:
 * - App logo/title
 * - User profile dropdown
 */

import Link from 'next/link';
import { UserProfileDropdown } from '@/components/auth/UserProfileDropdown';
import { Wand2 } from 'lucide-react';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-2 text-2xl font-bold font-headline text-foreground transition-colors hover:text-accent"
          >
            <Wand2 className="w-6 h-6 text-accent" />
            SmartStyle
          </Link>

          {/* User Profile Dropdown */}
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}
