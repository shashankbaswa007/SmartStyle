'use client';

import { Clock3, Gauge, Sparkles, Zap } from 'lucide-react';

interface UsageLimitMeterProps {
  title: string;
  subtitle: string;
  remaining: number;
  limit: number;
  resetAt?: string;
  variant?: 'styleCheck' | 'wardrobe';
  className?: string;
  showIcon?: boolean;
}

function getStatusTone(remaining: number, limit: number) {
  if (limit <= 0) return 'healthy';
  const ratio = remaining / limit;
  if (ratio <= 0.1) return 'danger';
  if (ratio <= 0.3) return 'warning';
  return 'healthy';
}

export default function UsageLimitMeter({
  title,
  subtitle,
  remaining,
  limit,
  resetAt,
  variant = 'styleCheck',
  className = '',
  showIcon = true,
}: UsageLimitMeterProps) {
  const safeLimit = Math.max(1, limit);
  const safeRemaining = Math.max(0, Math.min(limit, remaining));
  const used = Math.max(0, safeLimit - safeRemaining);
  const usedPercent = Math.min(100, Math.round((used / safeLimit) * 100));
  const tone = getStatusTone(safeRemaining, safeLimit);

  const isStyle = variant === 'styleCheck';
  
  // Enhanced shell class with better aesthetic integration
  const shellClass = isStyle
    ? 'border border-purple-200/60 bg-gradient-to-br from-purple-50/80 to-purple-50/40 backdrop-blur-sm hover:border-purple-300/80 transition-all duration-300'
    : 'border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50/30 hover:border-violet-300 transition-all duration-300 shadow-sm';

  const toneClass =
    tone === 'danger'
      ? 'text-rose-700 bg-rose-50 border border-rose-200'
      : tone === 'warning'
      ? 'text-amber-700 bg-amber-50 border border-amber-200'
      : isStyle
      ? 'text-purple-700 bg-purple-50 border border-purple-200'
      : 'text-violet-700 bg-violet-50 border border-violet-200';

  const progressTrackClass = isStyle 
    ? 'bg-gradient-to-r from-purple-100 to-purple-50' 
    : 'bg-gradient-to-r from-violet-100 to-purple-100';
    
  const progressFillClass =
    tone === 'danger'
      ? 'bg-gradient-to-r from-rose-500 to-red-500 shadow-lg shadow-red-500/30'
      : tone === 'warning'
      ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30'
      : isStyle
      ? 'bg-gradient-to-r from-purple-500 to-violet-500 shadow-lg shadow-purple-500/20'
      : 'bg-gradient-to-r from-violet-500 to-indigo-500 shadow-lg shadow-violet-500/20';

  const resetText = resetAt
    ? new Date(resetAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className={`rounded-xl border p-4 ${shellClass} ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {showIcon && isStyle && <Sparkles className="h-4 w-4 text-purple-600" />}
            {showIcon && !isStyle && <Zap className="h-4 w-4 text-violet-600" />}
            <p className={`text-sm font-semibold ${isStyle ? 'text-purple-900' : 'text-violet-900'}`}>{title}</p>
          </div>
          <p className={`text-xs ${isStyle ? 'text-purple-700/70' : 'text-violet-700/70'}`}>{subtitle}</p>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap ${toneClass}`}>
          <Gauge className="h-3.5 w-3.5 flex-shrink-0" />
          {safeRemaining}/{safeLimit}
        </div>
      </div>

      <div className={`h-3 w-full overflow-hidden rounded-full ${progressTrackClass}`}>
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-out ${progressFillClass}`} 
          style={{ width: `${usedPercent}%` }} 
        />
      </div>

      <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px]">
        <span className={`inline-flex items-center gap-1 ${isStyle ? 'text-purple-600' : 'text-violet-600'}`}>
          <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
          {safeRemaining}/{safeLimit} available today
        </span>
        {resetText ? (
          <span className={`inline-flex items-center gap-1 ${isStyle ? 'text-purple-500' : 'text-violet-500'}`}>
            <Clock3 className="h-3.5 w-3.5 flex-shrink-0" />
            resets {resetText}
          </span>
        ) : null}
      </div>
    </div>
  );
}
