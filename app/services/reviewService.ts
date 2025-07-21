import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface ReviewTriggerEvent {
  eventType: 'successful_subscription' | 'welcome_wheel_win' | 'ai_chat_positive' | 'daily_picks_viewed' | 'winning_streak' | 'app_usage_milestone';
  metadata?: {
    streakCount?: number;
    daysUsed?: number;
    picksViewed?: number;
    wheelPrize?: number;
    chatSatisfaction?: 'positive' | 'very_positive';
  };
}

interface ReviewState {
  hasRequestedReview: boolean;
  lastReviewRequestDate: string | null;
  reviewTriggerCount: number;
  positiveInteractions: number;
  lastPositiveInteraction: string | null;
  appInstallDate: string;
  totalAppOpens: number;
}

class ReviewService {
  private static instance: ReviewService;
  private readonly STORAGE_KEY = 'parley_review_state';
  private readonly MIN_DAYS_BETWEEN_REQUESTS = 90; // Apple's recommendation
  private readonly MIN_POSITIVE_INTERACTIONS = 3;
  private readonly MIN_DAYS_SINCE_INSTALL = 0; // Allow immediate reviews for testing

  public static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  /**
   * Initialize review service - call on app startup
   */
  async initialize(): Promise<void> {
    try {
      const state = await this.getReviewState();
      
      // Increment app opens counter
      const updatedState: ReviewState = {
        ...state,
        totalAppOpens: state.totalAppOpens + 1
      };
      
      await this.saveReviewState(updatedState);
      
      console.log('📱 Review Service initialized:', {
        totalOpens: updatedState.totalAppOpens,
        positiveInteractions: updatedState.positiveInteractions,
        daysSinceInstall: this.getDaysSinceInstall(updatedState.appInstallDate)
      });
    } catch (error) {
      console.error('❌ Failed to initialize review service:', error);
    }
  }

  /**
   * Track a positive user interaction that might trigger a review prompt
   */
  async trackPositiveInteraction(event: ReviewTriggerEvent): Promise<void> {
    try {
      const state = await this.getReviewState();
      const now = new Date().toISOString();
      
      const updatedState: ReviewState = {
        ...state,
        positiveInteractions: state.positiveInteractions + 1,
        lastPositiveInteraction: now,
        reviewTriggerCount: state.reviewTriggerCount + 1
      };
      
      await this.saveReviewState(updatedState);
      
      console.log('✨ Positive interaction tracked:', {
        eventType: event.eventType,
        totalPositive: updatedState.positiveInteractions,
        metadata: event.metadata
      });
      
      // Check if we should show review prompt
      await this.checkAndShowReviewPrompt(event, updatedState);
      
    } catch (error) {
      console.error('❌ Failed to track positive interaction:', error);
    }
  }

  /**
   * Check conditions and show review prompt if appropriate
   */
  private async checkAndShowReviewPrompt(event: ReviewTriggerEvent, state: ReviewState): Promise<void> {
    try {
      // Check if review is available on this platform
      if (!await StoreReview.hasAction()) {
        console.log('📱 Store review not available on this platform');
        return;
      }

      // Don't show if already requested review
      if (state.hasRequestedReview) {
        console.log('📱 Review already requested previously');
        return;
      }

      // Check minimum time since last request (if any)
      if (state.lastReviewRequestDate) {
        const daysSinceLastRequest = this.getDaysSince(state.lastReviewRequestDate);
        if (daysSinceLastRequest < this.MIN_DAYS_BETWEEN_REQUESTS) {
          console.log(`📱 Too soon since last review request (${daysSinceLastRequest} days)`);
          return;
        }
      }

      // Check minimum days since app install
      const daysSinceInstall = this.getDaysSinceInstall(state.appInstallDate);
      if (daysSinceInstall < this.MIN_DAYS_SINCE_INSTALL) {
        console.log(`📱 Too soon since app install (${daysSinceInstall} days)`);
        return;
      }

      // Check minimum positive interactions
      if (state.positiveInteractions < this.MIN_POSITIVE_INTERACTIONS) {
        console.log(`📱 Not enough positive interactions (${state.positiveInteractions}/${this.MIN_POSITIVE_INTERACTIONS})`);
        return;
      }

      // Check event-specific conditions for high-happiness moments
      const shouldShowForEvent = this.shouldShowReviewForEvent(event, state);
      if (!shouldShowForEvent) {
        console.log('📱 Event conditions not met for review prompt');
        return;
      }

      // All conditions met - show review prompt!
      await this.showReviewPrompt(event, state);
      
    } catch (error) {
      console.error('❌ Failed to check review prompt conditions:', error);
    }
  }

