'use client';

/**
 * Recommendation Feedback Component
 * 
 * Allows users to like/dislike outfits and provide detailed feedback
 * to improve AI personalization over time.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  ThumbsUp,
  ThumbsDown,
  Star,
  Check,
  Sparkles,
} from 'lucide-react';
import { provideFeedback } from '@/app/actions';
import { submitRecommendationFeedback, RecommendationHistory } from '@/lib/personalization';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface RecommendationFeedbackProps {
  recommendationId: string;
  userId: string;
  outfitId: string; // 'outfit1', 'outfit2', or 'outfit3'
  outfitDescription: string;
}

export function RecommendationFeedback({
  recommendationId,
  userId,
  outfitId,
  outfitDescription,
}: RecommendationFeedbackProps) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [worn, setWorn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    console.log('🔍 RecommendationFeedback: Setting up auth listener...');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔥 RecommendationFeedback auth state:', {
        hasUser: !!user,
        uid: user?.uid,
        email: user?.email,
        isAnonymous: user?.isAnonymous,
      });

      if (user && !user.isAnonymous) {
        setIsAuthenticated(true);
        console.log('✅ RecommendationFeedback: User is authenticated');
      } else {
        setIsAuthenticated(false);
        console.log('⚠️ RecommendationFeedback: User is not authenticated or anonymous');
      }
      
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  const handleQuickFeedback = async (isLiked: boolean) => {
    if (!isAuthenticated) {
      console.log('⚠️ User not authenticated, showing sign-in prompt');
      toast({
        title: "Sign in required",
        description: "Please sign in to save feedback on recommendations",
        action: (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = '/auth'}
          >
            Sign In
          </Button>
        ),
      });
      return;
    }

    try {
      setSubmitting(true);
      setLiked(isLiked);

      // Get the current user's ID token for server authentication
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const idToken = await currentUser.getIdToken();
      console.log('🔑 Got ID token, calling provideFeedback...');

      // Use the new server action
      const result = await provideFeedback(
        idToken,
        recommendationId, 
        isLiked ? 'like' : 'dislike'
      );

      if (result.success) {
        // Also save to personalization for legacy compatibility
        const feedback: RecommendationHistory['feedback'] = {
          liked: isLiked ? [outfitId] : [],
          disliked: !isLiked ? [outfitId] : [],
        };
        await submitRecommendationFeedback(recommendationId, userId, feedback);

        toast({
          title: isLiked ? '👍 Thanks for the feedback!' : '👎 Feedback received',
          description: isLiked
            ? 'We\'ll show you more outfits like this'
            : 'We\'ll avoid similar suggestions',
        });
      } else {
        if (result.error?.includes('sign in')) {
          toast({
            title: "Sign in required",
            description: result.error,
            action: (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/auth'}
              >
                Sign In
              </Button>
            ),
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error || 'Failed to save feedback. Please try again.',
          });
        }
        setLiked(null);
      }
    } catch (error) {
      console.error('Error submitting quick feedback:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save feedback. Please try again.',
      });
      setLiked(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetailedFeedback = async () => {
    if (!isAuthenticated) {
      console.log('⚠️ User not authenticated, showing sign-in prompt');
      toast({
        title: "Sign in required",
        description: "Please sign in to save detailed feedback",
        action: (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = '/auth'}
          >
            Sign In
          </Button>
        ),
      });
      return;
    }

    try {
      setSubmitting(true);

      // Get the current user's ID token for server authentication
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const idToken = await currentUser.getIdToken();
      console.log('🔑 Got ID token, calling provideFeedback...');

      // Use the new server action with notes
      const result = await provideFeedback(
        idToken,
        recommendationId,
        liked === true ? 'like' : 'dislike',
        notes.trim() || undefined
      );

      if (result.success) {
        // Also save to personalization for legacy compatibility
        const feedback: RecommendationHistory['feedback'] = {
          liked: liked === true ? [outfitId] : [],
          disliked: liked === false ? [outfitId] : [],
          selected: worn ? outfitId : undefined,
          worn,
          rating: rating || undefined,
          notes: notes.trim() || undefined,
        };
        await submitRecommendationFeedback(recommendationId, userId, feedback);

        toast({
          title: '✨ Feedback saved!',
          description: 'Your preferences help us create better recommendations',
        });

        setShowDetailedFeedback(false);
      } else {
        if (result.error?.includes('sign in')) {
          toast({
            title: "Sign in required",
            description: result.error,
            action: (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/auth'}
              >
                Sign In
              </Button>
            ),
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error || 'Failed to save detailed feedback. Please try again.',
          });
        }
      }
    } catch (error) {
      console.error('Error submitting detailed feedback:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save detailed feedback. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Don't render until auth is checked
  if (!authChecked) {
    return (
      <div className="flex items-center gap-2 mt-4">
        <Button variant="outline" size="sm" disabled>
          <ThumbsUp className="w-4 h-4" />
          Like
        </Button>
        <Button variant="outline" size="sm" disabled>
          <ThumbsDown className="w-4 h-4" />
          Dislike
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Debug Info - Remove after testing */}
      <div className="text-xs text-muted-foreground mb-2 px-1">
        🐛 Auth: {isAuthenticated ? '✅ Signed In' : '❌ Not Signed In'} | Checked: {authChecked ? '✅' : '⏳'}
      </div>

      {/* Quick Feedback Buttons */}
      <div className="flex items-center gap-2 mt-4">
        <motion.div
          whileHover={{ scale: isAuthenticated ? 1.05 : 1 }}
          whileTap={{ scale: isAuthenticated ? 0.95 : 1 }}
        >
          <Button
            variant={liked === true ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickFeedback(true)}
            className="gap-2"
            disabled={liked !== null || submitting || !isAuthenticated}
            title={!isAuthenticated ? 'Sign in to save feedback' : ''}
          >
            {submitting && liked === true ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ThumbsUp className={`w-4 h-4 ${liked === true ? 'fill-current' : ''}`} />
            )}
            {submitting && liked === true ? 'Saving...' : 'Like'}
          </Button>
        </motion.div>

        <motion.div
          whileHover={{ scale: isAuthenticated ? 1.05 : 1 }}
          whileTap={{ scale: isAuthenticated ? 0.95 : 1 }}
        >
          <Button
            variant={liked === false ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => handleQuickFeedback(false)}
            className="gap-2"
            disabled={liked !== null || submitting || !isAuthenticated}
            title={!isAuthenticated ? 'Sign in to save feedback' : ''}
          >
            {submitting && liked === false ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ThumbsDown className={`w-4 h-4 ${liked === false ? 'fill-current' : ''}`} />
            )}
            {submitting && liked === false ? 'Saving...' : 'Dislike'}
          </Button>
        </motion.div>

        {liked !== null && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetailedFeedback(true)}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Add details
            </Button>
          </motion.div>
        )}
      </div>

      {/* Detailed Feedback Dialog */}
      <Dialog open={showDetailedFeedback} onOpenChange={setShowDetailedFeedback}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share More Feedback</DialogTitle>
            <DialogDescription>
              Help us understand your style better
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Rating */}
            <div className="space-y-2">
              <Label>How would you rate this outfit?</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Did you wear it? */}
            <div className="space-y-2">
              <Label>Did you wear this outfit?</Label>
              <Button
                type="button"
                variant={worn ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWorn(!worn)}
                className="gap-2"
              >
                {worn && <Check className="w-4 h-4" />}
                {worn ? 'Yes, I wore it!' : 'Mark as worn'}
              </Button>
            </div>

            {/* Additional notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional thoughts (optional)</Label>
              <Textarea
                id="notes"
                placeholder="What did you like or dislike about this outfit?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDetailedFeedback(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDetailedFeedback}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
