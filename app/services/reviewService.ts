import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';

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
  // New fields (migration-safe)
  appVersion?: string;                 // App version the counters belong to
  autoRequestCount?: number;           // Count of automatic native prompts requested this version
  autoLastRequestDate?: string | null; // Last time we attempted an automatic native prompt
  manualLastRequestDate?: string | null; // Last time user manually requested review (Settings)
}

class ReviewService {
  private static instance: ReviewService;
  private readonly STORAGE_KEY = 'parley_review_state';
  private readonly MIN_DAYS_BETWEEN_REQUESTS = 60; // Reduced from 90 days
  private readonly MIN_POSITIVE_INTERACTIONS = 1; // Reduced from 3 to 1
  private readonly MIN_DAYS_SINCE_INSTALL = 0; // Allow immediate reviews for testing
  private readonly MAX_REVIEWS_PER_VERSION = 3; // Allow up to 3 review requests per version
  private readonly APP_STORE_REVIEW_URL = 'https://apps.apple.com/app/id6748275790?action=write-review';

  /** Get current app version in a safe way (works in Expo) */
  private getCurrentAppVersion(): string {
    try {
      const v = (Constants as any)?.expoConfig?.version;
      return typeof v === 'string' && v.length > 0 ? v : 'dev';
    } catch {
      return 'dev';
    }
  }

  /** Ensure the stored state has all new fields and sane defaults */
  private normalizeState(state: ReviewState): ReviewState {
    const currentVersion = this.getCurrentAppVersion();
    const normalized: ReviewState = {
      ...state,
      appVersion: state.appVersion ?? currentVersion,
      autoRequestCount: state.autoRequestCount ?? 0,
      autoLastRequestDate: state.autoLastRequestDate ?? state.lastReviewRequestDate ?? null,
      manualLastRequestDate: state.manualLastRequestDate ?? null,
    };
    return normalized;
  }

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
      const existing = await this.getReviewState();
      const currentVersion = this.getCurrentAppVersion();
      let updatedState = this.normalizeState(existing);

      // Reset counters if app version changed (per-version cap)
      if (updatedState.appVersion !== currentVersion) {
        console.log('🆕 App version changed for review system', {
          from: updatedState.appVersion,
          to: currentVersion,
        });
        updatedState = {
          ...updatedState,
          appVersion: currentVersion,
          autoRequestCount: 0,
          autoLastRequestDate: null,
          // Keep manual history, but clear legacy fields for safety
          lastReviewRequestDate: null,
          reviewTriggerCount: 0,
          hasRequestedReview: false,
        };
      }

      // Increment app opens counter
      updatedState = {
        ...updatedState,
        totalAppOpens: (updatedState.totalAppOpens || 0) + 1,
      };

      await this.saveReviewState(updatedState);

