/**
 * Multi-stage Progress Indicator
 * 
 * Shows step-by-step progress with circular progress bar and time estimates
 */

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, Sparkles, Image as ImageIcon, ShoppingBag } from "lucide-react";
import { Progress } from "./ui/progress";
import { cn } from "@/lib/utils";

export interface ProgressStage {
  label: string;
  progress: number;
  duration: number; // seconds
  icon?: React.ReactNode;
}

const DEFAULT_STAGES: ProgressStage[] = [
  { 
    label: "Analyzing your outfit", 
    progress: 25,
    duration: 3,
    icon: <Sparkles className="w-5 h-5" />
  },
  { 
    label: "Getting personalized recommendations", 
    progress: 50,
    duration: 4,
    icon: <Loader2 className="w-5 h-5 animate-spin" />
  },
  { 
    label: "Generating outfit images", 
    progress: 75,
    duration: 5,
    icon: <ImageIcon className="w-5 h-5" />
  },
  { 
    label: "Finding shopping links", 
    progress: 95,
    duration: 2,
    icon: <ShoppingBag className="w-5 h-5" />
  },
];

interface RecommendationProgressProps {
  currentStage: number;
  stages?: ProgressStage[];
  className?: string;
}

export function RecommendationProgress({ 
  currentStage, 
  stages = DEFAULT_STAGES,
  className 
}: RecommendationProgressProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const stage = stages[currentStage] || stages[stages.length - 1];
  const totalDuration = stages.reduce((sum, s) => sum + s.duration, 0);
  const completedDuration = stages.slice(0, currentStage).reduce((sum, s) => sum + s.duration, 0);
  const estimatedTimeLeft = Math.max(0, totalDuration - completedDuration - elapsedTime);

  // Smooth progress animation
  useEffect(() => {
    setElapsedTime(0);
    const startProgress = currentStage > 0 ? stages[currentStage - 1].progress : 0;
    const endProgress = stage.progress;
    const duration = stage.duration * 1000;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayProgress(startProgress + (endProgress - startProgress) * progress);
      setElapsedTime(elapsed / 1000);

      if (progress >= 1) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [currentStage, stage, stages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col items-center gap-6 p-8", className)}
    >
      {/* Circular Progress */}
      <div className="relative">
        <svg className="w-32 h-32 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted"
          />
          {/* Progress circle */}
          <motion.circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            className="text-primary"
            strokeDasharray={`${2 * Math.PI * 56}`}
            strokeDashoffset={`${2 * Math.PI * 56 * (1 - displayProgress / 100)}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - displayProgress / 100) }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </svg>

        {/* Percentage text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            key={Math.floor(displayProgress)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-3xl font-bold text-primary"
          >
            {Math.floor(displayProgress)}%
          </motion.span>
        </div>
      </div>

      {/* Stage information */}
      <div className="text-center space-y-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center gap-2"
          >
            {stage.icon}
            <h3 className="text-lg font-semibold">{stage.label}</h3>
          </motion.div>
        </AnimatePresence>

        <motion.p
          className="text-sm text-muted-foreground"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {estimatedTimeLeft > 0 
            ? `~${Math.ceil(estimatedTimeLeft)} seconds remaining`
            : "Almost done..."
          }
        </motion.p>
      </div>

      {/* Linear progress bar */}
      <div className="w-full max-w-md space-y-2">
        <Progress value={displayProgress} className="h-2" />
        
        {/* Stage indicators */}
        <div className="flex justify-between">
          {stages.map((s, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  index < currentStage ? "bg-primary" :
                  index === currentStage ? "bg-primary animate-pulse" :
                  "bg-muted"
                )}
              />
              <span className="text-xs text-muted-foreground hidden sm:block">
                {s.progress}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Fun loading messages */}
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="text-xs text-center text-muted-foreground italic mt-4"
      >
        {currentStage === 0 && "✨ Checking out your style..."}
        {currentStage === 1 && "🎨 Crafting perfect combinations..."}
        {currentStage === 2 && "🖼️ Creating beautiful visuals..."}
        {currentStage === 3 && "🛍️ Finding the best deals..."}
      </motion.div>
    </motion.div>
  );
}

/**
 * Compact progress indicator for smaller spaces
 */
export function CompactProgress({ currentStage, stages = DEFAULT_STAGES }: RecommendationProgressProps) {
  const stage = stages[currentStage] || stages[stages.length - 1];

  return (
    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
      <div className="animate-spin">
        <Loader2 className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{stage.label}</p>
        <Progress value={stage.progress} className="h-1" />
      </div>
      <span className="text-sm font-semibold text-primary">{stage.progress}%</span>
    </div>
  );
}
