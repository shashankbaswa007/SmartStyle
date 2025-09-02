"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles, Palette, Shirt, PenTool, Wand2 } from "lucide-react";
import type { AnalyzeImageAndProvideRecommendationsOutput } from "@/ai/flows/analyze-image-and-provide-recommendations";
import { Separator } from "./ui/separator";

interface StyleAdvisorResultsProps {
  analysisResult: AnalyzeImageAndProvideRecommendationsOutput;
  generatedImageUrl: string | null;
}

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
  generatedImageUrl,
}: StyleAdvisorResultsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-8"
    >
      <header className="text-center">
        <h2 className="text-3xl md:text-4xl font-headline font-bold text-foreground flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 text-accent" /> Your Style Analysis
        </h2>
        <p className="mt-2 text-muted-foreground">{analysisResult.feedback}</p>
      </header>
      
      <Separator />

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
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

          <motion.div variants={itemVariants} className={cardClasses}>
            <div className="p-6">
              <h3 className="font-bold text-xl mb-4 text-foreground flex items-center gap-2"><Palette className="text-accent" /> Color Suggestions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {analysisResult.colorSuggestions.map((color, i) => (
                  <div key={i} className="text-center">
                    <div 
                      className="w-16 h-16 rounded-full mx-auto mb-2 shadow-inner border-2 border-white/20"
                      style={{ backgroundColor: color.hex }}
                      title={color.reason}
                    />
                    <p className="text-sm font-medium">{color.name}</p>
                    <p className="text-xs text-muted-foreground">{color.hex}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
          
           <motion.div variants={itemVariants} className={cardClasses}>
            <div className="p-6">
               <h3 className="font-bold text-xl mb-4 text-foreground flex items-center gap-2"><PenTool className="text-accent" /> Pro Tip</h3>
              <p className="text-muted-foreground italic">"{analysisResult.notes}"</p>
            </div>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
            <motion.div variants={itemVariants} className={`${cardClasses} md:col-span-1`}>
              <div className="p-6">
                <h3 className="font-bold text-xl mb-4 text-foreground flex items-center gap-2"><Wand2 className="text-accent" /> Visual Suggestion</h3>
                 {generatedImageUrl ? (
                    <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-lg border-2 border-accent/30">
                       <Image src={generatedImageUrl} alt="Generated outfit recommendation" fill className="object-cover" data-ai-hint="fashion outfit" />
                    </div>
                  ) : (
                    <div className="aspect-square w-full rounded-lg bg-muted animate-pulse" />
                  )}
              </div>
            </motion.div>
        </div>
      </div>

      <motion.div variants={itemVariants} className={`${cardClasses} md:col-span-2`}>
        <div className="p-6">
          <h3 className="font-bold text-2xl text-center mb-6 text-foreground flex items-center justify-center gap-2"><Shirt className="text-accent" /> Outfit Recommendations</h3>
          <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-6">
            {analysisResult.outfitRecommendations.map((outfit, i) => (
              <div key={i} className="bg-primary/30 p-4 rounded-lg border border-border/20">
                <h4 className="font-bold text-lg mb-2">{outfit.title}</h4>
                <ul className="space-y-1 list-disc pl-5 text-muted-foreground text-sm">
                  {outfit.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
