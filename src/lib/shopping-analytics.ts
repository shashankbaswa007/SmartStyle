/**
 * Shopping Link Analytics and Monitoring
 * Tracks shopping query performance, click-through rates, and relevance metrics
 */

import { db } from './firebase';
import { logger } from './logger';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import type { StructuredAnalysis } from '@/ai/flows/analyze-generated-image';
import type { ShoppingLinkResult } from './tavily';

// Firestore collection name
const SHOPPING_LOGS_COLLECTION = 'shoppingQueryLogs';

// Analytics helper - only use if available
let analytics: any = null;
if (typeof window !== 'undefined') {
  try {
    import('firebase/analytics').then(({ getAnalytics, logEvent: fbLogEvent }) => {
      const { firebaseApp } = require('./firebase');
      analytics = getAnalytics(firebaseApp);
    }).catch(() => {
      logger.warn('Firebase Analytics not available');
    });
  } catch (e) {
    // Analytics not available
  }
}

const logAnalyticsEvent = (eventName: string, params?: Record<string, any>) => {
  if (analytics && typeof window !== 'undefined') {
    try {
      import('firebase/analytics').then(({ logEvent }) => {
        logEvent(analytics, eventName, params);
      });
    } catch (e) {
      // Silently fail
    }
  }
};

interface ShoppingSearchLog {
  userId?: string;
  sessionId: string;
  outfitTitle: string;
  gender: string;
  timestamp: any; // Firestore serverTimestamp
  
  // Analysis data
  itemsDetected: number;
  primaryModel: string;
  analysisTimeMs: number;
  searchTimeMs: number;
  totalProcessingTimeMs: number;
  
  // Search results
  totalLinksFound: number;
  averageRelevanceScore: number;
  linksByPlatform: {
    amazon: number;
    myntra: number;
    tatacliq: number;
  };
  
  // Item details
  items: Array<{
    itemNumber: number;
    type: string;
    color: string;
    category: string;
    linksFound: number;
  }>;
  
  // Quality metrics
  minRelevanceScore: number;
  maxRelevanceScore: number;
  itemsWithNoLinks: number;
  
  // Status
  status: 'success' | 'partial' | 'failed';
  errorMessage?: string;
}

interface ShoppingLinkClickLog {
  userId?: string;
  sessionId: string;
  outfitTitle: string;
  itemName: string;
  platform: 'amazon' | 'myntra' | 'tatacliq';
  productUrl: string;
  relevanceScore: number;
  timestamp: any; // Firestore serverTimestamp
}

/**
 * Log a shopping search session to Firestore
 */
export async function logShoppingSearch(
  sessionId: string,
  outfitTitle: string,
  gender: string,
  structuredAnalysis: StructuredAnalysis,
  shoppingLinks: ShoppingLinkResult,
  metadata: {
    primaryModel: string;
    analysisTime: number;
    searchTime: number;
    totalProcessingTime: number;
  },
  userId?: string
): Promise<void> {
  try {
    // Calculate metrics
    const allRelevanceScores: number[] = [];
    shoppingLinks.byItem.forEach(item => {
      item.links.amazon.forEach(link => allRelevanceScores.push(link.relevanceScore));
      item.links.myntra.forEach(link => allRelevanceScores.push(link.relevanceScore));
      item.links.tatacliq.forEach(link => allRelevanceScores.push(link.relevanceScore));
    });

    const minRelevance = allRelevanceScores.length > 0 ? Math.min(...allRelevanceScores) : 0;
    const maxRelevance = allRelevanceScores.length > 0 ? Math.max(...allRelevanceScores) : 0;
    const itemsWithNoLinks = shoppingLinks.byItem.filter(
      item => item.links.amazon.length === 0 && item.links.myntra.length === 0 && item.links.tatacliq.length === 0
    ).length;

    // Determine status
    let status: 'success' | 'partial' | 'failed' = 'success';
    if (shoppingLinks.metadata.totalLinksFound === 0) {
      status = 'failed';
    } else if (itemsWithNoLinks > 0) {
      status = 'partial';
    }

    const logData: ShoppingSearchLog = {
      userId,
      sessionId,
      outfitTitle,
      gender,
      timestamp: serverTimestamp(),
      
      itemsDetected: structuredAnalysis.items.length,
      primaryModel: metadata.primaryModel,
      analysisTimeMs: metadata.analysisTime,
      searchTimeMs: metadata.searchTime,
      totalProcessingTimeMs: metadata.totalProcessingTime,
      
      totalLinksFound: shoppingLinks.metadata.totalLinksFound,
      averageRelevanceScore: shoppingLinks.metadata.averageRelevanceScore,
      linksByPlatform: {
        amazon: shoppingLinks.byPlatform.amazon.length,
        myntra: shoppingLinks.byPlatform.myntra.length,
        tatacliq: shoppingLinks.byPlatform.tatacliq.length,
      },
      
      items: structuredAnalysis.items.map((item, idx) => ({
        itemNumber: item.itemNumber,
        type: item.type,
        color: item.color,
        category: item.category,
        linksFound: 
          shoppingLinks.byItem[idx].links.amazon.length +
          shoppingLinks.byItem[idx].links.myntra.length +
          shoppingLinks.byItem[idx].links.tatacliq.length,
      })),
      
      minRelevanceScore: minRelevance,
      maxRelevanceScore: maxRelevance,
      itemsWithNoLinks,
      
      status,
    };

    // Save to Firestore
    await addDoc(collection(db, SHOPPING_LOGS_COLLECTION), logData);
    
    // Track in Firebase Analytics
    logAnalyticsEvent('shopping_search_completed', {
      items_detected: structuredAnalysis.items.length,
      total_links: shoppingLinks.metadata.totalLinksFound,
      avg_relevance: shoppingLinks.metadata.averageRelevanceScore,
      status,
      processing_time_ms: metadata.totalProcessingTime,
    });

    logger.log('✅ Shopping search logged to Firestore');
  } catch (error) {
    logger.error('❌ Failed to log shopping search:', error);
    // Don't throw - analytics failure shouldn't break the app
  }
}

