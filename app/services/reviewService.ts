import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface ReviewTriggerEvent {
  eventType: 'successful_subscription' | 'welcome_wheel_win' | 'ai_chat_positive' | 'daily_picks_viewed' | 'winning_streak' | 'app_usage_milestone' | 'referral_success' | 'giveaway_entry' | 'tier_upgrade';
  metadata?: {
    streakCount?: number;
    daysUsed?: number;
    picksViewed?: number;
    wheelPrize?: number;
    chatSatisfaction?: 'positive' | 'very_positive';
    referralCount?: number;
    subscriptionTier?: string;
    upgradeFrom?: string;
    upgradeTo?: string;
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
  debugMode: boolean;
}

class ReviewService {
  private static instance: ReviewService;
  private readonly STORAGE_KEY = 'parley_review_state';
  private readonly MIN_DAYS_BETWEEN_REQUESTS = 30; // Reduced from 90 days for better testing
  private readonly MIN_POSITIVE_INTERACTIONS = 1; // Reduced from 3 for easier triggering
  private readonly MIN_DAYS_SINCE_INSTALL = 0; // Allow immediate reviews
  private readonly MAX_REVIEWS_PER_VERSION = 3; // Allow multiple attempts per version

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
      console.log('🔍 Checking review prompt conditions for event:', event.eventType);
      console.log('📊 Current state:', {
        hasRequestedReview: state.hasRequestedReview,
        positiveInteractions: state.positiveInteractions,
        totalAppOpens: state.totalAppOpens,
        daysSinceInstall: this.getDaysSinceInstall(state.appInstallDate)
      });

      // Check if review is available on this platform
      const hasAction = await StoreReview.hasAction();
      console.log('📱 StoreReview.hasAction():', hasAction);
      
      if (!hasAction && !__DEV__) {
        console.log('📱 Store review not available on this platform');
        return;
      }

      // Check minimum time since last request (if any) - but be more lenient
      if (state.lastReviewRequestDate) {
        const daysSinceLastRequest = this.getDaysSince(state.lastReviewRequestDate);
        if (daysSinceLastRequest < this.MIN_DAYS_BETWEEN_REQUESTS) {
          console.log(`📱 Too soon since last review request (${daysSinceLastRequest}/${this.MIN_DAYS_BETWEEN_REQUESTS} days)`);
          return;
        }
      }

      // Check minimum positive interactions - reduced requirement
      if (state.positiveInteractions < this.MIN_POSITIVE_INTERACTIONS) {
        console.log(`📱 Not enough positive interactions (${state.positiveInteractions}/${this.MIN_POSITIVE_INTERACTIONS})`);
        return;
      }

      // Check event-specific conditions for high-happiness moments
      const shouldShowForEvent = this.shouldShowReviewForEvent(event, state);
      console.log('🎯 Should show for event:', shouldShowForEvent);
      
      if (!shouldShowForEvent) {
        console.log('📱 Event conditions not met for review prompt');
        return;
      }

      // All conditions met - show review prompt!
      console.log('🌟 All conditions met - showing review prompt!');
      await this.showReviewPrompt(event, state);
      
    } catch (error) {
      console.error('❌ Failed to check review prompt conditions:', error);
    }
  }

  /**
   * Determine if this specific event should trigger a review prompt
   * SIMPLIFIED LOGIC - More generous conditions for better trigger rates
   */
  private shouldShowReviewForEvent(event: ReviewTriggerEvent, state: ReviewState): boolean {
    console.log('🎯 Checking event conditions for:', event.eventType, 'with metadata:', event.metadata);
    
    switch (event.eventType) {
      case 'successful_subscription':
        // Perfect moment - user just paid for premium
        console.log('💰 Subscription event - always show review');
        return true;
        
      case 'welcome_wheel_win':
        // Great moment - user just won free picks (any amount)
        const wheelPrize = event.metadata?.wheelPrize || 0;
        console.log('🎡 Wheel win event - prize:', wheelPrize);
        return wheelPrize >= 1; // Any win is good
        
      case 'ai_chat_positive':
        // Good moment for any positive chat experience
        console.log('💬 Chat positive event');
        return true; // Any positive chat is good enough
        
      case 'daily_picks_viewed':
        // Good moment after user views picks (lowered threshold)
        const picksViewed = event.metadata?.picksViewed || 0;
        console.log('📊 Picks viewed event - count:', picksViewed);
        return picksViewed >= 3; // Reduced from 10
        
      case 'winning_streak':
        // Excellent moment - user is on a winning streak (lowered threshold)
        const streakCount = event.metadata?.streakCount || 0;
        console.log('🏆 Winning streak event - count:', streakCount);
        return streakCount >= 2; // Reduced from 3
        
      case 'app_usage_milestone':
        // Good moment for consistent users (lowered threshold)
        const daysUsed = event.metadata?.daysUsed || 0;
        console.log('📅 Usage milestone event - days:', daysUsed);
        return daysUsed >= 3; // Reduced from 7
        
      case 'referral_success':
        // Excellent moment - user successfully referred someone
        console.log('👥 Referral success event');
        return true;
        
      case 'giveaway_entry':
        // Good moment - user just entered giveaway
        console.log('🎁 Giveaway entry event');
        return state.totalAppOpens >= 1; // Reduced from 3
        
      case 'tier_upgrade':
        // Perfect moment - user just upgraded subscription tier
        console.log('⬆️ Tier upgrade event');
        return event.metadata?.upgradeFrom !== event.metadata?.upgradeTo;
        
      default:
        console.log('❓ Unknown event type');
        return false;
    }
  }

  /**
   * Show the native App Store review prompt
   */
  private async showReviewPrompt(event: ReviewTriggerEvent, state: ReviewState): Promise<void> {
    try {
      console.log('🌟 Attempting to show App Store review prompt for event:', event.eventType);
      
      // In development, always log but only show if forced
      if (__DEV__) {
        console.log('🧪 DEV MODE: Review prompt would show here for event:', event.eventType);
        console.log('🧪 Use forceShowReview() to test the actual dialog');
      }
      
      // Update state to mark review as requested (increment counter instead of blocking)
      const updatedState: ReviewState = {
        ...state,
        reviewTriggerCount: state.reviewTriggerCount + 1,
        lastReviewRequestDate: new Date().toISOString(),
        debugMode: state.debugMode || __DEV__
      };
      
      await this.saveReviewState(updatedState);
      
      // Show native review prompt
      try {
        const hasAction = await StoreReview.hasAction();
        console.log('📱 Final hasAction check:', hasAction);
        
        if (hasAction || __DEV__) {
          await StoreReview.requestReview();
          console.log('✅ StoreReview.requestReview() called successfully');
          
          // Only mark as fully requested after successful show
          updatedState.hasRequestedReview = true;
          await this.saveReviewState(updatedState);
        } else {
          console.log('📱 StoreReview not available - skipping');
        }
      } catch (reviewError) {
        console.error('❌ StoreReview.requestReview() failed:', reviewError);
        // Don't mark as requested if it failed
      }
      
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
        totalAppOpens: 0,
        debugMode: __DEV__
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
        totalAppOpens: 0,
        debugMode: __DEV__
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
   * Manual trigger for testing (dev and production)
   */
  async forceShowReview(): Promise<void> {
    console.log('🧪 Force showing review prompt');
    try {
      const hasAction = await StoreReview.hasAction();
      console.log('📱 StoreReview.hasAction():', hasAction);
      
      if (hasAction) {
        console.log('📱 Calling StoreReview.requestReview()...');
        await StoreReview.requestReview();
        console.log('✅ StoreReview.requestReview() completed');
      } else {
        console.log('📱 Store review not available on this platform/device');
        console.log('📱 Platform:', Platform.OS);
        console.log('📱 This might happen in simulator or non-iOS devices');
      }
    } catch (error) {
      console.error('❌ Failed to force show review:', error);
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
