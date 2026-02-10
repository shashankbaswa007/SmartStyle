/**
 * Interaction Tracker - Comprehensive User Behavior Tracking
 * 
 * Tracks user interactions with recommendations including:
 * - Session metadata (occasion, weather, timestamp)
 * - User actions (views, likes, wears, shopping clicks)
 * - Implicit feedback (view duration, hover tracking)
 * - Session outcomes
 */

import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SessionMetadata {
  sessionId: string;
  userId: string;
  timestamp: Date;
  occasion: string;
  genre?: string;
  gender: string;
  weather?: {
    temp: number;
    condition: string;
  };
  season: string; // Derived from timestamp
}

export interface OutfitRecommendationData {
  position: number; // 1, 2, or 3
  title: string;
  colors: string[];
  styles: string[];
  items: string[];
  imageUrl: string;
  description?: string;
}

export interface UserAction {
  type: 'viewed' | 'hovered_color' | 'clicked_shopping' | 'liked' | 'wore' | 'ignored' | 'disliked';
  timestamp: Date;
  outfitPosition?: number;
  colorHex?: string; // For hover tracking
  platform?: string; // For shopping clicks
  duration?: number; // For view duration (ms)
}

export interface SessionOutcome {
  outcome: 'liked_one' | 'wore_one' | 'liked_multiple' | 'ignored_all' | 'in_progress';
  timeToFirstAction?: number; // Milliseconds from session start
  timeToDecision?: number; // Milliseconds from session start
  totalViewDuration: number; // Total time spent on page
  scrollDepth: number; // 0-100 percentage
}

