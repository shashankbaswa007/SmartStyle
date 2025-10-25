"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles, Palette, Shirt, PenTool, Wand2, ShoppingCart, ShoppingBag, ExternalLink, Check, Heart, Info } from "lucide-react";
import type { AnalyzeImageAndProvideRecommendationsOutput } from "@/ai/flows/analyze-image-and-provide-recommendations";
import { Separator } from "./ui/separator";
import { RecommendationFeedback } from "./RecommendationFeedback";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { trackOutfitSelection } from "@/lib/personalization";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { saveRecommendationUsage } from "@/app/actions";

interface StyleAdvisorResultsProps {
  analysisResult: AnalyzeImageAndProvideRecommendationsOutput;
  generatedImageUrls: string[];
  imageSources?: ('gemini' | 'pollinations' | 'placeholder')[];
  recommendationId: string | null;
}

type ShoppingLinks = { amazon?: string | null; flipkart?: string | null; myntra?: string | null };

// Helper function to convert color names to hex codes
const convertColorNameToHex = (colorName: string): string => {
  // If already hex, return as-is
  if (colorName.startsWith('#')) return colorName;
  
  // Common color name to hex mappings
  const colorMap: Record<string, string> = {
    // Basics
    'black': '#000000', 'white': '#FFFFFF', 'gray': '#808080', 'grey': '#808080',
    'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000', 'yellow': '#FFFF00',
    'orange': '#FFA500', 'purple': '#800080', 'pink': '#FFC0CB', 'brown': '#A52A2A',
    
    // Extended colors
    'navy': '#000080', 'navy blue': '#000080', 'teal': '#008080', 'maroon': '#800000',
    'olive': '#808000', 'lime': '#00FF00', 'aqua': '#00FFFF', 'fuchsia': '#FF00FF',
    'silver': '#C0C0C0', 'gold': '#FFD700', 'beige': '#F5F5DC', 'tan': '#D2B48C',
    'khaki': '#F0E68C', 'ivory': '#FFFFF0', 'cream': '#FFFDD0', 'coral': '#FF7F50',
    'salmon': '#FA8072', 'crimson': '#DC143C', 'burgundy': '#800020', 'wine': '#722F37',
    
    // Shades
    'light gray': '#D3D3D3', 'dark gray': '#A9A9A9', 'light blue': '#ADD8E6',
    'dark blue': '#00008B', 'light green': '#90EE90', 'dark green': '#006400',
    'light pink': '#FFB6C1', 'dark red': '#8B0000', 'sky blue': '#87CEEB',
    'royal blue': '#4169E1', 'midnight blue': '#191970', 'powder blue': '#B0E0E6',
    
    // Fashion colors
    'charcoal': '#36454F', 'slate': '#708090', 'taupe': '#483C32',
    'mauve': '#E0B0FF', 'lavender': '#E6E6FA', 'mint': '#98FF98',
    'peach': '#FFDAB9', 'rose': '#FF007F', 'sage': '#9DC183',
    'mustard': '#FFDB58', 'rust': '#B7410E', 'emerald': '#50C878',
    'sapphire': '#0F52BA', 'ruby': '#E0115F', 'amber': '#FFBF00',
  };

  const normalized = colorName.toLowerCase().trim();
  return colorMap[normalized] || '#808080'; // Default to gray if unknown
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
    },
  },
};

const cardClasses = "bg-card/60 dark:bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl overflow-hidden";

