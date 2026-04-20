'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickStartEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export default function QuickStartEmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: QuickStartEmptyStateProps) {
  const PrimaryIcon = primaryAction.icon;

  return (
    <div className={className}>
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-10 text-center">
        <Icon className="mx-auto mb-5 h-16 w-16 text-emerald-400" />
        <h3 className="mb-2 text-2xl font-bold text-emerald-900">{title}</h3>
        <p className="mx-auto mb-6 max-w-2xl text-emerald-700">{description}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {primaryAction.href ? (
            <Button asChild className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700">
              <Link href={primaryAction.href}>
                {PrimaryIcon ? <PrimaryIcon className="h-4 w-4" /> : null}
                {primaryAction.label}
              </Link>
            </Button>
          ) : (
            <Button onClick={primaryAction.onClick} className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700">
              {PrimaryIcon ? <PrimaryIcon className="h-4 w-4" /> : null}
              {primaryAction.label}
            </Button>
          )}

          {secondaryAction ? (
            secondaryAction.href ? (
              <Button asChild variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50">
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            ) : (
              <Button onClick={secondaryAction.onClick} variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50">
                {secondaryAction.label}
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
