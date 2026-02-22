/**
 * Smart Recommendations Cache
 * 
 * Caches AI-generated outfit recommendations to improve performance:
 * - Reduces API calls and AI generation costs
 * - Provides instant results for repeat queries
 * - Automatically invalidates on wardrobe changes
 * - Memory-efficient with LRU eviction
 */

import type { WardrobeItemData } from './wardrobeService';

interface CachedRecommendation {
  recommendations: any; // The recommendation result
  timestamp: number;
  wardrobeHash: string; // Hash of wardrobe items to detect changes
  requestHash: string; // Hash of request params (occasion, preferences, etc.)
}

interface CacheEntry {
  value: CachedRecommendation;
  lastAccessed: number;
}

// Cache configuration
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 50; // Maximum number of cached recommendations

// In-memory cache (could be upgraded to IndexedDB for persistence)
const cache = new Map<string, CacheEntry>();

/**
 * Generate a hash from wardrobe items to detect changes
 */
export function generateWardrobeHash(items: WardrobeItemData[]): string {
  if (!items || items.length === 0) return 'empty';
  
  // Sort by ID for consistent hashing
  const sortedItems = [...items].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  
  // Include ID, colors, and type in hash (most relevant for recommendations)
  const hashData = sortedItems
    .map(item => `${item.id}:${item.itemType}:${item.dominantColors?.join(',')}`)
    .join('|');
  
  return simpleHash(hashData);
}

/**
 * Generate a hash from request parameters
 */
export function generateRequestHash(params: {
  userId: string;
  occasion?: string;
  season?: string;
  preferences?: any;
  wardrobeItemIds?: string[];
}): string {
  const hashData = [
    params.userId,
    params.occasion || '',
    params.season || '',
    JSON.stringify(params.preferences || {}),
    (params.wardrobeItemIds || []).sort().join(',')
  ].join('|');
  
  return simpleHash(hashData);
}

/**
 * Simple string hash function (DJB2 algorithm)
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Get cached recommendation if valid
 */
export function getCachedRecommendation(
  requestHash: string,
  wardrobeHash: string
): any | null {
  const cacheKey = `${requestHash}:${wardrobeHash}`;
  const entry = cache.get(cacheKey);
  
  if (!entry) {
    return null;
  }
  
  // Check if cache is expired
  const age = Date.now() - entry.value.timestamp;
  if (age > CACHE_DURATION_MS) {
    cache.delete(cacheKey);
    return null;
  }
  
  // Check if wardrobe has changed
  if (entry.value.wardrobeHash !== wardrobeHash) {
    cache.delete(cacheKey);
    return null;
  }
  
  // Update last accessed time for LRU
  entry.lastAccessed = Date.now();
  
  return entry.value.recommendations;
}

/**
 * Store recommendation in cache
 */
export function cacheRecommendation(
  requestHash: string,
  wardrobeHash: string,
  recommendations: any
): void {
  const cacheKey = `${requestHash}:${wardrobeHash}`;
  
  // Implement LRU eviction if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    evictLeastRecentlyUsed();
  }
  
  cache.set(cacheKey, {
    value: {
      recommendations,
      timestamp: Date.now(),
      wardrobeHash,
      requestHash,
    },
    lastAccessed: Date.now(),
  });
  
}

/**
 * Evict least recently used cache entry
 */
function evictLeastRecentlyUsed(): void {
  let oldestKey: string | null = null;
  let oldestTime = Date.now();
  
  for (const [key, entry] of cache.entries()) {
    if (entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed;
      oldestKey = key;
    }
  }
  
  if (oldestKey) {
    cache.delete(oldestKey);
  }
}

/**
 * Invalidate all cached recommendations for a user
 * Call this when wardrobe changes significantly
 */
export function invalidateUserCache(userId: string): void {
  let deletedCount = 0;
  
  for (const [key, entry] of cache.entries()) {
    if (entry.value.requestHash.startsWith(userId)) {
      cache.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
  }
}

/**
 * Clear all cached recommendations (useful for testing)
 */
export function clearAllCache(): void {
  const size = cache.size;
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const entries = Array.from(cache.values());
  const now = Date.now();
  
  const stats = {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    oldestEntry: entries.length > 0 
      ? Math.round((now - Math.min(...entries.map(e => e.value.timestamp))) / 1000 / 60) 
      : 0,
    newestEntry: entries.length > 0
      ? Math.round((now - Math.max(...entries.map(e => e.value.timestamp))) / 1000 / 60)
      : 0,
  };
  
  return stats;
}

/**
 * Example usage in outfit recommendation API:
 * 
 * ```typescript
 * // In your outfit recommendation function:
 * export async function generateOutfitRecommendations(
 *   userId: string,
 *   wardrobeItems: WardrobeItemData[],
 *   occasion: string,
 *   season?: string
 * ) {
 *   // Generate hashes
 *   const wardrobeHash = generateWardrobeHash(wardrobeItems);
 *   const requestHash = generateRequestHash({ userId, occasion, season });
 *   
 *   // Check cache first
 *   const cached = getCachedRecommendation(requestHash, wardrobeHash);
 *   if (cached) {
 *     return cached; // Return cached result instantly
 *   }
 *   
 *   // Generate new recommendations (expensive AI call)
 *   const recommendations = await generateWithAI(wardrobeItems, occasion, season);
 *   
 *   // Cache for future requests
 *   cacheRecommendation(requestHash, wardrobeHash, recommendations);
 *   
 *   return recommendations;
 * }
 * 
 * // When wardrobe changes (add/delete/update items):
 * invalidateUserCache(userId);
 * ```
 */
