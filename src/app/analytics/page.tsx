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
  Calendar,
  ShoppingBag,
  Sparkles,
  BarChart3,
  PieChart
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import { 
  getUserPreferences, 
  getRecommendationHistory,
  getStyleInsights
} from '@/lib/personalization';
import type { UserPreferences, RecommendationHistory } from '@/lib/personalization';
import Link from 'next/link';

interface StyleInsights {
  topColors: { color: string; count: number }[];
  topOccasions: { occasion: string; count: number }[];
  likeRate: number;
  totalRecommendations: number;
  totalFeedback: number;
  seasonalDistribution: { season: string; count: number }[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [history, setHistory] = useState<RecommendationHistory[]>([]);
  const [insights, setInsights] = useState<StyleInsights | null>(null);

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

      // Fetch user preferences
      const prefs = await getUserPreferences(user.uid);
      console.log('📊 User preferences:', prefs);
      setPreferences(prefs);

      // Fetch recommendation history
      const recs = await getRecommendationHistory(user.uid, 50);
      console.log('📊 Recommendation history:', recs.length, 'items');
      setHistory(recs);

      // Calculate insights
      const calculatedInsights = calculateInsights(recs);
      console.log('📊 Calculated insights:', calculatedInsights);
      setInsights(calculatedInsights);

    } catch (error) {
      console.error('❌ Error loading analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const calculateInsights = (recs: RecommendationHistory[]): StyleInsights => {
    const colorCounts: { [key: string]: number } = {};
    const occasionCounts: { [key: string]: number } = {};
    const seasonCounts: { [key: string]: number } = {};
    let totalLikes = 0;
    let totalFeedback = 0;

    recs.forEach((rec) => {
      // Count occasions
      if (rec.occasion) {
        occasionCounts[rec.occasion] = (occasionCounts[rec.occasion] || 0) + 1;
      }

      // Count seasons
      if (rec.season) {
        seasonCounts[rec.season] = (seasonCounts[rec.season] || 0) + 1;
      }

      // Count feedback
      if (rec.feedback) {
        totalFeedback++;
        if (rec.feedback.liked && rec.feedback.liked.length > 0) {
          totalLikes += rec.feedback.liked.length;
        }

        // Count colors from liked outfits
        rec.feedback.liked?.forEach((outfitId) => {
          const outfit = rec.recommendations[outfitId as keyof typeof rec.recommendations];
          outfit?.colors.forEach((color) => {
            colorCounts[color] = (colorCounts[color] || 0) + 1;
          });
        });
      }
    });

    const topColors = Object.entries(colorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([color, count]) => ({ color, count }));

    const topOccasions = Object.entries(occasionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([occasion, count]) => ({ occasion, count }));

    const seasonalDistribution = Object.entries(seasonCounts)
      .map(([season, count]) => ({ season, count }));

    const likeRate = totalFeedback > 0 ? (totalLikes / (totalFeedback * 3)) * 100 : 0;

    return {
      topColors,
      topOccasions,
      likeRate: Math.round(likeRate),
      totalRecommendations: recs.length,
      totalFeedback,
      seasonalDistribution,
    };
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto py-12 px-4">
          <div className="space-y-8">
            <Skeleton className="h-12 w-64" />
            <div className="grid md:grid-cols-3 gap-6">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto py-12 px-4">
          <Alert variant="destructive" className="max-w-2xl mx-auto">
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

  if (!preferences || history.length === 0) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto py-12 px-4">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6" />
                No Analytics Yet
              </CardTitle>
              <CardDescription>
                Start using the Style Advisor to build your personalized analytics!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Upload outfits, get recommendations, and provide feedback to see your style insights here.
              </p>
              <Button asChild>
                <Link href="/style-check">Get Started</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
    <div className="container mx-auto py-12 px-4">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <BarChart3 className="w-10 h-10 text-accent" />
                Your Style Analytics
              </h1>
              <p className="text-muted-foreground mt-2">
                Insights into your fashion preferences and style evolution
              </p>
            </div>
            <Button 
              onClick={loadAnalytics}
              variant="outline"
              size="sm"
              className="gap-2"
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

        {/* Key Metrics */}
        <motion.div variants={itemVariants} className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{insights?.totalRecommendations || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Outfits analyzed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Feedback Given
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{insights?.totalFeedback || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Preferences learned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Like Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{insights?.likeRate || 0}%</div>
              <Progress value={insights?.likeRate || 0} className="mt-2" />
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Favorite Colors */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-accent" />
                  Your Color Preferences
                </CardTitle>
                <CardDescription>
                  Colors you&apos;ve liked most in recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights?.topColors.map((item, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-lg border-2 border-border shadow-sm flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                        title={item.color}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-sm">{item.color}</span>
                          <Badge variant="secondary">{item.count} likes</Badge>
                        </div>
                        <Progress value={(item.count / (insights?.topColors[0]?.count || 1)) * 100} />
                      </div>
                    </div>
                  ))}
                </div>

                {preferences && preferences.dislikedColors.length > 0 && (
                  <>
                    <Separator className="my-6" />
                    <div>
                      <h4 className="font-semibold mb-3 text-sm text-muted-foreground">
                        Colors You Avoid
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {preferences.dislikedColors.map((color, index) => (
                          <Badge key={index} variant="destructive" className="opacity-60">
                            {color}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Occasions */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-accent" />
                  Your Occasions
                </CardTitle>
                <CardDescription>
                  Events you&apos;ve styled for most
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights?.topOccasions.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium capitalize">{item.occasion}</div>
                        <Progress 
                          value={(item.count / (insights?.topOccasions[0]?.count || 1)) * 100} 
                          className="mt-2"
                        />
                      </div>
                      <Badge variant="outline" className="ml-4">
                        {item.count}
                      </Badge>
                    </div>
                  ))}
                </div>

                {insights && insights.seasonalDistribution.length > 0 && (
                  <>
                    <Separator className="my-6" />
                    <div>
                      <h4 className="font-semibold mb-3 text-sm text-muted-foreground">
                        Seasonal Distribution
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {insights.seasonalDistribution.map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize">
                              {item.season}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Style Preferences */}
        {preferences && (preferences.preferredStyles.length > 0 || preferences.avoidedStyles.length > 0) && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-accent" />
                  Style Preferences
                </CardTitle>
                <CardDescription>
                  Your learned fashion style tendencies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {preferences.preferredStyles.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        Preferred Styles
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {preferences.preferredStyles.map((style, index) => (
                          <Badge key={index} variant="default" className="capitalize">
                            {style}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {preferences.avoidedStyles.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-red-500" />
                        Avoided Styles
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {preferences.avoidedStyles.map((style, index) => (
                          <Badge key={index} variant="outline" className="capitalize opacity-60">
                            {style}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
    </ProtectedRoute>
  );
}
