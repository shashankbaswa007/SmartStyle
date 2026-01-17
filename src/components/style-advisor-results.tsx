"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles, Palette, Shirt, PenTool, Wand2, ShoppingCart, ShoppingBag, ExternalLink, Check, Heart, Info, ChevronDown, Star } from "lucide-react";
import type { AnalyzeImageAndProvideRecommendationsOutput } from "@/ai/flows/analyze-image-and-provide-recommendations";
import type { ShoppingLinkResult, ItemShoppingLinks, ProductLink } from "@/lib/tavily";
import { Separator } from "./ui/separator";
import { RecommendationFeedback } from "./RecommendationFeedback";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { trackOutfitSelection } from "@/lib/personalization";
import { saveLikedOutfit } from "@/lib/likedOutfits";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { saveRecommendationUsage } from "@/app/actions";
import { EnhancedColorPalette } from "./EnhancedColorPalette";

interface StyleAdvisorResultsProps {
  analysisResult: AnalyzeImageAndProvideRecommendationsOutput;
  generatedImageUrls: string[];
  imageSources?: ('gemini' | 'pollinations' | 'placeholder')[];
  recommendationId: string | null;
  gender?: string; // Add gender for better shopping link results
  // NEW: Enhanced shopping links from structured analysis
  enhancedShoppingLinks?: ShoppingLinkResult[];
}

type ShoppingLinks = { amazon?: string | null; tatacliq?: string | null; myntra?: string | null };

// Type for color palette - can be either Gemini object format or legacy string format
type ColorValue = string | { name?: string; hex?: string; percentage?: number };

// Extended outfit type that includes itemShoppingLinks for liked outfits
type OutfitWithLinks = AnalyzeImageAndProvideRecommendationsOutput['outfitRecommendations'][0] & {
  itemShoppingLinks?: Array<{
    item: string;
    amazon: string;
    tatacliq: string;
    myntra: string;
  }>;
};


