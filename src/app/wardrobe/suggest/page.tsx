'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight, TrendingUp, Calendar, Shirt, AlertCircle, Cloud, CloudRain, Sun } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Particles from '@/components/Particles';
import TextPressure from '@/components/TextPressure';
import { useMounted } from '@/hooks/useMounted';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

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
  const isMounted = useMounted();
  const [loading, setLoading] = useState(false);
  const [occasion, setOccasion] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [result, setResult] = useState<OutfitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate outfit suggestions');
      }

      const data = await response.json();
      setResult(data);

      toast({
        title: 'Outfits Generated! ✨',
        description: `${data.outfits.length} outfit combinations created from your wardrobe.`,
      });
    } catch (err) {
      console.error('Error getting outfit suggestions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate suggestions';
      setError(errorMessage);
      
      // Provide more helpful error messages
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
    switch (type) {
      case 'top': return '👕';
      case 'bottom': return '👖';
      case 'dress': return '👗';
      case 'shoes': return '👟';
      case 'accessory': return '👜';
      case 'outerwear': return '🧥';
      default: return '👔';
    }
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
              particleCount={500}
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
              <CardTitle className="text-teal-900">Plan Your Outfit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Occasion Input */}
              <div className="space-y-2">
                <Label htmlFor="occasion" className="text-teal-700">What's the occasion?</Label>
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
                <p className="text-sm text-teal-600">We'll check the weather forecast for that day!</p>
              </div>

              <Button 
                onClick={handleGetSuggestions}
                disabled={loading || !occasion.trim() || !selectedDate}
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white gap-2"
                size="lg"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Generating Outfits...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Get Outfit Suggestions
                  </>
                )}
              </Button>

              <Link href="/wardrobe">
                <Button variant="outline" className="w-full border-teal-300 text-teal-700 hover:bg-teal-50">
                  ← Back to Wardrobe
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
                    <Link href="/wardrobe">
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

          {/* Results */}
          {result && result.outfits.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Weather Card */}
              {result.weather && (
                <Card className="max-w-2xl mx-auto mb-8 border-teal-200 bg-gradient-to-br from-teal-50 to-sky-50">
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
                            {result.weather.temp}°C
                          </span>
                          <span className="text-teal-800 capitalize">
                            {result.weather.description}
                          </span>
                        </div>
                        {result.weather.location && (
                          <p className="text-sm text-teal-600 mt-1">📍 {result.weather.location}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stats */}
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

              {/* Outfit Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                {result.outfits.map((outfit, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card className="border-teal-200 hover:border-teal-400 hover:shadow-xl transition-all duration-500 ease-out will-change-transform">
                      <CardHeader className="bg-gradient-to-r from-teal-50 to-emerald-50">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-teal-900 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-teal-600" />
                            {outfit.name}
                          </CardTitle>
                          <Badge className="bg-teal-600 text-white">
                            {outfit.confidence}% match
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        {/* Items */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Shirt className="h-4 w-4" />
                            Items to Wear:
                          </h4>
                          {outfit.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg">
                              <span className="text-2xl">{getItemTypeIcon(item.type)}</span>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{item.description}</div>
                                <div className="text-sm text-teal-700 capitalize">{item.type}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Reasoning */}
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <h4 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Why This Works:
                          </h4>
                          <p className="text-emerald-800 text-sm leading-relaxed">{outfit.reasoning}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Missing Pieces */}
              {result.missingPieces && result.missingPieces.length > 0 && (
                <Card className="max-w-2xl mx-auto border-amber-200 bg-amber-50">
                  <CardHeader>
                    <CardTitle className="text-amber-900 flex items-center gap-2">
                      <ChevronRight className="h-5 w-5" />
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
                          <span className="text-amber-600 mt-1">•</span>
                          <span className="text-amber-900">{piece}</span>
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
                  We couldn't create outfit combinations with your current wardrobe items.
                  Try adding more items to get personalized suggestions!
                </p>
                <Link href="/wardrobe">
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