/**
 * Log a shopping search failure
 */
export async function logShoppingSearchFailed(
  sessionId: string,
  outfitTitle: string,
  gender: string,
  errorMessage: string,
  userId?: string
): Promise<void> {
  try {
    const logData = {
      userId,
      sessionId,
      outfitTitle,
      gender,
      timestamp: serverTimestamp(),
      status: 'failed',
      errorMessage,
      itemsDetected: 0,
      totalLinksFound: 0,
      averageRelevanceScore: 0,
    };

    await addDoc(collection(db, SHOPPING_LOGS_COLLECTION), logData);

    logAnalyticsEvent('shopping_search_failed', {
      error_message: errorMessage,
    });

    logger.log('✅ Shopping search failure logged');
  } catch (error) {
    logger.error('❌ Failed to log shopping search failure:', error);
  }
}

/**
 * Track a shopping link click
 */
export async function trackShoppingLinkClick(
  sessionId: string,
  outfitTitle: string,
  itemName: string,
  platform: 'amazon' | 'myntra' | 'tatacliq',
  productUrl: string,
  relevanceScore: number,
  userId?: string
): Promise<void> {
  try {
    const clickData: ShoppingLinkClickLog = {
      userId,
      sessionId,
      outfitTitle,
      itemName,
      platform,
      productUrl,
      relevanceScore,
      timestamp: serverTimestamp(),
    };

    // Save to Firestore (you might want a separate collection for clicks)
    await addDoc(collection(db, 'shoppingLinkClicks'), clickData);

    // Track in Firebase Analytics
    logAnalyticsEvent('shopping_link_clicked', {
      platform,
      item_name: itemName,
      relevance_score: relevanceScore,
    });

    logger.log(`✅ Click tracked: ${platform} - ${itemName}`);
  } catch (error) {
    logger.error('❌ Failed to track shopping link click:', error);
  }
}

/**
 * Get shopping search statistics (for admin dashboard)
 */
export async function getShoppingSearchStats(days: number = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const q = query(
      collection(db, SHOPPING_LOGS_COLLECTION),
      where('timestamp', '>=', cutoffDate),
      orderBy('timestamp', 'desc'),
      limit(1000)
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => doc.data() as ShoppingSearchLog);

    // Calculate statistics
    const totalSearches = logs.length;
    const successfulSearches = logs.filter(l => l.status === 'success').length;
    const failedSearches = logs.filter(l => l.status === 'failed').length;
    const partialSearches = logs.filter(l => l.status === 'partial').length;

    const avgLinksFound = logs.reduce((sum, l) => sum + l.totalLinksFound, 0) / totalSearches || 0;
    const avgRelevance = logs.reduce((sum, l) => sum + l.averageRelevanceScore, 0) / totalSearches || 0;
    const avgProcessingTime = logs.reduce((sum, l) => sum + l.totalProcessingTimeMs, 0) / totalSearches || 0;

    return {
      totalSearches,
      successfulSearches,
      failedSearches,
      partialSearches,
      successRate: (successfulSearches / totalSearches * 100).toFixed(1) + '%',
      avgLinksFound: avgLinksFound.toFixed(1),
      avgRelevance: (avgRelevance * 100).toFixed(1) + '%',
      avgProcessingTimeMs: Math.round(avgProcessingTime),
    };
  } catch (error) {
    logger.error('❌ Failed to get shopping search stats:', error);
    return null;
  }
}

/**
 * Get platform performance comparison
 */
export async function getPlatformPerformance(days: number = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const q = query(
      collection(db, SHOPPING_LOGS_COLLECTION),
      where('timestamp', '>=', cutoffDate),
      orderBy('timestamp', 'desc'),
      limit(1000)
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => doc.data() as ShoppingSearchLog);

    const amazonLinks = logs.reduce((sum, l) => sum + l.linksByPlatform.amazon, 0);
    const myntraLinks = logs.reduce((sum, l) => sum + l.linksByPlatform.myntra, 0);
    const tatacliqLinks = logs.reduce((sum, l) => sum + l.linksByPlatform.tatacliq, 0);
    const totalLinks = amazonLinks + myntraLinks + tatacliqLinks;

    return {
      amazon: {
        links: amazonLinks,
        percentage: ((amazonLinks / totalLinks) * 100).toFixed(1) + '%',
      },
      myntra: {
        links: myntraLinks,
        percentage: ((myntraLinks / totalLinks) * 100).toFixed(1) + '%',
      },
      tatacliq: {
        links: tatacliqLinks,
        percentage: ((tatacliqLinks / totalLinks) * 100).toFixed(1) + '%',
      },
      total: totalLinks,
    };
  } catch (error) {
    logger.error('❌ Failed to get platform performance:', error);
    return null;
  }
}
