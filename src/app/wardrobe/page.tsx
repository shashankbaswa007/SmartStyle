'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { motion } from 'framer-motion';
import { Shirt, Plus, Filter, Trash2, TrendingUp, Sparkles, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Particles from '@/components/Particles';
import ShinyText from '@/components/ShinyText';
import TextPressure from '@/components/TextPressure';
import SplashCursor from '@/components/SplashCursor';
import { useMounted } from '@/hooks/useMounted';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { getWardrobeItems, deleteWardrobeItem, markItemAsWorn, WardrobeItemData } from '@/lib/wardrobeService';
import { WardrobeItemUpload } from '@/components/WardrobeItemUpload';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';

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

export default function WardrobePage() {
  const isMounted = useMounted();
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItemData[]>([]);
  const [filteredItems, setFilteredItems] = useState<WardrobeItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'top' | 'bottom' | 'dress' | 'shoes' | 'accessory' | 'outerwear'>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthenticated(true);
        fetchWardrobeItems(user.uid);
      } else {
        setUserId(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Apply filter
    if (selectedFilter === 'all') {
      setFilteredItems(wardrobeItems);
    } else {
      setFilteredItems(wardrobeItems.filter(item => item.itemType === selectedFilter));
    }
  }, [selectedFilter, wardrobeItems]);

  const fetchWardrobeItems = async (uid: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Fetching wardrobe items for user:', uid);
      
      const items = await getWardrobeItems(uid);
      
      console.log('✅ Fetched wardrobe items:', items.length);
      setWardrobeItems(items);
      
      if (items.length === 0) {
        console.log('ℹ️ No wardrobe items found - user may need to add items first');
      }
    } catch (error) {
      console.error('❌ Error fetching wardrobe items:', error);
      
      let errorMessage = 'Failed to load your wardrobe';
      if ((error as any)?.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please sign in again.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setWardrobeItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (userId) {
      console.log('🔄 Manual refresh triggered');
      setError(null);
      setLoading(true);
      fetchWardrobeItems(userId);
    }
  };

  const handleDeleteItem = async (itemId: string, description: string) => {
    if (!userId) return;

    try {
      const result = await deleteWardrobeItem(userId, itemId);
      
      if (result.success) {
        setWardrobeItems(prev => prev.filter(item => item.id !== itemId));
        
        toast({
          title: 'Item removed',
          description: `"${description}" has been removed from your wardrobe.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to remove',
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Error removing item:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to remove item from wardrobe',
      });
    }
  };

  const handleMarkAsWorn = async (itemId: string, description: string) => {
    if (!userId) return;

    try {
      const result = await markItemAsWorn(userId, itemId);
      
      if (result.success) {
        // Update local state
        setWardrobeItems(prev => prev.map(item => 
          item.id === itemId 
            ? { ...item, wornCount: (item.wornCount || 0) + 1, lastWornDate: Date.now() }
            : item
        ));
        
        toast({
          title: 'Marked as worn',
          description: `"${description}" wear count updated.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to update',
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Error marking as worn:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update item',
      });
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

  const convertColorToHex = (color: string): string => {
    if (color.startsWith('#')) return color.toUpperCase();
    
    const colorMap: Record<string, string> = {
      'black': '#000000', 'white': '#FFFFFF', 'gray': '#808080', 'grey': '#808080',
      'red': '#FF0000', 'blue': '#0000FF', 'green': '#008000', 'yellow': '#FFFF00',
      'orange': '#FFA500', 'purple': '#800080', 'pink': '#FFC0CB', 'brown': '#A52A2A',
    };
    
    return colorMap[color.toLowerCase()] || '#808080';
  };

  return (
    <ProtectedRoute>
      <main className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
        {/* Particles Background - Teal/Emerald theme for wardrobe */}
        <div className="absolute inset-0 -z-10">
          {isMounted && (
            <Particles
              className="absolute inset-0"
              particleColors={['#14b8a6', '#5eead4']}
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
                  text="My Wardrobe"
                  stroke={true}
                  width={false}
                  weight={true}
                  textColor="#5eead4"
                  strokeColor="#0d9488"
                  minFontSize={32}
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              <Link href="/wardrobe/suggest">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-500 ease-out will-change-transform gap-2"
                >
                  <Sparkles className="h-5 w-5" />
                  Get Outfit Suggestions
                </Button>
              </Link>
              
              <Button 
                size="lg" 
                variant="outline"
                className="border-teal-600 text-teal-600 hover:bg-teal-50 shadow-md gap-2"
                onClick={() => setShowUploadModal(true)}
              >
                <Plus className="h-5 w-5" />
                Add Item
              </Button>

              {wardrobeItems.length > 0 && (
                <Button 
                  onClick={handleRefresh}
                  variant="outline"
                  size="lg"
                  className="border-teal-600 text-teal-600 hover:bg-teal-50 shadow-md"
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
              )}
            </div>

            {/* Stats Bar */}
            {wardrobeItems.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 flex flex-wrap gap-4 justify-center"
              >
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
                  <span className="text-teal-900 font-semibold">{wardrobeItems.length}</span>
                  <span className="text-teal-700 ml-1">Total Items</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
                  <span className="text-emerald-900 font-semibold">
                    {wardrobeItems.filter(i => i.wornCount > 0).length}
                  </span>
                  <span className="text-emerald-700 ml-1">Worn</span>
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2">
                  <span className="text-cyan-900 font-semibold">
                    {wardrobeItems.filter(i => i.wornCount === 0).length}
                  </span>
                  <span className="text-cyan-700 ml-1">Never Worn</span>
                </div>
              </motion.div>
            )}
          </header>

          {/* Filter Buttons */}
          {wardrobeItems.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {['all', 'top', 'bottom', 'dress', 'shoes', 'accessory', 'outerwear'].map((filter) => (
                <Button
                  key={filter}
                  onClick={() => setSelectedFilter(filter as any)}
                  variant={selectedFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  className={selectedFilter === filter 
                    ? 'bg-teal-600 hover:bg-teal-700 text-white' 
                    : 'border-teal-300 text-teal-700 hover:bg-teal-50'
                  }
                >
                  {getItemTypeIcon(filter)} {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden border-teal-200">
                  <Skeleton className="h-48 w-full" />
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <Alert variant="destructive" className="max-w-2xl mx-auto">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Empty State */}
          {!loading && !error && wardrobeItems.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-dashed border-teal-300 rounded-2xl p-12 max-w-2xl mx-auto">
                <Shirt className="h-20 w-20 mx-auto mb-6 text-teal-400" />
                <h3 className="text-2xl font-bold text-teal-900 mb-3">
                  Your Wardrobe is Empty
                </h3>
                <p className="text-teal-700 mb-6 text-lg">
                  Start building your digital wardrobe by adding your clothing items.
                  Get personalized outfit suggestions based on what you own!
                </p>
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white gap-2"
                  onClick={() => {
                    toast({
                      title: 'Coming Soon!',
                      description: 'Item upload feature is being built.',
                    });
                  }}
                >
                  <Plus className="h-5 w-5" />
                  Add Your First Item
                </Button>
              </div>
            </motion.div>
          )}

          {/* Wardrobe Items Grid */}
          {!loading && !error && filteredItems.length > 0 && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8"
            >
              {filteredItems.map((item) => (
                <motion.div key={item.id} variants={itemVariants}>
                  <Card className="group overflow-hidden border-teal-200 hover:border-teal-400 hover:shadow-xl transition-all duration-500 ease-out will-change-transform">
                    {/* Image */}
                    <div className="relative h-64 overflow-hidden bg-gradient-to-br from-teal-50 to-emerald-50">
                      <Image
                        src={item.imageUrl}
                        alt={item.description}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      
                      {/* Item Type Badge */}
                      <Badge className="absolute top-3 left-3 bg-teal-600 text-white">
                        {getItemTypeIcon(item.itemType)} {item.itemType}
                      </Badge>
                      
                      {/* Worn Count Badge */}
                      {item.wornCount > 0 && (
                        <Badge className="absolute top-3 right-3 bg-emerald-600 text-white">
                          Worn {item.wornCount}x
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-4">
                      {/* Description */}
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">
                        {item.description}
                      </h3>

                      {/* Colors */}
                      {item.dominantColors && item.dominantColors.length > 0 && (
                        <div className="flex gap-2 mb-3">
                          {item.dominantColors.slice(0, 5).map((color, idx) => (
                            <div
                              key={idx}
                              className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                              style={{ backgroundColor: convertColorToHex(color) }}
                              title={color}
                            />
                          ))}
                        </div>
                      )}

                      {/* Meta Info */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {item.category && (
                          <Badge variant="outline" className="text-xs border-teal-300 text-teal-700">
                            {item.category}
                          </Badge>
                        )}
                        {item.brand && (
                          <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">
                            {item.brand}
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-teal-600 text-teal-600 hover:bg-teal-50"
                          onClick={() => handleMarkAsWorn(item.id!, item.description)}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Mark Worn
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteItem(item.id!, item.description)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* No Results for Filter */}
          {!loading && !error && wardrobeItems.length > 0 && filteredItems.length === 0 && (
            <div className="text-center py-16">
              <Filter className="h-16 w-16 mx-auto mb-4 text-teal-400" />
              <h3 className="text-xl font-bold text-teal-900 mb-2">
                No items in this category
              </h3>
              <p className="text-teal-700">
                Try selecting a different filter or add more items to your wardrobe.
              </p>
            </div>
          )}
        </div>

        {/* Upload Modal */}
        <WardrobeItemUpload 
          open={showUploadModal}
          onOpenChange={setShowUploadModal}
          onItemAdded={() => {
            if (userId) {
              fetchWardrobeItems(userId);
            }
          }}
        />
      </main>
    </ProtectedRoute>
  );
}