export function StyleAdvisorResults({
  analysisResult,
  generatedImageUrls,
  imageSources = [],
  recommendationId,
}: StyleAdvisorResultsProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedOutfit, setSelectedOutfit] = useState<string | null>(null);
  const [isUsing, setIsUsing] = useState<number | null>(null);
  const { toast } = useToast();
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // NEW: Track image loading state
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());

  // Reset image loading state when new images arrive
  useEffect(() => {
    setLoadedImages(new Set());
    setImageLoadErrors(new Set());
  }, [generatedImageUrls]);

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => new Set(prev).add(index));
  };

  const handleImageError = (index: number) => {
    setImageLoadErrors(prev => new Set(prev).add(index));
  };

  useEffect(() => {
    console.log('🔍 StyleAdvisorResults: Setting up Firebase auth listener...');
    
    // Direct Firebase auth state listener (bypassing custom wrapper)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔥 Firebase auth state update:', {
        timestamp: new Date().toISOString(),
        hasUser: !!user,
        uid: user?.uid,
        email: user?.email,
        displayName: user?.displayName,
        isAnonymous: user?.isAnonymous,
        providerData: user?.providerData,
      });

      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
        setIsAnonymous(user.isAnonymous);
        console.log(`✅ User authenticated: ${user.email || user.uid} (Anonymous: ${user.isAnonymous})`);
      } else {
        setUserId(null);
        setUserEmail(null);
        setIsAnonymous(true);
        console.log('⚠️ No authenticated user found');
      }
      
      setAuthChecked(true);
    });

    // Also log current user immediately
    const currentUser = auth.currentUser;
    console.log('📌 Current auth.currentUser on mount:', {
      hasUser: !!currentUser,
      uid: currentUser?.uid,
      email: currentUser?.email,
      isAnonymous: currentUser?.isAnonymous,
    });

    return () => {
      console.log('� Cleaning up Firebase auth listener');
      unsubscribe();
    };
  }, []);

  const handleUseOutfit = async (outfitIndex: number, outfitTitle: string) => {
    console.log('🔘 User clicked "Use This Outfit"', { 
      outfitIndex, 
      outfitTitle,
      userId, 
      recommendationId,
      isAnonymous,
      authChecked,
      checks: {
        hasUserId: !!userId,
        hasRecommendationId: !!recommendationId,
        isNotAnonymous: !isAnonymous
      }
    });
    
    if (!userId || !recommendationId || isAnonymous) {
      console.error('❌ Auth check failed:', {
        missingUserId: !userId,
        missingRecommendationId: !recommendationId,
        userIsAnonymous: isAnonymous
      });
      
      toast({
        title: "Sign in required",
        description: "Please sign in to save outfits",
        action: (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = '/auth'}
          >
            Sign In
          </Button>
        ),
      });
      return;
    }

    setIsUsing(outfitIndex);
    try {
      // Get the current user's ID token for server authentication
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const idToken = await currentUser.getIdToken();
      console.log('� Got ID token, calling saveRecommendationUsage...');
      
      const result = await saveRecommendationUsage(idToken, recommendationId, outfitIndex, outfitTitle);
      
      if (result.success) {
        setSelectedOutfit(`outfit${outfitIndex}`);
        // Also track for personalization
        await trackOutfitSelection(userId, recommendationId, `outfit${outfitIndex}` as any);
        
        console.log('✅ Outfit selection tracked successfully!');
        toast({
          title: "Outfit Saved! 🎉",
          description: `"${outfitTitle}" saved to your preferences. Future recommendations will be personalized!`,
        });
      } else {
        if (result.error?.includes('sign in')) {
          toast({
            title: "Sign in required",
            description: result.error,
            action: (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/auth'}
              >
                Sign In
              </Button>
            ),
          });
        } else if (result.error?.includes('not found')) {
          toast({
            title: "Recommendation Expired",
            description: "This recommendation has expired. Please generate a new one.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to save outfit. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('❌ Error using outfit:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save outfit selection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUsing(null);
    }
  };

  const findSimilar = async (query: string, colors?: string[]): Promise<ShoppingLinks | null> => {
    try {
      const res = await fetch('/api/tavily/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, colors }),
      });
      const data = await res.json();
      return data?.links as ShoppingLinks | null;
    } catch (err) {
      console.warn('Find similar failed', err);
      return null;
    }
  };
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-8"
    >
      <header className="text-center">
        <h2 className="text-3xl md:text-4xl font-headline font-bold text-foreground flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 text-accent" /> Your Style Analysis
        </h2>
        
        {/* AI Provider Badge */}
        {analysisResult.provider && (
          <div className="mt-3 flex items-center justify-center">
            <Badge variant="secondary" className="text-sm px-4 py-1.5 gap-2">
              {analysisResult.provider === 'gemini' ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>🤖 Powered by Gemini AI</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>⚡ Powered by Groq AI (Llama 3.3 70B)</span>
                </>
              )}
            </Badge>
          </div>
        )}
        
        <p className="mt-2 text-muted-foreground">{analysisResult.feedback}</p>
      </header>
      
      <Separator />

      {/* Feedback and Color Suggestions - Top Section */}
      <div className="grid md:grid-cols-2 gap-8">
        <motion.div variants={itemVariants} className={cardClasses}>
          <div className="p-6">
            <h3 className="font-bold text-xl mb-4 text-foreground flex items-center gap-2"><Sparkles className="text-accent" /> Highlights</h3>
            <ul className="space-y-2 list-disc pl-5 text-muted-foreground">
              {analysisResult.highlights.map((highlight, i) => (
                <li key={i}>{highlight}</li>
              ))}
            </ul>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className={cardClasses}>
          <div className="p-6">
            <h3 className="font-bold text-xl mb-4 text-foreground flex items-center gap-2"><Palette className="text-accent" /> Color Suggestions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {analysisResult.colorSuggestions.map((color, i) => (
                <div key={i} className="text-center">
                  <div 
                    className="w-16 h-16 rounded-full mx-auto mb-2 shadow-inner border-2 border-white/20"
                    style={{ backgroundColor: color.hex }}
                    title={color.reason}
                  />
                  <p className="text-sm font-medium">{color.name}</p>
                  <p className="text-xs text-muted-foreground">{color.hex}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className={cardClasses}>
        <div className="p-6">
          <h3 className="font-bold text-xl mb-4 text-foreground flex items-center gap-2"><PenTool className="text-accent" /> Pro Tip</h3>
          <p className="text-muted-foreground italic">&ldquo;{analysisResult.notes}&rdquo;</p>
        </div>
      </motion.div>

      {/* Outfit Recommendations - Full Width with Side-by-Side Layout */}
      <div className="space-y-6">
        <h3 className="font-bold text-2xl text-foreground flex items-center gap-2">
          <Shirt className="text-accent" /> Your Outfit Recommendations
        </h3>

        {/* Anonymous User Alert */}
        {isAnonymous && authChecked && (
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div className="flex items-center justify-between flex-1">
              <div>
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Sign in to save outfits</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Create an account to save your favorite outfits and get personalized recommendations!</p>
              </div>
              <Button 
                variant="default" 
                size="sm"
                className="ml-4 whitespace-nowrap"
                onClick={() => {
                  console.log('🔄 Redirecting to /auth...');
                  window.location.href = '/auth';
                }}
              >
                Sign In Now →
              </Button>
            </div>
          </Alert>
        )}

        {analysisResult.outfitRecommendations.map((outfit, index) => {
          const outfitId = `outfit${index + 1}` as 'outfit1' | 'outfit2' | 'outfit3';
          const isSelected = selectedOutfit === outfitId;
          const isLoading = isUsing === index;
          const isImageLoaded = loadedImages.has(index);
          const hasImageError = imageLoadErrors.has(index);

          return (
            <motion.div key={index} variants={itemVariants} className={cardClasses}>
              <div className="p-6">
                {/* Outfit Header with Select Button */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex-1">
                    <h4 className="font-bold text-xl text-foreground flex items-center gap-2">
                      <Wand2 className="text-accent w-5 h-5" /> {outfit.title}
                    </h4>
                    {outfit.isExistingMatch && (
                      <Badge variant="secondary" className="mt-2">
                        ✨ Trending style match
                      </Badge>
                    )}
                  </div>
                  
                  {/* Use This Outfit Button */}
                  <button
                    onClick={() => handleUseOutfit(index, outfit.title)}
                    disabled={isSelected || isLoading || isAnonymous || !isImageLoaded}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                      isSelected
                        ? 'bg-green-500/20 text-green-600 cursor-not-allowed'
                        : isAnonymous || !isImageLoaded
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : isLoading
                        ? 'bg-accent/50 text-white cursor-wait'
                        : 'bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-white shadow-lg hover:shadow-xl hover:scale-105'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-5 h-5" />
                        Selected
                      </>
                    ) : isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Heart className="w-5 h-5" />
                        Use This Outfit
                      </>
                    )}
                  </button>
                </div>

                {/* Image and Description Side by Side */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {/* Left: Generated Image */}
                  <div className="relative">
                    {generatedImageUrls[index] ? (
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-lg border-2 border-accent/30">
                        {/* Loading Skeleton - Show until image loads */}
                        {!loadedImages.has(index) && !imageLoadErrors.has(index) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
                            <div className="text-center space-y-3">
                              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                              <p className="text-sm text-muted-foreground">Loading image...</p>
                            </div>
                          </div>
                        )}

                        {/* Actual Image - Hidden until loaded */}
                        <Image 
                          src={generatedImageUrls[index]} 
                          alt={`Generated outfit: ${outfit.title}`} 
                          fill 
                          style={{ objectFit: 'cover' }} 
                          className={`transition-opacity duration-300 ${
                            loadedImages.has(index) ? 'opacity-100' : 'opacity-0'
                          }`}
                          data-ai-hint="fashion outfit" 
                          priority={index === 0}
                          onLoad={() => handleImageLoad(index)}
                          onError={() => handleImageError(index)}
                        />
                        
                        {/* REMOVED: No watermark/attribution shown */}
                      </div>
                    ) : (
                      <div className="aspect-square w-full rounded-xl bg-muted animate-pulse flex items-center justify-center">
                        <Wand2 className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Right: Outfit Details */}
                  <div className="space-y-4">
                    {/* Description */}
                    {outfit.description && (
                      <div>
                        <h5 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Description
                        </h5>
                        <p className="text-foreground/90 leading-relaxed">
                          {outfit.description}
                        </p>
                      </div>
                    )}

                    {/* Color Palette */}
                    {outfit.colorPalette && outfit.colorPalette.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Color Palette
                        </h5>
                        <div className="flex gap-2 flex-wrap">
                          {outfit.colorPalette.map((colorValue, idx) => {
                            // Convert color name to hex if needed
                            const hex = convertColorNameToHex(colorValue);
                            const isValidHex = /^#[0-9A-F]{6}$/i.test(hex);
                            
                            return (
                              <div key={idx} className="group relative">
                                <div 
                                  className="w-10 h-10 rounded-full border-2 border-white/20 shadow-md hover:scale-110 transition-transform"
                                  style={{ backgroundColor: isValidHex ? hex : '#808080' }}
                                  title={`${colorValue}${hex !== colorValue ? ` (${hex})` : ''}`}
                                />
                                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  {colorValue}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Outfit Items */}
                    {outfit.items && outfit.items.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Outfit Items
                        </h5>
                        <ul className="space-y-1 text-foreground/80">
                          {outfit.items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-accent mt-1">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shopping Links */}
                <div className="pt-4 border-t border-border/20">
                  <h5 className="text-sm font-semibold mb-3 text-foreground/90 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Shop This Look
                  </h5>
                  
                  {/* Show helpful message if no links available */}
                  {!(outfit.shoppingLinks?.amazon || outfit.shoppingLinks?.flipkart || outfit.shoppingLinks?.myntra) && (
                    <Alert className="mb-3">
                      <Info className="w-4 h-4" />
                      <AlertTitle className="text-sm">Shopping links not available</AlertTitle>
                      <AlertDescription className="text-xs">
                        Try searching for &ldquo;{outfit.title}&rdquo; on your favorite shopping site, or use the items list above to shop manually.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    {/* Amazon */}
                    <a
                      href={outfit.shoppingLinks?.amazon ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border ${
                        outfit.shoppingLinks?.amazon 
                          ? 'hover:translate-y-[-2px] transition-all duration-150 hover:shadow-md cursor-pointer' 
                          : 'opacity-40 cursor-not-allowed'
                      } text-orange-500 border-orange-200 bg-transparent`}
                      aria-disabled={!outfit.shoppingLinks?.amazon}
                      onClick={(e) => { if (!outfit.shoppingLinks?.amazon) e.preventDefault(); }}
                      style={{ backgroundColor: outfit.shoppingLinks?.amazon ? 'rgba(255,153,0,0.04)' : undefined }}
                      title={outfit.shoppingLinks?.amazon ? 'View on Amazon' : 'Link not available'}
                    >
                      <ShoppingBag className="w-4 h-4 text-orange-500" />
                      <span className="sr-only">View on Amazon</span>
                      <span className="hidden sm:inline">Amazon</span>
                      {outfit.shoppingLinks?.amazon && <ExternalLink className="w-3 h-3 ml-1 text-muted-foreground" />}
                    </a>

                    {/* Flipkart */}
                    <a
                      href={outfit.shoppingLinks?.flipkart ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border ${
                        outfit.shoppingLinks?.flipkart 
                          ? 'hover:translate-y-[-2px] transition-all duration-150 hover:shadow-md cursor-pointer' 
                          : 'opacity-40 cursor-not-allowed'
                      } text-blue-500 border-blue-200 bg-transparent`}
                      aria-disabled={!outfit.shoppingLinks?.flipkart}
                      onClick={(e) => { if (!outfit.shoppingLinks?.flipkart) e.preventDefault(); }}
                      style={{ backgroundColor: outfit.shoppingLinks?.flipkart ? 'rgba(40,116,240,0.04)' : undefined }}
                      title={outfit.shoppingLinks?.flipkart ? 'View on Flipkart' : 'Link not available'}
                    >
                      <ShoppingCart className="w-4 h-4 text-blue-500" />
                      <span className="sr-only">View on Flipkart</span>
                      <span className="hidden sm:inline">Flipkart</span>
                      {outfit.shoppingLinks?.flipkart && <ExternalLink className="w-3 h-3 ml-1 text-muted-foreground" />}
                    </a>

                    {/* Myntra */}
                    <a
                      href={outfit.shoppingLinks?.myntra ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border ${
                        outfit.shoppingLinks?.myntra 
                          ? 'hover:translate-y-[-2px] transition-all duration-150 hover:shadow-md cursor-pointer' 
                          : 'opacity-40 cursor-not-allowed'
                      } text-pink-500 border-pink-200 bg-transparent`}
                      aria-disabled={!outfit.shoppingLinks?.myntra}
                      onClick={(e) => { if (!outfit.shoppingLinks?.myntra) e.preventDefault(); }}
                      style={{ backgroundColor: outfit.shoppingLinks?.myntra ? 'rgba(233,30,99,0.04)' : undefined }}
                      title={outfit.shoppingLinks?.myntra ? 'View on Myntra' : 'Link not available'}
                    >
                      <ShoppingBag className="w-4 h-4 text-pink-500" />
                      <span className="sr-only">View on Myntra</span>
                      <span className="hidden sm:inline">Myntra</span>
                      {outfit.shoppingLinks?.myntra && <ExternalLink className="w-3 h-3 ml-1 text-muted-foreground" />}
                    </a>
                  </div>
                </div>

                {/* Use This Outfit Button - Always visible */}
                <div className="pt-6 border-t border-border/20">
                  {!userId || !recommendationId || isAnonymous ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          toast({
                            title: "Sign in required",
                            description: "Create an account to save your favorite outfits and get personalized recommendations!",
                            action: (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.location.href = '/auth'}
                              >
                                Sign In
                              </Button>
                            ),
                          });
                        }}
                        className="w-full px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 bg-gradient-to-r from-accent/70 to-accent/50 hover:from-accent/80 hover:to-accent/60 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <Heart className="w-6 h-6" />
                        <span>Save This Outfit</span>
                      </button>
                      <p className="text-xs text-muted-foreground text-center">
                        Sign in to save outfits and get personalized recommendations
                      </p>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => handleUseOutfit(index, outfit.title)}
                        disabled={selectedOutfit === `outfit${index + 1}` || isUsing === index}
                        className={`w-full px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                          selectedOutfit === `outfit${index + 1}`
                            ? 'bg-green-500/20 text-green-600 border-2 border-green-500 cursor-not-allowed'
                            : isUsing === index
                            ? 'bg-accent/50 text-white cursor-wait'
                            : 'bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                        }`}
                      >
                        {isUsing === index ? (
                          <>
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : selectedOutfit === `outfit${index + 1}` ? (
                          <>
                            <Check className="w-6 h-6" />
                            <span>Selected as Favorite ✓</span>
                          </>
                        ) : (
                          <>
                            <Heart className="w-6 h-6" />
                            <span>Use This Outfit</span>
                          </>
                        )}
                      </button>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        {selectedOutfit === `outfit${index + 1}` 
                          ? "This outfit will help improve future recommendations" 
                          : "Click to save this as your preferred style"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Feedback Component */}
                {userId && recommendationId && (
                  <div className="pt-4 border-t border-border/20">
                    <RecommendationFeedback
                      recommendationId={recommendationId}
                      userId={userId}
                      outfitId={`outfit${index + 1}`}
                      outfitDescription={outfit.title}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
