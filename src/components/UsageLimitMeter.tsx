'use client';

import { Clock3, Gauge, Sparkles, Zap } from 'lucide-react';

interface UsageLimitMeterProps {
  title: string;
  subtitle: string;
  remaining?: number;
  limit?: number;
  resetAt?: string;
  variant?: 'styleCheck' | 'wardrobe';
  className?: string;
  showIcon?: boolean;
  isLoading?: boolean;
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
  isLoading = false,
}: UsageLimitMeterProps) {
  const hasUsageData = typeof remaining === 'number' && typeof limit === 'number';
  const isUnavailable = !isLoading && !hasUsageData;
  const resolvedLimit = hasUsageData ? Math.max(0, Math.floor(limit as number)) : 0;
  const resolvedRemaining = hasUsageData
    ? Math.max(0, Math.min(resolvedLimit, Math.floor(remaining as number)))
    : 0;
  const safeLimit = Math.max(1, resolvedLimit);
  const safeRemaining = hasUsageData ? resolvedRemaining : 0;
  const used = Math.max(0, safeLimit - safeRemaining);
  const usedPercent = hasUsageData && resolvedLimit > 0 ? Math.min(100, Math.round((used / safeLimit) * 100)) : 0;
  const tone = hasUsageData ? getStatusTone(safeRemaining, safeLimit) : 'healthy';

  const isStyle = variant === 'styleCheck';
  
  // Enhanced shell class with better aesthetic integration
  const shellClass = isStyle
    ? 'border border-teal-200/60 bg-gradient-to-br from-teal-50/80 to-teal-50/40 backdrop-blur-sm hover:border-teal-300/80 transition-all duration-300'
    : 'border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/30 hover:border-emerald-300 transition-all duration-300 shadow-sm';

  const toneClass =
    isUnavailable
      ? 'text-slate-700 bg-slate-50 border border-slate-200'
      : tone === 'danger'
      ? 'text-rose-700 bg-rose-50 border border-rose-200'
      : tone === 'warning'
      ? 'text-amber-700 bg-amber-50 border border-amber-200'
      : isStyle
      ? 'text-teal-700 bg-teal-50 border border-teal-200'
      : 'text-emerald-700 bg-emerald-50 border border-emerald-200';

  const progressTrackClass = isStyle 
    ? 'bg-gradient-to-r from-teal-100 to-teal-50' 
    : 'bg-gradient-to-r from-emerald-100 to-teal-100';
    
  const progressFillClass =
    isUnavailable
      ? 'bg-gradient-to-r from-slate-400 to-slate-500'
      : tone === 'danger'
      ? 'bg-gradient-to-r from-rose-500 to-red-500 shadow-lg shadow-red-500/30'
      : tone === 'warning'
      ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30'
      : isStyle
      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/20'
      : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20';

  const resetText = resetAt
    ? new Date(resetAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  const valueText = isLoading ? 'Checking...' : isUnavailable ? '--' : `${resolvedRemaining}/${resolvedLimit}`;
  const availabilityText = isLoading
    ? 'Checking daily usage...'
    : isUnavailable
    ? 'Usage status unavailable'
    : `${safeRemaining}/${safeLimit} available today`;

  return (
    <div className={`rounded-xl border p-4 ${shellClass} ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {showIcon && isStyle && <Sparkles className="h-4 w-4 text-teal-600" />}
            {showIcon && !isStyle && <Zap className="h-4 w-4 text-emerald-600" />}
            <p className={`text-sm font-semibold ${isStyle ? 'text-teal-900' : 'text-emerald-900'}`}>{title}</p>
          </div>
          <p className={`text-xs ${isStyle ? 'text-teal-700/70' : 'text-emerald-700/70'}`}>{subtitle}</p>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap ${toneClass}`}>
          <Gauge className="h-3.5 w-3.5 flex-shrink-0" />
          {valueText}
        </div>
      </div>

      <div className={`h-3 w-full overflow-hidden rounded-full ${progressTrackClass}`}>
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-out ${progressFillClass}`} 
          style={{ width: `${usedPercent}%` }} 
        />
      </div>

      <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px]">
        <span className={`inline-flex items-center gap-1 ${isStyle ? 'text-teal-600' : 'text-emerald-600'}`}>
          <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
          {availabilityText}
        </span>
        {!isLoading && resetText ? (
          <span className={`inline-flex items-center gap-1 ${isStyle ? 'text-teal-500' : 'text-emerald-500'}`}>
            <Clock3 className="h-3.5 w-3.5 flex-shrink-0" />
            resets {resetText}
          </span>
        ) : null}
      </div>
    </div>
  );
}
