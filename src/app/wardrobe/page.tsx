'use client';

import { useEffect, useState, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Shirt, Plus, Filter, Trash2, TrendingUp, Sparkles, Calendar, Loader2, Shield, Info, Undo2, Camera, Upload as UploadIcon, LightbulbIcon, Clock, Heart, AlertCircle, ChevronDown, ChevronUp, Zap, Star, Briefcase, Coffee, Plane, CloudSun, PartyPopper, Home, Search, ArrowUpDown, Palette } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMounted } from '@/hooks/useMounted';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { getWardrobeItems, deleteWardrobeItem, markItemAsWorn, WardrobeItemData } from '@/lib/wardrobeService';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';

// Lazy load heavy components for better initial load performance
const Particles = lazy(() => import('@/components/Particles'));
const TextPressure = lazy(() => import('@/components/TextPressure'));
const WardrobeItemUpload = lazy(() => import('@/components/WardrobeItemUpload').then(mod => ({ default: mod.WardrobeItemUpload })));

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
  const ITEM_FILTERS = ['all', 'top', 'bottom', 'dress', 'shoes', 'accessory', 'outerwear'] as const;
  type ItemFilter = typeof ITEM_FILTERS[number];
  const [selectedFilter, setSelectedFilter] = useState<ItemFilter>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [lastDeletedItem, setLastDeletedItem] = useState<{item: WardrobeItemData, timestamp: number} | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const markingAsWornRef = useRef<Set<string>>(new Set());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showInsights, setShowInsights] = useState(true);
  
  // Respect reduced-motion preference for accessibility
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Cleanup undo timer on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);
  
  // Context mode for smart filtering
  const CONTEXT_MODES = ['all', 'work', 'casual', 'travel', 'weather', 'occasion'] as const;
  type ContextMode = typeof CONTEXT_MODES[number];
  const [contextMode, setContextMode] = useState<ContextMode>('all');
  
  // Search and discovery features
  const [searchQuery, setSearchQuery] = useState('');
  const SORT_OPTIONS = ['recent', 'most-worn', 'least-worn', 'never-worn', 'alphabetical'] as const;
  type SortOption = typeof SORT_OPTIONS[number];
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [groupByColor, setGroupByColor] = useState(false);
  
  // Network and sync state management
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Scale awareness for large wardrobes
  const LARGE_WARDROBE_THRESHOLD = 100;
  const isLargeWardrobe = wardrobeItems.length >= LARGE_WARDROBE_THRESHOLD;

  // Network connectivity detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-refresh when coming back online
      if (userId) {
        console.log('📶 Connection restored, refreshing wardrobe...');
        fetchWardrobeItems(userId);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      console.log('📴 Connection lost');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check initial state
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId]);

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

  // Optimized: Use polling instead of real-time subscriptions
  // Fetches data every 45 seconds or on user action
  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchWardrobeItems(userId);

    // Set up polling every 45 seconds
    const pollInterval = setInterval(() => {
      fetchWardrobeItems(userId);
    }, 45000); // 45 seconds

    return () => clearInterval(pollInterval);
  }, [userId]);

  // Apply context-aware filtering
  const applyContextFilter = (items: WardrobeItemData[]) => {
    if (contextMode === 'all') return items;

    return items.filter(item => {
      const occasions = item.occasions || [];
      const season = item.season || [];

      switch (contextMode) {
        case 'work':
          return occasions.includes('business') || occasions.includes('formal');
        case 'casual':
          return occasions.includes('casual');
        case 'travel':
          // Prioritize versatile items and comfortable clothing
          return occasions.includes('casual') || item.itemType === 'shoes' || item.itemType === 'outerwear';
        case 'weather':
          // Show seasonal items based on current season (simplified: use all seasonal items)
          return season.length > 0;
        case 'occasion':
          return occasions.includes('formal') || occasions.includes('party');
        default:
          return true;
      }
    });
  };

  // Natural-language search filter
  const applySearchFilter = (items: WardrobeItemData[]) => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase().trim();
    return items.filter(item => {
      const searchableFields = [
        item.description,
        item.itemType,
        item.category,
        item.brand,
        item.notes,
        ...(item.occasions || []),
        ...(item.season || [])
      ].filter(Boolean).map(field => field?.toLowerCase() || '');

      return searchableFields.some(field => field.includes(query));
    });
  };

  // Usage-based sorting
  const applySorting = (items: WardrobeItemData[]) => {
    const sorted = [...items];

    switch (sortBy) {
      case 'most-worn':
        return sorted.sort((a, b) => (b.wornCount || 0) - (a.wornCount || 0));
      case 'least-worn':
        return sorted.sort((a, b) => (a.wornCount || 0) - (b.wornCount || 0));
      case 'never-worn':
        return sorted.filter(item => !item.wornCount || item.wornCount === 0)
          .concat(sorted.filter(item => item.wornCount && item.wornCount > 0));
      case 'alphabetical':
        return sorted.sort((a, b) => 
          (a.description || '').localeCompare(b.description || '')
        );
      case 'recent':
      default:
        return sorted.sort((a, b) => {
          const dateA = typeof a.addedDate === 'number' ? a.addedDate : 0;
          const dateB = typeof b.addedDate === 'number' ? b.addedDate : 0;
          return dateB - dateA; // Most recent first
        });
    }
  };

  // Color-based grouping
  const groupItemsByColor = (items: WardrobeItemData[]) => {
    const colorGroups: { [key: string]: WardrobeItemData[] } = {};
    
    items.forEach(item => {
      const primaryColor = item.dominantColors?.[0] || '#808080';
      if (!colorGroups[primaryColor]) {
        colorGroups[primaryColor] = [];
      }
      colorGroups[primaryColor].push(item);
    });

    return Object.entries(colorGroups).map(([color, items]) => ({
      color,
      items,
      count: items.length
    })).sort((a, b) => b.count - a.count); // Sort by group size
  };

  useEffect(() => {
    // Apply filters in order: type → context → search → sort
    let items = selectedFilter === 'all' 
      ? wardrobeItems 
      : wardrobeItems.filter(item => item.itemType === selectedFilter);
    
    items = applyContextFilter(items);
    items = applySearchFilter(items);
    items = applySorting(items);
    
    setFilteredItems(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter, wardrobeItems, contextMode, searchQuery, sortBy]);

  const fetchWardrobeItems = async (uid: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      setIsSyncing(true);
      setError(null);
      console.log('🔍 Fetching wardrobe items for user:', uid);
      
      const items = await getWardrobeItems(uid);
      
      console.log('✅ Fetched wardrobe items:', items.length);
      setWardrobeItems(items);
      setLastUpdated(Date.now());
      
      // Scale warning for large wardrobes
      if (items.length >= LARGE_WARDROBE_THRESHOLD && items.length % 50 === 0) {
        console.log(`⚠️ Large wardrobe detected: ${items.length} items. Consider using filters for better performance.`);
      }
      
      if (items.length === 0) {
        console.log('ℹ️ No wardrobe items found - user may need to add items first');
      }
    } catch (error) {
      console.error('❌ Error fetching wardrobe items:', error);
      
      let errorMessage = 'Failed to load your wardrobe';
      if (error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Please sign in again.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setWardrobeItems([]);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  const handleRefresh = () => {
    if (userId) {
      if (!isOnline) {
        toast({
          variant: 'default',
          title: 'No internet connection',
          description: 'Please check your connection and try again.',
        });
        return;
      }
      console.log('🔄 Manual refresh triggered');
      setError(null);
      setLoading(true);
      fetchWardrobeItems(userId);
    }
  };

  const handleDeleteItem = async (itemId: string, description: string) => {
    if (!userId) return;
    
    // Prevent operations when offline
    if (!isOnline) {
      toast({
        variant: 'default',
        title: 'No internet connection',
        description: 'Cannot delete items while offline. Please check your connection.',
      });
      return;
    }

    // Prevent concurrent deletes or undo operations
    if (deletingItemId || isUndoing) {
      toast({
        variant: 'default',
        title: 'Please wait',
        description: deletingItemId ? 'Another item is being deleted.' : 'Undo operation in progress.',
      });
      return;
    }

    setDeletingItemId(itemId);

    // Store the item being deleted for potential undo
    const itemToDelete = wardrobeItems.find(item => item.id === itemId);

    // Optimistic update - remove from UI immediately
    const previousItems = [...wardrobeItems];
    setWardrobeItems(prev => prev.filter(item => item.id !== itemId));

    try {
      const result = await deleteWardrobeItem(userId, itemId);
      
      if (result.success) {
        // Store deleted item for undo (available for 10 seconds)
        if (itemToDelete) {
          setLastDeletedItem({ item: itemToDelete, timestamp: Date.now() });
          setShowUndoToast(true);
          
          // Clear any existing undo timer
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
          
          // Auto-hide undo after 10 seconds
          undoTimerRef.current = setTimeout(() => {
            setShowUndoToast(false);
            setLastDeletedItem(null);
            undoTimerRef.current = null;
          }, 10000);
        }

        toast({
          title: 'Item removed',
          description: `"${description}" has been removed from your wardrobe.`,
        });
      } else {
        // Rollback on failure
        setWardrobeItems(previousItems);
        
        toast({
          variant: 'destructive',
          title: 'Failed to remove',
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Error removing item:', error);
      
      // Rollback on error
      setWardrobeItems(previousItems);
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to remove item from wardrobe. Please try again.',
      });
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleUndoDelete = async () => {
    if (!lastDeletedItem || !userId || isUndoing || deletingItemId) return;
    
    // Check if undo window has expired (10 seconds)
    const timeSinceDelete = Date.now() - lastDeletedItem.timestamp;
    if (timeSinceDelete > 10000) {
      toast({
        variant: 'default',
        title: 'Undo window expired',
        description: 'This item can no longer be restored. Please re-add it manually if needed.',
      });
      setShowUndoToast(false);
      setLastDeletedItem(null);
      return;
    }
    
    // Prevent undo when offline
    if (!isOnline) {
      toast({
        variant: 'default',
        title: 'No internet connection',
        description: 'Cannot restore items while offline. Please check your connection.',
      });
      return;
    }

    // Prevent concurrent undo operations or deletes
    if (deletingItemId) {
      toast({
        variant: 'default',
        title: 'Please wait',
        description: 'Delete operation in progress.',
      });
      return;
    }

    const itemToRestore = lastDeletedItem.item;
    
    // Hide toast immediately
    setShowUndoToast(false);
    setIsUndoing(true);
    
    try {
      // Re-add the item to Firestore with the same ID and data
      const itemsRef = collection(db, 'users', userId, 'wardrobeItems');
      const docRef = doc(itemsRef, itemToRestore.id);
      
      await setDoc(docRef, {
        imageUrl: itemToRestore.imageUrl,
        images: itemToRestore.images || undefined,
        itemType: itemToRestore.itemType,
        category: itemToRestore.category || '',
        brand: itemToRestore.brand || '',
        description: itemToRestore.description,
        dominantColors: itemToRestore.dominantColors || [],
        season: itemToRestore.season || [],
        occasions: itemToRestore.occasions || [],
        purchaseDate: itemToRestore.purchaseDate || '',
        addedDate: itemToRestore.addedDate,
        wornCount: itemToRestore.wornCount || 0,
        lastWornDate: itemToRestore.lastWornDate || null,
        tags: itemToRestore.tags || [],
        notes: itemToRestore.notes || '',
        isActive: true,
      });
      
      // Restore in UI
      setWardrobeItems(prev => [...prev, itemToRestore].sort((a, b) => b.addedDate - a.addedDate));
      setLastDeletedItem(null);
      
      toast({
        title: 'Item Restored',
        description: `"${itemToRestore.description}" has been restored to your wardrobe.`,
      });
    } catch (error) {
      console.error('Error restoring item:', error);
      toast({
        variant: 'destructive',
        title: 'Restore Failed',
        description: 'Could not restore the item. Please try adding it again.',
      });
      setLastDeletedItem(null);
    } finally {
      setIsUndoing(false);
    }
  };

  // Calculate recommendation readiness
  const getRecommendationReadiness = () => {
    const itemCount = wardrobeItems.length;
    if (itemCount === 0) return { level: 0, message: 'Add items to get started', color: 'text-gray-500' };
    if (itemCount < 5) return { level: 1, message: 'Getting started - add more for better suggestions', color: 'text-amber-600' };
    if (itemCount < 10) return { level: 2, message: 'Good progress - recommendations improving', color: 'text-teal-600' };
    if (itemCount < 20) return { level: 3, message: 'Great wardrobe - quality recommendations available', color: 'text-emerald-600' };
    return { level: 4, message: 'Excellent wardrobe - best recommendations', color: 'text-green-600' };
  };

  const handleMarkAsWorn = async (itemId: string, description: string) => {
    if (!userId) return;
    
    // Prevent operations when offline
    if (!isOnline) {
      toast({
        variant: 'default',
        title: 'No internet connection',
        description: 'Cannot update wear count while offline.',
      });
      return;
    }

    // Prevent duplicate requests for the same item
    if (markingAsWornRef.current.has(itemId)) {
      return;
    }

    markingAsWornRef.current.add(itemId);

    // Optimistic update
    const previousItems = [...wardrobeItems];
    setWardrobeItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, wornCount: (item.wornCount || 0) + 1, lastWornDate: Date.now() }
        : item
    ));

    try {
      const result = await markItemAsWorn(userId, itemId);
      
      if (result.success) {
        toast({
          title: 'Marked as worn',
          description: `"${description}" wear count updated.`,
        });
      } else {
        // Rollback on failure
        setWardrobeItems(previousItems);
        
        toast({
          variant: 'destructive',
          title: 'Failed to update',
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Error marking as worn:', error);
      
      // Rollback on error
      setWardrobeItems(previousItems);
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update item. Please try again.',
      });
    } finally {
      markingAsWornRef.current.delete(itemId);
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

  // Generate smart insights based on wardrobe data and context (memoized)
  const smartInsights = useMemo(() => {
    if (wardrobeItems.length === 0) return [];

    const insights = [];
    const now = Date.now();
    const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const THREE_MONTHS = 90 * 24 * 60 * 60 * 1000;

    // Context-specific insights
    if (contextMode !== 'all') {
      const contextItems = applyContextFilter(wardrobeItems);
      const contextLabel = contextMode === 'work' ? 'work' : contextMode === 'casual' ? 'casual' : contextMode === 'travel' ? 'travel' : contextMode === 'weather' ? 'seasonal' : 'special occasion';
      
      if (contextItems.length === 0) {
        insights.push({
          type: 'context-empty',
          icon: AlertCircle,
          color: 'amber',
          title: `No ${contextLabel} items found`,
          description: `Add items tagged for ${contextLabel} to see them here`,
          items: [],
        });
        return insights;
      }
      
      if (contextItems.length <= 3) {
        insights.push({
          type: 'context-limited',
          icon: Info,
          color: 'teal',
          title: `${contextItems.length} ${contextLabel} item${contextItems.length > 1 ? 's' : ''}`,
          description: `Consider adding more ${contextLabel} options`,
          items: contextItems,
        });
      }
    }

    // Calculate average wear count for reference
    const wornItems = wardrobeItems.filter(item => item.wornCount > 0);
    const avgWearCount = wornItems.length > 0 
      ? wornItems.reduce((sum, item) => sum + item.wornCount, 0) / wornItems.length 
      : 0;

    // 1. Overused items (wearing out) - worn significantly more than average
    if (avgWearCount > 0) {
      const overused = wardrobeItems.filter(item => 
        item.wornCount > avgWearCount * 2 && item.wornCount >= 8
      ).sort((a, b) => b.wornCount - a.wornCount);
      
      if (overused.length > 0) {
        const top = overused[0];
        insights.push({
          type: 'overused',
          icon: TrendingUp,
          color: 'amber',
          title: 'High rotation item',
          description: `${top.description} has been worn ${top.wornCount} times — consider adding similar items`,
          items: overused.slice(0, 2),
        });
      }
    }

    // 2. Rotation suggestion - underused items that complement favorites
    const underused = wardrobeItems.filter(item => 
      item.wornCount > 0 && 
      item.wornCount < 3 && 
      item.lastWornDate && 
      (now - item.lastWornDate) > ONE_MONTH
    );
    
    if (underused.length > 0) {
      const suggestion = underused[0];
      insights.push({
        type: 'rotation',
        icon: Sparkles,
        color: 'purple',
        title: 'Rotation suggestion',
        description: `Try wearing ${suggestion.description} this week to refresh your style`,
        items: [suggestion],
      });
    }

    // 3. Category imbalance - item types that are never/rarely worn
    const typeUsage = ITEM_FILTERS.slice(1).map(type => ({
      type,
      items: wardrobeItems.filter(item => item.itemType === type),
      avgWears: 0
    }));
    
    typeUsage.forEach(t => {
      if (t.items.length > 0) {
        t.avgWears = t.items.reduce((sum, item) => sum + item.wornCount, 0) / t.items.length;
      }
    });
    
    const neglectedTypes = typeUsage.filter(t => 
      t.items.length > 0 && t.avgWears < 1 && t.items.length >= 2
    );
    
    if (neglectedTypes.length > 0) {
      const type = neglectedTypes[0];
      insights.push({
        type: 'category-underused',
        icon: Info,
        color: 'teal',
        title: `Underused ${type.type}s`,
        description: `You have ${type.items.length} ${type.type}s that rarely get worn — time to mix them in?`,
        items: type.items.slice(0, 3),
      });
    }

    // 4. Seasonal opportunity - unused seasonal items for current season
    const currentMonth = new Date().getMonth(); // 0-11
    let currentSeason: 'spring' | 'summer' | 'fall' | 'winter';
    if (currentMonth >= 2 && currentMonth <= 4) currentSeason = 'spring';
    else if (currentMonth >= 5 && currentMonth <= 7) currentSeason = 'summer';
    else if (currentMonth >= 8 && currentMonth <= 10) currentSeason = 'fall';
    else currentSeason = 'winter';
    
    const seasonalUnused = wardrobeItems.filter(item => 
      item.season?.includes(currentSeason) && 
      (!item.lastWornDate || (now - item.lastWornDate) > TWO_WEEKS)
    );
    
    if (seasonalUnused.length >= 2) {
      insights.push({
        type: 'seasonal-reminder',
        icon: CloudSun,
        color: 'teal',
        title: `Perfect for ${currentSeason}`,
        description: `${seasonalUnused.length} ${currentSeason} items haven't been worn recently`,
        items: seasonalUnused.slice(0, 3),
      });
    }

    // 5. Never worn items (higher priority than before)
    const neverWorn = wardrobeItems.filter(item => !item.wornCount || item.wornCount === 0);
    const oldNeverWorn = neverWorn.filter(item => 
      item.addedDate && (now - item.addedDate) > ONE_MONTH
    );
    
    if (oldNeverWorn.length > 0) {
      insights.push({
        type: 'forgotten',
        icon: Clock,
        color: 'amber',
        title: `${oldNeverWorn.length} item${oldNeverWorn.length > 1 ? 's' : ''} still waiting`,
        description: `${oldNeverWorn.map(i => i.description).slice(0, 2).join(', ')}${oldNeverWorn.length > 2 ? ` and ${oldNeverWorn.length - 2} more` : ''} — give them a try!`,
        items: oldNeverWorn.slice(0, 3),
      });
    } else if (neverWorn.length > 0 && neverWorn.length <= 3) {
      insights.push({
        type: 'new-unworn',
        icon: Star,
        color: 'teal',
        title: 'New additions ready',
        description: neverWorn.map(i => i.description).join(', '),
        items: neverWorn,
      });
    }

    // 6. Favorites milestone
    const favorites = wardrobeItems.filter(item => (item.wornCount || 0) >= 5);
    if (favorites.length > 0 && favorites.length <= 3) {
      const topFavorite = favorites.sort((a, b) => (b.wornCount || 0) - (a.wornCount || 0))[0];
      insights.push({
        type: 'favorite',
        icon: Heart,
        color: 'rose',
        title: 'Wardrobe MVP',
        description: `${topFavorite.description} (${topFavorite.wornCount} wears) — a true favorite!`,
        items: [topFavorite],
      });
    }

    // 7. Long-term neglected (have history but abandoned)
    const longNeglected = wardrobeItems.filter(item => 
      item.wornCount >= 2 && 
      item.lastWornDate && 
      (now - item.lastWornDate) > THREE_MONTHS
    );
    
    if (longNeglected.length > 0) {
      insights.push({
        type: 'neglected',
        icon: Sparkles,
        color: 'purple',
        title: 'Rediscover past favorites',
        description: `${longNeglected.length} item${longNeglected.length > 1 ? 's' : ''} you used to love — ${longNeglected[0].description} and more`,
        items: longNeglected.slice(0, 3),
      });
    }

    // Return prioritized insights (max 4 to keep it manageable)
    return insights.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardrobeItems, contextMode]);

  // Get item-specific nudge badge (memoized helper)
  const getItemNudge = useCallback((item: WardrobeItemData) => {
    const now = Date.now();
    const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const THREE_MONTHS = 90 * 24 * 60 * 60 * 1000;

    // Calculate average wear count for comparison
    const wornItems = wardrobeItems.filter(i => i.wornCount > 0);
    const avgWearCount = wornItems.length > 0 
      ? wornItems.reduce((sum, i) => sum + i.wornCount, 0) / wornItems.length 
      : 0;

    // High usage - worn significantly more than average
    if (avgWearCount > 0 && item.wornCount > avgWearCount * 2 && item.wornCount >= 8) {
      return { label: `${item.wornCount}x`, color: 'bg-blue-100 text-blue-700 border-blue-300', icon: '🔥' };
    }

    // Favorite milestone (worn 5+ times)
    if (item.wornCount >= 5) {
      return { label: `${item.wornCount}x`, color: 'bg-rose-100 text-rose-700 border-rose-300', icon: '❤️' };
    }

    // Never worn but old enough to notice
    if (!item.wornCount || item.wornCount === 0) {
      const daysSinceAdded = item.addedDate ? Math.floor((now - item.addedDate) / (24 * 60 * 60 * 1000)) : 0;
      if (daysSinceAdded < 7) {
        return { label: 'New', color: 'bg-teal-100 text-teal-700 border-teal-300', icon: '✨' };
      }
      if (daysSinceAdded > 30) {
        return { label: 'Try me!', color: 'bg-amber-100 text-amber-700 border-amber-300', icon: '👀' };
      }
      return { label: 'Unworn', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: '📦' };
    }

    // Worn once or twice but not recently - good rotation candidate
    if (item.wornCount <= 2 && item.lastWornDate && (now - item.lastWornDate) > ONE_MONTH) {
      return { label: 'Rotate in?', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: '🔄' };
    }

    // Long-term neglected (was favorite, now forgotten)
    if (item.wornCount >= 3 && item.lastWornDate && (now - item.lastWornDate) > THREE_MONTHS) {
      return { label: 'Miss me?', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: '💜' };
    }

    // Recently worn (within 2 weeks)
    if (item.lastWornDate && (now - item.lastWornDate) < TWO_WEEKS) {
      return { label: 'Recent', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '✓' };
    }

    return null;
  }, [wardrobeItems]);

  // Get detailed wear info for tooltips
  const getWearInfo = (item: WardrobeItemData) => {
    const now = Date.now();
    const parts = [];

    if (item.wornCount > 0) {
      parts.push(`Worn ${item.wornCount} time${item.wornCount !== 1 ? 's' : ''}`);
    } else {
      parts.push('Never worn');
    }

    if (item.lastWornDate) {
      const daysSince = Math.floor((now - item.lastWornDate) / (24 * 60 * 60 * 1000));
      if (daysSince === 0) {
        parts.push('worn today');
      } else if (daysSince === 1) {
        parts.push('worn yesterday');
      } else if (daysSince < 7) {
        parts.push(`worn ${daysSince} days ago`);
      } else if (daysSince < 30) {
        parts.push(`worn ${Math.floor(daysSince / 7)} week${Math.floor(daysSince / 7) !== 1 ? 's' : ''} ago`);
      } else {
        parts.push(`worn ${Math.floor(daysSince / 30)} month${Math.floor(daysSince / 30) !== 1 ? 's' : ''} ago`);
      }
    }

    if (item.addedDate) {
      const daysSinceAdded = Math.floor((now - item.addedDate) / (24 * 60 * 60 * 1000));
      if (daysSinceAdded < 7) {
        parts.push('added this week');
      } else if (daysSinceAdded < 30) {
        parts.push(`added ${Math.floor(daysSinceAdded / 7)} week${Math.floor(daysSinceAdded / 7) !== 1 ? 's' : ''} ago`);
      }
    }

    return parts.join(' • ');
  };
  
  // Format last updated time for display
  const getLastUpdatedText = () => {
    if (!lastUpdated) return 'Never';
    
    const now = Date.now();
    const diff = now - lastUpdated;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <ProtectedRoute>
      <TooltipProvider delayDuration={300}>
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-24 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to main content
      </a>
      <main id="main-content" className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8" role="main" aria-label="Wardrobe management">
        {/* Offline Notification Banner */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white px-4 py-2 text-center text-sm font-medium shadow-lg"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span>You&apos;re offline. Some features are unavailable until your connection is restored.</span>
            </div>
          </motion.div>
        )}
        
        {/* Particles Background - Optimized for performance */}
        <div className="absolute inset-0 -z-10">
          {isMounted && (
            <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-emerald-50" />}>
              <Particles
                className="absolute inset-0"
                particleColors={['#14b8a6', '#0f766e']}
                particleCount={200}
                particleSpread={10}
                speed={0.5}
                particleBaseSize={120}
                moveParticlesOnHover={false}
                alphaParticles={false}
                disableRotation={true}
              />
            </Suspense>
          )}
        </div>

        <div className="relative z-10 max-w-6xl mx-auto" id="main-content">
          {/* Header */}
          <header className="text-center mb-16 relative" role="banner">
            <div style={{ position: 'relative', height: '300px' }} aria-label="Page title">
              {isMounted && (
                <Suspense fallback={<h1 className="text-5xl font-bold text-teal-900">My Wardrobe</h1>}>
                  <TextPressure
                    text="My Wardrobe"
                    stroke={true}
                    width={false}
                  weight={true}
                  textColor="#5eead4"
                  strokeColor="#0d9488"
                  minFontSize={32}
                />
                </Suspense>
              )}
            </div>

            {/* Privacy Reassurance Badge with Sync Status */}
            <div className="flex items-center justify-center gap-2 mb-4 text-sm" role="status" aria-live="polite">
              <Shield className="h-4 w-4 text-teal-600" aria-hidden="true" />
              <span className="text-gray-700">Your wardrobe is private</span>
              {isSyncing && (
                <>
                  <span className="text-gray-400">•</span>
                  <Loader2 className="h-3 w-3 text-teal-600 animate-spin" aria-hidden="true" />
                  <span className="text-gray-500 text-xs">Syncing...</span>
                </>
              )}
              {!isSyncing && lastUpdated && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500 text-xs" title={new Date(lastUpdated).toLocaleString()}>
                    Updated {getLastUpdatedText()}
                  </span>
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                    aria-label="Learn more about privacy"
                  >
                    <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 transition-colors" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs font-semibold mb-1">Complete Privacy</p>
                  <p className="text-xs">Only you can see your wardrobe. AI processes images locally when possible, and uploaded images are stored securely with your account.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Action Buttons - Mobile optimized */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-3 justify-center mt-6 sm:mt-8 px-4 sm:px-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={`/wardrobe/suggest${contextMode !== 'all' ? `?context=${contextMode}` : ''}`} className="w-full sm:w-auto">
                    <Button 
                      size="lg" 
                      className="w-full sm:w-auto bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 gap-2 h-12 sm:h-11 text-base sm:text-sm touch-manipulation active:scale-95"
                      aria-label="Get AI-powered outfit suggestions"
                    >
                      <Sparkles className="h-5 w-5" aria-hidden="true" />
                      <span className="truncate">{contextMode !== 'all' ? `${contextMode.charAt(0).toUpperCase() + contextMode.slice(1)} Outfits` : 'Get Outfit Suggestions'}</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-teal-900 text-white border-teal-700 max-w-xs hidden sm:block">
                  <p>AI creates {contextMode !== 'all' ? `${contextMode} ` : ''}outfits from your wardrobe</p>
                  <p className="text-xs opacity-80 mt-1">Works best with 10+ items</p>
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-teal-700">
                    <Shield className="h-3 w-3" aria-hidden="true" />
                    <span className="text-xs opacity-90">AI runs securely on your data only</span>
                  </div>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="w-full sm:w-auto border-2 border-teal-600 text-teal-600 hover:bg-teal-50 shadow-md gap-2 h-12 sm:h-11 text-base sm:text-sm focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 touch-manipulation active:scale-95"
                    onClick={() => setShowUploadModal(true)}
                    aria-label="Add a new clothing item to your wardrobe"
                  >
                    <Plus className="h-5 w-5" aria-hidden="true" />
                    Add Item
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-teal-900 text-white border-teal-700 hidden sm:block">
                  <p>Upload a photo of your clothing item</p>
                </TooltipContent>
              </Tooltip>

              {wardrobeItems.length > 0 && (
                <Button 
                  onClick={handleRefresh}
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-teal-600 text-teal-600 hover:bg-teal-50 shadow-md h-12 sm:h-11 text-base sm:text-sm focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 touch-manipulation active:scale-95"
                  disabled={loading || isSyncing || !isOnline}
                  aria-label="Refresh wardrobe items"
                  aria-live="polite"
                  aria-busy={loading || isSyncing}
                >
                  {(loading || isSyncing) ? (
                    <>
                      <Loader2 className="h-4 w-4 sm:h-4 sm:w-4 mr-2 animate-spin" aria-hidden="true" />
                      <span className="text-sm sm:text-base">{isSyncing ? 'Syncing...' : 'Refreshing...'}</span>
                    </>
                  ) : (
                    'Refresh'
                  )}
                </Button>
              )}
            </div>

            {/* Stats Bar */}
            {wardrobeItems.length > 0 && (
              <motion.div 
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : undefined}
                className="mt-6 sm:mt-8 space-y-3"
                role="region"
                aria-label="Wardrobe statistics"
              >
                <div className="flex flex-wrap gap-2 sm:gap-4 justify-center px-4 sm:px-0">
                  <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
                    <span className="text-teal-900 font-semibold" aria-label={`${wardrobeItems.length} total items`}>{wardrobeItems.length}</span>
                    <span className="text-teal-700 ml-1">Total Items</span>
                  </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
                  <span className="text-emerald-900 font-semibold" aria-label={`${wardrobeItems.filter(i => i.wornCount > 0).length} worn items`}>
                    {wardrobeItems.filter(i => i.wornCount > 0).length}
                  </span>
                  <span className="text-emerald-700 ml-1">Worn</span>
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2">
                  <span className="text-cyan-900 font-semibold" aria-label={`${wardrobeItems.filter(i => i.wornCount === 0).length} never worn items`}>
                    {wardrobeItems.filter(i => i.wornCount === 0).length}
                  </span>
                  <span className="text-cyan-700 ml-1">Never Worn</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 cursor-help flex items-center gap-2" role="status" aria-label={`AI recommendation readiness: ${getRecommendationReadiness().message}`}>
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className={`font-semibold ${getRecommendationReadiness().color}`}>
                        {getRecommendationReadiness().level}/4
                      </span>
                      <span className="text-purple-700 ml-1">AI Readiness</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-semibold">{getRecommendationReadiness().message}</p>
                    <p className="text-xs mt-1 opacity-90">More items = better outfit suggestions</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {/* Large Wardrobe Performance Tip */}
              {isLargeWardrobe && (
                <Alert className="max-w-2xl mx-auto border-amber-200 bg-amber-50">
                  <Zap className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-900">Large Wardrobe Detected</AlertTitle>
                  <AlertDescription className="text-amber-800 text-sm">
                    You have {wardrobeItems.length} items! Use filters, search, or context modes above for faster browsing. 
                    {filteredItems.length < wardrobeItems.length && (
                      <span className="font-medium"> Currently showing {filteredItems.length} items.</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </motion.div>
            )}
          </header>

          {/* Search and Discovery Controls */}
          {wardrobeItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 space-y-4"
            >
              {/* Search Bar */}
              <div className="relative max-w-2xl mx-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by description, brand, category, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 py-3 border-teal-200 focus:border-teal-500 focus:ring-teal-500 rounded-xl shadow-sm"
                  aria-label="Search wardrobe items"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs font-semibold mb-1">Local Search</p>
                      <p className="text-xs">Searches happen instantly on your device - no data sent to servers</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Sort and Group Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Sort:</span>
                  <div className="flex gap-1">
                    {SORT_OPTIONS.map((option) => {
                      const labels = {
                        'recent': 'Recent',
                        'most-worn': 'Most Worn',
                        'least-worn': 'Least Worn',
                        'never-worn': 'Never Worn',
                        'alphabetical': 'A-Z'
                      };
                      return (
                        <Button
                          key={option}
                          size="sm"
                          variant={sortBy === option ? 'default' : 'outline'}
                          onClick={() => setSortBy(option)}
                          className={sortBy === option 
                            ? 'bg-teal-600 text-white h-8 px-3' 
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50 h-8 px-3'}
                        >
                          {labels[option]}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-6 w-px bg-gray-300" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={groupByColor ? 'default' : 'outline'}
                      onClick={() => setGroupByColor(!groupByColor)}
                      className={groupByColor 
                        ? 'bg-teal-600 text-white h-8' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 h-8'}
                    >
                      <Palette className="h-4 w-4 mr-1" />
                      Group by Color
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Organize items by their dominant colors</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Active Filters Summary */}
              {(searchQuery || sortBy !== 'recent' || groupByColor) && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                  <span className="text-gray-500">Active:</span>
                  {searchQuery && (
                    <Badge variant="secondary" className="bg-teal-100 text-teal-700">
                      Search: &quot;{searchQuery.slice(0, 20)}{searchQuery.length > 20 ? '...' : ''}&quot;
                    </Badge>
                  )}
                  {sortBy !== 'recent' && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      Sort: {sortBy.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </Badge>
                  )}
                  {groupByColor && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                      Color Groups
                    </Badge>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Context Mode Selector */}
          {wardrobeItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-sm text-gray-600 mr-2">Context:</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={contextMode === 'all' ? 'default' : 'outline'}
                      onClick={() => setContextMode('all')}
                      className={contextMode === 'all' ? 'bg-teal-600 text-white' : 'border-teal-300 text-teal-700 hover:bg-teal-50'}
                    >
                      <Home className="h-4 w-4 mr-1" />
                      All
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Show all wardrobe items</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={contextMode === 'work' ? 'default' : 'outline'}
                      onClick={() => setContextMode('work')}
                      className={contextMode === 'work' ? 'bg-teal-600 text-white' : 'border-teal-300 text-teal-700 hover:bg-teal-50'}
                    >
                      <Briefcase className="h-4 w-4 mr-1" />
                      Work
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Business and formal attire</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={contextMode === 'casual' ? 'default' : 'outline'}
                      onClick={() => setContextMode('casual')}
                      className={contextMode === 'casual' ? 'bg-teal-600 text-white' : 'border-teal-300 text-teal-700 hover:bg-teal-50'}
                    >
                      <Coffee className="h-4 w-4 mr-1" />
                      Casual
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Everyday wear</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={contextMode === 'travel' ? 'default' : 'outline'}
                      onClick={() => setContextMode('travel')}
                      className={contextMode === 'travel' ? 'bg-teal-600 text-white' : 'border-teal-300 text-teal-700 hover:bg-teal-50'}
                    >
                      <Plane className="h-4 w-4 mr-1" />
                      Travel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Versatile travel items</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={contextMode === 'weather' ? 'default' : 'outline'}
                      onClick={() => setContextMode('weather')}
                      className={contextMode === 'weather' ? 'bg-teal-600 text-white' : 'border-teal-300 text-teal-700 hover:bg-teal-50'}
                    >
                      <CloudSun className="h-4 w-4 mr-1" />
                      Seasonal
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Season-specific items</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={contextMode === 'occasion' ? 'default' : 'outline'}
                      onClick={() => setContextMode('occasion')}
                      className={contextMode === 'occasion' ? 'bg-teal-600 text-white' : 'border-teal-300 text-teal-700 hover:bg-teal-50'}
                    >
                      <PartyPopper className="h-4 w-4 mr-1" />
                      Special
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Formal and party wear</p></TooltipContent>
                </Tooltip>
              </div>
            </motion.div>
          )}

          {/* Smart Insights Panel */}
          {wardrobeItems.length > 0 && smartInsights.length > 0 && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : undefined}
              className="mb-8"
              role="region"
              aria-label="Smart insights"
            >
              <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-50 border border-teal-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setShowInsights(!showInsights)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset"
                  aria-expanded={showInsights}
                  aria-controls="insights-content"
                  aria-label={showInsights ? 'Collapse smart insights' : 'Expand smart insights'}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-teal-600" aria-hidden="true" />
                    <span className="font-semibold text-teal-900">Smart Insights</span>
                    <Badge variant="secondary" className="bg-teal-100 text-teal-700 text-xs">
                      {smartInsights.length}
                    </Badge>
                  </div>
                  {showInsights ? (
                    <ChevronUp className="h-4 w-4 text-teal-600" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-teal-600" aria-hidden="true" />
                  )}
                </button>
                
                <AnimatePresence>
                  {showInsights && (
                    <motion.div
                      id="insights-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 space-y-3">
                        {smartInsights.map((insight, idx) => {
                          const IconComponent = insight.icon;
                          const colorClasses = {
                            amber: 'bg-amber-50 border-amber-200 text-amber-900',
                            rose: 'bg-rose-50 border-rose-200 text-rose-900',
                            purple: 'bg-purple-50 border-purple-200 text-purple-900',
                            teal: 'bg-teal-50 border-teal-200 text-teal-900',
                          };
                          const iconColors = {
                            amber: 'text-amber-600',
                            rose: 'text-rose-600',
                            purple: 'text-purple-600',
                            teal: 'text-teal-600',
                          };
                          
                          return (
                            <motion.div
                              key={insight.type}
                              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={prefersReducedMotion ? { duration: 0 } : { delay: idx * 0.1 }}
                              className={`${colorClasses[insight.color as keyof typeof colorClasses]} border-2 rounded-lg p-3 flex items-start gap-3`}
                              role="article"
                              aria-label={`${insight.title}: ${insight.description}`}
                            >
                              <IconComponent className={`h-5 w-5 ${iconColors[insight.color as keyof typeof iconColors]} mt-0.5 flex-shrink-0`} aria-hidden="true" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm">{insight.title}</p>
                                <p className="text-xs opacity-80 mt-0.5">{insight.description}</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Filter Buttons */}
          {wardrobeItems.length > 0 && (
            <div className="space-y-3 mb-8">
              {contextMode !== 'all' && (
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-full text-sm text-teal-700">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Showing {filteredItems.length} {contextMode} item{filteredItems.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-center px-4 sm:px-0" role="tablist" aria-label="Wardrobe item filters">
              {ITEM_FILTERS.map((filter) => (
                <Tooltip key={filter}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setSelectedFilter(filter)}
                      variant={selectedFilter === filter ? 'default' : 'outline'}
                      size="sm"
                      className={`min-h-[44px] px-4 touch-manipulation active:scale-95 ${
                        selectedFilter === filter 
                          ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md' 
                          : 'border-2 border-teal-300 text-teal-700 hover:bg-teal-50'
                      }`}
                      role="tab"
                      aria-selected={selectedFilter === filter}
                      aria-label={`Filter by ${filter}`}
                    >
                      <span className="flex items-center gap-1.5">
                        {getItemTypeIcon(filter)} 
                        <span className="text-sm font-medium">{filter.charAt(0).toUpperCase() + filter.slice(1)}</span>
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="hidden sm:block">
                    <p>Show {filter === 'all' ? 'all items' : `${filter}s only`}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
              </div>
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
                  Let&apos;s Build Your Digital Wardrobe
                </h3>
                <p className="text-teal-700 mb-6 text-lg">
                  Add photos of your clothing items to get personalized outfit suggestions.
                </p>
                
                {/* Quick Start Guide */}
                <div className="bg-white/60 rounded-xl p-6 mb-6 text-left">
                  <div className="flex items-start gap-3 mb-3">
                    <LightbulbIcon className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-teal-900 mb-2">Getting Started</h4>
                      <ul className="space-y-2 text-sm text-teal-700">
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 font-bold">1.</span>
                          <span>Take photos or upload images of your clothes</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 font-bold">2.</span>
                          <span>Add at least 5-10 items for best results</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 font-bold">3.</span>
                          <span>Get AI-powered outfit recommendations based on your style</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-teal-600 bg-teal-50 rounded-lg p-3 mt-3">
                    <Shield className="h-4 w-4" />
                    <span>Your photos are stored securely and privately in your account</span>
                  </div>
                </div>
                
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white gap-2"
                  onClick={() => setShowUploadModal(true)}
                >
                  <Plus className="h-5 w-5" />
                  Add Your First Item
                </Button>
              </div>
            </motion.div>
          )}

          {/* Wardrobe Items Grid */}
          {!loading && !error && filteredItems.length > 0 && (
            <>
              {groupByColor ? (
                // Color-grouped view
                <div className="mt-8 space-y-8">
                  {groupItemsByColor(filteredItems).map((group, groupIdx) => (
                    <motion.div
                      key={group.color}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: groupIdx * 0.1 }}
                    >
                      {/* Color Group Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div 
                          className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                          style={{ backgroundColor: group.color }}
                        />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {group.count} item{group.count !== 1 ? 's' : ''}
                        </h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent" />
                      </div>
                      
                      {/* Items in this color group */}
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                      >
                        {group.items.map((item) => {
                          const nudge = getItemNudge(item);
                          return (
                            <motion.div 
                              key={item.id} 
                              variants={itemVariants}
                              whileHover={nudge ? { scale: 1.02 } : {}}
                              transition={{ duration: 0.2 }}
                            >
                              <Card className={`group overflow-hidden border-teal-200 hover:border-teal-400 hover:shadow-xl transition-all duration-500 ease-out will-change-transform ${
                                nudge ? 'ring-1 ring-offset-2 ring-' + (nudge.color.includes('amber') ? 'amber' : nudge.color.includes('rose') ? 'rose' : nudge.color.includes('purple') ? 'purple' : 'teal') + '-200' : ''
                              }`}>
                              {/* Image */}
                              <div className="relative h-64 overflow-hidden bg-gradient-to-br from-teal-50 to-emerald-50">
                                <Image
                                  src={item.images?.thumbnail || item.imageUrl}
                                  alt={item.description}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform"
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  loading="lazy"
                                  quality={75}
                                  placeholder="blur"
                                  blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAwIiBoZWlnaHQ9IjQ3NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2ZXJzaW9uPSIxLjEiLz4="
                                />
                                
                                {/* Item Type Badge */}
                                <Badge className="absolute top-3 left-3 bg-teal-600 text-white">
                                  {getItemTypeIcon(item.itemType)} {item.itemType}
                                </Badge>
                                
                                {/* Smart Nudge Badge with wear info tooltip */}
                                {getItemNudge(item) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge className={`absolute top-3 right-3 ${getItemNudge(item)!.color} border font-medium shadow-sm cursor-help`}>
                                        <span className="mr-1">{getItemNudge(item)!.icon}</span>
                                        {getItemNudge(item)!.label}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      <p className="text-sm">{getWearInfo(item)}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                
                                {/* Worn Count Badge (only show if no nudge) */}
                                {!getItemNudge(item) && item.wornCount > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge className="absolute top-3 right-3 bg-emerald-600 text-white cursor-help">
                                        Worn {item.wornCount}x
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      <p className="text-sm">{getWearInfo(item)}</p>
                                    </TooltipContent>
                                  </Tooltip>
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

                                {/* Actions - Mobile optimized with larger touch targets */}
                                <div className="flex gap-2 mt-4">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 min-h-[44px] border-2 border-teal-600 text-teal-600 hover:bg-teal-50 focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 touch-manipulation active:scale-95"
                                        onClick={() => handleMarkAsWorn(item.id!, item.description)}
                                        disabled={deletingItemId === item.id}
                                        aria-label={`Mark ${item.description} as worn today`}
                                      >
                                        <Calendar className="h-4 w-4 sm:mr-1" aria-hidden="true" />
                                        <span className="hidden sm:inline">Mark Worn</span>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs hidden sm:block">
                                      <p className="mb-1">Track when you wear this item</p>
                                      <p className="text-xs text-gray-400">Helps AI suggest better outfits • Only visible to you</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="min-h-[44px] min-w-[44px] border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 touch-manipulation active:scale-95"
                                        onClick={() => handleDeleteItem(item.id!, item.description)}
                                        disabled={deletingItemId !== null}
                                        aria-label={`Delete ${item.description}. Deletions can be undone within 10 seconds`}
                                      >
                                        {deletingItemId === item.id ? (
                                          <>
                                            <Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin" aria-hidden="true" />
                                            <span className="sr-only">Deleting</span>
                                          </>
                                        ) : (
                                          <>
                                            <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
                                            <span className="sr-only">Delete</span>
                                          </>
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs hidden sm:block">
                                      <p className="font-semibold mb-1">Safe to remove</p>
                                      <p className="text-xs">You&apos;ll have 10 seconds to undo this action</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                          );
                        })}
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                // Standard grid view
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8"
                >
                  {filteredItems.map((item) => {
                    const nudge = getItemNudge(item);
                    return (
                      <motion.div 
                        key={item.id} 
                        variants={itemVariants}
                        whileHover={nudge ? { scale: 1.02 } : {}}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className={`group overflow-hidden border-teal-200 hover:border-teal-400 hover:shadow-xl transition-all duration-500 ease-out will-change-transform ${
                          nudge ? 'ring-1 ring-offset-2 ring-' + (nudge.color.includes('amber') ? 'amber' : nudge.color.includes('rose') ? 'rose' : nudge.color.includes('purple') ? 'purple' : 'teal') + '-200' : ''
                        }`}>
                        {/* Image */}
                        <div className="relative h-64 overflow-hidden bg-gradient-to-br from-teal-50 to-emerald-50">
                          <Image
                            src={item.images?.thumbnail || item.imageUrl}
                            alt={item.description}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            loading="lazy"
                            quality={75}
                            placeholder="blur"
                            blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAwIiBoZWlnaHQ9IjQ3NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2ZXJzaW9uPSIxLjEiLz4="
                          />
                          
                          {/* Item Type Badge */}
                          <Badge className="absolute top-3 left-3 bg-teal-600 text-white">
                            {getItemTypeIcon(item.itemType)} {item.itemType}
                          </Badge>
                          
                          {/* Smart Nudge Badge with wear info tooltip */}
                          {getItemNudge(item) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className={`absolute top-3 right-3 ${getItemNudge(item)!.color} border font-medium shadow-sm cursor-help`}>
                                  <span className="mr-1">{getItemNudge(item)!.icon}</span>
                                  {getItemNudge(item)!.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <p className="text-sm">{getWearInfo(item)}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {/* Worn Count Badge (only show if no nudge) */}
                          {!getItemNudge(item) && item.wornCount > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="absolute top-3 right-3 bg-emerald-600 text-white cursor-help">
                                  Worn {item.wornCount}x
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <p className="text-sm">{getWearInfo(item)}</p>
                              </TooltipContent>
                            </Tooltip>
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

                          {/* Actions - Mobile optimized with larger touch targets */}
                          <div className="flex gap-2 mt-4">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 min-h-[44px] border-2 border-teal-600 text-teal-600 hover:bg-teal-50 focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 touch-manipulation active:scale-95"
                                  onClick={() => handleMarkAsWorn(item.id!, item.description)}
                                  disabled={deletingItemId === item.id}
                                  aria-label={`Mark ${item.description} as worn today`}
                                >
                                  <Calendar className="h-4 w-4 sm:mr-1" aria-hidden="true" />
                                  <span className="hidden sm:inline">Mark Worn</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs hidden sm:block">
                                <p className="mb-1">Track when you wear this item</p>
                                <p className="text-xs text-gray-400">Helps AI suggest better outfits • Only visible to you</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="min-h-[44px] min-w-[44px] border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 focus:ring-2 focus:ring-red-500 focus:ring-offset-1 touch-manipulation active:scale-95"
                                  onClick={() => handleDeleteItem(item.id!, item.description)}
                                  disabled={deletingItemId !== null}
                                  aria-label={`Delete ${item.description}. Deletions can be undone within 10 seconds`}
                                >
                                  {deletingItemId === item.id ? (
                                    <>
                                      <Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin" aria-hidden="true" />
                                      <span className="sr-only">Deleting</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
                                      <span className="sr-only">Delete</span>
                                    </>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs hidden sm:block">
                                <p className="font-semibold mb-1">Safe to remove</p>
                                <p className="text-xs">You&apos;ll have 10 seconds to undo this action</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </>
          )}

          {/* No Results for Filter */}
          {!loading && !error && wardrobeItems.length > 0 && filteredItems.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-10 max-w-lg mx-auto">
                {searchQuery ? (
                  <>
                    <Search className="h-16 w-16 mx-auto mb-4 text-teal-400" />
                    <h3 className="text-xl font-bold text-teal-900 mb-2">
                      No items match &quot;{searchQuery}&quot;
                    </h3>
                    <p className="text-teal-700 mb-4">
                      Try searching with different keywords or clear your filters.
                    </p>
                  </>
                ) : (
                  <>
                    <Filter className="h-16 w-16 mx-auto mb-4 text-teal-400" />
                    <h3 className="text-xl font-bold text-teal-900 mb-2">
                      {contextMode !== 'all' 
                        ? `No ${contextMode} ${selectedFilter !== 'all' ? selectedFilter : ''} items found`
                        : `No ${selectedFilter === 'all' ? '' : selectedFilter} items yet`}
                    </h3>
                    <p className="text-teal-700 mb-4">
                      {contextMode !== 'all'
                        ? `Tag items with "${contextMode}" occasions to see them in this context.`
                        : selectedFilter === 'all' 
                          ? 'Your wardrobe is empty.'
                          : `You haven't added any ${selectedFilter}s to your wardrobe yet.`}
                    </p>
                  </>
                )}
                <div className="flex gap-2 justify-center flex-wrap">
                  {searchQuery && (
                    <Button 
                      variant="outline"
                      className="border-teal-600 text-teal-600 hover:bg-teal-50"
                      onClick={() => setSearchQuery('')}
                    >
                      Clear Search
                    </Button>
                  )}
                  {contextMode !== 'all' && (
                    <Button 
                      variant="outline"
                      className="border-teal-600 text-teal-600 hover:bg-teal-50"
                      onClick={() => setContextMode('all')}
                    >
                      Clear Context
                    </Button>
                  )}
                  {selectedFilter !== 'all' && (
                    <Button 
                      variant="outline"
                      className="border-teal-600 text-teal-600 hover:bg-teal-50"
                      onClick={() => setSelectedFilter('all')}
                    >
                      View All Items
                    </Button>
                  )}
                  <Button 
                    className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white gap-2"
                    onClick={() => setShowUploadModal(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Upload Modal - Lazy loaded for better performance */}
        {showUploadModal && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>}>
            <WardrobeItemUpload 
              open={showUploadModal}
              onOpenChange={setShowUploadModal}
              onItemAdded={() => {
                if (userId) {
                  fetchWardrobeItems(userId);
                }
              }}
            />
          </Suspense>
        )}
        
        {/* Undo Delete Toast */}
        <AnimatePresence>
          {showUndoToast && lastDeletedItem && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 50 }}
              transition={prefersReducedMotion ? { duration: 0 } : undefined}
              className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white rounded-lg shadow-2xl p-4 max-w-md border-2 border-gray-700"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">Item removed</p>
                    <Shield className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
                  </div>
                  <p className="text-sm text-gray-300 mb-1">{lastDeletedItem.item.description}</p>
                  <p className="text-xs text-gray-400" role="timer" aria-live="off">You have 10 seconds to restore it</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900 flex-shrink-0"
                  onClick={handleUndoDelete}
                  aria-label={`Undo deletion of ${lastDeletedItem.item.description}`}
                  autoFocus
                >
                  <Undo2 className="h-4 w-4 mr-1" aria-hidden="true" />
                  <span>Undo</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </TooltipProvider>
    </ProtectedRoute>
  );
}
