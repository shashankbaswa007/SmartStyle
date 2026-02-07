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
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import Link from 'next/link';
import { useMounted } from '@/hooks/useMounted';

// Lazy load heavy components for better performance
const Particles = lazy(() => import('@/components/Particles'));
const TextPressure = lazy(() => import('@/components/TextPressure'));

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
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
    },
  },
};

// Simple Bar Chart Component
function SimpleBarChart({ data }: { data: { name: string; count: number; hex?: string }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div className="space-y-4">
      {data.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {item.hex && (
                <div 
                  className="w-4 h-4 rounded-full border-2 border-white/20 shadow-sm" 
                  style={{ backgroundColor: item.hex }}
                />
              )}
              <span className="font-medium capitalize">{item.name}</span>
            </div>
            <span className="text-muted-foreground font-semibold">{item.count}</span>
          </div>
          <div className="h-10 bg-muted/20 rounded-lg overflow-hidden border border-border/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.count / maxCount) * 100}%` }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
              className="h-full rounded-lg relative"
              style={{ 
                background: item.hex 
                  ? `linear-gradient(90deg, ${item.hex} 0%, ${item.hex}dd 100%)`
                  : 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)',
                minWidth: '3%',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
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

// Simple Pie Chart Component
function SimplePieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;
  
  return (
    <div className="flex flex-col lg:flex-row items-center gap-8 justify-center">
      <div className="relative">
        <svg viewBox="0 0 200 200" className="w-72 h-72">
          {/* Outer glow circle */}
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="1"
            opacity="0.3"
          />
          
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (percentage / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            
            const start = polarToCartesian(100, 100, 80, startAngle);
            const end = polarToCartesian(100, 100, 80, endAngle);
            const largeArc = angle > 180 ? 1 : 0;
            
            const pathData = [
              `M 100 100`,
              `L ${start.x} ${start.y}`,
              `A 80 80 0 ${largeArc} 1 ${end.x} ${end.y}`,
              `Z`
            ].join(' ');
            
            currentAngle += angle;
            
            return (
              <motion.path
                key={index}
                d={pathData}
                fill={item.color}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.15, duration: 0.6, ease: "easeOut" }}
                className="transition-all hover:opacity-90 cursor-pointer"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}
              />
            );
          })}
          
          {/* Center circle for donut effect */}
          <circle
            cx="100"
            cy="100"
            r="45"
            fill="hsl(var(--card))"
            className="transition-colors"
          />
          
          {/* Center text */}
          <text
            x="100"
            y="95"
            textAnchor="middle"
            className="text-2xl font-bold fill-foreground"
          >
            {total}
          </text>
          <text
            x="100"
            y="110"
            textAnchor="middle"
            className="text-xs fill-muted-foreground"
          >
            Total
          </text>
        </svg>
      </div>
      
      <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
        {data.map((item, index) => (
          <motion.div 
            key={index} 
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/10 hover:bg-muted/30 transition-colors"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 + 0.3 }}
          >
            <div 
              className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-white/30 shadow-md" 
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate capitalize">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.value} items ({((item.value / total) * 100).toFixed(1)}%)
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees - 90) * Math.PI / 180.0;
  return {
    x: cx + (radius * Math.cos(radians)),
    y: cy + (radius * Math.sin(radians))
  };
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isMounted = useMounted();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [history, setHistory] = useState<RecommendationHistory[]>([]);
  const [insights, setInsights] = useState<StyleInsights | null>(null);
  const [likedCount, setLikedCount] = useState(0);

  // Hard-kill any stale service workers or caches to stop old chunk URLs
  useEffect(() => {
    // Unregister any existing service workers
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister().catch(() => undefined));
      }).catch(() => undefined);
    }

    // Clear runtime caches that may hold old chunk manifests
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key).catch(() => undefined));
      }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user) {
        setLoading(false);
        return;
      }

      const [prefs, recs, liked] = await Promise.all([
        getUserPreferences(user.uid),
        getRecommendationHistory(user.uid, 100),
        getLikedOutfits(user.uid)
      ]);

      console.log('📊 Analytics data loaded:', {
        preferences: prefs,
        recommendationCount: recs.length,
        likedCount: liked.length,
        sampleRecommendation: recs[0],
      });

      setPreferences(prefs);
      setHistory(recs);
      setLikedCount(liked.length);
      // Insights will be calculated via useMemo hook

    } catch (error) {
      console.error('Error loading analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Memoize expensive calculations to avoid recalculation on every render
  const insights = useMemo(() => {
    if (!history.length && !likedCount) return null;
    return calculateInsights(history, likedCount, [] as any[]);
  }, [history, likedCount]);

  const calculateInsights = useCallback((recs: RecommendationHistory[], likedTotal: number, likedOutfits: any[]): StyleInsights => {
    const colorCounts: { [key: string]: number } = {};
    const occasionCounts: { [key: string]: number } = {};
    const styleCounts: { [key: string]: number } = {};
    const seasonCounts: { [key: string]: number } = {};

    // Extract data from liked outfits (primary source for charts)
    likedOutfits.forEach(outfit => {
      // Count colors from liked outfits
      if (outfit.colorPalette && Array.isArray(outfit.colorPalette)) {
        outfit.colorPalette.forEach((color: string) => {
          const normalizedColor = color.toLowerCase().trim();
          if (normalizedColor) {
            colorCounts[normalizedColor] = (colorCounts[normalizedColor] || 0) + 1;
          }
        });
      }
      
      // Count occasions from liked outfits
      if (outfit.occasion) {
        const normalizedOccasion = outfit.occasion.toLowerCase().trim();
        occasionCounts[normalizedOccasion] = (occasionCounts[normalizedOccasion] || 0) + 1;
      }
      
      // Count styles from liked outfits
      if (outfit.styleType) {
        const normalizedStyle = outfit.styleType.toLowerCase().trim();
        styleCounts[normalizedStyle] = (styleCounts[normalizedStyle] || 0) + 1;
      }
    });

    // Supplement with recommendation history data for additional context
    recs.forEach(rec => {
      // Count occasions from recommendations (lower weight)
      if (rec.occasion && !occasionCounts[rec.occasion.toLowerCase().trim()]) {
        const normalizedOccasion = rec.occasion.toLowerCase().trim();
        occasionCounts[normalizedOccasion] = (occasionCounts[normalizedOccasion] || 0) + 1;
      }
      
      // Count seasons based on weather
      if (rec.weather && typeof rec.weather.temp === 'number') {
        const temp = rec.weather.temp;
        const season = temp > 25 ? 'Summer' : temp > 15 ? 'Spring/Fall' : 'Winter';
        seasonCounts[season] = (seasonCounts[season] || 0) + 1;
      }
    });

    console.log('📈 Calculated insights:', {
      colorCounts,
      occasionCounts,
      styleCounts,
      seasonCounts,
      totalRecs: recs.length,
      likedTotal,
      likedOutfitsCount: likedOutfits.length
    });

    const colorMap: { [key: string]: string } = {
      'black': '#000000', 'white': '#FFFFFF', 'gray': '#808080', 'grey': '#808080',
      'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000', 'yellow': '#FFFF00', 
      'orange': '#FFA500', 'purple': '#800080', 'pink': '#FFC0CB', 'brown': '#A52A2A', 
      'beige': '#F5F5DC', 'navy': '#000080', 'maroon': '#800000', 'olive': '#808000',
      'lime': '#00FF00', 'teal': '#008080', 'aqua': '#00FFFF', 'silver': '#C0C0C0',
      'gold': '#FFD700', 'indigo': '#4B0082', 'violet': '#EE82EE', 'cream': '#FFFDD0'
    };

    // Helper to get hex color from color name or hex string
    const getHexColor = (color: string): string => {
      const normalized = color.toLowerCase().trim();
      // If already a hex color, return it
      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return color.toUpperCase();
      }
      // Look up in color map
      return colorMap[normalized] || '#6366F1';
    };

    return {
      topColors: Object.entries(colorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([color, count]) => ({
          color,
          count,
          hex: getHexColor(color)
        })),
      topOccasions: Object.entries(occasionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([occasion, count]) => ({ occasion, count })),
      topStyles: Object.entries(styleCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([style, count]) => ({ style, count })),
      likeRate: recs.length > 0 ? (likedTotal / recs.length) * 100 : 0,
      totalRecommendations: recs.length,
      totalFeedback: recs.filter(r => r.feedback).length,
      totalLiked: likedTotal,
      seasonalDistribution: Object.entries(seasonCounts).map(([season, count]) => ({ season, count })),
      mostActiveMonth: 'Recent'
    };
  }, []);

  if (!isMounted) {
    return null;
  }

  // If no user, show a gentle sign-in prompt instead of blank screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4 text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in to view your analytics</CardTitle>
            <CardDescription>We need your account to load personalized insights.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href="/auth">
              <Button className="w-full">Go to Sign In</Button>
            </Link>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              Back to home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
        {/* Particles Background - Optimized */}
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
                <Suspense fallback={<h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent pt-24">Style-Analytics</h1>}>
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
          </header>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Alert variant="destructive" className="mb-6 max-w-4xl mx-auto">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-card/60 backdrop-blur-xl border border-border/20">
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6 max-w-7xl mx-auto"
            >
              {/* Stats Overview */}
              <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20 backdrop-blur-xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Recommendations</CardTitle>
                    <Sparkles className="h-4 w-4 text-violet-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{insights?.totalRecommendations || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Outfits generated</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 border-pink-500/20 backdrop-blur-xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Liked Outfits</CardTitle>
                    <Heart className="h-4 w-4 text-pink-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{insights?.totalLiked || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {insights ? insights.likeRate.toFixed(0) : '0'}% like rate
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 backdrop-blur-xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Feedback Given</CardTitle>
                    <Star className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{insights?.totalFeedback || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">Ratings provided</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 backdrop-blur-xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Active Period</CardTitle>
                    <Activity className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{insights?.mostActiveMonth || 'N/A'}</div>
                    <p className="text-xs text-muted-foreground mt-1">Most active</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Charts Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Top Colors */}
                <motion.div variants={itemVariants}>
                  <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        <CardTitle>Favorite Colors</CardTitle>
                      </div>
                      <CardDescription>Colors from your liked outfits</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {insights && insights.topColors.length > 0 ? (
                        <SimpleBarChart data={insights.topColors.map(c => ({
                          name: c.color,
                          count: c.count,
                          hex: c.hex
                        }))} />
                      ) : (
                        <p className="text-muted-foreground text-center py-12">No data yet. Start liking recommendations!</p>
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
                        <CardTitle>Top Occasions</CardTitle>
                      </div>
                      <CardDescription>Events from your liked outfits</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {insights && insights.topOccasions.length > 0 ? (
                        <SimpleBarChart data={insights.topOccasions.map(o => ({
                          name: o.occasion,
                          count: o.count
                        }))} />
                      ) : (
                        <p className="text-muted-foreground text-center py-12">No data yet. Start liking recommendations!</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Top Styles/Genres */}
                {insights && insights.topStyles.length > 0 && (
                  <motion.div variants={itemVariants}>
                    <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          <CardTitle>Favorite Styles</CardTitle>
                        </div>
                        <CardDescription>Style genres from your liked outfits</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <SimpleBarChart data={insights.topStyles.map(s => ({
                          name: s.style,
                          count: s.count
                        }))} />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Seasonal Distribution */}
                {insights && insights.seasonalDistribution.length > 0 && (
                  <motion.div variants={itemVariants} className={insights.topStyles.length > 0 ? '' : 'md:col-span-2'}>
                    <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          <CardTitle>Seasonal Preferences</CardTitle>
                        </div>
                        <CardDescription>When you look for style advice</CardDescription>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        <SimplePieChart 
                          data={insights.seasonalDistribution.map((s, i) => ({
                            name: s.season,
                            value: s.count,
                            color: ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981'][i % 4]
                          }))}
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </div>

              {/* Call to Action */}
              <motion.div variants={itemVariants}>
                <Card className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg">
                  <CardContent className="py-8 text-center">
                    <h3 className="text-2xl font-bold mb-2">Ready for More Style Insights?</h3>
                    <p className="text-muted-foreground mb-6">Get personalized recommendations to discover your perfect style</p>
                    <div className="flex gap-4 justify-center flex-wrap">
                      <Link href="/style-check">
                        <Button size="lg" className="gap-2">
                          <Sparkles className="h-5 w-5" />
                          Get Style Advice
                        </Button>
                      </Link>
                      <Link href="/likes">
                        <Button size="lg" variant="outline" className="gap-2">
                          <Heart className="h-5 w-5" />
                          View Liked Outfits
                        </Button>
                      </Link>
                      <Button size="lg" variant="ghost" onClick={loadAnalytics} className="gap-2">
                        <RefreshCw className="h-5 w-5" />
                        Refresh Data
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}

          {/* Empty State */}
          {!loading && insights && insights.totalRecommendations === 0 && (
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
                <Link href="/style-check">
                  <Button size="lg" className="gap-2">
                    <Sparkles className="h-5 w-5" />
                    Get Your First Recommendation
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