// Helper function to convert color names to hex codes
const convertColorNameToHex = (colorName: string): string => {
  // If already hex, return as-is
  if (colorName.startsWith('#')) return colorName.toUpperCase();
  
  // Common color name to hex mappings (comprehensive fashion color database)
  const colorMap: Record<string, string> = {
    // Basics
    'black': '#000000', 'white': '#FFFFFF', 'gray': '#808080', 'grey': '#808080',
    'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000', 'yellow': '#FFFF00',
    'orange': '#FFA500', 'purple': '#800080', 'pink': '#FFC0CB', 'brown': '#A52A2A',
    
    // Extended colors
    'navy': '#000080', 'navy blue': '#000080', 'teal': '#008080', 'maroon': '#800000',
    'olive': '#808000', 'lime': '#00FF00', 'aqua': '#00FFFF', 'cyan': '#00FFFF',
    'fuchsia': '#FF00FF', 'magenta': '#FF00FF', 'silver': '#C0C0C0', 'gold': '#FFD700',
    'beige': '#F5F5DC', 'tan': '#D2B48C', 'khaki': '#F0E68C', 'ivory': '#FFFFF0',
    'cream': '#FFFDD0', 'coral': '#FF7F50', 'salmon': '#FA8072', 'crimson': '#DC143C',
    'burgundy': '#800020', 'wine': '#722F37', 'indigo': '#4B0082', 'violet': '#EE82EE',
    
    // Shades of gray/grey
    'light gray': '#D3D3D3', 'light grey': '#D3D3D3', 'dark gray': '#A9A9A9', 
    'dark grey': '#A9A9A9', 'charcoal': '#36454F', 'slate': '#708090', 'ash': '#B2BEB5',
    
    // Shades of blue
    'light blue': '#ADD8E6', 'dark blue': '#00008B', 'sky blue': '#87CEEB',
    'royal blue': '#4169E1', 'midnight blue': '#191970', 'powder blue': '#B0E0E6',
    'steel blue': '#4682B4', 'cornflower blue': '#6495ED', 'cadet blue': '#5F9EA0',
    
    // Shades of green
    'light green': '#90EE90', 'dark green': '#006400', 'lime green': '#32CD32',
    'forest green': '#228B22', 'sea green': '#2E8B57', 'olive green': '#556B2F',
    
    // Shades of red/pink
    'light pink': '#FFB6C1', 'dark red': '#8B0000', 'deep pink': '#FF1493',
    'hot pink': '#FF69B4', 'rose': '#FF007F', 'ruby': '#E0115F',
    
    // Fashion-specific colors
    'taupe': '#483C32', 'mauve': '#E0B0FF', 'lavender': '#E6E6FA',
    'mint': '#98FF98', 'mint green': '#98FF98', 'peach': '#FFDAB9',
    'sage': '#9DC183', 'sage green': '#9DC183', 'mustard': '#FFDB58',
    'rust': '#B7410E', 'emerald': '#50C878', 'emerald green': '#50C878',
    'sapphire': '#0F52BA', 'amber': '#FFBF00', 'turquoise': '#40E0D0',
    'copper': '#B87333', 'bronze': '#CD7F32', 'champagne': '#F7E7CE',
    'denim': '#1560BD', 'denim blue': '#1560BD', 'sky': '#87CEEB',
    
    // Neutrals
    'off white': '#FAF9F6', 'off-white': '#FAF9F6', 'eggshell': '#F0EAD6',
    'bone': '#E3DAC9', 'ecru': '#C2B280', 'sand': '#C2B280',
    
    // Warm tones
    'terracotta': '#E2725B', 'brick': '#CB4154', 'brick red': '#CB4154',
    'burnt orange': '#CC5500', 'burnt sienna': '#E97451',
    
    // Cool tones
    'periwinkle': '#CCCCFF', 'lilac': '#C8A2C8', 'plum': '#DDA0DD',
  };

  const normalized = colorName.toLowerCase().trim();
  const hexValue = colorMap[normalized] || '#808080'; // Default to gray if unknown
  
  // Log if we had to use the default
  if (hexValue === '#808080' && normalized !== 'gray' && normalized !== 'grey') {
    console.warn(`⚠️ Unknown color name: "${colorName}" - using gray as fallback`);
  }
  
  return hexValue;
};

