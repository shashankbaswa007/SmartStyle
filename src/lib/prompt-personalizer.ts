/**
 * Prompt Personalizer - AI Prompt Engineering with User Preferences
 * 
 * Builds highly personalized AI prompts by injecting user's historical preferences,
 * blocklists, and confidence-based exploration strategies into the recommendation system.
 */

import { ComprehensivePreferences } from './preference-engine';
import { Blocklists } from './blocklist-manager';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PersonalizationContext {
  preferences: ComprehensivePreferences;
  blocklists: Blocklists;
  currentContext: {
    occasion: string;
    weather?: string;
    gender: string;
    uploadedColors?: string[];
    skinTone?: string;
  };
}

export interface PersonalizedPromptSections {
  contextSection: string;
  preferencesSection: string;
  strategySection: string;
  constraintsSection: string;
}

// ============================================
// MAIN PROMPT BUILDER
// ============================================

/**
 * Build comprehensive personalized prompt sections to inject into AI
 */
export function buildPersonalizedPrompt(context: PersonalizationContext): PersonalizedPromptSections {
  const { preferences, blocklists, currentContext } = context;
  const confidence = preferences.overallConfidence;

  return {
    contextSection: buildContextSection(currentContext),
    preferencesSection: buildPreferencesSection(preferences, blocklists, currentContext.occasion),
    strategySection: buildStrategySection(confidence, preferences.totalInteractions),
    constraintsSection: buildConstraintsSection(blocklists),
  };
}

// ============================================
// CONTEXT SECTION
// ============================================

function buildContextSection(context: {
  occasion: string;
  weather?: string;
  gender: string;
  uploadedColors?: string[];
  skinTone?: string;
}): string {
  let section = `**USER CONTEXT:**\n`;
  section += `- Occasion: ${context.occasion}\n`;
  section += `- Gender: ${context.gender}\n`;
  
  if (context.weather) {
    section += `- Weather: ${context.weather}\n`;
  }
  
  if (context.uploadedColors && context.uploadedColors.length > 0) {
    section += `- Uploaded outfit colors: ${context.uploadedColors.join(', ')}\n`;
  }
  
  if (context.skinTone) {
    section += `- Skin tone: ${context.skinTone}\n`;
  }

  return section;
}

// ============================================
// PREFERENCES SECTION (MOST IMPORTANT)
// ============================================

