/**
 * Multi-Gemini API Key Manager
 * Cycles through multiple Gemini API keys for extended quota
 * Provides 100 requests/day with 2 keys (50 each)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiKeyConfig {
  key: string;
  name: string;
  dailyQuota: number;
  currentUsage: number;
  isAvailable: boolean;
  imageGenerationSupported?: boolean;
  modelName?: string;
}

class MultiGeminiManager {
  private keys: GeminiKeyConfig[] = [];
  private currentKeyIndex: number = 0;

  constructor() {
    this.initializeKeys();
  }

  /**
   * Initialize all available Gemini API keys
   */
  private initializeKeys() {
    const primaryKey = process.env.GOOGLE_GENAI_API_KEY;
    const backupKey = process.env.GOOGLE_GENAI_API_KEY_BACKUP;

    if (primaryKey) {
      this.keys.push({
        key: primaryKey,
        name: 'Primary Gemini',
        dailyQuota: 50,
        currentUsage: 0,
        isAvailable: true,
        imageGenerationSupported: true, // Attempting with gemini-2.0-flash
        modelName: 'gemini-2.0-flash',
      });
    }

    if (backupKey && backupKey !== primaryKey) {
      this.keys.push({
        key: backupKey,
        name: 'Backup Gemini',
        dailyQuota: 50,
        currentUsage: 0,
        isAvailable: true,
        imageGenerationSupported: true, // Attempting with gemini-2.0-flash
        modelName: 'gemini-2.0-flash',
      });
    } else if (backupKey === primaryKey) {
      console.warn('⚠️ Backup Gemini key is same as primary - skipping to avoid shared quota');
    }

    console.log(`🔑 Initialized ${this.keys.length} unique Gemini API key(s) (attempting image generation with gemini-2.0-flash)`);
  }

  /**
   * Get the next available Gemini API key
   */
  getNextAvailableKey(): string | null {
    if (this.keys.length === 0) {
      console.error('❌ No Gemini API keys configured');
      return null;
    }

    // Try current key first
    if (this.keys[this.currentKeyIndex]?.isAvailable) {
      return this.keys[this.currentKeyIndex].key;
    }

    // Try to find any available key
    for (let i = 0; i < this.keys.length; i++) {
      if (this.keys[i].isAvailable) {
        this.currentKeyIndex = i;
        console.log(`🔄 Switched to ${this.keys[i].name}`);
        return this.keys[i].key;
      }
    }

    console.error('❌ All Gemini API keys exhausted');
    return null;
  }

  /**
   * Mark current key as quota exceeded and switch to next
   */
  markCurrentKeyExhausted(): boolean {
    if (this.keys[this.currentKeyIndex]) {
      this.keys[this.currentKeyIndex].isAvailable = false;
      console.log(`⚠️ ${this.keys[this.currentKeyIndex].name} quota exceeded`);
      
      // Try to switch to next available key
      for (let i = 0; i < this.keys.length; i++) {
        if (this.keys[i].isAvailable) {
          this.currentKeyIndex = i;
          console.log(`✅ Switched to ${this.keys[i].name}`);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get current key info
   */
  getCurrentKeyInfo(): GeminiKeyConfig | null {
    return this.keys[this.currentKeyIndex] || null;
  }

  /**
   * Get total available quota across all keys
   */
  getTotalAvailableQuota(): number {
    return this.keys
      .filter(k => k.isAvailable)
      .reduce((sum, k) => sum + (k.dailyQuota - k.currentUsage), 0);
  }

  /**
   * Check if any keys are available
   */
  hasAvailableKeys(): boolean {
    return this.keys.some(k => k.isAvailable);
  }

  /**
   * Get summary of all keys
   */
  getKeysSummary(): string {
    if (this.keys.length === 0) {
      return 'No Gemini API keys configured';
    }
    
    return this.keys.map((k, i) => 
      `${i + 1}. ${k.name}: ${k.isAvailable ? '✅ Available' : '❌ Exhausted'} (${k.currentUsage}/${k.dailyQuota})`
    ).join('\n');
  }

  /**
   * Increment usage for current key
   */
  incrementCurrentUsage() {
    if (this.keys[this.currentKeyIndex]) {
      this.keys[this.currentKeyIndex].currentUsage++;
    }
  }

  /**
   * Check if current key supports image generation
   */
  supportsImageGeneration(): boolean {
    return this.keys[this.currentKeyIndex]?.imageGenerationSupported ?? false;
  }
}

// Singleton instance
export const multiGeminiManager = new MultiGeminiManager();

/**
 * Get Google Generative AI instance with current available key
 */
export function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = multiGeminiManager.getNextAvailableKey();
  
  if (!apiKey) {
    return null;
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Check if any Gemini keys are available
 */
export function hasAvailableGeminiKey(): boolean {
  return multiGeminiManager.hasAvailableKeys();
}
