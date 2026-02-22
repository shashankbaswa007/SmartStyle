'use client';

import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Palette,
  Heart,
  Sparkles,
  BarChart3,
  Award,
  Star,
  Activity,
  RefreshCw,
  Shirt,
  Calendar,
  Zap,
  Target,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  getUserPreferences,
  getRecommendationHistory,
} from '@/lib/personalization';
import type { UserPreferences, RecommendationHistory } from '@/lib/personalization';
import { getLikedOutfits } from '@/lib/likedOutfits';
import type { LikedOutfitData } from '@/lib/likedOutfits';
import { getWardrobeItems } from '@/lib/wardrobeService';
import type { WardrobeItemData } from '@/lib/wardrobeService';
import Link from 'next/link';
import { useMounted } from '@/hooks/useMounted';

// Lazy load heavy components for better performance
const Particles = lazy(() => import('@/components/Particles'));
const TextPressure = lazy(() => import('@/components/TextPressure'));

// ─── Types ──────────────────────────────────────────────────────
interface StyleInsights {
  topColors: { color: string; count: number; hex: string }[];
  topOccasions: { occasion: string; count: number }[];
  topStyles: { style: string; count: number }[];
  likeRate: number;
  totalRecommendations: number;
  totalFeedback: number;
  totalLiked: number;
  seasonalDistribution: { season: string; count: number }[];
  mostActiveMonth: string;
  activityTimeline: { label: string; count: number }[];
  wardrobeBreakdown: { type: string; count: number }[];
  wardrobeTotal: number;
  avgColorsPerOutfit: number;
  topWardrobeColors: { color: string; count: number; hex: string }[];
  engagementScore: number;
}

// ─── Animation Variants ─────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
};

// ─── Color Helpers ──────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  black: '#1a1a1a', white: '#F5F5F5', gray: '#808080', grey: '#808080',
  red: '#EF4444', blue: '#3B82F6', green: '#22C55E', yellow: '#EAB308',
  orange: '#F97316', purple: '#A855F7', pink: '#EC4899', brown: '#92400E',
  beige: '#D4C5A9', navy: '#1E3A5F', maroon: '#7F1D1D', olive: '#6B7C3E',
  lime: '#84CC16', teal: '#14B8A6', aqua: '#06B6D4', silver: '#A1A1AA',
  gold: '#CA8A04', indigo: '#6366F1', violet: '#8B5CF6', cream: '#FEF3C7',
  burgundy: '#7F1D3E', coral: '#F87171', mint: '#6EE7B7', lavender: '#C4B5FD',
  rust: '#B45309', mustard: '#CA8A04', charcoal: '#374151', ivory: '#FFFFF0',
};