function buildPreferencesSection(
  preferences: ComprehensivePreferences,
  blocklists: Blocklists,
  occasion: string
): string {
  const confidence = preferences.overallConfidence;
  const interactions = preferences.totalInteractions;
  
  if (interactions === 0) {
    return buildNewUserSection();
  }

  let section = `\n**USER'S HISTORICAL PREFERENCES** (${interactions} interactions, ${getConfidenceLabel(confidence)} confidence):\n\n`;

  // Favorite Colors (Top Priority)
  if (preferences.colors.favoriteColors.length > 0) {
    section += `**FAVORITE COLORS (prioritize in recommendations):**\n`;
    preferences.colors.favoriteColors.slice(0, 5).forEach(color => {
      section += `- ${color.name} (${color.hex}) - weight: ${color.weight}/100, frequency: ${color.frequency}\n`;
    });
    section += '\n';
  }

  // Disliked Colors (Hard Constraint)
  if (preferences.colors.dislikedColors.length > 0 || blocklists.hardBlocklist.colors.length > 0) {
    section += `**DISLIKED COLORS (NEVER use these):**\n`;
    
    preferences.colors.dislikedColors.forEach(color => {
      section += `- ${color.name} (${color.hex}) - explicitly disliked\n`;
    });
    
    blocklists.hardBlocklist.colors.forEach(item => {
      section += `- ${item.value} - ${item.reason}\n`;
    });
    section += '\n';
  }

  // Preferred Styles
  if (preferences.styles.topStyles.length > 0) {
    section += `**PREFERRED STYLES:**\n`;
    preferences.styles.topStyles.slice(0, 5).forEach(style => {
      section += `- ${style.name}: weight ${style.weight}/100, ${style.consistency}% consistency\n`;
    });
    section += '\n';
  }

  // Occasion-specific preferences
  const occasionKey = mapOccasionToCategory(occasion);
  const occasionStyles = preferences.styles.occasionStyles[occasionKey];
  
  if (occasionStyles && occasionStyles.length > 0) {
    section += `**PREFERENCES FOR ${occasion.toUpperCase()}:**\n`;
    occasionStyles.slice(0, 3).forEach(style => {
      section += `- ${style.name} (selected ${style.frequency} times)\n`;
    });
    section += '\n';
  }

  // Proven Color Combinations
  if (preferences.colors.provenCombinations.length > 0) {
    section += `**PROVEN COLOR COMBINATIONS (user's history shows these work):**\n`;
    preferences.colors.provenCombinations.slice(0, 3).forEach(combo => {
      section += `- ${combo.join(' + ')}\n`;
    });
    section += '\n';
  }

  // Fit and Pattern Preferences
  if (preferences.styles.fitPreferences.length > 0) {
    section += `**FIT PREFERENCES:**\n`;
    section += `Prefers: ${preferences.styles.fitPreferences.join(', ')}\n\n`;
  }

  if (preferences.styles.patternPreferences.length > 0) {
    section += `**PATTERN PREFERENCES:**\n`;
    section += `Prefers: ${preferences.styles.patternPreferences.join(', ')}\n\n`;
  }

  // Shopping Behavior
  if (preferences.shopping.preferredPlatforms.length > 0) {
    section += `**SHOPPING PREFERENCES:**\n`;
    section += `Price range: ₹${preferences.shopping.priceRangeComfort.min} - ₹${preferences.shopping.priceRangeComfort.max}\n`;
    if (preferences.shopping.preferredPlatforms.length > 0) {
      const topPlatform = preferences.shopping.preferredPlatforms[0];
      section += `Preferred platform: ${topPlatform.name} (${topPlatform.percentage}% of clicks)\n`;
    }
    section += '\n';
  }

  // Seasonal Context
  const currentSeason = getCurrentSeason();
  const seasonalPrefs = preferences.seasonal[currentSeason];
  
  if (seasonalPrefs && (seasonalPrefs.colors.length > 0 || seasonalPrefs.styles.length > 0)) {
    section += `**SEASONAL CONTEXT (Current: ${currentSeason}):**\n`;
    if (seasonalPrefs.colors.length > 0) {
      section += `${currentSeason} colors: ${seasonalPrefs.colors.slice(0, 3).join(', ')}\n`;
    }
    if (seasonalPrefs.styles.length > 0) {
      section += `${currentSeason} styles: ${seasonalPrefs.styles.slice(0, 3).join(', ')}\n`;
    }
    section += '\n';
  }

  // Color Intensity and Temperature Preferences
  section += `**COLOR PROFILE:**\n`;
  section += `Intensity preference: ${preferences.colors.intensityPreference}\n`;
  section += `Temperature preference: ${preferences.colors.temperaturePreference}\n\n`;

  return section;
}

function buildNewUserSection(): string {
  return `\n**NEW USER (Exploration Mode):**\n
This user has no interaction history yet. Focus on:
- Generating diverse recommendations across different styles
- Using a wide color palette to discover preferences
- Providing 3 distinct outfit options to gather data
- Being exploratory rather than conservative\n\n`;
}

// ============================================
// STRATEGY SECTION (CONFIDENCE-BASED)
// ============================================

