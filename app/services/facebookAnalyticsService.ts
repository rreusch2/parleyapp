import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import { Platform } from 'react-native';

interface EventParameters {
  [key: string]: string | number;
}

class FacebookAnalyticsService {
  private static instance: FacebookAnalyticsService;
  private isInitialized = false;

  static getInstance(): FacebookAnalyticsService {
    if (!FacebookAnalyticsService.instance) {
      FacebookAnalyticsService.instance = new FacebookAnalyticsService();
    }
    return FacebookAnalyticsService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔥 Facebook Analytics already initialized');
      return;
    }

    try {
      // Enable auto-logging of app events
      Settings.setAutoLogAppEventsEnabled(true);
      
      // Enable advertiser tracking (iOS 14.5+)
      if (Platform.OS === 'ios') {
        Settings.setAdvertiserTrackingEnabled(true);
      }

      this.isInitialized = true;
      console.log('✅ Facebook Analytics initialized successfully');
    } catch (error) {
      console.error('❌ Facebook Analytics initialization failed:', error);
      throw error;
    }
  }

  // CORE CONVERSION EVENTS

  /**
   * Track app installation - automatically handled by Facebook SDK
   */
  trackAppInstall(): void {
    console.log('📱 App Install tracked automatically by Facebook SDK');
  }

  /**
   * Track user registration/signup
   */
  trackCompleteRegistration(parameters?: EventParameters): void {
    try {
      AppEventsLogger.logEvent('CompleteRegistration', {
        fb_registration_method: 'email',
        fb_content_name: 'Account Signup',
        ...parameters
      });
      console.log('✅ Complete Registration tracked');
    } catch (error) {
      console.error('❌ Failed to track Complete Registration:', error);
    }
  }

  /**
   * Track subscription purchase
   */
  trackPurchase(value: number, currency: string = 'USD', parameters?: EventParameters): void {
    try {
      AppEventsLogger.logPurchase(value, currency, {
        fb_content_type: 'subscription',
        fb_content_name: 'Pro Subscription',
        fb_num_items: 1,
        ...parameters
      });
      console.log(`✅ Purchase tracked: $${value} ${currency}`);
    } catch (error) {
      console.error('❌ Failed to track Purchase:', error);
    }
  }

  /**
   * Track when user views daily picks content
   */
  trackViewContent(contentName: string, parameters?: EventParameters): void {
    try {
      AppEventsLogger.logEvent('ViewContent', {
        fb_content_type: 'predictions',
        fb_content_name: contentName,
        fb_content_category: 'daily_picks',
        ...parameters
      });
      console.log(`✅ View Content tracked: ${contentName}`);
    } catch (error) {
      console.error('❌ Failed to track View Content:', error);
    }
  }

  /**
   * Track when user opens subscription modal (intent to purchase)
   */
  trackAddToCart(subscriptionTier: string, value: number, parameters?: EventParameters): void {
    try {
      AppEventsLogger.logEvent('AddToCart', {
        fb_content_type: 'subscription',
        fb_content_name: subscriptionTier,
        fb_currency: 'USD',
        fb_value: value,
        ...parameters
      });
      console.log(`✅ Add To Cart tracked: ${subscriptionTier} - $${value}`);
    } catch (error) {
      console.error('❌ Failed to track Add To Cart:', error);
    }
  }

  // CUSTOM EVENTS FOR PARLEYAPP

  /**
   * Track welcome bonus claim from spinning wheel
   */
  trackWelcomeBonusClaimed(picksWon: number): void {
    try {
      AppEventsLogger.logEvent('WelcomeBonusClaimed', {
        picks_won: picksWon,
        event_category: 'onboarding',
        fb_content_name: 'Welcome Bonus'
      });
      console.log(`✅ Welcome Bonus Claimed tracked: ${picksWon} picks`);
    } catch (error) {
      console.error('❌ Failed to track Welcome Bonus Claimed:', error);
    }
  }

  /**
   * Track Professor Lock chat usage
   */
  trackChatUsage(messageCount: number, userTier: string): void {
    try {
      AppEventsLogger.logEvent('ChatUsage', {
        message_count: messageCount,
        user_tier: userTier,
        event_category: 'engagement',
        fb_content_name: 'Professor Lock Chat'
      });
      console.log(`✅ Chat Usage tracked: ${messageCount} messages`);
    } catch (error) {
      console.error('❌ Failed to track Chat Usage:', error);
    }
  }

  /**
   * Track daily app return (retention metric)
   */
  trackDailyReturn(daysStreak: number): void {
    try {
      AppEventsLogger.logEvent('DailyReturn', {
        days_streak: daysStreak,
        event_category: 'retention',
        fb_content_name: 'Daily App Open'
      });
      console.log(`✅ Daily Return tracked: ${daysStreak} day streak`);
    } catch (error) {
      console.error('❌ Failed to track Daily Return:', error);
    }
  }

  /**
   * Track subscription cancellation
   */
  trackSubscriptionCancelled(reason?: string): void {
    try {
      AppEventsLogger.logEvent('SubscriptionCancelled', {
        cancellation_reason: reason || 'unknown',
        event_category: 'churn',
        fb_content_name: 'Subscription Cancelled'
      });
      console.log('✅ Subscription Cancelled tracked');
    } catch (error) {
      console.error('❌ Failed to track Subscription Cancelled:', error);
    }
  }

  /**
   * Track trial start
   */
  trackTrialStart(trialType: string, trialDuration: number): void {
    try {
      AppEventsLogger.logEvent('StartTrial', {
        fb_content_name: trialType,
        trial_duration_days: trialDuration,
        event_category: 'trial',
        fb_predicted_ltv: 50 // Estimated LTV for optimization
      });
      console.log(`✅ Trial Start tracked: ${trialType} for ${trialDuration} days`);
    } catch (error) {
      console.error('❌ Failed to track Trial Start:', error);
    }
  }

  // UTILITY METHODS

  /**
   * Set user properties for better targeting
   */
  setUserProperties(properties: { [key: string]: string }): void {
    try {
      AppEventsLogger.setUserData(properties);
      console.log('✅ User properties set for Facebook targeting');
    } catch (error) {
      console.error('❌ Failed to set user properties:', error);
    }
  }

  /**
   * Track custom event with parameters
   */
  trackCustomEvent(eventName: string, parameters?: EventParameters): void {
    try {
      AppEventsLogger.logEvent(eventName, parameters);
      console.log(`✅ Custom event tracked: ${eventName}`);
    } catch (error) {
      console.error(`❌ Failed to track custom event ${eventName}:`, error);
    }
  }
}

export default FacebookAnalyticsService.getInstance();