      console.log('📱 Review Service initialized:', {
        version: updatedState.appVersion,
        totalOpens: updatedState.totalAppOpens,
        positiveInteractions: updatedState.positiveInteractions,
        daysSinceInstall: this.getDaysSinceInstall(updatedState.appInstallDate),
        autoRequestCount: updatedState.autoRequestCount,
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
        // IMPORTANT: Do NOT increment review request counters here.
        // Apple may suppress the dialog; we only count when we actually call requestReview.
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

      const autoCount = state.autoRequestCount ?? 0;
      // Check if we've hit the maximum automatic requests per version
      if (autoCount >= this.MAX_REVIEWS_PER_VERSION) {
        console.log(`📱 Maximum auto review requests reached (${autoCount}/${this.MAX_REVIEWS_PER_VERSION})`);
        return;
      }

      // Check minimum time since last request (if any)
      const lastAuto = state.autoLastRequestDate ?? state.lastReviewRequestDate;
      if (lastAuto) {
        const daysSinceLastRequest = this.getDaysSince(lastAuto);
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
        // Great moment - user just won free picks (lowered threshold)
        return event.metadata?.wheelPrize && event.metadata.wheelPrize >= 1;
        
      case 'ai_chat_positive':
        // Good moment if user had positive chat experience (lowered requirements)
        return event.metadata?.chatSatisfaction === 'very_positive' || state.totalAppOpens >= 2;
        
      case 'daily_picks_viewed':
        // Good moment after user has engaged with picks (lowered threshold)
        return (event.metadata?.picksViewed || 0) >= 3 && state.totalAppOpens >= 2;
        
      case 'winning_streak':
        // Excellent moment - user is on a winning streak (lowered threshold)
        return (event.metadata?.streakCount || 0) >= 2;
        
      case 'app_usage_milestone':
        // Good moment for consistent users (lowered requirements)
        return (event.metadata?.daysUsed || 0) >= 3 && state.positiveInteractions >= 1;
        
      case 'referral_success':
        // Excellent moment - user successfully referred someone
        return (event.metadata?.referralCount || 0) >= 1;
        
      case 'giveaway_entry':
        // Good moment - user just entered giveaway (lowered threshold)
        return state.totalAppOpens >= 1;
        
      case 'tier_upgrade':
        // Perfect moment - user just upgraded subscription tier
        return event.metadata?.upgradeFrom !== event.metadata?.upgradeTo;
        
      default:
        return true; // Allow any other positive interactions to trigger review
    }
  }

  /**
   * Show the native App Store review prompt
   */
  private async showReviewPrompt(event: ReviewTriggerEvent, state: ReviewState): Promise<void> {
    try {
      console.log('🌟 Showing App Store review prompt for event:', event.eventType);
      
      // Update state to track this review request
      const updatedState: ReviewState = {
        ...state,
        hasRequestedReview: true,
        // Maintain legacy field for backward compatibility (not used for gating anymore)
        lastReviewRequestDate: new Date().toISOString(),
        // Increment per-version automatic counter and timestamp
        autoRequestCount: (state.autoRequestCount ?? 0) + 1,
        autoLastRequestDate: new Date().toISOString(),
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
        const parsed = JSON.parse(stored) as ReviewState;
        // Migrate to include new fields while preserving history
        const normalized = this.normalizeState(parsed);
        // Also, if stored version differs, don't reset here (handled in initialize) – just annotate
        return normalized;
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
        appVersion: this.getCurrentAppVersion(),
        autoRequestCount: 0,
        autoLastRequestDate: null,
        manualLastRequestDate: null,
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
        appVersion: this.getCurrentAppVersion(),
        autoRequestCount: 0,
        autoLastRequestDate: null,
        manualLastRequestDate: null,
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
   * Manual review trigger for users (production safe)
   */
  async showManualReview(): Promise<boolean> {
    try {
      console.log('⭐ Manual review requested by user');
      
      // Fetch state and enforce a short manual-only cooldown (7 days)
      const state = await this.getReviewState();
      const lastManual = state.manualLastRequestDate;
      if (lastManual) {
        const daysSinceLastManual = this.getDaysSince(lastManual);
        if (daysSinceLastManual < 7) {
          console.log(`📱 Manual review blocked - too recent (${daysSinceLastManual} days ago)`);
          return false;
        }
      }

      const hasAction = await StoreReview.hasAction();
      // If native prompt isn't available (e.g., TestFlight), fall back to App Store write-review page
      if (!hasAction) {
        if (Platform.OS === 'ios') {
          try {
            await Linking.openURL(this.APP_STORE_REVIEW_URL);
            const updatedState: ReviewState = {
              ...state,
              hasRequestedReview: true,
              manualLastRequestDate: new Date().toISOString(),
              // Do not touch auto counters or lastReviewRequestDate to avoid blocking auto prompts
              positiveInteractions: state.positiveInteractions + 1,
            };
            await this.saveReviewState(updatedState);
            console.log('✅ Opened App Store write-review page as fallback');
            return true;
          } catch (e) {
            console.error('❌ Failed to open App Store review URL:', e);
            return false;
          }
        }
        console.log('📱 Store review not available on this platform');
        return false;
      }

      // Native prompt is available - show it and update state
      await StoreReview.requestReview();
      const updatedState: ReviewState = {
        ...state,
        hasRequestedReview: true,
        manualLastRequestDate: new Date().toISOString(),
        // Do not affect auto counters; manual prompt shouldn't block future auto prompts
        positiveInteractions: state.positiveInteractions + 1,
      };
      await this.saveReviewState(updatedState);
      console.log('✅ Manual App Store review shown successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to show manual review:', error);
      return false;
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