function buildStrategySection(confidence: number, interactions: number): string {
  let section = `\n**PERSONALIZATION STRATEGY:**\n\n`;

  if (confidence >= 75) {
    // HIGH CONFIDENCE (50+ interactions)
    section += `**HIGH CONFIDENCE MODE (${interactions} interactions):**\n`;
    section += `Make all 3 recommendations closely aligned with user's proven preferences.\n`;
    section += `Vary only in specific shades and minor style details.\n`;
    section += `User has clear, established taste - respect it.\n\n`;
    
    section += `**MANDATORY REQUIREMENTS:**\n`;
    section += `- ALL 3 recommendations MUST prominently feature user's top 3 favorite colors\n`;
    section += `- ALL 3 recommendations MUST match user's preferred style category\n`;
    section += `- Use proven color combinations when applicable\n`;
    section += `- Stay within user's comfortable price range\n\n`;
    
    section += `**POSITION-SPECIFIC GUIDANCE:**\n`;
    section += `- Position 1: User's absolute favorite combination (90-100% match)\n`;
    section += `- Position 2: Alternative using same colors in different order (85-95% match)\n`;
    section += `- Position 3: Slight variation - test one adjacent shade (75-85% match)\n\n`;
    
  } else if (confidence >= 50) {
    // MEDIUM CONFIDENCE (10-50 interactions)
    section += `**MEDIUM CONFIDENCE MODE (${interactions} interactions):**\n`;
    section += `Patterns are emerging but still refining understanding.\n`;
    section += `Balance personalization with controlled exploration.\n\n`;
    
    section += `**MANDATORY REQUIREMENTS:**\n`;
    section += `- At least 2 of 3 recommendations MUST prominently feature user's top 3 favorite colors\n`;
    section += `- ABSOLUTELY NEVER use any colors from the disliked list\n`;
    section += `- Match user's preferred style category for this occasion\n`;
    section += `- Consider user's proven color combinations\n\n`;
    
    section += `**POSITION-SPECIFIC GUIDANCE:**\n`;
    section += `- Position 1: Strongly aligned with preferences (85-95% match)\n`;
    section += `- Position 2: Aligned with preferences, slight variation (70-85% match)\n`;
    section += `- Position 3: Adjacent exploration - test new element (50-70% match)\n`;
    section += `  Example: If user likes minimalist, try minimalist with one bold accent\n`;
    section += `  Example: If user likes earth tones, try adding one jewel tone\n\n`;
    
  } else {
    // LOW CONFIDENCE (<10 interactions)
    section += `**LOW CONFIDENCE MODE (${interactions} interactions):**\n`;
    section += `Gathering data about user's taste boundaries.\n`;
    section += `Focus on exploration while respecting known preferences.\n\n`;
    
    section += `**MANDATORY REQUIREMENTS:**\n`;
    section += `- At least 1 recommendation should incorporate known favorite colors (if any)\n`;
    section += `- ABSOLUTELY NEVER use colors from disliked list\n`;
    section += `- Provide diverse options to learn preferences\n\n`;
    
    section += `**POSITION-SPECIFIC GUIDANCE:**\n`;
    section += `- Position 1: Best guess based on limited data (60-80% match)\n`;
    section += `- Position 2: Exploratory - different style direction (40-60% match)\n`;
    section += `- Position 3: Maximum exploration - test boundaries (30-50% match)\n\n`;
  }

  section += `**DIVERSITY WITHIN PREFERENCES:**\n`;
  section += `- Don't make all 3 recommendations identical\n`;
  section += `- Vary specific shades of favorite colors across recommendations\n`;
  section += `- Mix different combinations of user's preferred elements\n`;
  section += `- Each recommendation should offer something unique\n\n`;

  return section;
}

// ============================================
// CONSTRAINTS SECTION (BLOCKLISTS)
// ============================================

function buildConstraintsSection(blocklists: Blocklists): string {
  let section = `\n**CRITICAL CONSTRAINTS (NEVER VIOLATE):**\n\n`;

  // Hard blocklist
  if (blocklists.hardBlocklist.colors.length > 0 ||
      blocklists.hardBlocklist.styles.length > 0 ||
      blocklists.hardBlocklist.patterns.length > 0) {
    
    section += `**ABSOLUTELY FORBIDDEN (Hard Blocklist):**\n`;
    
    if (blocklists.hardBlocklist.colors.length > 0) {
      section += `Colors to NEVER use: ${blocklists.hardBlocklist.colors.map(c => c.value).join(', ')}\n`;
    }
    
    if (blocklists.hardBlocklist.styles.length > 0) {
      section += `Styles to NEVER use: ${blocklists.hardBlocklist.styles.map(s => s.value).join(', ')}\n`;
    }
    
    if (blocklists.hardBlocklist.patterns.length > 0) {
      section += `Patterns to NEVER use: ${blocklists.hardBlocklist.patterns.map(p => p.value).join(', ')}\n`;
    }
    
    section += '\n';
  }

  // Soft blocklist (deprioritize)
  if (blocklists.softBlocklist.colors.length > 0 || blocklists.softBlocklist.styles.length > 0) {
    section += `**DEPRIORITIZED (Soft Blocklist - use sparingly):**\n`;
    
    if (blocklists.softBlocklist.colors.length > 0) {
      const topIgnored = blocklists.softBlocklist.colors
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 3);
      section += `Colors user often ignores: ${topIgnored.map(c => `${c.value} (ignored ${c.count}x)`).join(', ')}\n`;
    }
    
    section += '\n';
  }

  // Temporary blocklist (anti-repetition)
  if (blocklists.temporaryBlocklist.recentRecommendations.length > 0) {
    const recentCombos = blocklists.temporaryBlocklist.recentRecommendations
      .slice(0, 3)
      .map(item => item.outfitData.colorCombination.split('|').join(' + '));
    
    section += `**RECENTLY RECOMMENDED (Avoid repetition):**\n`;
    section += `These exact color combinations were recently shown:\n`;
    recentCombos.forEach(combo => {
      section += `- ${combo}\n`;
    });
    section += 'Provide fresh combinations while staying within user preferences.\n\n';
  }

  return section;
}

