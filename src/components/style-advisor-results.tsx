"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles, Palette, Shirt, PenTool, Wand2, ShoppingCart, ShoppingBag, ExternalLink, Check, Heart, Info, ChevronDown, ChevronUp, Star, Lightbulb, Eye } from "lucide-react";
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
import { updatePreferencesFromLike, updatePreferencesFromWear, trackShoppingClick } from "@/lib/preference-engine";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { saveRecommendationUsage } from "@/app/actions";
import { EnhancedColorPalette } from "./EnhancedColorPalette";
import { MatchScoreBadge } from "./match-score-badge";

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
  // Personalization fields from diversification system
  matchScore?: number;
  matchCategory?: string;
  explanation?: string;
  position?: number;
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
  const [wornOutfits, setWornOutfits] = useState<Set<number>>(new Set());
  const [isMarkingWorn, setIsMarkingWorn] = useState<number | null>(null);
  const { toast } = useToast();
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [enrichedOutfits, setEnrichedOutfits] = useState(analysisResult.outfitRecommendations);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Track per-image loading state: 'loading' | 'loaded' | 'error' | 'placeholder'
  const [imageStates, setImageStates] = useState<Map<number, 'loading' | 'loaded' | 'error' | 'placeholder'>>(new Map());

  // When image URLs change, immediately classify each one
  useEffect(() => {
    const initial = new Map<number, 'loading' | 'loaded' | 'error' | 'placeholder'>();
    generatedImageUrls.forEach((url, i) => {
      if (!url || url.includes('via.placeholder.com')) {
        initial.set(i, 'placeholder');
      } else if (url.startsWith('data:')) {
        // SVG/base64 data URIs are available instantly — no network load needed
        initial.set(i, 'loaded');
      } else {
        initial.set(i, 'loading');
      }
    });
    setImageStates(initial);
  }, [generatedImageUrls]);

  // Safety timeout: force any still-loading images to 'error' after 30s
  // (accommodates the 8s per-outfit budget in smart-image-generation)
  useEffect(() => {
    const hasLoading = Array.from(imageStates.values()).some(s => s === 'loading');
    if (!hasLoading) return;
    const timer = setTimeout(() => {
      setImageStates(prev => {
        const next = new Map(prev);
        for (const [k, v] of next) {
          if (v === 'loading') next.set(k, 'error');
        }
        return next;
      });
      console.warn('⏱️ Image load timeout — forced remaining images to error state');
    }, 30000);
    return () => clearTimeout(timer);
  }, [imageStates]);

  const handleImageLoad = (index: number) => {
    console.log('🖼️ Image loaded:', index);
    setImageStates(prev => new Map(prev).set(index, 'loaded'));
  };

  const handleImageError = (index: number) => {
    console.log('❌ Image error:', index);
    setImageStates(prev => new Map(prev).set(index, 'error'));
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
          
          // Generate individual item shopping links with optimized queries
          const itemShoppingLinks = (outfit.items || []).map(item => {
            const links = optimizeItemLinks(item, gender);
            return {
              item: links.item,
              amazon: links.amazon,
              tatacliq: links.tatacliq,
              myntra: links.myntra,
            };
          });
          
          console.log('🔥 BEFORE calling saveLikedOutfit - Function exists?', typeof saveLikedOutfit);
          console.log('🔥 UserId:', userId);
          console.log('🔥 ImageUrl:', imageUrl?.substring(0, 50));
          
          let likedOutfitResult: { success: boolean; message: string; isDuplicate?: boolean } | undefined;
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
              title: "Already Liked ❤️",
              description: "This outfit is already in your favorites!",
            });
          } else if (likedOutfitResult.success) {
            console.log('✅ Outfit saved to likes collection');
            
            // Update preferences from like (+2 weight)
            try {
              const season = getCurrentSeason();
              const prefResult = await updatePreferencesFromLike(userId, outfit, {
                occasion: outfit.occasion || 'casual',
                season,
              });
              
              if (prefResult.success) {
                console.log('✅ Preferences updated from like (+2 weight)');
              } else {
                console.warn('⚠️ Preference update returned unsuccessful:', prefResult.message);
              }
            } catch (prefError) {
              console.error('❌ Error updating preferences from like:', prefError);
              console.error('   Error details:', {
                name: prefError instanceof Error ? prefError.name : 'Unknown',
                message: prefError instanceof Error ? prefError.message : String(prefError),
                userId,
                outfitTitle: outfit.title
              });
              // Non-critical error - don't block the like action
            }
            
            toast({
              title: "Added to Favorites! ❤️",
              description: `"${outfit.title}" has been saved to your likes! View it in your Likes page.`,
            });
          } else {
            console.error('❌ Failed to save to likes:', likedOutfitResult.message);
            toast({
              title: "Couldn't Save to Likes",
              description: likedOutfitResult.message || "Failed to add to favorites",
              variant: "destructive",
            });
            // Don't return here - still track the selection for preferences
          }
        } else {
          console.error('❌ Outfit data not found at index:', outfitIndex);
          toast({
            title: "Error",
            description: "Outfit data not available",
            variant: "destructive",
          });
        }
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
    // Use the centralized optimizer for fallback URLs
    const generateSearchUrls = (items: string[], genderParam?: string) => {
      return buildOutfitSearchUrls(items, genderParam);
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
            
            // Build optimized search query from individual items
            const allItems = outfit.items || [];
            const firstItemQuery = allItems.length > 0
              ? allItems[0] // Use first item for focused search
              : outfit.title;
            
            console.log(`🔍 Searching for: "${firstItemQuery}" (${allItems.length} total items)`);
            console.log(`   Gender: ${gender || 'not specified'}`);
            
            const links = await findSimilar(firstItemQuery, outfit.colorPalette, gender);
            
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
            
            // Fallback: Generate optimized search URLs
            console.log(`⚠️ No Tavily links found for outfit ${index}, generating optimized URLs`);
            const searchUrls = generateSearchUrls(allItems, gender);
            console.log(`🔗 Generated optimized URLs (query: "${searchUrls.query}"):`, searchUrls);
            
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

  // Get current season for preference tracking
  const getCurrentSeason = (): 'summer' | 'winter' | 'monsoon' => {
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 6 && month <= 9) return 'monsoon';
    if (month >= 11 || month <= 2) return 'winter';
    return 'summer';
  };

  // Handle "Mark as Worn" button click
  const handleMarkAsWorn = async (outfitIndex: number, outfit: any) => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Sign in to track worn outfits and get better recommendations!",
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

    setIsMarkingWorn(outfitIndex);
    console.log('🔄 Marking outfit as worn:', { outfitIndex, userId, outfit: outfit.title });
    
    try {
      const season = getCurrentSeason();
      console.log('📅 Current season:', season);
      
      const result = await updatePreferencesFromWear(userId, outfit, {
        occasion: outfit.occasion || 'casual',
        season,
      });

      console.log('📊 Update result:', result);

      if (result.success) {
        setWornOutfits(prev => new Set(prev).add(outfitIndex));
        toast({
          title: "Marked as Worn! 👔",
          description: `We'll remember you love "${outfit.title}" style! Future recommendations will be even better.`,
        });
        console.log('✅ Preferences updated from wear (+5 weight):', {
          colors: outfit.colorPalette || outfit.colors,
          style: outfit.styleType || outfit.style,
          occasion: outfit.occasion
        });
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Error marking outfit as worn:', error);
      console.error('   Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        outfitIndex,
        outfitTitle: outfit.title,
        hasColorPalette: !!outfit.colorPalette,
        hasColors: !!outfit.colors,
        season: getCurrentSeason()
      });
      
      // Provide user-friendly error messages based on error type
      let userMessage = 'Failed to mark as worn. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Nested arrays')) {
          userMessage = 'Data format error. Please refresh the page and try again.';
        } else if (error.message.includes('permission')) {
          userMessage = 'Permission denied. Please check your account settings.';
        } else if (error.message.includes('network')) {
          userMessage = 'Network error. Please check your connection and try again.';
        } else {
          userMessage = error.message;
        }
      }
      
      toast({
        title: "Update Failed",
        description: userMessage,
        variant: "destructive",
      });
    } finally {
      setIsMarkingWorn(null);
    }
  };

  // Handle shopping link click (track behavior)
  const handleShoppingClick = async (platform: 'amazon' | 'myntra' | 'tatacliq', item: string) => {
    if (userId) {
      try {
        await trackShoppingClick(userId, platform, item);
        console.log(`✅ Shopping click tracked: ${platform} - ${item}`);
      } catch (error) {
        console.warn('⚠️ Failed to track shopping click (non-critical):', error);
      }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-8 relative"
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
          const outfitWithLinks = outfit as OutfitWithLinks;
          const outfitId = `outfit${index + 1}` as 'outfit1' | 'outfit2' | 'outfit3';
          const isSelected = selectedOutfit === outfitId;
          const isLoading = isUsing === index;

          const imgUrl = generatedImageUrls[index] || '';
          const imgState = imageStates.get(index) || 'placeholder';
          const hasOutfitError = (outfit as any).error && !(outfit as any).shoppingError;
          const isDataUri = imgUrl.startsWith('data:');
          const isPlaceholderUrl = imgUrl.includes('via.placeholder.com');
          const hasRealImage = imgUrl && !isPlaceholderUrl && !hasOutfitError; // Data URIs ARE real images!

          // Extract color hex codes for accent strip + compact dots
          const colorHexes = (outfit.colorPalette || []).map((c: ColorValue) => {
            if (typeof c === 'object' && c !== null && 'hex' in c) return c.hex || '#808080';
            if (typeof c === 'string') {
              const hm = c.match(/#[0-9A-Fa-f]{6}/);
              if (hm) return hm[0];
              if (c.startsWith('#')) return c;
              return convertColorNameToHex(c);
            }
            return '#808080';
          }).slice(0, 6) as string[];

          const gradientBg = colorHexes.length >= 2
            ? `linear-gradient(135deg, ${colorHexes.join(', ')})`
            : colorHexes.length === 1
            ? colorHexes[0]
            : 'linear-gradient(135deg, #6366f1, #a78bfa, #c4b5fd)';

          const rankLabels = ['✦ Top Pick', '✦✦ Look 2', '✦✦✦ Look 3'];
          const rankColors = [
            'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
            'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
            'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
          ];

          return (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group relative rounded-2xl overflow-hidden bg-card/70 dark:bg-card/50 backdrop-blur-xl border border-border/20 shadow-lg hover:shadow-2xl transition-shadow duration-300"
            >
              {/* ── Color Accent Strip ── */}
              <div className="h-1.5 w-full" style={{ background: gradientBg }} />

              {/* ── Card Body ── */}
              <div className="p-5 sm:p-6 space-y-5">

                {/* ── Header Row: Rank + Title + Match Badge ── */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${rankColors[index] || rankColors[2]}`}>
                    {rankLabels[index] || `Look ${index + 1}`}
                  </span>
                  <h4 className="text-lg sm:text-xl font-bold text-foreground flex-1 min-w-0 truncate">
                    {outfit.title}
                  </h4>
                  <MatchScoreBadge
                    matchScore={outfitWithLinks.matchScore}
                    matchCategory={outfitWithLinks.matchCategory}
                    showScore={true}
                  />
                </div>

                {/* ── Explanation ── */}
                {outfitWithLinks.explanation && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/15 text-sm text-muted-foreground">
                    <Lightbulb className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <p>{outfitWithLinks.explanation}</p>
                  </div>
                )}

                {/* ── Main Content Grid ── */}
                <div className={`grid gap-5 ${hasRealImage ? 'md:grid-cols-[minmax(200px,2fr)_3fr]' : ''}`}>

                  {/* Image column — only for real AI-generated images */}
                  {hasRealImage && (
                    <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden shadow-md border border-border/20">
                      {imgState === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse z-10">
                          <div className="text-center space-y-2">
                            <div className="w-7 h-7 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-xs text-muted-foreground">Loading…</p>
                          </div>
                        </div>
                      )}
                      {imgState === 'error' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-10">
                          <div className="text-center space-y-2 p-4">
                            <Eye className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                            <p className="text-xs text-muted-foreground">Couldn&apos;t load image</p>
                          </div>
                        </div>
                      )}
                      <Image
                        src={imgUrl}
                        alt={`Generated outfit: ${outfit.title}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 300px"
                        style={{ objectFit: 'cover' }}
                        className={`transition-opacity duration-300 ${imgState === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
                        data-ai-hint="fashion outfit"
                        priority={index === 0}
                        onLoad={() => handleImageLoad(index)}
                        onError={() => handleImageError(index)}
                        unoptimized={
                          isDataUri ||
                          imgUrl.includes('together.xyz') ||
                          imgUrl.includes('together.ai') ||
                          imgUrl.includes('replicate.delivery')
                        }
                      />
                    </div>
                  )}

                  {/* Details column */}
                  <div className="space-y-4 min-w-0">
                    {/* Description */}
                    {outfit.description && (
                      <p className="text-sm text-foreground/85 leading-relaxed">
                        {outfit.description}
                      </p>
                    )}

                    {/* Color Palette — compact inline dots */}
                    {colorHexes.length > 0 && (
                      <div className="space-y-1.5">
                        <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Palette className="w-3.5 h-3.5" /> Palette
                        </h5>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {colorHexes.map((hex, ci) => (
                            <button
                              key={ci}
                              onClick={() => {
                                navigator.clipboard?.writeText(hex);
                                toast({ title: 'Copied!', description: `${hex} copied to clipboard`, duration: 1500 });
                              }}
                              className="w-8 h-8 rounded-lg border-2 border-white/30 shadow-sm hover:scale-110 hover:shadow-md transition-all duration-200 cursor-pointer"
                              style={{ backgroundColor: hex }}
                              title={hex}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Outfit Items — chips/tags */}
                    {outfit.items && outfit.items.length > 0 && (
                      <div className="space-y-1.5">
                        <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Shirt className="w-3.5 h-3.5" /> Items
                        </h5>
                        <div className="flex flex-wrap gap-1.5">
                          {outfit.items.map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted/60 text-foreground/80 border border-border/20 hover:bg-accent/10 hover:border-accent/30 transition-colors"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Shopping Links — collapsible ── */}
                {(() => {
                  const hasEnhanced = enhancedShoppingLinks && enhancedShoppingLinks[index];
                  const hasLegacy = !hasEnhanced && outfitWithLinks.items && outfitWithLinks.items.length > 0;

                  if (!hasEnhanced && !hasLegacy) return null;

                  return (
                    <details className="group/shop pt-4 border-t border-border/15">
                      <summary className="flex items-center justify-between cursor-pointer list-none py-2 select-none [&::-webkit-details-marker]:hidden">
                        <h5 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-accent" />
                          Shop This Look
                        </h5>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open/shop:rotate-180" />
                      </summary>

                      <div className="pt-3 space-y-2">
                        {hasEnhanced ? (
                          <EnhancedShoppingSection
                            shoppingLinks={enhancedShoppingLinks![index]}
                            outfitTitle={outfit.title}
                          />
                        ) : (
                          <>
                            {outfitWithLinks.items!.map((item, itemIndex) => {
                              let itemLinks;
                              if (outfitWithLinks.itemShoppingLinks && outfitWithLinks.itemShoppingLinks[itemIndex]) {
                                itemLinks = outfitWithLinks.itemShoppingLinks[itemIndex];
                              } else {
                                // Use optimized query builder instead of raw AI text
                                itemLinks = optimizeItemLinks(item, gender);
                              }

                              return (
                                <div
                                  key={itemIndex}
                                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-accent/5 hover:bg-accent/10 transition-all duration-200 border border-border/10 hover:border-accent/30"
                                >
                                  <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">{item}</span>
                                  <div className="flex gap-1.5 flex-shrink-0">
                                    <a href={itemLinks.amazon} target="_blank" rel="noopener noreferrer" onClick={() => handleShoppingClick('amazon', item)}
                                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 hover:scale-105 transition-all border border-orange-200/40">
                                      <ShoppingBag className="w-3 h-3" /><span className="hidden sm:inline">Amazon</span>
                                    </a>
                                    <a href={itemLinks.tatacliq} target="_blank" rel="noopener noreferrer" onClick={() => handleShoppingClick('tatacliq', item)}
                                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 hover:scale-105 transition-all border border-blue-200/40">
                                      <ShoppingCart className="w-3 h-3" /><span className="hidden sm:inline">CLiQ</span>
                                    </a>
                                    <a href={itemLinks.myntra} target="_blank" rel="noopener noreferrer" onClick={() => handleShoppingClick('myntra', item)}
                                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 hover:scale-105 transition-all border border-pink-200/40">
                                      <ShoppingBag className="w-3 h-3" /><span className="hidden sm:inline">Myntra</span>
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </details>
                  );
                })()}

                {/* ── Action Bar ── */}
                <div className="pt-4 border-t border-border/15 flex flex-wrap items-center gap-3">
                  {(!userId || !recommendationId || isAnonymous) ? (
                    <button
                      onClick={() => {
                        toast({
                          title: "Sign in required",
                          description: "Create an account to save outfits and get personalized recommendations!",
                          action: <Button variant="outline" size="sm" onClick={() => window.location.href = '/auth'}>Sign In</Button>,
                        });
                      }}
                      className="flex-1 min-w-[180px] px-5 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-accent to-accent/80 text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Heart className="w-4 h-4" /> Like This Outfit
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleUseOutfit(index, outfit.title)}
                        disabled={isSelected || isLoading}
                        className={`flex-1 min-w-[140px] px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-green-500/15 text-green-600 dark:text-green-400 border-2 border-green-500/40 cursor-default'
                            : isLoading
                            ? 'bg-accent/50 text-white cursor-wait'
                            : 'bg-gradient-to-r from-accent to-accent/80 text-white shadow-md hover:shadow-lg hover:scale-[1.02]'
                        }`}
                      >
                        {isLoading ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                        ) : isSelected ? (
                          <><Check className="w-4 h-4" /> Liked ✓</>
                        ) : (
                          <><Heart className="w-4 h-4" /> Like</>
                        )}
                      </button>

                      {/* Mark as Worn — only visible after Like */}
                      {isSelected && (
                        <button
                          onClick={() => handleMarkAsWorn(index, outfit)}
                          disabled={wornOutfits.has(index) || isMarkingWorn === index}
                          className={`px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                            wornOutfits.has(index)
                              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-2 border-purple-500/40 cursor-default'
                              : isMarkingWorn === index
                              ? 'bg-purple-500/50 text-white cursor-wait'
                              : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02]'
                          }`}
                        >
                          {isMarkingWorn === index ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                          ) : wornOutfits.has(index) ? (
                            <><Check className="w-4 h-4" /> Worn ✓</>
                          ) : (
                            <><Shirt className="w-4 h-4" /> I Wore This!</>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>

              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Helper function to build optimized shopping URLs for individual items
function optimizeItemLinks(item: string, gender?: string): { item: string; amazon: string; tatacliq: string; myntra: string } {
  // Clean and optimize the item query
  const cleanItem = item.trim().toLowerCase();
  
  // Build gender-aware search query
  let searchQuery = item;
  if (gender) {
    // Add gender prefix for better results
    searchQuery = `${gender} ${item}`;
  }
  
  // URL-encode the search query
  const encodedQuery = encodeURIComponent(searchQuery);
  
  return {
    item,
    amazon: `https://www.amazon.in/s?k=${encodedQuery}`,
    tatacliq: `https://www.tatacliq.com/search/?searchCategory=all&text=${encodedQuery}`,
    myntra: `https://www.myntra.com/${encodedQuery.replace(/\s+/g, '-')}`,
  };
}

// Helper function to build optimized shopping URLs for complete outfits
function buildOutfitSearchUrls(items: string[], gender?: string): { query: string; amazon: string; tatacliq: string; myntra: string } {
  // Use first 2 items for focused search (e.g., "white shirt black pants")
  const primaryItems = items.slice(0, 2).join(' ');
  let query = primaryItems;
  
  if (gender) {
    query = `${gender} ${primaryItems}`;
  }
  
  const encodedQuery = encodeURIComponent(query);
  
  return {
    query,
    amazon: `https://www.amazon.in/s?k=${encodedQuery}`,
    tatacliq: `https://www.tatacliq.com/search/?searchCategory=all&text=${encodedQuery}`,
    myntra: `https://www.myntra.com/${encodedQuery.replace(/\s+/g, '-')}`,
  };
}