export interface InteractionSession {
  metadata: SessionMetadata;
  recommendations: OutfitRecommendationData[];
  actions: UserAction[];
  outcome: SessionOutcome;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create new interaction tracking session
 */
export async function createInteractionSession(
  userId: string,
  sessionId: string,
  metadata: Omit<SessionMetadata, 'sessionId' | 'userId' | 'timestamp' | 'season'>,
  recommendations: OutfitRecommendationData[]
): Promise<void> {
  // Server-side: Firestore client SDK lacks auth context — skip
  if (typeof window === 'undefined') return;

  try {
    const now = new Date();
    const season = getSeason(now);

    const session: InteractionSession = {
      metadata: {
        sessionId,
        userId,
        timestamp: now,
        season,
        ...metadata,
      },
      recommendations,
      actions: [],
      outcome: {
        outcome: 'in_progress',
        totalViewDuration: 0,
        scrollDepth: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    const sessionRef = doc(db, 'userInteractions', userId, 'sessions', sessionId);
    await setDoc(sessionRef, {
      ...session,
      metadata: {
        ...session.metadata,
        timestamp: Timestamp.fromDate(session.metadata.timestamp),
      },
      actions: session.actions.map(action => ({
        ...action,
        timestamp: Timestamp.fromDate(action.timestamp),
      })),
      createdAt: Timestamp.fromDate(session.createdAt),
      updatedAt: serverTimestamp(),
    });

    logger.log('✅ [Interaction Tracker] Session created:', sessionId);
  } catch (error: any) {
    if (error?.code !== 'permission-denied') {
      logger.error('❌ [Interaction Tracker] Failed to create session:', error);
    }
  }
}

/**
 * Track user action in session
 */
export async function trackAction(
  userId: string,
  sessionId: string,
  action: UserAction
): Promise<void> {
  try {
    const sessionRef = doc(db, 'userInteractions', userId, 'sessions', sessionId);
    
    await updateDoc(sessionRef, {
      actions: arrayUnion({
        ...action,
        timestamp: Timestamp.fromDate(action.timestamp),
      }),
      updatedAt: serverTimestamp(),
    });

    logger.log(`✅ [Interaction Tracker] Action tracked: ${action.type} at ${action.timestamp.toISOString()}`);
  } catch (error) {
    if ((error as any)?.code !== 'permission-denied') {
      logger.error('❌ [Interaction Tracker] Failed to track action:', error);
    }
  }
}

/**
 * Update session outcome
 */
export async function updateSessionOutcome(
  userId: string,
  sessionId: string,
  outcome: SessionOutcome
): Promise<void> {
  try {
    const sessionRef = doc(db, 'userInteractions', userId, 'sessions', sessionId);
    
    await updateDoc(sessionRef, {
      outcome,
      updatedAt: serverTimestamp(),
    });

    logger.log(`✅ [Interaction Tracker] Outcome updated: ${outcome.outcome}`);
  } catch (error) {
    if ((error as any)?.code !== 'permission-denied') {
      logger.error('❌ [Interaction Tracker] Failed to update outcome:', error);
    }
  }
}

// ============================================
// SPECIFIC ACTION TRACKERS
// ============================================

/**
 * Track outfit view with duration
 */
export async function trackView(
  userId: string,
  sessionId: string,
  outfitPosition: number,
  duration: number
): Promise<void> {
  await trackAction(userId, sessionId, {
    type: 'viewed',
    timestamp: new Date(),
    outfitPosition,
    duration,
  });
}

/**
 * Track color palette hover
 */
export async function trackColorHover(
  userId: string,
  sessionId: string,
  outfitPosition: number,
  colorHex: string
): Promise<void> {
  await trackAction(userId, sessionId, {
    type: 'hovered_color',
    timestamp: new Date(),
    outfitPosition,
    colorHex,
  });
}

/**
 * Track shopping link click
 */
export async function trackShoppingClick(
  userId: string,
  sessionId: string,
  outfitPosition: number,
  platform: string
): Promise<void> {
  await trackAction(userId, sessionId, {
    type: 'clicked_shopping',
    timestamp: new Date(),
    outfitPosition,
    platform,
  });
}

/**
 * Track outfit like
 */
export async function trackLike(
  userId: string,
  sessionId: string,
  outfitPosition: number
): Promise<void> {
  await trackAction(userId, sessionId, {
    type: 'liked',
    timestamp: new Date(),
    outfitPosition,
  });
}

/**
 * Track outfit wore
 */
export async function trackWore(
  userId: string,
  sessionId: string,
  outfitPosition: number
): Promise<void> {
  await trackAction(userId, sessionId, {
    type: 'wore',
    timestamp: new Date(),
    outfitPosition,
  });
}

/**
 * Track outfit dislike
 */
export async function trackDislike(
  userId: string,
  sessionId: string,
  outfitPosition: number
): Promise<void> {
  await trackAction(userId, sessionId, {
    type: 'disliked',
    timestamp: new Date(),
    outfitPosition,
  });
}

// ============================================
// SESSION TIMEOUT DETECTION
// ============================================

/**
 * Start session timeout monitoring
 * Automatically marks session as ignored after 5 minutes of inactivity
 */
export function startSessionTimeoutMonitoring(
  userId: string,
  sessionId: string,
  sessionStartTime: Date,
  timeoutMinutes: number = 5
): NodeJS.Timeout {
  const timeoutMs = timeoutMinutes * 60 * 1000;

  const timeoutId = setTimeout(async () => {
    logger.log('⏱️ [Interaction Tracker] Session timeout reached:', sessionId);
    
    // Check if session has any positive actions
    // This would require fetching the session, but for simplicity we'll just mark as ignored
    await updateSessionOutcome(userId, sessionId, {
      outcome: 'ignored_all',
      totalViewDuration: Date.now() - sessionStartTime.getTime(),
      scrollDepth: 0, // Unknown at timeout
    });
  }, timeoutMs);

  logger.log(`⏱️ [Interaction Tracker] Session timeout monitoring started: ${timeoutMinutes} minutes`);
  
  return timeoutId;
}

/**
 * Cancel session timeout monitoring (user took action)
 */
export function cancelSessionTimeout(timeoutId: NodeJS.Timeout): void {
  clearTimeout(timeoutId);
  logger.log('✅ [Interaction Tracker] Session timeout cancelled - user activity detected');
}

// ============================================
// ANALYTICS AND METRICS
// ============================================

/**
 * Calculate session metrics from actions
 */
export function calculateSessionMetrics(
  actions: UserAction[],
  sessionStartTime: Date
): {
  timeToFirstAction?: number;
  timeToDecision?: number;
  totalViewDuration: number;
} {
  if (actions.length === 0) {
    return {
      totalViewDuration: 0,
    };
  }

  const sortedActions = [...actions].sort((a, b) => 
    a.timestamp.getTime() - b.timestamp.getTime()
  );

  const firstAction = sortedActions[0];
  const timeToFirstAction = firstAction.timestamp.getTime() - sessionStartTime.getTime();

  // Time to decision is when user likes or wears
  const decisionAction = sortedActions.find(a => a.type === 'liked' || a.type === 'wore');
  const timeToDecision = decisionAction 
    ? decisionAction.timestamp.getTime() - sessionStartTime.getTime()
    : undefined;

  // Sum all view durations
  const totalViewDuration = actions
    .filter(a => a.type === 'viewed')
    .reduce((sum, a) => sum + (a.duration || 0), 0);

  return {
    timeToFirstAction,
    timeToDecision,
    totalViewDuration,
  };
}

/**
 * Determine session outcome from actions
 */
export function determineSessionOutcome(actions: UserAction[]): SessionOutcome['outcome'] {
  const likedCount = actions.filter(a => a.type === 'liked').length;
  const woreCount = actions.filter(a => a.type === 'wore').length;

  if (woreCount > 0) return 'wore_one';
  if (likedCount > 1) return 'liked_multiple';
  if (likedCount === 1) return 'liked_one';
  
  // Check if user interacted at all
  const hasInteraction = actions.some(a => 
    ['liked', 'wore', 'clicked_shopping', 'hovered_color'].includes(a.type)
  );

  if (!hasInteraction && actions.length > 0) return 'ignored_all';
  
  return 'in_progress';
}

// ============================================
// IMPLICIT FEEDBACK HELPERS
// ============================================

/**
 * Create IntersectionObserver for tracking view duration
 * Returns observer instance and cleanup function
 */
export function createViewDurationObserver(
  elements: HTMLElement[],
  onViewDurationChange: (element: HTMLElement, duration: number) => void
): { observer: IntersectionObserver; cleanup: () => void } {
  const viewTimes = new Map<HTMLElement, number>();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const element = entry.target as HTMLElement;
        
        if (entry.isIntersecting) {
          // Element came into view
          viewTimes.set(element, Date.now());
        } else {
          // Element left view
          const startTime = viewTimes.get(element);
          if (startTime) {
            const duration = Date.now() - startTime;
            onViewDurationChange(element, duration);
            viewTimes.delete(element);
          }
        }
      });
    },
    {
      threshold: 0.5, // Consider "viewed" when 50% visible
      rootMargin: '0px',
    }
  );

  // Observe all elements
  elements.forEach(el => observer.observe(el));

  const cleanup = () => {
    observer.disconnect();
    viewTimes.clear();
  };

  return { observer, cleanup };
}

