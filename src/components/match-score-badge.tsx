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
      label: "Perfect Match",
      color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
      description: "This matches your style perfectly!"
    },
    great: {
      icon: Sparkles,
      emoji: "✨",
      label: "Great Match",
      color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
      description: "A great match with some fresh variation"
    },
    exploring: {
      icon: Search,
      emoji: "🔍",
      label: "Exploring",
      color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
      description: "Something new to explore!"
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
