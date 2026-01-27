'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, ExternalLink, Sparkles, Trash2, Shirt } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Particles from '@/components/Particles';
import ShinyText from '@/components/ShinyText';
import TextPressure from '@/components/TextPressure';
import { useMounted } from '@/hooks/useMounted';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { getLikedOutfits, removeLikedOutfit } from '@/lib/likedOutfits';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';

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
      console.log('🔄 Manual refresh triggered');
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
      console.error('Error removing like:', error);
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
      console.log('🔍 Fetching liked outfits for user:', uid);
      console.log('🔍 Firebase db object:', db);
      console.log('🔍 Auth current user:', auth.currentUser?.uid);
      
      // Use the centralized getLikedOutfits function
      const outfitsData = await getLikedOutfits(uid);
      
      console.log('✅ Fetched outfits:', outfitsData.length, 'valid outfits');
      if (outfitsData.length > 0) {
        console.log('📊 First outfit:', outfitsData[0]);
        console.log('📊 All outfit titles:', outfitsData.map(o => o.title));
      }
      
      // Data already has the id field from getLikedOutfits
      setLikedOutfits(outfitsData as LikedOutfit[]);
      
      if (outfitsData.length === 0) {
        console.log('ℹ️ No liked outfits found in database - user may need to like some outfits first');
      }
    } catch (error) {
      console.error('❌ Error fetching liked outfits:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
      });
      
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
      <main className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Particles Background */}
      <div className="absolute inset-0 -z-10" >
        {isMounted && (
          <Particles
            className="absolute inset-0"
            particleColors={['#ef4444', '#fca5a5']}
            particleCount={500}
            particleSpread={8}
            speed={0.2}
            particleBaseSize={120}
            moveParticlesOnHover={true}
            alphaParticles={false}
            disableRotation={false}
          />
        )}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-16 relative">
          <div style={{ 
            position: 'relative', 
            height: '350px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            paddingTop: '90px', 
            paddingBottom: '90px',
            paddingLeft: '40px',
            paddingRight: '40px'
          }}>
            {isMounted && (
              <TextPressure
                text="Your Likes"
                stroke={true}
                width={false}
                weight={true}
                textColor="#fca5a5"
                strokeColor="#dc2626"
                minFontSize={32}
              />
            )}
            {/* Refresh button - only show when there are liked outfits */}
            {likedOutfits.length > 0 && (
              <Button 
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                className="absolute top-4 right-4 gap-2"
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
            )}
          </div>
          <ShinyText
            className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
            text="Your curated collection of favorite outfit recommendations"
          />
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
                      priority={true}
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
                      <div className="bg-red-500 rounded-full p-2 shadow-lg">
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
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors"
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
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
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
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 transition-colors"
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
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </main>
    </ProtectedRoute>
  );
}
