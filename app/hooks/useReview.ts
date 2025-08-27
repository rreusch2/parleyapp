import { useCallback } from 'react';
import ReviewService, { ReviewTriggerEvent } from '../services/reviewService';

/**
 * Hook for tracking positive user interactions that might trigger App Store review prompts
 * 
 * Usage:
 * const { trackPositiveInteraction } = useReview();
 * 
 * // When user subscribes to Pro
 * trackPositiveInteraction({ eventType: 'successful_subscription' });
 * 
 * // When user wins spinning wheel
 * trackPositiveInteraction({ 
 *   eventType: 'welcome_wheel_win', 
 *   metadata: { wheelPrize: 5 } 
 * });
 */
export const useReview = () => {
  const reviewService = ReviewService.getInstance();

  /**
   * Track a positive user interaction
   */
  const trackPositiveInteraction = useCallback(async (event: ReviewTriggerEvent) => {
    try {
      await reviewService.trackPositiveInteraction(event);
    } catch (error) {
      console.error('❌ Failed to track positive interaction:', error);
    }
  }, [reviewService]);

  /**
   * Initialize review service (call in App.tsx or main component)
   */
  const initializeReview = useCallback(async () => {
    try {
      await reviewService.initialize();
    } catch (error) {
      console.error('❌ Failed to initialize review service:', error);
    }
  }, [reviewService]);

  /**
   * Get review statistics (for debugging)
   */
  const getReviewStats = useCallback(async () => {
    try {
      return await reviewService.getReviewStats();
    } catch (error) {
      console.error('❌ Failed to get review stats:', error);
      return null;
    }
  }, [reviewService]);

  /**
   * Force show review (dev only)
   */
  const forceShowReview = useCallback(async () => {
    if (__DEV__) {
      try {
        await reviewService.forceShowReview();
      } catch (error) {
        console.error('❌ Failed to force show review:', error);
      }
    }
  }, [reviewService]);

  /**
   * Show manual review (production safe)
   */
  const showManualReview = useCallback(async () => {
    try {
      return await reviewService.showManualReview();
    } catch (error) {
      console.error('❌ Failed to show manual review:', error);
      return false;
    }
  }, [reviewService]);

  /**
   * Reset review state (dev only)
   */
  const resetReviewState = useCallback(async () => {
    if (__DEV__) {
      try {
        await reviewService.resetReviewState();
      } catch (error) {
        console.error('❌ Failed to reset review state:', error);
      }
    }
  }, [reviewService]);

  return {
    trackPositiveInteraction,
    initializeReview,
    getReviewStats,
    forceShowReview,
    showManualReview,
    resetReviewState
  };
};

export default useReview;
