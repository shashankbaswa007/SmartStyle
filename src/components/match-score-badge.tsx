"use client";

import { Badge } from "./ui/badge";
import { Target, Sparkles, Search } from "lucide-react";

interface MatchScoreBadgeProps {
  matchScore?: number;
  matchCategory?: string;
  showScore?: boolean;
  className?: string;
}

export function MatchScoreBadge({ 
  matchScore, 
  matchCategory, 
  showScore = true,
  className = "" 
}: MatchScoreBadgeProps) {
  // If no match data available, don't render
  if (matchScore === undefined || matchCategory === undefined) {
    return null;
  }

  // Map category to display properties
  const categoryConfig = {
    perfect: {
      icon: Target,
      emoji: "🎯",
      label: "Core Match",
      color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
      description: "Closest to your core style profile"
    },
    great: {
      icon: Sparkles,
      emoji: "✨",
      label: "Style Stretch",
      color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
      description: "A nearby variation to widen your style range"
    },
    exploring: {
      icon: Search,
      emoji: "🔍",
      label: "Creative Edge",
      color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
      description: "A bold option outside your usual comfort zone"
    }
  };

  const config = categoryConfig[matchCategory as keyof typeof categoryConfig] || categoryConfig.exploring;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant="outline" 
        className={`${config.color} font-medium px-3 py-1 text-xs`}
      >
        <Icon className="w-3 h-3 mr-1.5" />
        {config.emoji} {config.label}
        {showScore && ` ${Math.round(matchScore)}%`}
      </Badge>
    </div>
  );
}
