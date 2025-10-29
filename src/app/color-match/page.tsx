"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Palette, Search, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Particles from "@/components/Particles";
import TextPressure from "@/components/TextPressure";
import { useMounted } from "@/hooks/useMounted";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

interface ColorMatch {
  label: string;
  hex: string;
  rgb: string;
  name?: string;
}

interface ColorResponse {
  inputColor: {
    hex: string;
    rgb: string;
    name?: string;
  };
  matches: ColorMatch[];
  harmonyType?: string;
}

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
  const [harmonyType, setHarmonyType] = useState("complementary");
  const [loading, setLoading] = useState(false);
  const [colorData, setColorData] = useState<ColorResponse | null>(null);
  const { toast } = useToast();
  const isMounted = useMounted();

  const handleSearch = async () => {
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
      const response = await fetch("/api/getColorMatches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          color: color.trim(),
          harmonyType: harmonyType 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || "Failed to process color",
          variant: "destructive",
        });
        return;
      }

      setColorData(data);
      toast({
        title: "Success!",
        description: `Found ${data.matches.length} harmonious colors for ${data.inputColor.name || data.inputColor.hex}`,
      });
    } catch (error) {
      console.error("Error fetching color matches:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      {/* Particles Background */}
      {isMounted && (
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <Particles
              className="absolute inset-0"
              particleColors={['#7B68EE', '#00FFFF']}
              particleCount={500}
              particleSpread={10}
              speed={0.3}
              particleBaseSize={150}
              moveParticlesOnHover={true}
              alphaParticles={false}
              disableRotation={false}
            />
        </div>
      )}

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-16">
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
                text="Color-Match"
                stroke={true}
                width={false}
                weight={true}
                textColor="#C4B5FD"
                strokeColor="#5B21B6"
                minFontSize={32}
              />
            )}
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-4">
            Discover harmonious color combinations using professional color theory. Enter any color name (like turquoise, chartreuse), hex code, or RGB value, then choose a harmony type to get perfectly matched colors.
          </p>
        </header>

        {/* Harmony Type Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-4xl mx-auto mb-8"
        >
          <div className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-accent" />
              <h2 className="font-semibold text-lg">Color Harmony Type</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
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
                      : 'hover:border-accent/50'
                  }`}
                >
                  <span className="font-semibold text-sm">{type.label}</span>
                  <span className="text-xs opacity-80 font-normal">{type.desc}</span>
                </Button>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  Select a harmony type to generate colors that work well together based on professional color theory principles.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md mx-auto mb-12"
        >
          <div className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-accent" />
              <h2 className="font-semibold text-lg">Enter a Color</h2>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-white/20 shadow-md"
                    style={{ backgroundColor: color }}
                  />
                )}
              </div>

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
                  Supports color names (red, blue), hex codes (#FF0000), and RGB values
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
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  Your Color
                  {colorData.harmonyType && (
                    <span className="ml-auto text-sm font-normal text-muted-foreground bg-accent/10 px-3 py-1 rounded-full">
                      {colorData.harmonyType.replace('_', ' ').split(' ').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')} Harmony
                    </span>
                  )}
                </h3>
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
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Color Matches Grid - Updated for 10 colors */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {colorData.matches.map((match, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  whileHover={{ scale: 1.05, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-4 cursor-pointer hover:shadow-xl"
                >
                  <div className="flex flex-col items-center text-center">
                    {/* Color Swatch - Larger for better visibility */}
                    <div
                      className="w-28 h-28 rounded-full shadow-xl border-4 border-white/20 mb-3"
                      style={{ backgroundColor: match.hex }}
                    />
                    
                    {/* Color Info */}
                    <div className="space-y-1.5 w-full">
                      <div className="inline-block px-2.5 py-0.5 bg-accent/10 text-accent text-xs font-semibold rounded-full">
                        {match.label}
                      </div>
                      {match.name && (
                        <p className="text-base font-bold">{match.name}</p>
                      )}
                      <p className="text-xs font-mono text-muted-foreground break-all">
                        {match.hex}
                      </p>
                      <p className="text-xs text-muted-foreground break-all">
                        {match.rgb}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Color Theory Info - Updated with new schemes */}
            <motion.div variants={itemVariants} className="mt-8">
              <div className="bg-card/60 backdrop-blur-xl border border-border/20 shadow-lg rounded-2xl p-6">
                <h3 className="font-semibold text-lg mb-4">Color Theory Guide</h3>
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
            </motion.div>
          </motion.div>
        )}

        {/* Empty State */}
        {!colorData && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center max-w-md mx-auto"
          >
            <div className="bg-card/40 backdrop-blur-xl border border-border/20 rounded-2xl p-12">
              <Palette className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Enter a color above to discover beautiful color combinations
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}