// ============================================
// OUTPUT FORMAT SECTION
// ============================================

export function buildOutputFormatSection(): string {
  return `\n**OUTPUT FORMAT:**\n
Return JSON with 3 recommendations, each containing:
- title: Catchy outfit name
- description: Detailed description (3+ sentences)
- colorPalette: Array of hex codes
- items: Array of clothing items
- styleType: Style category
- occasion: Suitable occasion
- imagePrompt: For image generation
- shoppingLinks: {amazon, myntra, tatacliq}
- isExistingMatch: boolean
- **personalizationScore**: 0-100 (how closely it matches user preferences)
- **reasoning**: Brief explanation of why this matches user's taste
- **exploratoryElement**: null or description of new element being tested\n\n`;
}

// ============================================
// COMPLETE PROMPT ASSEMBLY
// ============================================

/**
 * Assemble complete personalized prompt for AI
 */
export function assemblePersonalizedPrompt(
  basePrompt: string,
  personalization: PersonalizedPromptSections
): string {
  // Insert personalization sections after base context, before main instructions
  const sections = [
    basePrompt,
    personalization.contextSection,
    personalization.preferencesSection,
    personalization.strategySection,
    personalization.constraintsSection,
    buildOutputFormatSection(),
  ];

  return sections.join('\n');
}

/**
 * Build complete personalized prompt (one-step convenience function)
 */
export function buildCompletePersonalizedPrompt(
  basePrompt: string,
  context: PersonalizationContext
): string {
  const sections = buildPersonalizedPrompt(context);
  return assemblePersonalizedPrompt(basePrompt, sections);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 75) return 'HIGH';
  if (confidence >= 50) return 'MEDIUM';
  return 'LOW';
}

function mapOccasionToCategory(occasion: string): 'office' | 'casual' | 'party' | 'ethnic' {
  const lower = occasion.toLowerCase();
  if (lower.includes('office') || lower.includes('work') || lower.includes('business')) return 'office';
  if (lower.includes('party') || lower.includes('wedding') || lower.includes('event')) return 'party';
  if (lower.includes('ethnic') || lower.includes('traditional') || lower.includes('festive')) return 'ethnic';
  return 'casual';
}

function getCurrentSeason(): 'summer' | 'winter' | 'monsoon' {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 6 && month <= 9) return 'monsoon';
  if (month >= 4 && month <= 9) return 'summer';
  return 'winter';
}

/**
 * Extract personalization data for Groq client (legacy format support)
 */
export function extractPersonalizationForGroq(preferences: ComprehensivePreferences, blocklists: Blocklists): string {
  let data = '';

  if (preferences.colors.favoriteColors.length > 0) {
    data += `Favorite colors: ${preferences.colors.favoriteColors.slice(0, 5).map(c => c.name).join(', ')}. `;
  }

  if (preferences.colors.dislikedColors.length > 0 || blocklists.hardBlocklist.colors.length > 0) {
    const disliked = [
      ...preferences.colors.dislikedColors.map(c => c.name),
      ...blocklists.hardBlocklist.colors.map(c => c.value),
    ];
    data += `NEVER use these colors: ${disliked.join(', ')}. `;
  }

  if (preferences.styles.topStyles.length > 0) {
    data += `Preferred styles: ${preferences.styles.topStyles.slice(0, 3).map(s => s.name).join(', ')}. `;
  }

  return data;
}
