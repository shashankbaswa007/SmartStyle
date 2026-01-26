import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  message?: string;
}> {
  try {
    const limitsRef = doc(db, 'rateLimits', userId);
    const limitsSnap = await getDoc(limitsRef);
    
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
    
    if (!limitsSnap.exists()) {
      // First request this hour
      await setDoc(limitsRef, {
        count: 1,
        hourStart: Timestamp.fromDate(hourStart),
      });
      return { 
        allowed: true, 
        remaining: 19, 
        resetAt: new Date(hourStart.getTime() + 3600000) 
      };
    }
    
    const data = limitsSnap.data();
    const lastHourStart = data.hourStart.toDate();
    
    // Reset if new hour
    if (hourStart > lastHourStart) {
      await setDoc(limitsRef, {
        count: 1,
        hourStart: Timestamp.fromDate(hourStart),
      });
      return { 
        allowed: true, 
        remaining: 19, 
        resetAt: new Date(hourStart.getTime() + 3600000) 
      };
    }
    
    // Check limit (20 requests per hour per user)
    const maxRequests = 20;
    if (data.count >= maxRequests) {
      const resetAt = new Date(lastHourStart.getTime() + 3600000);
      const minutesUntilReset = Math.ceil((resetAt.getTime() - now.getTime()) / 60000);
      
      return { 
        allowed: false, 
        remaining: 0, 
        resetAt,
        message: `Rate limit exceeded. You can make ${maxRequests} requests per hour. Please try again in ${minutesUntilReset} minutes.`
      };
    }
    
    // Increment counter
    await setDoc(limitsRef, {
      count: data.count + 1,
      hourStart: data.hourStart,
    });
    
    return { 
      allowed: true, 
      remaining: maxRequests - data.count - 1, 
      resetAt: new Date(lastHourStart.getTime() + 3600000) 
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Allow request if rate limiting check fails (graceful degradation)
    return { 
      allowed: true, 
      remaining: -1, 
      resetAt: new Date() 
    };
  }
}