function getHexColor(color: string): string {
  if (!color) return '#6366F1';
  const normalized = color.toLowerCase().trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = color.match(/^#(.)(.)(.)$/) || [];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return COLOR_MAP[normalized] || '#6366F1';
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  top: 'Tops', bottom: 'Bottoms', dress: 'Dresses', shoes: 'Shoes',
  accessory: 'Accessories', outerwear: 'Outerwear',
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  top: '#8B5CF6', bottom: '#3B82F6', dress: '#EC4899', shoes: '#F97316',
  accessory: '#10B981', outerwear: '#6366F1',
};

// ─── Chart: Horizontal Bar ─────────────────────────────────────
function HorizontalBarChart({ data }: { data: { name: string; count: number; hex?: string }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <motion.div
          key={item.name}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.08 }}
          className="space-y-1.5"
        >
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {item.hex && (
                <div
                  className="w-4 h-4 rounded-full border-2 border-white/20 shadow-sm flex-shrink-0"
                  style={{ backgroundColor: item.hex }}
                />
              )}
              <span className="font-medium capitalize truncate">{item.name}</span>
            </div>
            <span className="text-muted-foreground font-semibold tabular-nums">{item.count}</span>
          </div>
          <div className="h-8 bg-muted/20 rounded-lg overflow-hidden border border-border/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max((item.count / maxCount) * 100, 3)}%` }}
              transition={{ duration: 0.7, delay: index * 0.08, ease: 'easeOut' }}
              className="h-full rounded-lg relative"
              style={{
                background: item.hex
                  ? `linear-gradient(90deg, ${item.hex} 0%, ${item.hex}cc 100%)`
                  : 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Chart: Donut / Pie ─────────────────────────────────────────
function DonutChart({ data, centerLabel }: { data: { name: string; value: number; color: string }[]; centerLabel?: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;
  let currentAngle = 0;

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6 justify-center">
      <div className="relative">
        <svg viewBox="0 0 200 200" className="w-56 h-56 md:w-64 md:h-64">
          <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.3" />
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (percentage / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            const start = polarToCartesian(100, 100, 80, startAngle);
            const end = polarToCartesian(100, 100, 80, endAngle);
            const largeArc = angle > 180 ? 1 : 0;
            const pathData = `M 100 100 L ${start.x} ${start.y} A 80 80 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
            currentAngle += angle;

            return (
              <motion.path
                key={index}
                d={pathData}
                fill={item.color}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.12, duration: 0.5, ease: 'easeOut' }}
                className="transition-all hover:opacity-80 cursor-pointer"
                style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.1))' }}
              />
            );
          })}
          <circle cx="100" cy="100" r="45" fill="hsl(var(--card))" className="transition-colors" />
          <text x="100" y="95" textAnchor="middle" className="text-2xl font-bold fill-foreground">{total}</text>
          <text x="100" y="112" textAnchor="middle" className="text-[10px] fill-muted-foreground">{centerLabel || 'Total'}</text>
        </svg>
      </div>
      <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
        {data.map((item, index) => (
          <motion.div
            key={index}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/10 hover:bg-muted/30 transition-colors"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 + 0.3 }}
          >
            <div className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-white/20 shadow-sm" style={{ backgroundColor: item.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate capitalize">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.value} · {((item.value / total) * 100).toFixed(0)}%</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees - 90) * Math.PI / 180.0;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

// ─── Chart: Activity Sparkline ──────────────────────────────────
function ActivitySparkline({ data }: { data: { label: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const height = 120;
  const padding = 16;
  const usableH = height - padding * 2;
  const barWidth = Math.max(4, Math.min(24, (280 - padding * 2) / data.length - 2));

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[280px]">
        <svg viewBox={`0 0 ${Math.max(280, data.length * (barWidth + 3) + padding * 2)} ${height}`} className="w-full h-28">
          {data.map((item, i) => {
            const barH = Math.max(2, (item.count / maxCount) * usableH);
            const x = padding + i * (barWidth + 3);
            const y = height - padding - barH;
            return (
              <motion.g key={i}>
                <motion.rect
                  x={x} y={y} width={barWidth} height={barH} rx={barWidth / 2}
                  fill="url(#sparkGrad)"
                  initial={{ height: 0, y: height - padding }}
                  animate={{ height: barH, y }}
                  transition={{ delay: i * 0.04, duration: 0.5, ease: 'easeOut' }}
                />
                {(i % 2 === 0 || data.length <= 6) && (
                  <text x={x + barWidth / 2} y={height - 2} textAnchor="middle" className="text-[7px] fill-muted-foreground">
                    {item.label}
                  </text>
                )}
              </motion.g>
            );
          })}
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────
const STAT_ACCENT: Record<string, string> = {
  violet: '#8B5CF6', pink: '#EC4899', blue: '#3B82F6', emerald: '#10B981',
};

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string | number; subtitle: string; icon: React.ElementType; color: string;
}) {
  const accent = STAT_ACCENT[color] || '#6366F1';
  return (
    <motion.div variants={itemVariants}>
      <Card className="backdrop-blur-xl relative overflow-hidden" style={{ borderColor: `color-mix(in srgb, ${accent} 20%, transparent)` }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ background: `radial-gradient(circle at 80% 20%, ${accent}, transparent 70%)` }} />
        <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </CardHeader>
        <CardContent className="relative">
          <motion.div className="text-3xl font-bold tabular-nums" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 120 }}>
            {value}
          </motion.div>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Engagement Score Ring ──────────────────────────────────────
function EngagementRing({ score }: { score: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const scoreColor = score >= 70 ? '#10B981' : score >= 40 ? '#EAB308' : '#6366F1';

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" opacity="0.3" />
          <motion.circle cx="50" cy="50" r={radius} fill="none" stroke={scoreColor} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="text-xl font-bold fill-foreground">{score}</text>
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">Engagement Score</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {score >= 70 ? "Highly engaged! You're making the most of SmartStyle."
            : score >= 40 ? 'Growing nicely — keep exploring new styles!'
            : 'Just getting started — try more recommendations!'}
        </p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const { user } = useAuth();
  const isMounted = useMounted();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [history, setHistory] = useState<RecommendationHistory[]>([]);
  const [likedOutfits, setLikedOutfits] = useState<LikedOutfitData[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItemData[]>([]);

  // Load data from Firestore
  const loadAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      if (!user) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [prefs, recs, liked, wardrobe] = await Promise.all([
        getUserPreferences(user.uid),
        getRecommendationHistory(user.uid, 100),
        getLikedOutfits(user.uid),
        getWardrobeItems(user.uid).catch(() => [] as WardrobeItemData[]),
      ]);

      setPreferences(prefs);
      setHistory(recs);
      setLikedOutfits(liked);
      setWardrobeItems(wardrobe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadAnalytics();
  }, [user, loadAnalytics]);

  // ── Compute insights from real data ───────────────────────────
  const insights = useMemo((): StyleInsights | null => {
    if (!history.length && !likedOutfits.length && !wardrobeItems.length) return null;

    const colorCounts: Record<string, number> = {};
    const occasionCounts: Record<string, number> = {};
    const styleCounts: Record<string, number> = {};
    const seasonCounts: Record<string, number> = {};
    let totalColorsInLiked = 0;

    // 1. Extract from liked outfits (strongest signal)
    likedOutfits.forEach(outfit => {
      if (outfit.colorPalette?.length) {
        totalColorsInLiked += outfit.colorPalette.length;
        outfit.colorPalette.forEach((c: string) => {
          const n = c.toLowerCase().trim();
          if (n) colorCounts[n] = (colorCounts[n] || 0) + 1;
        });
      }
      if (outfit.occasion) {
        const n = outfit.occasion.toLowerCase().trim();
        if (n) occasionCounts[n] = (occasionCounts[n] || 0) + 1;
      }
      if (outfit.styleType) {
        const n = outfit.styleType.toLowerCase().trim();
        if (n) styleCounts[n] = (styleCounts[n] || 0) + 1;
      }
    });

    // 2. Supplement with recommendation history
    history.forEach(rec => {
      if (rec.occasion) {
        const n = rec.occasion.toLowerCase().trim();
        if (n) occasionCounts[n] = (occasionCounts[n] || 0) + 1;
      }
      if (rec.weather?.temp != null) {
        const t = rec.weather.temp;
        const season = t > 25 ? 'Summer' : t > 15 ? 'Spring/Fall' : 'Winter';
        seasonCounts[season] = (seasonCounts[season] || 0) + 1;
      }
      if (rec.season) {
        const s = rec.season.charAt(0).toUpperCase() + rec.season.slice(1).toLowerCase();
        if (['Spring', 'Summer', 'Fall', 'Winter'].includes(s)) {
          seasonCounts[s] = (seasonCounts[s] || 0) + 1;
        }
      }
    });

    // 3. Wardrobe seasons
    wardrobeItems.forEach(item => {
      if (item.season?.length) {
        item.season.forEach(s => {
          const label = s.charAt(0).toUpperCase() + s.slice(1);
          seasonCounts[label] = (seasonCounts[label] || 0) + 1;
        });
      }
    });

    // 4. Most active month from timestamps
    const monthCounts: Record<string, number> = {};
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    likedOutfits.forEach(o => {
      if (o.likedAt) {
        const d = new Date(o.likedAt);
        const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      }
    });
    history.forEach(r => {
      const ts = r.createdAt;
      if (ts) {
        const d = typeof ts === 'object' && 'toDate' in ts ? (ts as any).toDate() : new Date(ts as any);
        const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      }
    });

    const sortedMonths = Object.entries(monthCounts).sort(([, a], [, b]) => b - a);
    const mostActiveMonth = sortedMonths.length > 0 ? sortedMonths[0][0] : 'N/A';

    // 5. Activity timeline (last 8 weeks)
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const weeks = 8;
    const weekBuckets: number[] = new Array(weeks).fill(0);

    const addToTimeline = (ts: number) => {
      const weeksAgo = Math.floor((now - ts) / weekMs);
      if (weeksAgo >= 0 && weeksAgo < weeks) weekBuckets[weeks - 1 - weeksAgo]++;
    };

    likedOutfits.forEach(o => { if (o.likedAt) addToTimeline(o.likedAt); });
    history.forEach(r => {
      const ts = r.createdAt;
      if (ts) {
        const d = typeof ts === 'object' && 'toDate' in ts ? (ts as any).toDate().getTime() : Number(ts);
        addToTimeline(d);
      }
    });

    const activityTimeline = weekBuckets.map((count, i) => {
      const weeksAgo = weeks - 1 - i;
      return { label: weeksAgo === 0 ? 'Now' : weeksAgo === 1 ? '1w' : `${weeksAgo}w`, count };
    });

    // 6. Wardrobe breakdown
    const wardrobeTypeCounts: Record<string, number> = {};
    const wardrobeColorCounts: Record<string, number> = {};
    wardrobeItems.forEach(item => {
      wardrobeTypeCounts[item.itemType] = (wardrobeTypeCounts[item.itemType] || 0) + 1;
      if (item.dominantColors?.length) {
        item.dominantColors.forEach(c => {
          wardrobeColorCounts[c.toLowerCase()] = (wardrobeColorCounts[c.toLowerCase()] || 0) + 1;
        });
      }
    });

    // 7. Engagement score (0-100)
    const hasRecs = history.length > 0;
    const hasLikes = likedOutfits.length > 0;
    const hasWardrobe = wardrobeItems.length > 0;
    const hasFeedback = history.some(r => r.feedback);
    const recencyBonus = activityTimeline.slice(-3).some(w => w.count > 0) ? 15 : 0;
    const engagementScore = Math.min(100, Math.round(
      (hasRecs ? 20 : 0) + (hasLikes ? 20 : 0) + (hasWardrobe ? 15 : 0) +
      (hasFeedback ? 10 : 0) + Math.min(20, history.length * 2) + recencyBonus
    ));

    // 8. Like rate
    const likeRate = history.length > 0 ? Math.min(100, (likedOutfits.length / history.length) * 100) : 0;

    return {
      topColors: Object.entries(colorCounts).sort(([, a], [, b]) => b - a).slice(0, 6)
        .map(([color, count]) => ({ color, count, hex: getHexColor(color) })),
      topOccasions: Object.entries(occasionCounts).sort(([, a], [, b]) => b - a).slice(0, 5)
        .map(([occasion, count]) => ({ occasion, count })),
      topStyles: Object.entries(styleCounts).sort(([, a], [, b]) => b - a).slice(0, 5)
        .map(([style, count]) => ({ style, count })),
      likeRate,
      totalRecommendations: history.length,
      totalFeedback: history.filter(r => r.feedback).length,
      totalLiked: likedOutfits.length,
      seasonalDistribution: Object.entries(seasonCounts).sort(([, a], [, b]) => b - a)
        .map(([season, count]) => ({ season, count })),
      mostActiveMonth,
      activityTimeline,
      wardrobeBreakdown: Object.entries(wardrobeTypeCounts).sort(([, a], [, b]) => b - a)
        .map(([type, count]) => ({ type, count })),
      wardrobeTotal: wardrobeItems.length,
      avgColorsPerOutfit: likedOutfits.length > 0 ? Math.round((totalColorsInLiked / likedOutfits.length) * 10) / 10 : 0,
      topWardrobeColors: Object.entries(wardrobeColorCounts).sort(([, a], [, b]) => b - a).slice(0, 5)
        .map(([color, count]) => ({ color, count, hex: getHexColor(color) })),
      engagementScore,
    };
  }, [history, likedOutfits, wardrobeItems]);

  // ── Pre-render gates ──────────────────────────────────────────
  if (!isMounted) return null;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4 text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in to view your analytics</CardTitle>
            <CardDescription>We need your account to load personalized insights.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href="/auth"><Button className="w-full">Go to Sign In</Button></Link>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasAnyData = insights && (
    insights.totalRecommendations > 0 || insights.totalLiked > 0 || insights.wardrobeTotal > 0
  );

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
        {/* Particles Background */}
        {isMounted && (
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-500/10" />}>
              <Particles
                className="absolute inset-0"
                particleColors={['#a855f7', '#c4b5fd']}
                particleCount={50}
                particleSpread={10}
                speed={0.2}
                particleBaseSize={120}
                moveParticlesOnHover={false}
                alphaParticles={false}
                disableRotation={true}
              />
            </Suspense>
          </div>
        )}

        <div className="relative z-10 container mx-auto px-4 py-12">
          {/* Header */}
          <header className="text-center mb-16">
            <div style={{ position: 'relative', height: '300px' }}>
              {isMounted && (
                <Suspense fallback={
                  <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent pt-24">
                    Style Analytics
                  </h1>
                }>
                  <TextPressure
                    text="Style-Analytics"
                    stroke={true}
                    width={false}
                    weight={true}
                    textColor="#c4b5fd"
                    strokeColor="#7c3aed"
                    minFontSize={32}
                  />
                </Suspense>
              )}
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-4">
              Track your fashion journey and discover your style patterns through personalized insights
            </p>
            {!loading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadAnalytics(true)}
                disabled={refreshing}
                className="mt-3 gap-2 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </Button>
            )}
          </header>

          {error && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Alert variant="destructive" className="mb-6 max-w-4xl mx-auto">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-card/60 backdrop-blur-xl border border-border/20">
                  <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
                  <CardContent><Skeleton className="h-10 w-16" /><Skeleton className="h-3 w-20 mt-2" /></CardContent>
                </Card>
              ))}
              <div className="col-span-full grid gap-6 md:grid-cols-2 mt-2">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="bg-card/60 backdrop-blur-xl border border-border/20">
                    <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                    <CardContent><Skeleton className="h-48 w-full" /></CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : hasAnyData ? (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6 max-w-7xl mx-auto">

              {/* ─── Hero Stats Row ─────────────────────────────── */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Recommendations" value={insights.totalRecommendations} subtitle="Outfits generated for you" icon={Sparkles} color="violet" />
                <StatCard title="Liked Outfits" value={insights.totalLiked} subtitle={`${insights.likeRate.toFixed(0)}% like rate`} icon={Heart} color="pink" />
                <StatCard title="Wardrobe Items" value={insights.wardrobeTotal} subtitle={`${insights.wardrobeBreakdown.length} categories`} icon={Shirt} color="blue" />
                <StatCard title="Most Active" value={insights.mostActiveMonth} subtitle={insights.totalFeedback > 0 ? `${insights.totalFeedback} ratings given` : 'Keep exploring!'} icon={Calendar} color="emerald" />
              </div>

              {/* ─── Activity & Engagement Row ──────────────────── */}
              <motion.div variants={itemVariants} className="grid gap-6 md:grid-cols-2">
                {/* Activity Timeline */}
                <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Activity Timeline</CardTitle>
                    </div>
                    <CardDescription>Your style activity over the last 8 weeks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {insights.activityTimeline.some(w => w.count > 0) ? (
                      <ActivitySparkline data={insights.activityTimeline} />
                    ) : (
                      <EmptyChartMessage message="No recent activity yet. Your timeline will fill up as you use SmartStyle!" />
                    )}
                  </CardContent>
                </Card>

                {/* Engagement Score */}
                <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Style Engagement</CardTitle>
                    </div>
                    <CardDescription>How actively you&apos;re exploring your style</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <EngagementRing score={insights.engagementScore} />
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/20">
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums">{insights.totalRecommendations}</p>
                        <p className="text-[10px] text-muted-foreground">Explored</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums">{insights.totalLiked}</p>
                        <p className="text-[10px] text-muted-foreground">Saved</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold tabular-nums">{insights.totalFeedback}</p>
                        <p className="text-[10px] text-muted-foreground">Rated</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* ─── Color & Occasion Charts ────────────────────── */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Top Colors */}
                <motion.div variants={itemVariants}>
                  <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Your Color Palette</CardTitle>
                      </div>
                      <CardDescription>Most frequent colors in your liked outfits</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {insights.topColors.length > 0 ? (
                        <HorizontalBarChart data={insights.topColors.map(c => ({ name: c.color, count: c.count, hex: c.hex }))} />
                      ) : (
                        <EmptyChartMessage message="Like some outfits to see your color preferences!" />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Top Occasions */}
                <motion.div variants={itemVariants}>
                  <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Occasion Breakdown</CardTitle>
                      </div>
                      <CardDescription>What you dress for most</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {insights.topOccasions.length > 0 ? (
                        <HorizontalBarChart data={insights.topOccasions.map(o => ({ name: o.occasion, count: o.count }))} />
                      ) : (
                        <EmptyChartMessage message="Start getting recommendations to see your occasion preferences!" />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Favorite Styles */}
                {insights.topStyles.length > 0 && (
                  <motion.div variants={itemVariants}>
                    <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">Style DNA</CardTitle>
                        </div>
                        <CardDescription>Your most-loved style genres</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <HorizontalBarChart data={insights.topStyles.map(s => ({ name: s.style, count: s.count }))} />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Seasonal Distribution */}
                {insights.seasonalDistribution.length > 0 && (
                  <motion.div variants={itemVariants}>
                    <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">Seasonal Preferences</CardTitle>
                        </div>
                        <CardDescription>Seasons that influence your style</CardDescription>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        <DonutChart
                          centerLabel="Seasons"
                          data={insights.seasonalDistribution.map((s, i) => ({
                            name: s.season,
                            value: s.count,
                            color: ['#8B5CF6', '#EC4899', '#F97316', '#10B981'][i % 4],
                          }))}
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </div>

              {/* ─── Wardrobe Overview ──────────────────────────── */}
              {insights.wardrobeTotal > 0 && (
                <motion.div variants={itemVariants}>
                  <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shirt className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base">Wardrobe Overview</CardTitle>
                        </div>
                        <Link href="/wardrobe">
                          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                            View Wardrobe <ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                      <CardDescription>Your digital wardrobe at a glance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-3">By Category</p>
                          <DonutChart
                            centerLabel="Items"
                            data={insights.wardrobeBreakdown.map(w => ({
                              name: ITEM_TYPE_LABELS[w.type] || w.type,
                              value: w.count,
                              color: ITEM_TYPE_COLORS[w.type] || '#6366F1',
                            }))}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-3">Dominant Colors</p>
                          {insights.topWardrobeColors.length > 0 ? (
                            <HorizontalBarChart data={insights.topWardrobeColors.map(c => ({ name: c.color, count: c.count, hex: c.hex }))} />
                          ) : (
                            <EmptyChartMessage message="Color data will appear once your wardrobe items are processed." />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ─── Quick Insights (preferences) ───────────────── */}
              {preferences && (
                <motion.div variants={itemVariants}>
                  <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Quick Insights</CardTitle>
                      </div>
                      <CardDescription>Patterns our AI has noticed about your style</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {preferences.favoriteColors?.length > 0 && (
                          <InsightBadge icon={Palette} label="Favorite Colors" value={preferences.favoriteColors.slice(0, 4).join(', ')} />
                        )}
                        {preferences.preferredStyles?.length > 0 && (
                          <InsightBadge icon={Star} label="Preferred Styles" value={preferences.preferredStyles.slice(0, 3).join(', ')} />
                        )}
                        {preferences.accuracyScore > 0 && (
                          <InsightBadge icon={Target} label="AI Accuracy" value={`${preferences.accuracyScore}%`} />
                        )}
                        {insights.avgColorsPerOutfit > 0 && (
                          <InsightBadge icon={Palette} label="Avg Colors / Outfit" value={`${insights.avgColorsPerOutfit}`} />
                        )}
                        {preferences.priceRange && preferences.priceRange.max < 10000 && (
                          <InsightBadge icon={TrendingUp} label="Budget Range" value={`₹${preferences.priceRange.min}–₹${preferences.priceRange.max}`} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ─── CTA ────────────────────────────────────────── */}
              <motion.div variants={itemVariants}>
                <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                  <CardContent className="py-8 text-center">
                    <h3 className="text-2xl font-bold mb-2">Ready for More Style Insights?</h3>
                    <p className="text-muted-foreground mb-6">Get personalized recommendations to discover your perfect style</p>
                    <div className="flex gap-4 justify-center flex-wrap">
                      <Link href="/style-check">
                        <Button size="lg" className="gap-2"><Sparkles className="h-5 w-5" />Get Style Advice</Button>
                      </Link>
                      <Link href="/likes">
                        <Button size="lg" variant="outline" className="gap-2"><Heart className="h-5 w-5" />View Liked Outfits</Button>
                      </Link>
                      <Link href="/wardrobe">
                        <Button size="lg" variant="outline" className="gap-2"><Shirt className="h-5 w-5" />Manage Wardrobe</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          ) : (
            /* ─── Empty State ─────────────────────────────────── */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-2xl mx-auto"
            >
              <div className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-16">
                <BarChart3 className="w-20 h-20 text-muted-foreground/40 mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-3">No Analytics Data Yet</h3>
                <p className="text-muted-foreground mb-8 text-lg">
                  Start your style journey by getting personalized outfit recommendations.
                  Your analytics will appear here as you explore different styles!
                </p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Link href="/style-check">
                    <Button size="lg" className="gap-2"><Sparkles className="h-5 w-5" />Get Your First Recommendation</Button>
                  </Link>
                  <Link href="/wardrobe">
                    <Button size="lg" variant="outline" className="gap-2"><Shirt className="h-5 w-5" />Build Your Wardrobe</Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

// ─── Small Reusable Components ──────────────────────────────────

function EmptyChartMessage({ message }: { message: string }) {
  return <p className="text-muted-foreground text-center py-10 text-sm">{message}</p>;
}

function InsightBadge({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/10">
      <Icon className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold capitalize truncate">{value}</p>
      </div>
    </div>
  );
}