/**
 * Track scroll depth percentage
 */
export function trackScrollDepth(callback: (depth: number) => void): () => void {
  let maxScroll = 0;

  const handleScroll = () => {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY;

    const scrollable = documentHeight - windowHeight;
    const scrolled = scrollTop;
    const scrollPercentage = scrollable > 0 ? (scrolled / scrollable) * 100 : 100;

    if (scrollPercentage > maxScroll) {
      maxScroll = scrollPercentage;
      callback(Math.round(scrollPercentage));
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  return () => {
    window.removeEventListener('scroll', handleScroll);
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getSeason(date: Date): string {
  const month = date.getMonth() + 1; // 1-12
  
  // India seasons
  if (month >= 6 && month <= 9) return 'monsoon';
  if (month >= 4 && month <= 9) return 'summer';
  return 'winter';
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract style keywords from outfit description
 */
export function extractStyleKeywords(description: string): string[] {
  const keywords = [
    'casual', 'formal', 'minimalist', 'bohemian', 'ethnic', 'fusion',
    'streetwear', 'vintage', 'modern', 'classic', 'contemporary', 'traditional',
    'chic', 'elegant', 'sporty', 'edgy', 'romantic', 'preppy',
    'oversized', 'fitted', 'tailored', 'loose', 'relaxed',
    'solid', 'floral', 'geometric', 'striped', 'printed',
  ];
  
  const lowerDesc = description.toLowerCase();
  return keywords.filter(k => lowerDesc.includes(k));
}

/**
 * Batch update session with multiple actions
 */
export async function batchUpdateSession(
  userId: string,
  sessionId: string,
  updates: {
    actions?: UserAction[];
    outcome?: SessionOutcome;
  }
): Promise<void> {
  try {
    const sessionRef = doc(db, 'userInteractions', userId, 'sessions', sessionId);
    
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };

    if (updates.actions) {
      updateData.actions = arrayUnion(
        ...updates.actions.map(action => ({
          ...action,
          timestamp: Timestamp.fromDate(action.timestamp),
        }))
      );
    }

    if (updates.outcome) {
      updateData.outcome = updates.outcome;
    }

    await updateDoc(sessionRef, updateData);

    logger.log('✅ [Interaction Tracker] Batch update completed');
  } catch (error) {
    if ((error as any)?.code !== 'permission-denied') {
      logger.error('❌ [Interaction Tracker] Batch update failed:', error);
    }
  }
}

/**
 * Get current session data (for offline support)
 */
export interface LocalSessionData {
  sessionId: string;
  userId: string;
  pendingActions: UserAction[];
  lastSync: Date;
}

/**
 * Save session data to localStorage for offline support
 */
export function saveSessionToLocal(sessionData: LocalSessionData): void {
  try {
    localStorage.setItem('currentSession', JSON.stringify({
      ...sessionData,
      lastSync: sessionData.lastSync.toISOString(),
    }));
  } catch (error) {
    logger.error('❌ [Interaction Tracker] Failed to save to localStorage:', error);
  }
}

/**
 * Load session data from localStorage
 */
export function loadSessionFromLocal(): LocalSessionData | null {
  try {
    const data = localStorage.getItem('currentSession');
    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      ...parsed,
      lastSync: new Date(parsed.lastSync),
      pendingActions: parsed.pendingActions.map((action: any) => ({
        ...action,
        timestamp: new Date(action.timestamp),
      })),
    };
  } catch (error) {
    logger.error('❌ [Interaction Tracker] Failed to load from localStorage:', error);
    return null;
  }
}

/**
 * Clear local session data
 */
export function clearLocalSession(): void {
  localStorage.removeItem('currentSession');
}
