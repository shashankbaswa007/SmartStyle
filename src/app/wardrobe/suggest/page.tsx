'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ChevronRight, Calendar, Shirt, AlertCircle,
  Cloud, CloudRain, Sun, ArrowLeft, Footprints, Watch, Gem, Package,
  Loader2, ImageIcon, Star, Lightbulb, ShoppingBag, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
const Particles = dynamic(() => import('@/components/Particles'), { ssr: false });
import TextPressure from '@/components/TextPressure';
import { useMounted } from '@/hooks/useMounted';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { getWardrobeItems, WardrobeItemData } from '@/lib/wardrobeService';

interface OutfitItem {
  itemId: string;
  description: string;
  type: string;
}

interface OutfitCombination {
  name: string;
  items: OutfitItem[];
  reasoning: string;
  confidence: number;
  occasion: string;
}

interface OutfitResult {
  outfits: OutfitCombination[];
  wardrobeStats: {
    totalItems: number;
    itemsByType: Record<string, number>;
  };
  missingPieces?: string[];
  weather?: {
    temp: number;
    condition: string;
    description: string;
    location?: string;
  };
}

export default function WardrobeSuggestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>}>
      <WardrobeSuggestPageContent />
    </Suspense>
  );
}

function WardrobeSuggestPageContent() {
  const CONTEXT_MODES = ['all', 'work', 'casual', 'travel', 'weather', 'occasion'] as const;
  type ContextMode = typeof CONTEXT_MODES[number];

  const isMounted = useMounted();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [occasion, setOccasion] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [result, setResult] = useState<OutfitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wardrobeItemsMap, setWardrobeItemsMap] = useState<Map<string, WardrobeItemData>>(new Map());
  const [expandedOutfit, setExpandedOutfit] = useState<number | null>(null);

  // Read context from URL params or sessionStorage
  const [activeContext, setActiveContext] = useState<ContextMode>(() => {
    const urlContext = searchParams.get('context') as ContextMode | null;
    if (urlContext && CONTEXT_MODES.includes(urlContext)) return urlContext;
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('wardrobeContext') as ContextMode | null;
      if (stored && CONTEXT_MODES.includes(stored)) return stored;
    }
    return 'all';
  });

  // Pre-fill occasion from context
  useEffect(() => {
    if (!occasion && activeContext !== 'all') {
      const contextHints: Record<string, string> = {
        work: 'Business / Professional setting',
        casual: 'Casual outing',
        travel: 'Travel / Comfortable day out',
        weather: 'Weather-appropriate outfit',
        occasion: 'Special event / Formal occasion',
      };
      setOccasion(contextHints[activeContext] || '');
    }
  }, [activeContext]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build back link with context preserved
  const backToWardrobeHref = activeContext !== 'all'
    ? `/wardrobe?context=${activeContext}`
    : '/wardrobe';

  // Lookup a wardrobe item by its ID
  const getWardrobeItem = useCallback((itemId: string): WardrobeItemData | undefined => {
    return wardrobeItemsMap.get(itemId);
  }, [wardrobeItemsMap]);

  const handleGetSuggestions = async () => {
    if (!occasion || !occasion.trim()) {
      toast({
        variant: 'destructive',
        title: 'Occasion Required',
        description: 'Please describe the occasion to get outfit suggestions.',
      });
      return;
    }

    if (!selectedDate) {
      toast({
        variant: 'destructive',
        title: 'Date Required',
        description: 'Please select when you want to wear the outfit.',
      });
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Required',
        description: 'Please sign in to get outfit suggestions.',
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch user's wardrobe items from client-side
      const wardrobeItems = await getWardrobeItems(user.uid);

      if (wardrobeItems.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Empty Wardrobe',
          description: 'Please add items to your wardrobe before generating outfit suggestions.',
        });
        setLoading(false);
        return;
      }

      // Build a lookup map for quick access by ID
      const itemMap = new Map<string, WardrobeItemData>();
      wardrobeItems.forEach(item => {
        if (item.id) itemMap.set(item.id, item);
      });
      setWardrobeItemsMap(itemMap);

      const idToken = await user.getIdToken();

      const response = await fetch('/api/wardrobe-outfit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: user.uid,
          occasion: occasion.trim(),
          date: selectedDate.toISOString(),
          wardrobeItems: wardrobeItems,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate outfit suggestions');
      }

      const data = await response.json();
      setResult(data);
      // Auto-expand first outfit
      if (data.outfits && data.outfits.length > 0) {
        setExpandedOutfit(0);
      }

      toast({
        title: 'Outfits Generated!',
        description: `${data.outfits.length} outfit combinations created from your wardrobe.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate suggestions';
      setError(errorMessage);

      let toastDescription = errorMessage;
      if (errorMessage.includes('Empty wardrobe') || errorMessage.includes('add items')) {
        toastDescription = 'Add items to your wardrobe first, then come back for outfit suggestions!';
      } else if (errorMessage.includes('Insufficient items') || errorMessage.includes('at least')) {
        toastDescription = 'Add a few more items to your wardrobe to create better outfit combinations.';
      }

      toast({
        variant: 'destructive',
        title: 'Cannot Generate Outfits',
        description: toastDescription,
      });
    } finally {
      setLoading(false);
    }
  };

  const getItemTypeIcon = (type: string) => {
    const iconClass = 'h-4 w-4';
    switch (type) {
      case 'top': return <Shirt className={iconClass} />;
      case 'bottom': return <span className={`inline-flex items-center justify-center ${iconClass}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4 4h4l2 4h4l2-4h4v16H4z"/></svg></span>;
      case 'dress': return <Gem className={iconClass} />;
      case 'shoes': return <Footprints className={iconClass} />;
      case 'accessory': return <Watch className={iconClass} />;
      case 'outerwear': return <Package className={iconClass} />;
      default: return <Shirt className={iconClass} />;
    }
  };

  // Render a single outfit item with image from wardrobe
  const renderOutfitItem = (item: OutfitItem, index: number) => {
    const wardrobeItem = getWardrobeItem(item.itemId);
    const imageSrc = wardrobeItem?.images?.thumbnail || wardrobeItem?.imageUrl;
    const colors = wardrobeItem?.dominantColors || [];

    return (
      <motion.div
        key={item.itemId + '-' + index}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.07, duration: 0.3 }}
      >
        <div className="flex items-stretch gap-3 p-2.5 rounded-xl border border-teal-100 bg-white hover:border-teal-300 hover:shadow-md transition-all duration-300 group">
          {/* Image */}
          <div className="relative flex-shrink-0 w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gradient-to-br from-teal-50 to-emerald-50 ring-1 ring-teal-200/60">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={item.description}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="80px"
                loading="lazy"
                quality={75}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-teal-400">
                <ImageIcon className="h-5 w-5 mb-0.5" />
                <span className="text-[9px] font-medium">No image</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 py-0.5">
            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
              {item.description}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 text-teal-700 border-teal-200 bg-teal-50/60">
                {getItemTypeIcon(item.type)}
                <span className="capitalize">{item.type}</span>
              </Badge>
              {wardrobeItem?.brand && (
                <span className="text-[10px] text-gray-400 font-medium truncate">{wardrobeItem.brand}</span>
              )}
            </div>
          </div>

          {/* Color dots */}
          {colors.length > 0 && (
            <div className="flex flex-col items-center justify-center gap-1.5 flex-shrink-0 pr-1">
              {colors.slice(0, 3).map((color, idx) => (
                <div
                  key={idx}
                  className="w-3.5 h-3.5 rounded-full ring-1 ring-black/10 shadow-sm"
                  style={{ backgroundColor: color.startsWith('#') ? color : `#${color}` }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <ProtectedRoute>
      <main className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          {isMounted && (
            <Particles
              className="absolute inset-0"
              particleColors={['#14b8a6', '#5eead4']}
              particleCount={200}
              particleSpread={10}
              speed={0.3}
              particleBaseSize={150}
              moveParticlesOnHover={true}
              alphaParticles={false}
              disableRotation={false}
            />
          )}
        </div>

        <div className="relative z-10 max-w-6xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12">
            <div style={{
              position: 'relative',
              height: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: '60px',
              paddingBottom: '60px',
            }}>
              {isMounted && (
                <TextPressure
                  text="Outfit Suggestions"
                  stroke={true}
                  width={false}
                  weight={true}
                  textColor="#5eead4"
                  strokeColor="#0d9488"
                  minFontSize={32}
                />
              )}
            </div>
          </header>

          {/* Input Section */}
          <Card className="max-w-2xl mx-auto mb-12 border-teal-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-teal-900">Plan Your Outfit</CardTitle>
                {activeContext !== 'all' && (
                  <Badge className="bg-teal-100 text-teal-700 capitalize">
                    {activeContext} mode
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Occasion Input */}
              <div className="space-y-2">
                <Label htmlFor="occasion" className="text-teal-700">What&apos;s the occasion?</Label>
                <Input
                  id="occasion"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  placeholder="e.g., Business presentation, Wedding reception, Casual brunch..."
                  className="border-teal-300 focus:border-teal-500"
                />
                <p className="text-sm text-teal-600">Describe any occasion - be as specific as you like!</p>
              </div>

              {/* Date Picker */}
              <div className="space-y-2">
                <Label className="text-teal-700">When do you need this outfit?</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal border-teal-300 hover:border-teal-500',
                        !selectedDate && 'text-muted-foreground'
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4 text-teal-600" />
                      {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3">
                      <input
                        type="date"
                        value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                        onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : undefined)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        className="w-full border border-teal-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <p className="text-sm text-teal-600">We&apos;ll check the weather forecast for that day!</p>
              </div>

              <Button
                onClick={handleGetSuggestions}
                disabled={loading || !occasion.trim() || !selectedDate}
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white gap-2"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating Outfits...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Get Outfit Suggestions
                  </>
                )}
              </Button>

              <Link href={backToWardrobeHref}>
                <Button variant="outline" className="w-full border-teal-300 text-teal-700 hover:bg-teal-50 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Wardrobe
                  {activeContext !== 'all' && (
                    <Badge variant="secondary" className="ml-1 bg-teal-100 text-teal-700 text-xs capitalize">
                      {activeContext}
                    </Badge>
                  )}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="max-w-2xl mx-auto mb-8">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {(error.includes('Empty wardrobe') || error.includes('Insufficient items')) && (
                  <div className="mt-3">
                    <Link href={backToWardrobeHref}>
                      <Button variant="outline" size="sm" className="bg-white hover:bg-gray-50">
                        <Shirt className="h-4 w-4 mr-2" />
                        Go to Wardrobe
                      </Button>
                    </Link>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="max-w-4xl mx-auto space-y-6">
              {[1, 2].map((i) => (
                <Card key={i} className="border-teal-200 animate-pulse overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-teal-50/60 to-emerald-50/60 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-200/60" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 bg-teal-200/50 rounded-md w-48" />
                        <div className="h-3 bg-teal-100/50 rounded w-32" />
                      </div>
                      <div className="h-6 w-20 bg-teal-200/50 rounded-full" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5 space-y-3">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="flex gap-3 p-2.5 rounded-xl border border-gray-100">
                        <div className="w-20 h-20 bg-teal-50 rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-4 bg-gray-100 rounded w-3/4" />
                          <div className="h-3 bg-gray-50 rounded w-1/3" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ─── Results ─── */}
          {result && result.outfits.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-4xl mx-auto"
            >
              {/* Weather Card */}
              {result.weather && (
                <Card className="mb-8 border-teal-200 bg-gradient-to-br from-teal-50 to-sky-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      {result.weather.condition.toLowerCase().includes('rain') ? (
                        <CloudRain className="h-12 w-12 text-teal-600" />
                      ) : result.weather.condition.toLowerCase().includes('cloud') ? (
                        <Cloud className="h-12 w-12 text-teal-600" />
                      ) : (
                        <Sun className="h-12 w-12 text-amber-500" />
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-teal-900 flex items-center gap-2">
                          <Cloud className="h-5 w-5" />
                          Weather Forecast
                        </h3>
                        <p className="text-teal-700 font-medium">
                          {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-2xl font-bold text-teal-900">
                            {result.weather.temp}&deg;C
                          </span>
                          <span className="text-teal-800 capitalize">
                            {result.weather.description}
                          </span>
                        </div>
                        {result.weather.location && (
                          <p className="text-sm text-teal-600 mt-1">{result.weather.location}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stats Row */}
              <div className="flex flex-wrap gap-4 justify-center mb-8">
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
                  <span className="text-teal-900 font-semibold">{result.outfits.length}</span>
                  <span className="text-teal-700 ml-1">Outfits Generated</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
                  <span className="text-emerald-900 font-semibold">{result.wardrobeStats.totalItems}</span>
                  <span className="text-emerald-700 ml-1">Items in Wardrobe</span>
                </div>
              </div>

              {/* ─── Outfit Cards ─── */}
              <AnimatePresence>
                <div className="space-y-6 mb-12">
                  {result.outfits.map((outfit, outfitIdx) => {
                    const isExpanded = expandedOutfit === outfitIdx;
                    const matchedItems = outfit.items.filter(i => wardrobeItemsMap.has(i.itemId));
                    const previewItems = matchedItems.slice(0, 4);

                    return (
                      <motion.div
                        key={outfitIdx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: outfitIdx * 0.08 }}
                      >
                        <Card className={`overflow-hidden border-2 transition-all duration-300 ${
                          isExpanded
                            ? 'border-teal-400 shadow-xl shadow-teal-100/40'
                            : 'border-teal-200 hover:border-teal-300 hover:shadow-lg'
                        }`}>
                          {/* ── Card Header (clickable) ── */}
                          <button
                            onClick={() => setExpandedOutfit(isExpanded ? null : outfitIdx)}
                            className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded-t-xl"
                          >
                            <CardHeader className="bg-gradient-to-r from-teal-50/80 to-emerald-50/80 pb-4">
                              <div className="flex items-center gap-3">
                                {/* Outfit icon */}
                                <div className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-md flex-shrink-0">
                                  <Star className="h-5 w-5 text-white" />
                                </div>

                                {/* Title & badge */}
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base sm:text-lg text-teal-900 truncate">
                                    {outfit.name}
                                  </CardTitle>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Badge className="bg-teal-600/90 text-white text-[10px] px-1.5 py-0 h-5">
                                      {outfit.confidence}% match
                                    </Badge>
                                    <span className="text-xs text-teal-600 capitalize">{outfit.occasion}</span>
                                  </div>
                                </div>

                                {/* Preview thumbnails (collapsed) */}
                                {!isExpanded && previewItems.length > 0 && (
                                  <div className="hidden sm:flex -space-x-3">
                                    {previewItems.map((pItem, pIdx) => {
                                      const wItem = getWardrobeItem(pItem.itemId);
                                      const src = wItem?.images?.thumbnail || wItem?.imageUrl;
                                      return src ? (
                                        <div
                                          key={pIdx}
                                          className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm flex-shrink-0"
                                        >
                                          <Image src={src} alt="" fill className="object-cover" sizes="36px" />
                                        </div>
                                      ) : null;
                                    })}
                                    {matchedItems.length > 4 && (
                                      <div className="w-9 h-9 rounded-full bg-teal-100 border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-teal-700 flex-shrink-0">
                                        +{matchedItems.length - 4}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Chevron */}
                                <div className="flex-shrink-0 p-1">
                                  {isExpanded ? (
                                    <ChevronUp className="h-5 w-5 text-teal-500" />
                                  ) : (
                                    <ChevronDown className="h-5 w-5 text-teal-400" />
                                  )}
                                </div>
                              </div>
                            </CardHeader>
                          </button>

                          {/* ── Expanded content ── */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <CardContent className="pt-4 pb-6 space-y-5">
                                  {/* Items list */}
                                  <div>
                                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
                                      <Shirt className="h-4 w-4 text-teal-600" />
                                      Items to Wear
                                      <Badge variant="outline" className="ml-auto text-[10px] h-5 border-teal-200 text-teal-600">
                                        {outfit.items.length} piece{outfit.items.length !== 1 ? 's' : ''}
                                      </Badge>
                                    </h4>
                                    <div className="space-y-2">
                                      {outfit.items.map((item, itemIdx) =>
                                        renderOutfitItem(item, itemIdx)
                                      )}
                                    </div>
                                  </div>

                                  {/* Reasoning */}
                                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
                                    <h4 className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-1.5">
                                      <Lightbulb className="h-4 w-4 text-emerald-600" />
                                      Why This Works
                                    </h4>
                                    <p className="text-sm text-emerald-800 leading-relaxed">{outfit.reasoning}</p>
                                  </div>
                                </CardContent>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </AnimatePresence>

              {/* Missing Pieces */}
              {result.missingPieces && result.missingPieces.length > 0 && (
                <Card className="max-w-2xl mx-auto border-amber-200 bg-amber-50 mb-8">
                  <CardHeader>
                    <CardTitle className="text-amber-900 flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5" />
                      Wardrobe Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-amber-800 mb-4">
                      Consider adding these pieces to enhance your wardrobe for {occasion} occasions:
                    </p>
                    <ul className="space-y-2">
                      {result.missingPieces.map((piece, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-amber-900 text-sm">{piece}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* No Results State */}
          {result && result.outfits.length === 0 && (
            <Card className="max-w-2xl mx-auto border-teal-200">
              <CardContent className="py-12 text-center">
                <Shirt className="h-16 w-16 mx-auto mb-4 text-teal-400" />
                <h3 className="text-xl font-bold text-teal-900 mb-2">
                  Not Enough Items
                </h3>
                <p className="text-teal-700 mb-6">
                  We couldn&apos;t create outfit combinations with your current wardrobe items.
                  Try adding more items to get personalized suggestions!
                </p>
                <Link href={backToWardrobeHref}>
                  <Button className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white">
                    Add More Items
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
