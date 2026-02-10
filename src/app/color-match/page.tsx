"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Palette, Search, Sparkles, Info, Copy, Check, Download, Pipette, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMounted } from "@/hooks/useMounted";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { generateColorMatches, type ColorResponse, type ColorMatch } from "@/lib/colorMatching";
import { SaveColorPalette } from "@/components/SaveColorPalette";
import { MatchingWardrobeItems } from "@/components/MatchingWardrobeItems";
import { PaletteExportMenu } from "@/components/PaletteExportMenu";

// Lazy load heavy components for better performance
const Particles = lazy(() => import("@/components/Particles"));
const TextPressure = lazy(() => import("@/components/TextPressure"));

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0, scale: 0.95 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
    },
  },
};

export default function ColorMatchPage() {
  const [color, setColor] = useState("");
  const [harmonyType, setHarmonyType] = useState("recommended");
  const [loading, setLoading] = useState(false);
  const [colorData, setColorData] = useState<ColorResponse | null>(null);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAllColors, setShowAllColors] = useState(false);
  const { toast } = useToast();
  const isMounted = useMounted();

  // Respect reduced-motion preference for accessibility
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedColor(text);
      setTimeout(() => setCopiedColor(null), 2000);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Could not copy color to clipboard",
      });
    }
  };

  const exportPalette = () => {
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
      title: "Palette Exported!",
      description: "Color palette saved to your downloads",
    });
  };

  const quickCopyAll = async () => {
    if (!colorData) return;
    
    const allColors = [colorData.inputColor, ...colorData.matches];
    const hexCodes = allColors.map(c => c.hex).join(', ');
    
    try {
      await navigator.clipboard.writeText(hexCodes);
      toast({
        title: "Colors Copied!",
        description: "All hex codes copied to clipboard",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Could not copy colors to clipboard",
      });
    }
  };

  const handleSearch = () => {
    if (!color.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter a color name (turquoise, chartreuse), hex code (#40E0D0), or RGB value",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Generate color matches entirely on the client
      const data = generateColorMatches(color.trim(), harmonyType);

      setColorData(data);
      toast({
        title: "Success!",
        description: `Found ${data.matches.length} harmonious colors for ${data.inputColor.name || data.inputColor.hex}`,
      });
    } catch (error) {
      console.error("Error generating color matches:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      {/* Particles Background - Optimized, respects reduced motion */}
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
      {isMounted && !prefersReducedMotion && (
          <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/10" />}>
            <Particles
                className="absolute inset-0"
                particleColors={['#3b82f6', '#93c5fd']}
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
      {prefersReducedMotion && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/10" />
      )}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-16">
          <div style={{ position: 'relative', height: '300px' }}>
            {isMounted && (
              <Suspense fallback={<h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent pt-24">Color-Match</h1>}>
                <TextPressure
                  text="Color-Match"
                  stroke={true}
                  width={false}
                  weight={true}
                  textColor="#93c5fd"
                  strokeColor="#1d4ed8"
                  minFontSize={32}
                />
              </Suspense>
            )}
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-4">
            Discover harmonious color combinations that work perfectly together
          </p>
          <p className="text-sm text-muted-foreground/70 max-w-xl mx-auto mt-2">
            Enter any color and we&apos;ll suggest the best matching colors for your style
          </p>
        </header>

        {/* Quick Color Presets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-4xl mx-auto mb-6"
        >
          <div className="bg-card/40 backdrop-blur-xl border border-border/10 shadow-md rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-medium text-muted-foreground">Popular Colors</h3>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {[
                { name: 'Navy', hex: '#001F3F' },
                { name: 'Rose', hex: '#FF6B9D' },
                { name: 'Sage', hex: '#9CAF88' },
                { name: 'Coral', hex: '#FF6B6B' },
                { name: 'Lavender', hex: '#B19CD9' },
                { name: 'Teal', hex: '#20B2AA' },
                { name: 'Burgundy', hex: '#800020' },
                { name: 'Camel', hex: '#C19A6B' },
              ].map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setColor(preset.hex);
                    setShowPicker(false);
                  }}
                  className="group relative"
                  aria-label={`Select ${preset.name} color (${preset.hex})`}
                  title={`${preset.name}: ${preset.hex}`}
                >
                  <div
                    className="w-full aspect-square rounded-lg shadow-md border-2 border-white/20 hover:border-accent transition-all hover:scale-110"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span className="text-xs text-center block mt-1 text-muted-foreground group-hover:text-foreground transition-colors">
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Harmony Type Selection - Collapsible */}
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-4xl mx-auto mb-8"
          >
            <div className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <h2 className="font-semibold text-lg">Color Harmony Type</h2>
                  <Badge variant="outline" className="text-xs">Advanced</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Hide
                </Button>
              </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { value: 'recommended', label: 'Recommended', desc: 'Smart auto-select', featured: true },
                { value: 'complementary', label: 'Complementary', desc: 'Opposite on color wheel' },
                { value: 'analogous', label: 'Analogous', desc: 'Adjacent colors' },
                { value: 'triadic', label: 'Triadic', desc: 'Three evenly spaced' },
                { value: 'split_complementary', label: 'Split Comp.', desc: 'Base + two adjacent' },
                { value: 'tetradic', label: 'Tetradic', desc: 'Two complementary pairs' },
              ].map((type) => (
                <Button
                  key={type.value}
                  variant={harmonyType === type.value ? 'default' : 'outline'}
                  onClick={() => setHarmonyType(type.value)}
                  className={`h-auto py-3 px-4 flex flex-col items-start gap-1 transition-all ${
                    harmonyType === type.value 
                      ? 'bg-gradient-to-r from-accent to-accent/80 text-white border-accent shadow-lg' 
                      : type.featured
                      ? 'border-accent/70 bg-accent/5 hover:border-accent hover:bg-accent/10'
                      : 'hover:border-accent/50'
                  }`}
                >
                  <span className="font-semibold text-sm flex items-center gap-1">
                    {type.label}
                    {type.featured && harmonyType !== type.value && (
                      <Sparkles className="w-3 h-3 text-accent" />
                    )}
                  </span>
                  <span className="text-xs opacity-80 font-normal">{type.desc}</span>
                </Button>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  {harmonyType === 'recommended' 
                    ? 'Recommended mode automatically selects the best harmony based on your color\'s characteristics.'
                    : 'Manual mode lets you choose a specific harmony type based on color theory principles.'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
        )}

        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md mx-auto mb-12"
        >
          <div className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-lg">Enter a Color</h2>
              </div>
              {!showAdvanced && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(true)}
                  className="text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Advanced
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder='e.g., "red", "#3b82f6", "rgb(59, 130, 246)"'
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    className="pr-12"
                  />
                  {color && (
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-white/20 shadow-md cursor-pointer hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => setShowPicker(!showPicker)}
                    />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPicker(!showPicker)}
                  className="flex-shrink-0"
                >
                  <Pipette className="w-4 h-4" />
                </Button>
              </div>
              
              {showPicker && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <label className="text-sm font-medium">Pick Color:</label>
                  <input
                    type="color"
                    value={color.startsWith('#') ? color : '#3b82f6'}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-12 rounded cursor-pointer border-2 border-border"
                  />
                  <span className="text-xs text-muted-foreground flex-1">or type a color name above</span>
                </div>
              )}

              <Button
                onClick={handleSearch}
                disabled={loading}
                className="w-full bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Find Matches
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Try color names, hex codes (#FF0000), or pick from swatches above
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Results Section */}
        {colorData && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-5xl mx-auto"
          >
            {/* Input Color Display */}
            <motion.div variants={itemVariants} className="mb-8">
              <div className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent" />
                    Your Color
                    {colorData.harmonyType && (
                      <span className="text-sm font-normal text-muted-foreground bg-accent/10 px-3 py-1 rounded-full flex items-center gap-1">
                        {colorData.harmonyType.replace('_', ' ').split(' ').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')} Harmony
                        {(colorData as any).isRecommended && (
                          <span className="inline-flex items-center gap-0.5 ml-1 text-accent" title="Automatically selected based on color characteristics">
                            <Sparkles className="w-3 h-3" />
                            <span className="text-[10px] font-semibold">Auto</span>
                          </span>
                        )}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={quickCopyAll}
                      className="gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copy All
                    </Button>
                    <PaletteExportMenu
                      palette={{
                        inputColor: {
                          hex: colorData.inputColor.hex,
                          rgb: colorData.inputColor.rgb,
                          name: colorData.inputColor.name,
                          label: 'Base Color',
                        },
                        matches: colorData.matches.map(m => ({
                          hex: m.hex,
                          rgb: m.rgb,
                          name: m.name,
                          label: m.label,
                        })),
                        harmonyType: colorData.harmonyType || 'complementary',
                      }}
                    />
                  </div>
                </div>

                {/* Save Palette Button */}
                <div className="mb-4">
                  <SaveColorPalette
                    baseColor={colorData.inputColor}
                    harmonyType={colorData.harmonyType || 'complementary'}
                    matchColors={colorData.matches}
                    onSaved={(paletteId) => {
                      toast({
                        title: "Palette Saved!",
                        description: "You can view your saved palettes in your preferences.",
                      });
                    }}
                  />
                </div>

                <div className="flex items-center gap-6">
                  <div
                    className="w-24 h-24 rounded-full shadow-xl border-4 border-white/20"
                    style={{ backgroundColor: colorData.inputColor.hex }}
                  />
                  <div className="space-y-1">
                    {colorData.inputColor.name && (
                      <p className="text-2xl font-bold capitalize">{colorData.inputColor.name}</p>
                    )}
                    <p className="text-lg font-mono text-muted-foreground">{colorData.inputColor.hex}</p>
                    <p className="text-sm text-muted-foreground">{colorData.inputColor.rgb}</p>
                    
                    {/* Fashion Context for Input Color */}
                    {colorData.inputColor.fashionContext && (
                      <div className="mt-2 pt-2 border-t border-border/20">
                        <div className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full mb-1">
                          {colorData.inputColor.fashionContext.ratio}
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                          {colorData.inputColor.fashionContext.styleNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Top Matching Colors - Highlighted */}
            <motion.div variants={itemVariants} className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-xl flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Best Color Matches
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {showAllColors ? `All ${colorData.matches.length}` : 'Top 5'} Colors
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                These colors work beautifully with your selection
              </p>
            </motion.div>

            {/* Palette Explanation */}
            {colorData.explanation && (
              <motion.div variants={itemVariants} className="mb-6">
                <div className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-6">
                  <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-accent" />
                    Why This Palette Works
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {colorData.explanation.why}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">How to Wear It</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{colorData.explanation.howToUse}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Color Personality</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{colorData.explanation.colorPersonality}</p>
                    </div>
                  </div>
                  {colorData.explanation.fashionTips.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/20">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Fashion Tips</p>
                      <ul className="space-y-1.5">
                        {colorData.explanation.fashionTips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="text-accent mt-0.5">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Color Matches Grid - Show top 5 or all */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {colorData.matches.slice(0, showAllColors ? undefined : 5).map((match, index) => {
                // Determine if this is a key color (primary/secondary)
                const isKeyColor = match.fashionContext?.usage === 'primary' || match.fashionContext?.usage === 'secondary';
                
                return (
                  <motion.div
                    key={index}
                    variants={itemVariants}
                    whileHover={{ 
                      scale: 1.03, 
                      y: -8,
                      transition: { type: 'spring', stiffness: 400, damping: 25 }
                    }}
                    className={`bg-card/60 backdrop-blur-xl border shadow-lg rounded-2xl p-4 cursor-pointer hover:shadow-xl will-change-transform ${
                      isKeyColor ? 'border-accent/50 ring-2 ring-accent/20' : 'border-border/20'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      {/* Key Color Badge */}
                      {isKeyColor && (
                        <Badge className="mb-2 bg-accent/10 text-accent border-accent/30 text-xs">
                          ⭐ Key Color
                        </Badge>
                      )}
                      
                      {/* Color Swatch */}
                      <div className="relative group">
                        <div
                          className={`w-24 h-24 rounded-full shadow-xl mb-3 ${
                            isKeyColor ? 'border-4 border-accent/30' : 'border-4 border-white/20'
                          }`}
                          style={{ backgroundColor: match.hex }}
                        />
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyToClipboard(match.hex, match.name || 'Color')}
                        >
                          {copiedColor === match.hex ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      
                      {/* Color Info */}
                      <div className="space-y-1.5 w-full">
                        <div className="inline-block px-2.5 py-0.5 bg-accent/10 text-accent text-xs font-semibold rounded-full">
                          {match.label}
                        </div>
                        {match.name && (
                          <p className="text-base font-bold">{match.name}</p>
                        )}
                        <button
                          onClick={() => copyToClipboard(match.hex, 'Hex code')}
                          className="text-xs font-mono text-muted-foreground hover:text-foreground break-all cursor-pointer transition-colors"
                        >
                          {match.hex}
                        </button>
                        
                        {/* Fashion Context */}
                        {match.fashionContext && (
                          <div className="mt-2 pt-2 border-t border-border/20 space-y-1.5">
                            {/* Usage Badge */}
                            <div className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                              {match.fashionContext.ratio}
                            </div>
                            
                            {/* Clothing Items */}
                            {match.fashionContext.clothingItems.length > 0 && (
                              <div className="flex flex-col gap-1 items-center">
                                {match.fashionContext.clothingItems.map((item, idx) => (
                                  <span key={idx} className="text-xs bg-muted/50 px-2 py-0.5 rounded text-center w-full truncate" title={item}>
                                    {item}
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {/* Style Notes */}
                            <p className="text-xs text-muted-foreground italic leading-tight">
                              {match.fashionContext.styleNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Show More/Less Button */}
            {colorData.matches.length > 5 && (
              <motion.div variants={itemVariants} className="text-center mb-8">
                <Button
                  variant="outline"
                  onClick={() => setShowAllColors(!showAllColors)}
                  className="gap-2"
                >
                  {showAllColors ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Show Less Colors
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show All {colorData.matches.length} Colors
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {/* Matching Wardrobe Items */}
            <motion.div variants={itemVariants} className="mt-8 mb-8">
              <MatchingWardrobeItems
                paletteColors={[
                  colorData.inputColor.hex,
                  ...colorData.matches.map(m => m.hex)
                ]}
                onItemClick={(item) => {
                  toast({
                    title: "Wardrobe Item",
                    description: `${item.itemType} from your wardrobe`,
                  });
                }}
              />
            </motion.div>

            {/* Quick Fashion Tips - Always Visible */}
            <motion.div variants={itemVariants} className="mb-6">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800/30 shadow-lg rounded-xl p-6">
                <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Quick Styling Tips
                </h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 mt-1.5 flex-shrink-0" />
                    <p className="text-muted-foreground"><span className="font-semibold text-foreground">60-30-10 Rule:</span> 60% main, 30% secondary, 10% accent</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 mt-1.5 flex-shrink-0" />
                    <p className="text-muted-foreground"><span className="font-semibold text-foreground">Key Colors First:</span> Start with starred colors above</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Advanced Info - Collapsible */}
            {showAdvanced && (
              <motion.div 
                variants={itemVariants} 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Color Theory Guide</h3>
                    <Badge variant="outline" className="text-xs">Advanced</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div>
                      <h4 className="font-semibold text-accent mb-1">Complementary</h4>
                      <p className="text-muted-foreground">Colors opposite on the color wheel. Creates high contrast and vibrant looks.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-accent mb-1">Analogous</h4>
                      <p className="text-muted-foreground">Colors adjacent on the wheel. Creates harmonious and serene combinations.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-accent mb-1">Triadic</h4>
                      <p className="text-muted-foreground">Colors evenly spaced on the wheel. Offers vibrant yet balanced palettes.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-accent mb-1">Tetradic</h4>
                      <p className="text-muted-foreground">Square harmony with four colors. Creates rich, diverse color schemes.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-accent mb-1">Split Complementary</h4>
                      <p className="text-muted-foreground">Base color with two adjacent to its complement. High contrast with less tension.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-accent mb-1">Monochromatic</h4>
                      <p className="text-muted-foreground">Variations of the same hue. Creates elegant and cohesive designs.</p>
                    </div>
                  </div>
                </div>

                {/* Detailed Fashion Tips */}
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800/30 shadow-lg rounded-2xl p-6">
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Advanced Styling Techniques
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 mt-2 flex-shrink-0" />
                      <p className="text-muted-foreground"><span className="font-semibold text-foreground">Bold Contrast:</span> Use complementary colors for statement pieces</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 mt-2 flex-shrink-0" />
                      <p className="text-muted-foreground"><span className="font-semibold text-foreground">Soft Harmony:</span> Analogous colors create effortless, flowing outfits</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 mt-2 flex-shrink-0" />
                      <p className="text-muted-foreground"><span className="font-semibold text-foreground">Accent Colors:</span> Use lighter/darker shades as accessories</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-600 dark:bg-purple-400 mt-2 flex-shrink-0" />
                      <p className="text-muted-foreground"><span className="font-semibold text-foreground">Seasonal Adaptation:</span> Adjust color intensity for different seasons</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Toggle Advanced Info */}
            {!showAdvanced && (
              <motion.div variants={itemVariants} className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => setShowAdvanced(true)}
                  className="text-muted-foreground hover:text-foreground gap-2"
                >
                  <Info className="w-4 h-4" />
                  Learn More About Color Theory
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Empty State */}
        {!colorData && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="bg-card/40 backdrop-blur-xl border border-border/20 rounded-2xl p-12">
              <Palette className="w-16 h-16 text-accent/50 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-3">Ready to Find Your Perfect Colors?</h3>
              <p className="text-muted-foreground mb-6">
                Pick a color from the swatches above or enter your own to get started
              </p>
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl">🎨</span>
                  </div>
                  <p className="font-medium mb-1">Smart Matching</p>
                  <p className="text-xs text-muted-foreground">Color theory harmonies</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl">👔</span>
                  </div>
                  <p className="font-medium mb-1">Fashion Focused</p>
                  <p className="text-xs text-muted-foreground">Style tips for each color</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-2xl">✨</span>
                  </div>
                  <p className="font-medium mb-1">Wardrobe Match</p>
                  <p className="text-xs text-muted-foreground">See items you already own</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}
