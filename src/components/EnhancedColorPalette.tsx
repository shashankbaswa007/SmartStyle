"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Copy, Check, Info, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ColorInfo {
  hex: string;
  name: string;
  percentage?: number;
  rgb?: { r: number; g: number; b: number };
}

interface EnhancedColorPaletteProps {
  colors: ColorInfo[];
  outfitTitle: string;
  skinTone?: string;
  showHarmonyInfo?: boolean;
}

// Color harmony detection
function detectColorHarmony(colors: ColorInfo[]): {
  type: string;
  description: string;
  icon: string;
} {
  if (colors.length < 2) {
    return {
      type: "Monochromatic",
      description: "Single color with variations",
      icon: "🎯",
    };
  }

  // Convert hex to HSL for analysis
  const hslColors = colors.map(c => hexToHSL(c.hex));
  
  // Calculate hue differences
  const hueDiffs = [];
  for (let i = 0; i < hslColors.length - 1; i++) {
    const diff = Math.abs(hslColors[i].h - hslColors[i + 1].h);
    hueDiffs.push(Math.min(diff, 360 - diff));
  }

  const avgHueDiff = hueDiffs.reduce((a, b) => a + b, 0) / hueDiffs.length;

  // Detect harmony type
  if (avgHueDiff < 30) {
    return {
      type: "Monochromatic",
      description: "Elegant single-color harmony with depth and sophistication",
      icon: "🎨",
    };
  } else if (avgHueDiff >= 30 && avgHueDiff < 90) {
    return {
      type: "Analogous",
      description: "Harmonious adjacent colors creating a cohesive, natural look",
      icon: "🌈",
    };
  } else if (avgHueDiff >= 150 && avgHueDiff < 180) {
    return {
      type: "Complementary",
      description: "Bold contrasting colors for maximum visual impact",
      icon: "⚡",
    };
  } else if (avgHueDiff >= 90 && avgHueDiff < 150) {
    return {
      type: "Triadic",
      description: "Balanced trio of colors for vibrant, dynamic appeal",
      icon: "✨",
    };
  } else {
    return {
      type: "Custom Palette",
      description: "Unique color combination curated for your style",
      icon: "🎭",
    };
  }
}

// Hex to HSL conversion
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Get color name from hex (enhanced version)
function getColorName(hex: string): string {
  const colorNames: Record<string, string> = {
    '#000000': 'Black', '#FFFFFF': 'White', '#FF0000': 'Red', '#00FF00': 'Green',
    '#0000FF': 'Blue', '#FFFF00': 'Yellow', '#FF00FF': 'Magenta', '#00FFFF': 'Cyan',
    '#FFA500': 'Orange', '#800080': 'Purple', '#FFC0CB': 'Pink', '#A52A2A': 'Brown',
    '#808080': 'Gray', '#000080': 'Navy', '#008080': 'Teal', '#800000': 'Maroon',
  };

  // Check exact match
  if (colorNames[hex.toUpperCase()]) {
    return colorNames[hex.toUpperCase()];
  }

  // Analyze HSL to determine color name
  const hsl = hexToHSL(hex);
  
  if (hsl.s < 10) {
    if (hsl.l > 90) return 'White';
    if (hsl.l < 10) return 'Black';
    if (hsl.l > 60) return 'Light Gray';
    if (hsl.l < 40) return 'Dark Gray';
    return 'Gray';
  }

  // Determine base color from hue
  if (hsl.h < 30) return hsl.l > 50 ? 'Coral' : 'Crimson';
  if (hsl.h < 60) return hsl.l > 50 ? 'Gold' : 'Orange';
  if (hsl.h < 90) return hsl.l > 50 ? 'Yellow' : 'Olive';
  if (hsl.h < 150) return hsl.l > 50 ? 'Lime' : 'Forest Green';
  if (hsl.h < 210) return hsl.l > 50 ? 'Cyan' : 'Teal';
  if (hsl.h < 270) return hsl.l > 50 ? 'Sky Blue' : 'Navy';
  if (hsl.h < 330) return hsl.l > 50 ? 'Lavender' : 'Purple';
  return hsl.l > 50 ? 'Rose' : 'Burgundy';
}

