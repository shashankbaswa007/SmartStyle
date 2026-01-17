/**
 * Empty State Components
 * 
 * Engaging empty states with illustrations and call-to-actions
 */

"use client";

import { motion } from "framer-motion";
import { Heart, BarChart3, Upload, Sparkles, TrendingUp, Award } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import Image from "next/image";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  illustration?: string; // URL to SVG illustration
}

export function EmptyState({ icon, title, description, action, illustration }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
    >
      {/* Illustration or Icon */}
      {illustration ? (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mb-6"
        >
          <Image src={illustration} alt="" width={192} height={192} className="opacity-80" />
        </motion.div>
      ) : (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6"
        >
          <div className="text-primary">
            {icon}
          </div>
        </motion.div>
      )}

      {/* Content */}
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold mb-2"
      >
        {title}
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mb-6 max-w-md"
      >
        {description}
      </motion.p>

      {/* CTA Button */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button asChild size="lg" className="gap-2">
            <Link href={action.href}>
              <Sparkles className="w-4 h-4" />
              {action.label}
            </Link>
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Liked Outfits Empty State
 */
export function NoLikedOutfitsEmpty() {
  return (
    <EmptyState
      icon={<Heart className="w-12 h-12" />}
      title="No liked outfits yet"
      description="Start exploring and save your favorite outfit recommendations to build your personal style collection!"
      action={{
        label: "Discover Your Style",
        href: "/style-check"
      }}
      illustration="https://illustrations.popsy.co/amber/liking.svg"
    />
  );
}

/**
 * Analytics Empty State
 */
export function NoAnalyticsEmpty() {
  return (
    <EmptyState
      icon={<BarChart3 className="w-12 h-12" />}
      title="No analytics available yet"
      description="Upload your first outfit to start tracking your style journey and get personalized insights!"
      action={{
        label: "Get Started",
        href: "/style-check"
      }}
      illustration="https://illustrations.popsy.co/amber/data-analysis.svg"
    />
  );
}

/**
 * No Uploads Empty State
 */
export function NoUploadsEmpty() {
  return (
    <EmptyState
      icon={<Upload className="w-12 h-12" />}
      title="Start your style journey"
      description="Upload a photo of your outfit and get AI-powered recommendations tailored just for you!"
      action={{
        label: "Upload Outfit",
        href: "/style-check"
      }}
      illustration="https://illustrations.popsy.co/amber/uploading.svg"
    />
  );
}

/**
 * Generic Loading State with Animation
 */
export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[300px] gap-4"
    >
      <motion.div
        animate={{
          rotate: 360,
          scale: [1, 1.1, 1],
        }}
        transition={{
          rotate: { duration: 2, repeat: Infinity, ease: "linear" },
          scale: { duration: 1, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <Sparkles className="w-12 h-12 text-primary" />
      </motion.div>
      <p className="text-muted-foreground">{message}</p>
    </motion.div>
  );
}

/**
 * Achievement/Milestone Badge Component
 */
interface MilestoneBadgeProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  achieved?: boolean;
  progress?: number;
  total?: number;
}

export function MilestoneBadge({ 
  icon, 
  title, 
  description, 
  achieved = false,
  progress,
  total 
}: MilestoneBadgeProps) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      className={`relative p-4 rounded-lg border-2 transition-all ${
        achieved 
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
          : "border-muted bg-card"
      }`}
    >
      {/* Achievement badge */}
      {achieved && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="absolute -top-3 -right-3 bg-primary text-primary-foreground rounded-full p-2"
        >
          <Award className="w-4 h-4" />
        </motion.div>
      )}

      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${achieved ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          {icon}
        </div>
        
        <div className="flex-1">
          <h4 className="font-semibold mb-1">{title}</h4>
          <p className="text-sm text-muted-foreground mb-2">{description}</p>
          
          {!achieved && progress !== undefined && total !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress} / {total}</span>
                <span>{Math.round((progress / total) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(progress / total) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-primary"
                />
              </div>
            </div>
          )}
          
          {achieved && (
            <div className="text-xs text-primary font-semibold">
              ✨ Achieved!
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Milestones Grid
 */
export function MilestonesGrid({ 
  outfitsAnalyzed = 0,
  outfitsLiked = 0,
  daysActive = 0 
}: { 
  outfitsAnalyzed?: number;
  outfitsLiked?: number;
  daysActive?: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <MilestoneBadge
        icon={<Upload className="w-5 h-5" />}
        title="Style Explorer"
        description="Analyze 10 outfits"
        achieved={outfitsAnalyzed >= 10}
        progress={outfitsAnalyzed}
        total={10}
      />
      
      <MilestoneBadge
        icon={<Heart className="w-5 h-5" />}
        title="Fashion Curator"
        description="Like 50 outfits"
        achieved={outfitsLiked >= 50}
        progress={outfitsLiked}
        total={50}
      />
      
      <MilestoneBadge
        icon={<TrendingUp className="w-5 h-5" />}
        title="Style Streak"
        description="Active for 30 days"
        achieved={daysActive >= 30}
        progress={daysActive}
        total={30}
      />
    </div>
  );
}
