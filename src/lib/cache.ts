/**
 * Simple in-memory cache for AI responses to speed up repeated queries
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class ResponseCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number; // Time to live in milliseconds

  constructor(ttlMinutes: number = 30) {
    this.defaultTTL = ttlMinutes * 60 * 1000;
  }

  /**
   * Generate a cache key from input parameters
   */
  private generateKey(params: Record<string, any>): string {
    // Sort keys for consistent hashing
    const sortedKeys = Object.keys(params).sort();
    const keyString = sortedKeys
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < keyString.length; i++) {
      const char = keyString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached value if exists and not expired
   */
  get(params: Record<string, any>): T | null {
    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a value in cache
   */
  set(params: Record<string, any>, data: T, ttlMinutes?: number): void {
    const key = this.generateKey(params);
    const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.defaultTTL;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    this.cache.set(key, entry);
  }

  /**
   * Clear expired entries from cache
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Export singleton instances for different data types
export const userPreferencesCache = new ResponseCache<any>(60); // 1 hour cache
export const recommendationCache = new ResponseCache<any>(30); // 30 minutes cache

// Auto-cleanup every 10 minutes
setInterval(() => {
  userPreferencesCache.cleanup();
  recommendationCache.cleanup();
}, 10 * 60 * 1000);

export default ResponseCache;
