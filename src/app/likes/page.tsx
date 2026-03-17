'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Sparkles, Trash2, Shirt } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { lazy, Suspense } from 'react';
import dynamic from 'next/dynamic';
const Particles = dynamic(() => import('@/components/Particles'), { ssr: false });
const ShinyText = lazy(() => import('@/components/ShinyText'));
const TextPressure = lazy(() => import('@/components/TextPressure'));
import { useMounted } from '@/hooks/useMounted';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { getLikedOutfits, markLikedOutfitAsWorn, removeLikedOutfit } from '@/lib/likedOutfits';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';
import { updatePreferencesFromWear } from '@/lib/preference-engine';

interface LikedOutfit {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  items: string[];
  occasion?: string;
  styleType?: string;
  colorPalette: string[];
  shoppingLinks: {
    amazon: string | null;
    tatacliq: string | null;
    myntra: string | null;
  };
  itemShoppingLinks?: Array<{
    item: string;
    amazon: string;
    tatacliq: string;
    myntra: string;
  }>;
  likedAt: number;
  wornAt?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 80,
      damping: 15,
    },
  },
};

export default function LikesPage() {
  const isMounted = useMounted();
  const [likedOutfits, setLikedOutfits] = useState<LikedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingWornId, setMarkingWornId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthenticated(true);
        fetchLikedOutfits(user.uid);
      } else {
        setUserId(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRefresh = () => {
    if (userId) {
      setError(null);
      setLoading(true);
      fetchLikedOutfits(userId);
    }
  };

  const handleRemoveLike = async (outfitId: string, outfitTitle: string) => {
    if (!userId) return;

    try {
      const result = await removeLikedOutfit(userId, outfitId);
      
      if (result.success) {
        // Remove from local state immediately for better UX
        setLikedOutfits(prev => prev.filter(outfit => outfit.id !== outfitId));
        
        toast({
          title: 'Removed from likes',
          description: `"${outfitTitle}" has been removed from your favorites.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to remove',
          description: result.message,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to remove outfit from likes',
      });
    }
  };

  const fetchLikedOutfits = async (uid: string) => {
    try {
      setLoading(true);
      setError(null);
      // Use the centralized getLikedOutfits function
      const outfitsData = await getLikedOutfits(uid);
      
      // Data already has the id field from getLikedOutfits
      setLikedOutfits(outfitsData as LikedOutfit[]);
    } catch (error) {
      
      // Set user-friendly error message
      let errorMessage = 'Failed to load your liked outfits';
      if ((error as any)?.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please sign in again.';
      } else if ((error as any)?.code === 'unavailable') {
        errorMessage = 'Database temporarily unavailable. Please try again later.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setLikedOutfits([]);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentSeason = (): 'summer' | 'winter' | 'monsoon' => {
    const month = new Date().getMonth() + 1;
    if (month >= 6 && month <= 9) return 'monsoon';
    if (month >= 11 || month <= 2) return 'winter';
    return 'summer';
  };

  const handleMarkAsWorn = async (outfit: LikedOutfit) => {
    if (!userId || !outfit.id || outfit.wornAt) return;

    setMarkingWornId(outfit.id);
    try {
      const season = getCurrentSeason();
      const prefResult = await updatePreferencesFromWear(userId, {
        colorPalette: outfit.colorPalette,
        items: outfit.items,
        styleType: outfit.styleType,
        occasion: outfit.occasion,
        description: outfit.description,
        title: outfit.title,
      }, {
        occasion: outfit.occasion || 'casual',
        season,
      });

      if (!prefResult.success) {
        throw new Error(prefResult.message || 'Failed to update preferences');
      }

      const wearResult = await markLikedOutfitAsWorn(userId, outfit.id);
      if (!wearResult.success) {
        throw new Error(wearResult.message || 'Failed to save worn state');
      }

      setLikedOutfits(prev => prev.map(item =>
        item.id === outfit.id ? { ...item, wornAt: Date.now() } : item
      ));

      toast({
        title: 'Marked as worn',
        description: `We'll use ${outfit.title} as a strong preference signal for future recommendations.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to mark outfit as worn',
      });
    } finally {
      setMarkingWornId(null);
    }
  };

  // Helper to convert color name/hex to pure hex
  const convertColorToHex = (color: string): string => {
    if (color.startsWith('#')) return color.toUpperCase();
    
    const colorMap: Record<string, string> = {
      'black': '#000000', 'white': '#FFFFFF', 'gray': '#808080', 'grey': '#808080',
      'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000', 'yellow': '#FFFF00',
      'orange': '#FFA500', 'purple': '#800080', 'pink': '#FFC0CB', 'brown': '#A52A2A',
      'navy': '#000080', 'beige': '#F5F5DC', 'cream': '#FFFDD0',
    };
    
    const hexMatch = color.match(/#[0-9A-Fa-f]{6}/);
    if (hexMatch) return hexMatch[0].toUpperCase();
    
    return colorMap[color.toLowerCase()] || '#808080';
  };

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Particles Background */}
      <div className="absolute inset-0 -z-10" >
        {isMounted && (
          <Particles
            className="absolute inset-0"
            particleColors={['#7c3aed', '#5b21b6']}
            particleCount={200}
            particleSpread={10}
            speed={0.5}
            particleBaseSize={150}
            moveParticlesOnHover={true}
            alphaParticles={false}
            disableRotation={false}
          />
        )}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 sm:mb-12 md:mb-16 relative">
          <div className="relative h-[180px] sm:h-[240px] md:h-[300px] max-w-4xl mx-auto">
            {isMounted && (
              <Suspense fallback={<h1 className="text-3xl sm:text-4xl md:text-6xl font-bold bg-gradient-to-r from-violet-400 to-purple-600 bg-clip-text text-transparent">Your Likes</h1>}>
                <TextPressure
                  text="Your Likes"
                  stroke={true}
                  width={true}
                  weight={false}
                  textColor="#c4b5fd"
                  strokeColor="#6d28d9"
                  minFontSize={32}
                />
              </Suspense>
            )}
          </div>
          {/* Refresh button - only show when there are liked outfits */}
          {likedOutfits.length > 0 && (
            <div className="flex justify-center mt-4">
              <Button 
                onClick={handleRefresh}
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
          )}
          <Suspense fallback={<p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">Your curated collection of favorite outfit recommendations</p>}>
            <ShinyText
              className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
              text="Your curated collection of favorite outfit recommendations"
            />
          </Suspense>
        </header>

        {/* Content */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-64 w-full" />
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !isAuthenticated ? (
          <Alert className="max-w-2xl mx-auto bg-card/60 dark:bg-card/40 backdrop-blur-xl border-accent/30">
            <Heart className="h-4 w-4" />
            <AlertTitle>Sign in required</AlertTitle>
            <AlertDescription>
              <p className="mb-4">Sign in to view and save your favorite outfit recommendations.</p>
              <Button asChild variant="default">
                <Link href="/auth">Sign In</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : error ? (
          <Alert className="max-w-2xl mx-auto bg-red-500/10 dark:bg-red-500/10 backdrop-blur-xl border-red-500/30" variant="destructive">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <AlertTitle>Error Loading Likes</AlertTitle>
            <AlertDescription>
              <p className="mb-4">{error}</p>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleRefresh}
                  className="bg-background"
                >
                  Try Again
                </Button>
                <Button asChild variant="outline" className="bg-background">
                  <Link href="/style-check">Get New Recommendations</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : likedOutfits.length === 0 ? (
          <Alert className="max-w-2xl mx-auto bg-card/60 dark:bg-card/40 backdrop-blur-xl border-border/20">
            <Sparkles className="h-4 w-4" />
            <AlertTitle>No liked outfits yet</AlertTitle>
            <AlertDescription>
              <p className="mb-4">Start exploring recommendations and like your favorites!</p>
              <div className="flex gap-3">
                <Button asChild variant="default">
                  <Link href="/style-check">Get Style Recommendations</Link>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => userId && fetchLikedOutfits(userId)}
                >
                  Refresh
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {likedOutfits.map((outfit) => (
              <motion.div key={outfit.id} variants={itemVariants}>
                <Card className="overflow-hidden bg-card/60 dark:bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-shadow duration-300">
                  {/* Outfit Image */}
                  <div className="relative aspect-square">
                    <Image
                      src={outfit.imageUrl}
                      alt={outfit.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    {/* Like indicator and Remove button */}
                    <div className="absolute top-3 right-3 flex gap-2">
                      <Button
                        size="icon"
                        variant="destructive"
                        className="rounded-full shadow-md hover:scale-105 transition-transform"
                        onClick={() => handleRemoveLike(outfit.id!, outfit.title)}
                        title="Remove from likes"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="bg-violet-600 rounded-full p-2 shadow-lg">
                        <Heart className="w-5 h-5 text-white fill-white" />
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-6">
                    {/* Title */}
                    <h3 className="font-bold text-xl mb-3 text-foreground">{outfit.title}</h3>

                    {/* Description */}
                    {outfit.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {outfit.description}
                      </p>
                    )}

                    {/* Occasion and Style Type Badges */}
                    <div className="mb-4 flex flex-wrap gap-2">
                      {outfit.occasion && (
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />
                          {outfit.occasion}
                        </Badge>
                      )}
                      {outfit.styleType && (
                        <Badge variant="outline" className="text-xs">
                          <Shirt className="w-3 h-3 mr-1" />
                          {outfit.styleType}
                        </Badge>
                      )}
                    </div>

                    {/* Color Palette - Visual only */}
                    {outfit.colorPalette && outfit.colorPalette.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Colors
                        </h5>
                        <div className="flex gap-2">
                          {outfit.colorPalette.map((color, idx) => {
                            const hex = convertColorToHex(color);
                            const isValidHex = /^#[0-9A-F]{6}$/i.test(hex);
                            return (
                              <div
                                key={idx}
                                className="w-8 h-8 rounded-full border-2 border-white/20 shadow-sm"
                                style={{ backgroundColor: isValidHex ? hex : '#808080' }}
                                title={hex}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Outfit Items with Shopping Links */}
                    {outfit.items && outfit.items.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Items
                        </h5>
                        <ul className="space-y-2 text-sm text-foreground/80">
                          {outfit.items.slice(0, 3).map((item, idx) => {
                            // Find shopping links for this specific item
                            const itemLinks = outfit.itemShoppingLinks?.find(link => link.item === item);
                            
                            return (
                              <li key={idx} className="flex flex-col gap-1">
                                <div className="flex items-start gap-2">
                                  <span className="text-accent mt-0.5">•</span>
                                  <span>{item}</span>
                                </div>
                                {/* Individual item shopping links */}
                                {itemLinks && (
                                  <div className="ml-4 flex flex-wrap gap-1">
                                    {itemLinks.amazon && (
                                      <a
                                        href={itemLinks.amazon}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
                                        title={`Shop ${item} on Amazon`}
                                      >
                                        <ShoppingCart className="w-2.5 h-2.5" />
                                        Amazon
                                      </a>
                                    )}
                                    {itemLinks.tatacliq && (
                                      <a
                                        href={itemLinks.tatacliq}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
                                        title={`Shop ${item} on TATA CLiQ`}
                                      >
                                        <ShoppingCart className="w-2.5 h-2.5" />
                                        CLiQ
                                      </a>
                                    )}
                                    {itemLinks.myntra && (
                                      <a
                                        href={itemLinks.myntra}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-500/20 transition-colors"
                                        title={`Shop ${item} on Myntra`}
                                      >
                                        <ShoppingCart className="w-2.5 h-2.5" />
                                        Myntra
                                      </a>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    
                    {/* Overall shopping links removed per request */}

                    <div className="pt-4 mt-4 border-t border-border/20">
                      <Button
                        onClick={() => handleMarkAsWorn(outfit)}
                        disabled={Boolean(outfit.wornAt) || markingWornId === outfit.id}
                        className={`w-full gap-2 ${outfit.wornAt ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''}`}
                        variant={outfit.wornAt ? 'default' : 'outline'}
                      >
                        <Shirt className="w-4 h-4" />
                        {markingWornId === outfit.id
                          ? 'Saving...'
                          : outfit.wornAt
                          ? 'Worn ✓'
                          : 'I Wore This'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}
