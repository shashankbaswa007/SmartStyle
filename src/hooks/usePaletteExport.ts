'use client';

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { ColorResponse } from '@/lib/colorMatching';

interface UsePaletteExportResult {
  exportPalette: (colorData: ColorResponse | null) => void;
  quickCopyAllHex: (colorData: ColorResponse | null) => Promise<boolean>;
}

export function usePaletteExport(): UsePaletteExportResult {
  const { toast } = useToast();

  const exportPalette = useCallback((colorData: ColorResponse | null) => {
    if (!colorData) return;

    const paletteText = `Color Palette - ${colorData.harmonyType?.replace('_', ' ').toUpperCase()} Harmony\n\n` +
      `Input Color: ${colorData.inputColor.name}\n${colorData.inputColor.hex}\n\n` +
      `Matching Colors:\n` +
      colorData.matches.map((m, i) => `${i + 1}. ${m.name} - ${m.hex}`).join('\n');

    const blob = new Blob([paletteText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `color-palette-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Palette Exported!',
      description: 'Color palette saved to your downloads',
    });
  }, [toast]);

  const quickCopyAllHex = useCallback(async (colorData: ColorResponse | null) => {
    if (!colorData) return false;

    const allColors = [colorData.inputColor, ...colorData.matches];
    const hexCodes = allColors.map((c) => c.hex).join(', ');

    try {
      await navigator.clipboard.writeText(hexCodes);
      toast({
        title: 'Colors Copied!',
        description: 'All hex codes copied to clipboard',
      });
      return true;
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to copy',
        description: 'Could not copy colors to clipboard',
      });
      return false;
    }
  }, [toast]);

  return {
    exportPalette,
    quickCopyAllHex,
  };
}
