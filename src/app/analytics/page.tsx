'use client';

/**
 * Analytics Dashboard Page
 * 
 * Displays user's style evolution, preference trends, and recommendation insights
 */

import { useEffect, useState } from 'react';
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
import Particles from '@/components/Particles';
import ShinyText from '@/components/ShinyText';
import TextPressure from '@/components/TextPressure';
import SplashCursor from '@/components/SplashCursor';
import { useMounted } from '@/hooks/useMounted';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Area,
  AreaChart
} from 'recharts';

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

// Beautiful gradient colors for charts
const CHART_COLORS = {
  violet: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE'],
  pink: ['#EC4899', '#F472B6', '#F9A8D4', '#FBCFE8', '#FCE7F3'],
  blue: ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'],
  emerald: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'],
  amber: ['#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A', '#FEF3C7'],
};

// Helper function to convert color names to hex
const getColorHex = (colorName: string): string => {
  const colorMap: Record<string, string> = {
    // Basics
    'black': '#000000', 'white': '#FFFFFF', 'gray': '#808080', 'grey': '#808080',
    'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000', 'yellow': '#FFFF00',
    'orange': '#FFA500', 'purple': '#800080', 'pink': '#FFC0CB', 'brown': '#A52A2A',
    
    // Extended
    'navy': '#000080', 'teal': '#008080', 'maroon': '#800000',
    'olive': '#808000', 'lime': '#00FF00', 'cyan': '#00FFFF',
    'magenta': '#FF00FF', 'silver': '#C0C0C0', 'gold': '#FFD700',
    'beige': '#F5F5DC', 'tan': '#D2B48C', 'cream': '#FFFDD0',
    'coral': '#FF7F50', 'salmon': '#FA8072', 'crimson': '#DC143C',
    'burgundy': '#800020', 'indigo': '#4B0082', 'violet': '#EE82EE',
    
    // Fashion colors
    'navy blue': '#000080', 'light blue': '#ADD8E6', 'dark blue': '#00008B',
    'royal blue': '#4169E1', 'sky blue': '#87CEEB',
  };

  const normalized = colorName.toLowerCase().trim();
  if (colorName.startsWith('#')) return colorName.toUpperCase();
  return colorMap[normalized] || '#6366F1'; // Default to accent color
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background/95 backdrop-blur-xl border border-border/50 rounded-lg p-4 shadow-2xl"
      >
        <p className="text-sm font-bold mb-2 text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <p className="text-sm text-muted-foreground">
              {entry.name}: <span className="font-semibold text-foreground">{entry.value}</span>
            </p>
          </div>
        ))}
      </motion.div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isMounted = useMounted();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [history, setHistory] = useState<RecommendationHistory[]>([]);
  const [insights, setInsights] = useState<StyleInsights | null>(null);
  const [likedCount, setLikedCount] = useState(0);

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
        console.log('⚠️ No user found for analytics');
        setLoading(false);
        return;
      }

      console.log('🔍 Loading analytics for user:', user.uid);

      // Fetch all data in parallel
      const [prefs, recs, liked] = await Promise.all([
        getUserPreferences(user.uid),
        getRecommendationHistory(user.uid, 100),
        getLikedOutfits(user.uid)
      ]);

      console.log('📊 User preferences:', prefs);
      console.log('📊 Recommendation history:', recs.length, 'items');
      console.log('📊 Liked outfits:', liked.length, liked);

      setPreferences(prefs);
      setHistory(recs);
      setLikedCount(liked.length);

      // Calculate insights - pass liked outfits data
      const calculatedInsights = calculateInsights(recs, liked.length, liked);
      console.log('📊 Calculated insights:', calculatedInsights);
      setInsights(calculatedInsights);

    } catch (error) {
      console.error('❌ Error loading analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const calculateInsights = (recs: RecommendationHistory[], likedTotal: number, likedOutfits: any[]): StyleInsights => {
    const colorCounts: { [key: string]: number } = {};
    const occasionCounts: { [key: string]: number } = {};
    const seasonCounts: { [key: string]: number } = {};
    const styleCounts: { [key: string]: number } = {};
    const monthCounts: { [key: string]: number } = {};
    let totalLikes = 0;
    let totalFeedback = 0;

    // Process liked outfits data (richer data source with colorPalette, styleType, occasion)
    console.log('🎨 Processing liked outfits for insights:', likedOutfits.length);
    likedOutfits.forEach((outfit) => {
      // Count colors from colorPalette array
      if (outfit.colorPalette && Array.isArray(outfit.colorPalette)) {
        outfit.colorPalette.forEach((color: string) => {
          if (color) {
            colorCounts[color] = (colorCounts[color] || 0) + 1;
          }
        });
      }

      // Count occasions
      if (outfit.occasion) {
        occasionCounts[outfit.occasion] = (occasionCounts[outfit.occasion] || 0) + 1;
      }

      // Count styles
      if (outfit.styleType) {
        styleCounts[outfit.styleType] = (styleCounts[outfit.styleType] || 0) + 1;
      }

      // Track activity by month and season from likedAt timestamp
      if (outfit.likedAt) {
        const date = new Date(outfit.likedAt);
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const monthNum = date.getMonth();

        monthCounts[month] = (monthCounts[month] || 0) + 1;

        // Determine season (0-11 months)
        if (monthNum >= 2 && monthNum <= 4) {
          seasonCounts.spring = (seasonCounts.spring || 0) + 1;
        } else if (monthNum >= 5 && monthNum <= 7) {
          seasonCounts.summer = (seasonCounts.summer || 0) + 1;
        } else if (monthNum >= 8 && monthNum <= 10) {
          seasonCounts.fall = (seasonCounts.fall || 0) + 1;
        } else {
          seasonCounts.winter = (seasonCounts.winter || 0) + 1;
        }
      }
    });

    // Also process recommendation history for additional data
    recs.forEach((rec) => {
      // Count occasions from recommendations
      if (rec.occasion) {
        occasionCounts[rec.occasion] = (occasionCounts[rec.occasion] || 0) + 1;
      }

      // Count seasons from recommendations
      if (rec.season) {
        seasonCounts[rec.season] = (seasonCounts[rec.season] || 0) + 1;
      }

      // Track months from recommendations
      if (rec.createdAt) {
        const month = new Date(rec.createdAt.toDate()).toLocaleDateString('en-US', { month: 'short' });
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      }

      // Count feedback
      if (rec.feedback) {
        totalFeedback++;
        if (rec.feedback.liked && rec.feedback.liked.length > 0) {
          totalLikes += rec.feedback.liked.length;

          // Count colors and styles from liked outfits in recommendations
          rec.feedback.liked.forEach((outfitId) => {
            const outfit = rec.recommendations[outfitId as keyof typeof rec.recommendations];
            if (outfit) {
              outfit.colors?.forEach((color) => {
                colorCounts[color] = (colorCounts[color] || 0) + 1;
              });
              if (outfit.style) {
                styleCounts[outfit.style] = (styleCounts[outfit.style] || 0) + 1;
              }
            }
          });
        }
      }
    });

    const topColors = Object.entries(colorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([color, count]) => ({ 
        color, 
        count,
        hex: getColorHex(color)
      }));

    const topOccasions = Object.entries(occasionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([occasion, count]) => ({ occasion, count }));

    const topStyles = Object.entries(styleCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([style, count]) => ({ style, count }));

    const seasonalDistribution = Object.entries(seasonCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([season, count]) => ({ season, count }));

    const mostActiveMonth = Object.entries(monthCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

    const likeRate = totalFeedback > 0 ? (totalLikes / (totalFeedback * 3)) * 100 : 0;

    console.log('✨ Analytics insights:', {
      topColorsCount: topColors.length,
      topOccasionsCount: topOccasions.length,
      topStylesCount: topStyles.length,
      seasonalCount: seasonalDistribution.length,
      likeRate,
    });

    return {
      topColors,
      topOccasions,
      topStyles,
      likeRate: Math.round(likeRate),
      totalRecommendations: recs.length,
      totalFeedback,
      totalLiked: likedTotal,
      seasonalDistribution,
      mostActiveMonth,
    };
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background relative overflow-hidden">
          <div className="container mx-auto py-12 px-4 max-w-7xl">
            <div className="space-y-8">
              <Skeleton className="h-12 w-64" />
              <div className="grid md:grid-cols-4 gap-6">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <Alert variant="destructive" className="max-w-2xl">
            <BarChart3 className="h-4 w-4" />
            <AlertTitle>Error Loading Analytics</AlertTitle>
            <AlertDescription>
              <p className="mb-4">{error}</p>
              <Button onClick={loadAnalytics} variant="outline">
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </ProtectedRoute>
    );
  }

  if (!preferences || (history.length === 0 && likedCount === 0)) {
    return (
      <ProtectedRoute>
        <main className="relative min-h-screen overflow-hidden">
          {/* Particles Background - Fixed Position */}
          <div className="fixed inset-0 -z-10">
            {isMounted && (
              <>
                <SplashCursor />
                <Particles
                  className="absolute inset-0"
                  particleColors={['#8B5CF6', '#A78BFA', '#C4B5FD']}
                  particleCount={500}
                  particleSpread={10}
                  speed={0.3}
                  particleBaseSize={150}
                  moveParticlesOnHover={true}
                  alphaParticles={false}
                  disableRotation={false}
                />
              </>
            )}
          </div>
          
          <div className="container mx-auto py-20 px-4 relative z-10">
            <Card className="max-w-2xl mx-auto bg-card/60 dark:bg-card/40 backdrop-blur-xl border-border/20 shadow-2xl">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-accent" />
                </div>
                <CardTitle className="text-2xl">No Analytics Data Yet</CardTitle>
                <CardDescription className="text-base">
                  Start using SmartStyle to build your personalized style insights!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-center">
                <div className="space-y-3 text-muted-foreground">
                  <p className="flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Upload your photos and get AI recommendations
                  </p>
                  <p className="flex items-center justify-center gap-2">
                    <Heart className="w-4 h-4" />
                    Like outfits that match your style
                  </p>
                  <p className="flex items-center justify-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Watch your style profile evolve over time
                  </p>
                </div>
                <Button asChild size="lg" className="mt-4">
                  <Link href="/style-check">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Get Started
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  const accuracyScore = preferences.accuracyScore || 0;
  const totalSelections = preferences.totalSelections || 0;

  return (
    <ProtectedRoute>
      <main className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8 pb-24">
        {/* Particles Background - Fixed Position covering entire page */}
        <div className="fixed inset-0 -z-10">
          {isMounted && (
            <>
              <SplashCursor />
              <Particles
                className="absolute inset-0"
                particleColors={['#8B5CF6', '#A78BFA', '#C4B5FD']}
                particleCount={500}
                particleSpread={10}
                speed={0.3}
                particleBaseSize={150}
                moveParticlesOnHover={true}
                alphaParticles={false}
                disableRotation={false}
              />
            </>
          )}
        </div>

        <div className="container mx-auto max-w-7xl relative z-10">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8 pb-8"
          >
            {/* Header */}
            <motion.div variants={itemVariants}>
              <div className="text-center mb-8">
                {isMounted && (
                  <div className="mb-4">
                    <TextPressure
                      text="Style Analytics"
                      stroke={true}
                      width={false}
                      weight={true}
                      textColor="#C4B5FD"
                      strokeColor="#5B21B6"
                      minFontSize={48}
                    />
                  </div>
                )}
                <ShinyText
                  className="text-lg text-muted-foreground max-w-2xl mx-auto"
                  text="Your personalized fashion insights and style evolution"
                />
                
                <Button 
                  onClick={loadAnalytics}
                  variant="outline"
                  size="sm"
                  className="mt-6 gap-2"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M21 2v6h-6" />
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                    <path d="M3 22v-6h6" />
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  </svg>
                  Refresh
                </Button>
              </div>
            </motion.div>

            {/* Key Metrics - 3 Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {/* Total Recommendations */}
              <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20 backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <BarChart3 className="w-8 h-8 text-violet-500" />
                    <Badge variant="secondary" className="bg-violet-500/10 text-violet-400 border-violet-500/20">
                      Total
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {insights?.totalRecommendations || 0}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Recommendations
                  </p>
                </CardContent>
              </Card>

              {/* Liked Outfits */}
              <Card className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border-pink-500/20 backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Heart className="w-8 h-8 text-pink-500" />
                    <Badge variant="secondary" className="bg-pink-500/10 text-pink-400 border-pink-500/20">
                      Saved
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {insights?.totalLiked || 0}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Liked Outfits
                  </p>
                </CardContent>
              </Card>

              {/* Accuracy Score */}
              <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20 backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Award className="w-8 h-8 text-emerald-500" />
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      Score
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {accuracyScore}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Match Rate
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Main Content Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Color Preferences - Bar Chart */}
              <motion.div variants={itemVariants}>
                <Card className="bg-card/60 dark:bg-card/40 backdrop-blur-xl border-border/20 shadow-lg h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="w-5 h-5 text-accent" />
                      Color Preferences
                    </CardTitle>
                    <CardDescription>
                      Your most loved colors
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {insights && insights.topColors.length > 0 ? (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={insights.topColors.map(c => ({ 
                              name: c.color.charAt(0).toUpperCase() + c.color.slice(1), 
                              count: c.count,
                              fill: c.hex
                            }))}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                            <XAxis 
                              dataKey="name" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                              angle={-15}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <Tooltip 
                              content={<CustomTooltip />} 
                              cursor={{ fill: 'hsl(var(--accent) / 0.1)' }}
                            />
                            <Bar 
                              dataKey="count" 
                              name="Outfits"
                              radius={[8, 8, 0, 0]}
                              animationDuration={1000}
                              animationBegin={0}
                            >
                              {insights.topColors.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.hex}
                                  className="transition-opacity hover:opacity-80"
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-20">
                        No color preferences yet. Start liking outfits to build your palette!
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Style Preferences - Radar Chart */}
              <motion.div variants={itemVariants}>
                <Card className="bg-card/60 dark:bg-card/40 backdrop-blur-xl border-border/20 shadow-lg h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-accent" />
                      Style Profile
                    </CardTitle>
                    <CardDescription>
                      Your fashion style breakdown
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {insights && insights.topStyles.length > 0 ? (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart 
                            data={insights.topStyles.map(s => ({ 
                              style: s.style.charAt(0).toUpperCase() + s.style.slice(1), 
                              count: s.count 
                            }))}
                            margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
                          >
                            <PolarGrid 
                              stroke="hsl(var(--border))" 
                              opacity={0.3}
                              strokeDasharray="3 3"
                            />
                            <PolarAngleAxis 
                              dataKey="style" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                              fontWeight={500}
                            />
                            <PolarRadiusAxis 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={10}
                              angle={90}
                            />
                            <Tooltip 
                              content={<CustomTooltip />}
                            />
                            <Radar 
                              name="Outfits" 
                              dataKey="count" 
                              stroke={CHART_COLORS.violet[0]}
                              fill={CHART_COLORS.violet[1]}
                              fillOpacity={0.6}
                              animationDuration={1000}
                              animationBegin={200}
                              dot={{ fill: CHART_COLORS.violet[0], r: 4 }}
                              activeDot={{ r: 6, fill: CHART_COLORS.violet[0] }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-20">
                        No style preferences yet. Explore different styles to find your favorites!
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Occasion Breakdown - Pie Chart */}
              <motion.div variants={itemVariants}>
                <Card className="bg-card/60 dark:bg-card/40 backdrop-blur-xl border-border/20 shadow-lg h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-accent" />
                      Occasion Breakdown
                    </CardTitle>
                    <CardDescription>
                      Your style occasions distribution
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {insights && insights.topOccasions.length > 0 ? (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={insights.topOccasions.map((o, idx) => ({ 
                                name: o.occasion.charAt(0).toUpperCase() + o.occasion.slice(1), 
                                value: o.count,
                                fill: CHART_COLORS.pink[idx % CHART_COLORS.pink.length]
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={100}
                              innerRadius={40}
                              dataKey="value"
                              animationDuration={1000}
                              animationBegin={400}
                              paddingAngle={2}
                            >
                              {insights.topOccasions.map((_, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={CHART_COLORS.pink[index % CHART_COLORS.pink.length]}
                                  className="transition-opacity hover:opacity-80"
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-20">
                        No occasion data yet. Get recommendations for different events!
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Seasonal Activity - Area Chart */}
              <motion.div variants={itemVariants}>
                <Card className="bg-card/60 dark:bg-card/40 backdrop-blur-xl border-border/20 shadow-lg h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-accent" />
                      Seasonal Trends
                    </CardTitle>
                    <CardDescription>
                      Your fashion activity across seasons
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {insights && insights.seasonalDistribution.length > 0 ? (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart 
                            data={insights.seasonalDistribution.map(s => ({ 
                              season: s.season.charAt(0).toUpperCase() + s.season.slice(1), 
                              count: s.count 
                            }))}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.emerald[0]} stopOpacity={0.8}/>
                                <stop offset="95%" stopColor={CHART_COLORS.emerald[2]} stopOpacity={0.1}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                            <XAxis 
                              dataKey="season" 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                            />
                            <Tooltip 
                              content={<CustomTooltip />}
                              cursor={{ stroke: CHART_COLORS.emerald[0], strokeWidth: 2 }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="count" 
                              name="Outfits"
                              stroke={CHART_COLORS.emerald[0]}
                              strokeWidth={3}
                              fill="url(#colorCount)"
                              animationDuration={1500}
                              animationBegin={600}
                              dot={{ fill: CHART_COLORS.emerald[0], r: 5 }}
                              activeDot={{ r: 7, fill: CHART_COLORS.emerald[0] }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        <div className="mt-6 grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors">
                            <div className="flex items-center gap-3">
                              <TrendingUp className="w-5 h-5 text-emerald-500" />
                              <span className="text-sm font-medium">Like Rate</span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">{insights?.likeRate || 0}%</div>
                              <p className="text-xs text-muted-foreground">Satisfaction</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors">
                            <div className="flex items-center gap-3">
                              <Star className="w-5 h-5 text-yellow-500" />
                              <span className="text-sm font-medium">Most Active</span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">{insights?.mostActiveMonth || 'N/A'}</div>
                              <p className="text-xs text-muted-foreground">Month</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-20">
                        No seasonal data yet. Start your fashion journey across seasons!
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Quick Actions */}
            <motion.div variants={itemVariants}>
              <Card className="bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border-violet-500/20 backdrop-blur-xl">
                <CardContent className="py-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Ready for more style insights?</h3>
                        <p className="text-sm text-muted-foreground">
                          Continue building your personalized fashion profile
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button asChild variant="outline">
                        <Link href="/likes">
                          <Heart className="w-4 h-4 mr-2" />
                          View Likes
                        </Link>
                      </Button>
                      <Button asChild>
                        <Link href="/style-check">
                          <Sparkles className="w-4 h-4 mr-2" />
                          New Analysis
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