  /**
   * Determine if this specific event should trigger a review prompt
   */
  private shouldShowReviewForEvent(event: ReviewTriggerEvent, state: ReviewState): boolean {
    switch (event.eventType) {
      case 'successful_subscription':
        // Perfect moment - user just paid for premium
        return true;
        
      case 'welcome_wheel_win':
        // Great moment - user just won free picks
        return event.metadata?.wheelPrize && event.metadata.wheelPrize >= 3;
        
      case 'ai_chat_positive':
        // Good moment if user had very positive chat experience
        return event.metadata?.chatSatisfaction === 'very_positive' && state.totalAppOpens >= 5;
        
      case 'daily_picks_viewed':
        // Good moment after user has engaged with picks multiple times
        return (event.metadata?.picksViewed || 0) >= 10 && state.totalAppOpens >= 7;
        
      case 'winning_streak':
        // Excellent moment - user is on a winning streak
        return (event.metadata?.streakCount || 0) >= 3;
        
      case 'app_usage_milestone':
        // Good moment for consistent users
        return (event.metadata?.daysUsed || 0) >= 7 && state.positiveInteractions >= 5;
        
      default:
        return false;
    }
  }

  /**
   * Show the native App Store review prompt
   */
  private async showReviewPrompt(event: ReviewTriggerEvent, state: ReviewState): Promise<void> {
    try {
      console.log('🌟 Showing App Store review prompt for event:', event.eventType);
      
      // Update state to mark review as requested
      const updatedState: ReviewState = {
        ...state,
        hasRequestedReview: true,
        lastReviewRequestDate: new Date().toISOString()
      };
      
      await this.saveReviewState(updatedState);
      
      // Show native review prompt
      await StoreReview.requestReview();
      
      console.log('✅ App Store review prompt shown successfully');
      
    } catch (error) {
      console.error('❌ Failed to show review prompt:', error);
    }
  }

  /**
   * Get current review state from storage
   */
  private async getReviewState(): Promise<ReviewState> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Return default state for new users
      const defaultState: ReviewState = {
        hasRequestedReview: false,
        lastReviewRequestDate: null,
        reviewTriggerCount: 0,
        positiveInteractions: 0,
        lastPositiveInteraction: null,
        appInstallDate: new Date().toISOString(),
        totalAppOpens: 0
      };
      
      await this.saveReviewState(defaultState);
      return defaultState;
      
    } catch (error) {
      console.error('❌ Failed to get review state:', error);
      // Return safe default
      return {
        hasRequestedReview: false,
        lastReviewRequestDate: null,
        reviewTriggerCount: 0,
        positiveInteractions: 0,
        lastPositiveInteraction: null,
        appInstallDate: new Date().toISOString(),
        totalAppOpens: 0
      };
    }
  }

  /**
   * Save review state to storage
   */
  private async saveReviewState(state: ReviewState): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('❌ Failed to save review state:', error);
    }
  }

  /**
   * Get days since a specific date
   */
  private getDaysSince(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days since app install
   */
  private getDaysSinceInstall(installDate: string): number {
    return this.getDaysSince(installDate);
  }

  /**
   * Manual trigger for testing (dev only)
   */
  async forceShowReview(): Promise<void> {
    if (__DEV__) {
      console.log('🧪 Force showing review prompt (dev mode)');
      try {
        if (await StoreReview.hasAction()) {
          await StoreReview.requestReview();
        } else {
          console.log('📱 Store review not available');
        }
      } catch (error) {
        console.error('❌ Failed to force show review:', error);
      }
    }
  }

  /**
   * Reset review state (dev only)
   */
  async resetReviewState(): Promise<void> {
    if (__DEV__) {
      console.log('🧪 Resetting review state (dev mode)');
      await AsyncStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * Get current review statistics (for debugging)
   */
  async getReviewStats(): Promise<ReviewState> {
    return await this.getReviewState();
  }
}

export default ReviewService;
export type { ReviewTriggerEvent, ReviewState };