// Skin tone compatibility check
function checkSkinToneCompatibility(color: ColorInfo, skinTone?: string): {
  compatible: boolean;
  reason: string;
} {
  if (!skinTone) {
    return { compatible: true, reason: "Color versatile for all skin tones" };
  }

  const hsl = hexToHSL(color.hex);
  
  // Simplified skin tone compatibility logic
  if (skinTone.toLowerCase().includes('fair') || skinTone.toLowerCase().includes('light')) {
    if (hsl.l < 30) {
      return { compatible: true, reason: "Dark colors create elegant contrast" };
    } else if (hsl.s > 50) {
      return { compatible: true, reason: "Vibrant colors complement fair skin" };
    }
  } else if (skinTone.toLowerCase().includes('medium') || skinTone.toLowerCase().includes('olive')) {
    return { compatible: true, reason: "This color harmonizes beautifully with medium tones" };
  } else if (skinTone.toLowerCase().includes('dark') || skinTone.toLowerCase().includes('deep')) {
    if (hsl.l > 50 || hsl.s > 60) {
      return { compatible: true, reason: "Bright colors beautifully contrast with rich skin tones" };
    }
  }

  return { compatible: true, reason: "This color works well with your complexion" };
}

export function EnhancedColorPalette({
  colors,
  outfitTitle,
  skinTone,
  showHarmonyInfo = true,
}: EnhancedColorPaletteProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  const harmony = detectColorHarmony(colors);

  const handleCopyHex = (hex: string, index: number) => {
    navigator.clipboard.writeText(hex);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    
    toast({
      title: "Color copied!",
      description: `${hex} copied to clipboard`,
      duration: 2000,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with harmony info */}
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Color Palette
        </h5>
        {showHarmonyInfo && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
          >
            <Info className="w-3 h-3" />
            {showDetails ? 'Hide' : 'Show'} Details
          </button>
        )}
      </div>

      {/* Color harmony badge */}
      {showHarmonyInfo && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20"
        >
          <span className="text-base">{harmony.icon}</span>
          <div className="text-xs">
            <span className="font-semibold text-accent">{harmony.type}</span>
            {showDetails && (
              <span className="text-muted-foreground ml-2">{harmony.description}</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Interactive color swatches */}
      <div className="flex gap-3 items-start flex-wrap">
        {colors.map((color, idx) => {
          const colorName = color.name || getColorName(color.hex);
          const isHovered = hoveredIndex === idx;
          const isCopied = copiedIndex === idx;
          const skinCompatibility = checkSkinToneCompatibility(color, skinTone);

          return (
            <motion.div
              key={idx}
              className="relative group"
              onHoverStart={() => setHoveredIndex(idx)}
              onHoverEnd={() => setHoveredIndex(null)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.1, type: "spring", stiffness: 200 }}
            >
              {/* Color swatch */}
              <motion.button
                onClick={() => handleCopyHex(color.hex, idx)}
                className="relative w-16 h-16 rounded-2xl border-2 border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                style={{ backgroundColor: color.hex }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={false}
                />

                {/* Copy icon */}
                <AnimatePresence mode="wait">
                  {isCopied ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="bg-white/90 rounded-full p-2">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                    </motion.div>
                  ) : isHovered ? (
                    <motion.div
                      key="copy"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="bg-white/90 rounded-full p-2">
                        <Copy className="w-4 h-4 text-gray-700" />
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {/* Percentage badge */}
                {color.percentage && (
                  <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {color.percentage}%
                  </div>
                )}
              </motion.button>

              {/* Tooltip on hover */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute z-10 bottom-full mb-2 left-1/2 -translate-x-1/2 w-48"
                  >
                    <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-xl p-3 text-xs">
                      {/* Color name */}
                      <div className="font-bold mb-1">{colorName}</div>
                      
                      {/* Hex code */}
                      <div className="text-gray-300 font-mono mb-2">{color.hex}</div>
                      
                      {/* Skin tone compatibility */}
                      {skinTone && showDetails && (
                        <div className="text-[10px] text-gray-400 border-t border-gray-700 pt-2 mt-2">
                          <Sparkles className="w-3 h-3 inline mr-1" />
                          {skinCompatibility.reason}
                        </div>
                      )}

                      {/* Arrow pointer */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                        <div className="w-2 h-2 bg-gray-900 dark:bg-gray-800 rotate-45"></div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Expanded details section */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-border/20 space-y-3">
              {/* Color breakdown */}
              <div className="grid grid-cols-2 gap-3">
                {colors.map((color, idx) => {
                  const colorName = color.name || getColorName(color.hex);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <div
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="font-medium">{colorName}</span>
                      <span className="text-[10px] opacity-60">{color.hex}</span>
                    </div>
                  );
                })}
              </div>

              {/* Why this palette works */}
              <div className="bg-accent/5 rounded-lg p-3 text-xs text-foreground/80">
                <div className="font-semibold mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent" />
                  Why This Palette Works
                </div>
                <p>{harmony.description}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