// NEW: Enhanced Shopping Links Display Component
const EnhancedShoppingSection = ({ 
  shoppingLinks, 
  outfitTitle 
}: { 
  shoppingLinks: ShoppingLinkResult;
  outfitTitle: string;
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  
  const toggleItem = (itemNumber: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemNumber)) {
        next.delete(itemNumber);
      } else {
        next.add(itemNumber);
      }
      return next;
    });
  };

  return (
    <div className="pt-6 border-t border-border/20">
      <div className="flex items-center justify-between mb-4">
        <h5 className="text-base font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-accent" />
          🛍️ Shop This Look
        </h5>
        <Badge variant="secondary" className="text-xs">
          {shoppingLinks.metadata.totalLinksFound} products found
        </Badge>
      </div>

      {/* Shopping by Item */}
      <div className="space-y-3">
        {shoppingLinks.byItem.map((item) => {
          const isExpanded = expandedItems.has(item.itemNumber);
          const totalLinks = 
            item.links.amazon.length + 
            item.links.myntra.length + 
            item.links.tatacliq.length;

          return (
            <div 
              key={item.itemNumber}
              className="rounded-lg bg-accent/5 border border-border/10 overflow-hidden"
            >
              {/* Item Header */}
              <button
                onClick={() => toggleItem(item.itemNumber)}
                className="w-full flex items-center justify-between p-3 hover:bg-accent/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {item.itemName}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {item.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {totalLinks} {totalLinks === 1 ? 'option' : 'options'}
                  </span>
                  <ChevronDown 
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Expanded Links */}
              {isExpanded && (
                <div className="p-3 pt-0 space-y-2">
                  {/* Amazon Links */}
                  {item.links.amazon.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-orange-600 mb-1 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        Amazon India
                      </div>
                      {item.links.amazon.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2 rounded-md bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40 border border-orange-200/50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-orange-600">
                                {link.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {link.price && (
                                  <span className="text-xs font-bold text-orange-600">
                                    {link.price}
                                  </span>
                                )}
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
                                  <span className="text-xs text-muted-foreground">
                                    {(link.relevanceScore * 5).toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1" />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Myntra Links */}
                  {item.links.myntra.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-pink-600 mb-1 flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        Myntra
                      </div>
                      {item.links.myntra.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2 rounded-md bg-pink-50 dark:bg-pink-950/20 hover:bg-pink-100 dark:hover:bg-pink-950/40 border border-pink-200/50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-pink-600">
                                {link.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {link.price && (
                                  <span className="text-xs font-bold text-pink-600">
                                    {link.price}
                                  </span>
                                )}
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-pink-400 text-pink-400" />
                                  <span className="text-xs text-muted-foreground">
                                    {(link.relevanceScore * 5).toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1" />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Tata CLiQ Links */}
                  {item.links.tatacliq.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-blue-600 mb-1 flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        Tata CLiQ
                      </div>
                      {item.links.tatacliq.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2 rounded-md bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40 border border-blue-200/50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-blue-600">
                                {link.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {link.price && (
                                  <span className="text-xs font-bold text-blue-600">
                                    {link.price}
                                  </span>
                                )}
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-blue-400 text-blue-400" />
                                  <span className="text-xs text-muted-foreground">
                                    {(link.relevanceScore * 5).toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1" />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Metadata footer */}
      <div className="mt-3 pt-3 border-t border-border/10">
        <p className="text-xs text-muted-foreground text-center">
          Analyzed {shoppingLinks.metadata.itemsDetected} items • 
          Avg. relevance: {(shoppingLinks.metadata.averageRelevanceScore * 100).toFixed(0)}% •
          Click to view product details
        </p>
      </div>
    </div>
  );
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
  gender,
  enhancedShoppingLinks,
}: StyleAdvisorResultsProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedOutfit, setSelectedOutfit] = useState<string | null>(null);
  const [isUsing, setIsUsing] = useState<number | null>(null);
  const { toast } = useToast();
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [enrichedOutfits, setEnrichedOutfits] = useState(analysisResult.outfitRecommendations);
  const [loadingLinks, setLoadingLinks] = useState(true);
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
    console.log('❤️ User liked outfit', { 
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
        setSelectedOutfit(`outfit${outfitIndex + 1}`);  // Fixed: Add + 1 to match UI rendering
        
        // Also track for personalization (wrapped in try-catch to prevent errors)
        try {
          await trackOutfitSelection(userId, recommendationId, `outfit${outfitIndex + 1}` as any);  // Fixed: Add + 1
        } catch (trackError) {
          console.warn('⚠️ Failed to track outfit selection (non-critical):', trackError);
          // Don't throw - this is non-critical, the like still succeeded
        }
        
        // Save to liked outfits collection
        const outfit = enrichedOutfits[outfitIndex];
        if (outfit) {
          console.log('💾 Attempting to save outfit to likes...', {
            userId,
            outfitTitle: outfit.title,
            hasImageUrl: !!generatedImageUrls[outfitIndex],
            imageUrl: generatedImageUrls[outfitIndex]?.substring(0, 50) + '...',
            hasShoppingLinks: !!outfit.shoppingLinks,
            shoppingLinks: outfit.shoppingLinks,
          });
          
          // Ensure we have valid data before saving
          const imageUrl = generatedImageUrls[outfitIndex];
          if (!imageUrl) {
            console.error('❌ No image URL available for outfit', outfitIndex);
            toast({
              title: "Cannot Save",
              description: "Image not available for this outfit",
              variant: "destructive",
            });
            return;
          }

          // Convert color palette to hex strings safely
          const colorPalette = (outfit.colorPalette || []).map(c => {
            if (typeof c === 'string') {
              return c.startsWith('#') ? c : convertColorNameToHex(c);
            }
            const colorObj = c as { hex?: string; name?: string };
            return colorObj.hex || convertColorNameToHex(colorObj.name || 'gray');
          });
          
          // Generate individual item shopping links to save with the outfit
          const itemShoppingLinks = (outfit.items || []).map(item => {
            const itemQuery = `${gender || ''} ${item}`.trim();
            const genderPath = gender === 'male' ? 'men' : gender === 'female' ? 'women' : 'shop';
            const genderCategory = gender === 'male' ? 'men' : gender === 'female' ? 'women' : 'all';
            const encodedItem = encodeURIComponent(itemQuery);
            
            return {
              item,
              amazon: `https://www.amazon.in/s?k=${encodedItem}&rh=n:1968024031`,
              tatacliq: `https://www.tatacliq.com/search?q=${encodeURIComponent(itemQuery + ':relevance:inStockFlag:true')}`,
              myntra: `https://www.myntra.com/${genderPath}?rawQuery=${encodedItem}`,
            };
          });
          
          console.log('🔥 BEFORE calling saveLikedOutfit - Function exists?', typeof saveLikedOutfit);
          console.log('🔥 UserId:', userId);
          console.log('🔥 ImageUrl:', imageUrl?.substring(0, 50));
          
          let likedOutfitResult;
          try {
            likedOutfitResult = await saveLikedOutfit(userId, {
              imageUrl,
              title: outfit.title || 'Untitled Outfit',
              description: outfit.description || outfit.title || 'No description',
              items: Array.isArray(outfit.items) ? outfit.items : [],
              colorPalette,
              styleType: outfit.styleType,
              occasion: outfit.occasion,
              shoppingLinks: {
                amazon: outfit.shoppingLinks?.amazon || null,
                tatacliq: outfit.shoppingLinks?.tatacliq || null,
                myntra: outfit.shoppingLinks?.myntra || null,
              },
              itemShoppingLinks, // Save individual item links
              likedAt: Date.now(),
              recommendationId: recommendationId || `rec_${Date.now()}`,
            });
          } catch (saveError) {
            console.error('🔥 ERROR inside saveLikedOutfit call:', saveError);
            console.error('🔥 Error type:', saveError instanceof Error ? saveError.constructor.name : typeof saveError);
            console.error('🔥 Error message:', saveError instanceof Error ? saveError.message : String(saveError));
            console.error('🔥 Error stack:', saveError instanceof Error ? saveError.stack : 'No stack');
            throw saveError; // Re-throw to be caught by outer try-catch
          }
          
          console.log('📊 Save liked outfit result:', likedOutfitResult);
          
          if (likedOutfitResult.isDuplicate) {
            console.log('ℹ️ Outfit already in likes');
            toast({
              title: "Already Liked",
              description: "This outfit is already in your favorites!",
            });
          } else if (likedOutfitResult.success) {
            console.log('✅ Outfit saved to likes collection');
            toast({
              title: "Added to Favorites! ❤️",
              description: `"${outfit.title}" has been added to your likes!`,
            });
          } else {
            console.error('❌ Failed to save to likes:', likedOutfitResult.message);
            toast({
              title: "Couldn't Save",
              description: likedOutfitResult.message || "Failed to add to favorites",
              variant: "destructive",
            });
          }
        } else {
          console.error('❌ Outfit data not found at index:', outfitIndex);
          toast({
            title: "Error",
            description: "Outfit data not available",
            variant: "destructive",
          });
        }
        
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

  const findSimilar = async (query: string, colors?: string[], genderParam?: string): Promise<ShoppingLinks | null> => {
    try {
      const res = await fetch('/api/tavily/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, colors, gender: genderParam }),
      });
      const data = await res.json();
      return data?.links as ShoppingLinks | null;
    } catch (err) {
      console.warn('Find similar failed', err);
      return null;
    }
  };

  // Automatically fetch shopping links for all outfits on mount
  useEffect(() => {
    const generateSearchUrls = (query: string, genderParam?: string) => {
      const encodedQuery = encodeURIComponent(query);
      const genderPath = genderParam === 'male' ? 'men' : genderParam === 'female' ? 'women' : 'shop';
      return {
        amazon: `https://www.amazon.in/s?k=${encodedQuery}${genderParam ? `+${genderParam}` : ''}&rh=n:1968024031`,
        tatacliq: genderParam && genderParam !== 'neutral'
          ? `https://www.tatacliq.com/search/?searchCategory=${genderParam === 'male' ? 'men' : 'women'}&text=${encodedQuery}`
          : `https://www.tatacliq.com/search/?text=${encodedQuery}`,
        myntra: `https://www.myntra.com/${genderPath}?rawQuery=${encodedQuery}`
      };
    };

    const fetchShoppingLinks = async () => {
      try {
        console.log('🛍️ Checking shopping links for outfits...');
        setLoadingLinks(true);
        
        const updatedOutfits = await Promise.all(
          analysisResult.outfitRecommendations.map(async (outfit, index) => {
            // Check if outfit already has valid shopping links from API
            const hasValidLinks = outfit.shoppingLinks && (
              outfit.shoppingLinks.amazon || 
              outfit.shoppingLinks.tatacliq || 
              outfit.shoppingLinks.myntra
            );

            if (hasValidLinks) {
              console.log(`✅ Outfit ${index} already has shopping links from API:`, {
                amazon: !!outfit.shoppingLinks?.amazon,
                tatacliq: !!outfit.shoppingLinks?.tatacliq,
                myntra: !!outfit.shoppingLinks?.myntra,
              });
              return outfit;
            }

            // No links from API - fetch them now as fallback
            console.log(`⚠️ Outfit ${index} missing shopping links, fetching now...`);
            
            // Create comprehensive search query using ALL outfit items
            // This ensures the search includes all pieces mentioned in the description
            const allItems = outfit.items || [];
            const searchQuery = allItems.length > 0 
              ? allItems.join(' ') // Use all items for better search coverage
              : outfit.title;
            
            console.log(`🔍 Searching with all items: "${searchQuery}" (${allItems.length} items)`);
            console.log(`   Items: ${allItems.join(', ')}`);
            console.log(`   Gender: ${gender || 'not specified'}`);
            
            const links = await findSimilar(searchQuery, outfit.colorPalette, gender);
            
            // If Tavily returns links, use them
            if (links && (links.amazon || links.tatacliq || links.myntra)) {
              console.log(`✅ Found Tavily links for outfit ${index}:`, links);
              return {
                ...outfit,
                shoppingLinks: {
                  amazon: links.amazon ?? null,
                  tatacliq: links.tatacliq ?? null,
                  myntra: links.myntra ?? null,
                }
              };
            }
            
            // Fallback: Generate direct search URLs using the first item
            console.log(`⚠️ No Tavily links found for outfit ${index}, generating search URLs`);
            const searchUrls = generateSearchUrls(searchQuery, gender);
            console.log(`🔗 Generated search URLs:`, searchUrls);
            
            return {
              ...outfit,
              shoppingLinks: {
                amazon: searchUrls.amazon,
                tatacliq: searchUrls.tatacliq,
                myntra: searchUrls.myntra,
              }
            };
          })
        );

        setEnrichedOutfits(updatedOutfits);
        console.log('✅ All shopping links ready');
      } catch (error) {
        console.error('❌ Error fetching shopping links:', error);
        // Keep original outfits on error
      } finally {
        setLoadingLinks(false);
      }
    };

    if (analysisResult.outfitRecommendations.length > 0) {
      fetchShoppingLinks();
    }
  }, [analysisResult.outfitRecommendations, gender]);

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
        
        <p className="mt-4 text-muted-foreground">{analysisResult.feedback}</p>
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

        {enrichedOutfits.map((outfit, index) => {
          // Cast to extended type to support itemShoppingLinks from liked outfits
          const outfitWithLinks = outfit as OutfitWithLinks;
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
                </div>

                {/* Image and Description Side by Side */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {/* Left: Generated Image */}
                  <div className="relative">
                    {/* Check for error message in outfit */}
                    {(outfit as any).error ? (
                      <div className="aspect-square w-full rounded-xl bg-muted/50 border-2 border-destructive/30 flex items-center justify-center p-6">
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                            <Info className="w-8 h-8 text-destructive" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground mb-2">Image Unavailable</h4>
                            <p className="text-sm text-muted-foreground">{(outfit as any).error}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              The outfit details and shopping links are still available below.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : generatedImageUrls[index] ? (
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

                    {/* Enhanced Interactive Color Palette */}
                    {((outfit as any).colorDetails && (outfit as any).colorDetails.length > 0) || 
                     (outfit.colorPalette && outfit.colorPalette.length > 0) || 
                     ((outfit as any).generatedImageColors && (outfit as any).generatedImageColors.length > 0) ? (
                      <div className="space-y-3">
                        {/* Generated Image Colors (Primary - Most Accurate) */}
                        {(outfit as any).generatedImageColors && (outfit as any).generatedImageColors.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="w-4 h-4 text-accent" />
                              <h5 className="text-sm font-semibold text-accent uppercase tracking-wide">
                                Actual Outfit Colors
                              </h5>
                              <span className="text-xs text-muted-foreground">(from generated image)</span>
                            </div>
                            <EnhancedColorPalette
                              colors={(outfit as any).generatedImageColors.map((c: any) => ({
                                hex: c.hex || '#808080',
                                name: c.name || '',
                                percentage: Math.round((c.count / 1000) * 100), // Approximate percentage
                              }))}
                              outfitTitle={outfit.title + " - Actual Colors"}
                              showHarmonyInfo={true}
                            />
                          </div>
                        )}

                        {/* AI Recommended Colors (Secondary) */}
                        {((outfit as any).colorDetails || outfit.colorPalette) && (
                          <EnhancedColorPalette
                            colors={
                              (outfit as any).colorDetails && (outfit as any).colorDetails.length > 0
                                ? (outfit as any).colorDetails.map((c: any) => ({
                                    hex: c.hex || (typeof c === 'string' ? convertColorNameToHex(c) : '#808080'),
                                    name: c.name || '',
                                    percentage: c.percentage,
                                  }))
                                : (outfit.colorPalette || []).map((colorValue: ColorValue) => {
                                    let hex: string;
                                    let colorName: string;
                                    
                                    if (typeof colorValue === 'object' && colorValue !== null && 'hex' in colorValue) {
                                      hex = colorValue.hex || '#808080';
                                      colorName = colorValue.name || hex;
                                    } else if (typeof colorValue === 'string') {
                                      const cleanValue = colorValue.trim();
                                      const hexMatch = cleanValue.match(/#[0-9A-Fa-f]{6}/);
                                      if (hexMatch) {
                                        hex = hexMatch[0].toUpperCase();
                                        colorName = cleanValue.replace(hexMatch[0], '').trim() || hex;
                                      } else if (cleanValue.startsWith('#')) {
                                        hex = cleanValue.toUpperCase();
                                        colorName = hex;
                                      } else {
                                        hex = convertColorNameToHex(cleanValue);
                                        colorName = cleanValue;
                                      }
                                    } else {
                                      hex = '#808080';
                                      colorName = 'Unknown';
                                    }
                                    
                                    return { hex, name: colorName };
                                  })
                            }
                            outfitTitle={outfit.title}
                            showHarmonyInfo={!(outfit as any).generatedImageColors}
                          />
                        )}
                      </div>
                    ) : null}

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

                {/* NEW: Enhanced Shopping Links (if available) */}
                {enhancedShoppingLinks && enhancedShoppingLinks[index] && (
                  <EnhancedShoppingSection
                    shoppingLinks={enhancedShoppingLinks[index]}
                    outfitTitle={outfit.title}
                  />
                )}

                {/* Individual Item Shopping Links (Legacy fallback) */}
                {(!enhancedShoppingLinks || !enhancedShoppingLinks[index]) && outfitWithLinks.items && outfitWithLinks.items.length > 0 && (
                  <div className="pt-6 border-t border-border/20">
                    <h5 className="text-base font-bold mb-4 text-foreground flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-accent" />
                      Shop Individual Items
                    </h5>
                    <div className="space-y-3">
                      {outfitWithLinks.items.map((item, itemIndex) => {
                        // Use saved links if available (from liked outfit), otherwise generate fresh links
                        let itemLinks;
                        if (outfitWithLinks.itemShoppingLinks && outfitWithLinks.itemShoppingLinks[itemIndex]) {
                          itemLinks = outfitWithLinks.itemShoppingLinks[itemIndex];
                        } else {
                          // Generate links on-the-fly for new recommendations
                          const itemQuery = `${gender || ''} ${item}`.trim();
                          const genderPath = gender === 'male' ? 'men' : gender === 'female' ? 'women' : 'shop';
                          const genderCategory = gender === 'male' ? 'men' : gender === 'female' ? 'women' : 'all';
                          const encodedItem = encodeURIComponent(itemQuery);
                          
                          itemLinks = {
                            item,
                            amazon: `https://www.amazon.in/s?k=${encodedItem}&rh=n:1968024031`,
                            tatacliq: `https://www.tatacliq.com/search?q=${encodeURIComponent(itemQuery + ':relevance:inStockFlag:true')}`,
                            myntra: `https://www.myntra.com/${genderPath}?rawQuery=${encodedItem}`,
                          };
                        }
                        
                        return (
                          <div 
                            key={itemIndex} 
                            className="flex items-center justify-between gap-4 p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-all duration-200 border border-border/10 hover:border-accent/30 hover:shadow-md group"
                          >
                            <span className="text-sm font-medium text-foreground flex-1">{item}</span>
                            <div className="flex gap-2">
                              <a
                                href={itemLinks.amazon}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 hover:scale-105 transition-all duration-200 border border-orange-200/50 hover:border-orange-300 shadow-sm hover:shadow-orange-500/30"
                                title={`Search "${item}" on Amazon`}
                              >
                                <ShoppingBag className="w-4 h-4" />
                                <span className="text-xs font-semibold hidden sm:inline">Amazon</span>
                              </a>
                              <a
                                href={itemLinks.tatacliq}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 hover:scale-105 transition-all duration-200 border border-blue-200/50 hover:border-blue-300 shadow-sm hover:shadow-blue-500/30"
                                title={`Search "${item}" on TATA CLiQ`}
                              >
                                <ShoppingCart className="w-4 h-4" />
                                <span className="text-xs font-semibold hidden sm:inline">CLiQ</span>
                              </a>
                              <a
                                href={itemLinks.myntra}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 hover:scale-105 transition-all duration-200 border border-pink-200/50 hover:border-pink-300 shadow-sm hover:shadow-pink-500/30"
                                title={`Search "${item}" on Myntra`}
                              >
                                <ShoppingBag className="w-4 h-4" />
                                <span className="text-xs font-semibold hidden sm:inline">Myntra</span>
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 italic text-center">
                      Click any button to search for that specific item on your preferred store
                    </p>
                  </div>
                )}

                {/* Like Button - Save to favorites */}
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
                        <span>Like This Outfit</span>
                      </button>
                      <p className="text-xs text-muted-foreground text-center">
                        Sign in to like outfits and get personalized recommendations
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
                            <span>Liking...</span>
                          </>
                        ) : selectedOutfit === `outfit${index + 1}` ? (
                          <>
                            <Check className="w-6 h-6" />
                            <span>Liked ✓</span>
                          </>
                        ) : (
                          <>
                            <Heart className="w-6 h-6" />
                            <span>Like</span>
                          </>
                        )}
                      </button>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        {selectedOutfit === `outfit${index + 1}` 
                          ? "This outfit will help improve future recommendations" 
                          : "Click to save this outfit to your favorites"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Removed RecommendationFeedback component - feedback now handled by main Like button above */}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
