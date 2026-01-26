/**
 * Request Caching Utility
 * Reduces AI API costs by caching repeated requests
 * 
 * Features:
 * - In-memory LRU cache with TTL
 * - Automatic cleanup of expired entries
 * - Cache hit/miss tracking for analytics
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  stampedePrevented: number; // Track how many stampedes were prevented
}

class RequestCache {
  private cache: Map<string, CacheEntry<any>>;
  private stats: CacheStats;
  private readonly maxSize: number;
  private readonly ttl: number; // Time to live in milliseconds
  private cleanupInterval: NodeJS.Timeout | null;
  private locks: Map<string, Promise<any>>; // Dogpile prevention locks

  constructor(maxSize: number = 100, ttlMinutes: number = 5) {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0, size: 0, stampedePrevented: 0 };
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
    this.cleanupInterval = null;
    this.locks = new Map();
    
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size--;
      return null;
    }

    // Update hit count and stats
    entry.hits++;
    this.stats.hits++;
    
    return entry.data as T;
  }

  /**
   * Set cached data with automatic LRU eviction
   */
  set<T>(key: string, data: T): void {
    // Enforce max size (LRU eviction)
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
    });
    
    this.stats.size = this.cache.size;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.size--;
      return false;
    }
    
    return true;
  }

  /**
   * Get value from cache or fetch if missing (dogpile prevention)
   * Prevents cache stampede by ensuring only one request fetches data
   * while others wait for the result
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check if another request is already fetching
    const existingLock = this.locks.get(key);
    if (existingLock) {
      this.stats.stampedePrevented++;
      console.log(`⏳ [Cache] Waiting for concurrent fetch of key: ${key.substring(0, 30)}...`);
      return existingLock as Promise<T>;
    }

    // Create lock and fetch
    const fetchPromise = fetchFn()
      .then(data => {
        this.set(key, data);
        this.locks.delete(key);
        return data;
      })
      .catch(error => {
        this.locks.delete(key);
        throw error;
      });

    this.locks.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Clear specific key or entire cache
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
      this.stats = { hits: 0, misses: 0, size: 0, stampedePrevented: 0 };
    }
    this.stats.size = this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
    };
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get stampede prevention rate
   */
  getStampedePreventionRate(): number {
    const total = this.stats.misses;
    return total > 0 ? (this.stats.stampedePrevented / total) * 100 : 0;
  }

  /**
   * Evict least recently used (least hits) entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let minHits = Infinity;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Prioritize by hits, then by age
      if (entry.hits < minHits || (entry.hits === minHits && entry.timestamp < oldestTime)) {
        minHits = entry.hits;
        oldestTime = entry.timestamp;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Remove expired entries every minute
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.ttl) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.cache.delete(key));
      this.stats.size = this.cache.size;
    }, 60 * 1000); // Run every minute
  }

  /**
   * Stop cleanup interval (for cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create singleton instances for different cache types
export const recommendationCache = new RequestCache(50, 5); // 50 items, 5 min TTL
export const imageCache = new RequestCache(30, 10); // 30 items, 10 min TTL
export const shoppingCache = new RequestCache(100, 15); // 100 items, 15 min TTL

// Export class for custom instances
export { RequestCache };

/**
 * Helper function to create cache key from object
 */
export function createCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  const keyParts = sortedKeys.map(key => `${key}:${JSON.stringify(params[key])}`);
  return `${prefix}:${keyParts.join('|')}`;
}

/**
 * Decorator for caching async function results
 */
export function withCache<T>(
  cache: RequestCache,
  keyFn: (...args: any[]) => string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]): Promise<T> {
      const key = keyFn(...args);
      
      // Check cache
      const cached = cache.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);
      
      // Cache result
      cache.set(key, result);
      
      return result;
    };

    return descriptor;
  };
}
