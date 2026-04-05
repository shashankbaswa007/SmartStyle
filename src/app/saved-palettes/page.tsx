'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { SavedColorPalette } from '@/lib/colorPaletteService';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Trash2, Calendar, Tag, Sparkles, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageStatusAlert from '@/components/PageStatusAlert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useSavedPalettesData } from '@/hooks/useSavedPalettesData';
import { useSavedPaletteFilters } from '@/hooks/useSavedPaletteFilters';
import Link from 'next/link';

export default function SavedPalettesPage() {
  const { user, loading: isLoading, error, palettes, refreshPalettes, deletePalette } = useSavedPalettesData();
  const {
    filterOccasion,
    setFilterOccasion,
    filterSeason,
    setFilterSeason,
    filteredPalettes,
    clearFilters,
    occasions,
    seasons,
  } = useSavedPaletteFilters(palettes);
  const [palettePendingDelete, setPalettePendingDelete] = useState<SavedColorPalette | null>(null);
  const { toast } = useToast();

  const handleDelete = async (paletteId: string) => {
    if (!paletteId) return;

    try {
      const result = await deletePalette(paletteId);
      if (result.success) {
        toast({
          title: 'Palette Deleted',
          description: 'Color palette removed successfully',
        });
        setPalettePendingDelete(null);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete palette',
        variant: 'destructive',
      });
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Palette className="w-10 h-10 text-accent" />
              Saved Color Palettes
            </h1>
            <p className="text-muted-foreground">
              Manage your saved color combinations and find wardrobe matches
            </p>
          </div>

          {/* Filters */}
          {palettes.length > 0 && (
            <div className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-4 sm:p-5 md:p-6 mb-8">
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                {/* Occasion Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Filter by Occasion</label>
                  <div className="flex flex-wrap gap-2">
                    {occasions.map((occasion) => (
                      <Button
                        key={occasion}
                        variant={filterOccasion === occasion ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterOccasion(occasion)}
                        className="capitalize"
                      >
                        {occasion}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Season Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Filter by Season</label>
                  <div className="flex flex-wrap gap-2">
                    {seasons.map((season) => (
                      <Button
                        key={season}
                        variant={filterSeason === season ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterSeason(season)}
                        className="capitalize"
                      >
                        {season}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card/60 backdrop-blur-xl border border-border/20 rounded-2xl p-6">
                  <div className="h-6 bg-muted rounded w-3/4 mb-4 animate-pulse" />
                  <div className="flex gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="w-12 h-12 bg-muted rounded-full animate-pulse" />
                    ))}
                  </div>
                  <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <PageStatusAlert
              className="mx-auto max-w-2xl"
              title="Error loading saved palettes"
              description={error}
              onRetry={() => {
                void refreshPalettes();
              }}
            />
          )}

          {/* Empty State */}
          {!isLoading && !error && palettes.length === 0 && (
            <div className="bg-card/40 backdrop-blur-xl border border-border/20 rounded-2xl p-12 text-center">
              <Palette className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Saved Palettes Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start creating and saving your favorite color combinations
              </p>
              <Button asChild className="gap-2">
                <Link href="/color-match">
                  <Sparkles className="w-4 h-4" />
                  Discover Colors
                </Link>
              </Button>
            </div>
          )}

          {/* Palettes Grid */}
          {!isLoading && !error && filteredPalettes.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPalettes.map((palette) => (
                <motion.div
                  key={palette.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-6 hover:shadow-xl transition-shadow"
                >
                  {/* Palette Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{palette.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {palette.harmonyType.replace('_', ' ')} harmony
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPalettePendingDelete(palette)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Color Swatches */}
                  <div className="flex gap-2 mb-4">
                    {/* Base Color */}
                    <div
                      className="w-12 h-12 rounded-full shadow-md border-2 border-white/20"
                      style={{ backgroundColor: palette.baseColor.hex }}
                      title={palette.baseColor.name}
                    />
                    {/* Match Colors */}
                    {palette.matchColors.slice(0, 4).map((color, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-12 rounded-full shadow-md border-2 border-white/20"
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>

                  {/* Tags */}
                  <div className="space-y-2 mb-4">
                    {palette.occasions && palette.occasions.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {palette.occasions.map((occasion) => (
                          <span
                            key={occasion}
                            className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full capitalize"
                          >
                            {occasion}
                          </span>
                        ))}
                      </div>
                    )}
                    {palette.seasons && palette.seasons.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {palette.seasons.map((season) => (
                          <span
                            key={season}
                            className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs rounded-full capitalize"
                          >
                            {season}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/20 pt-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {palette.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                    </div>
                    {palette.linkedWardrobeItemIds && palette.linkedWardrobeItemIds.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {palette.linkedWardrobeItemIds.length} items
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {palette.notes && (
                    <div className="mt-3 pt-3 border-t border-border/20">
                      <p className="text-sm text-muted-foreground italic line-clamp-2">
                        &quot;{palette.notes}&quot;
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* No Results After Filtering */}
          {!isLoading && !error && palettes.length > 0 && filteredPalettes.length === 0 && (
            <div className="bg-card/40 backdrop-blur-xl border border-border/20 rounded-2xl p-12 text-center">
              <p className="text-muted-foreground">
                No palettes match your current filters. Try adjusting the filters above.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>
          )}

          <AlertDialog
            open={Boolean(palettePendingDelete)}
            onOpenChange={(open) => {
              if (!open) {
                setPalettePendingDelete(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete saved palette?</AlertDialogTitle>
                <AlertDialogDescription>
                  {palettePendingDelete
                    ? `This will permanently remove \"${palettePendingDelete.name}\" from your saved palettes.`
                    : 'This will permanently remove the selected palette from your saved palettes.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (palettePendingDelete?.id) {
                      void handleDelete(palettePendingDelete.id);
                    }
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </ProtectedRoute>
  );
}
