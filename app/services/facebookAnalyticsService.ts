import { Platform } from 'react-native';

// Conditional imports for platform compatibility
let AppEventsLogger: any = null;
let Settings: any = null;

// Only import Facebook SDK on mobile platforms
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    const FBSDK = require('react-native-fbsdk-next');
    AppEventsLogger = FBSDK.AppEventsLogger;
    Settings = FBSDK.Settings;
  } catch (error) {
    console.warn('Facebook SDK not available on this platform:', error);
  }
}

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
      // Only initialize on mobile platforms where Facebook SDK is available
      if (Platform.OS === 'web') {
        console.log('📱 Facebook Analytics disabled on web platform');
        this.isInitialized = true;
        return;
      }

      if (!Settings || !AppEventsLogger) {
        console.warn('📱 Facebook SDK not available, analytics disabled');
        this.isInitialized = true;
        return;
      }

      // Initialize Facebook SDK as early as possible (required on iOS >= v9)
      // This aligns with react-native-fbsdk-next guidance and ensures AEM & app events work
      try {
        // Set identity info (optional but helps ensure the correct app config)
        if (Settings.setAppID) {
          Settings.setAppID('1019527860059930');
        }
        if (Settings.setAppName) {
          Settings.setAppName('Predictive Play');
        }
        if (Settings.initializeSDK) {
          Settings.initializeSDK();
        }
      } catch (e) {
        console.warn('⚠️ FB Settings initializeSDK failed (continuing):', e);
      }

      // Enable auto-logging of app events
      Settings.setAutoLogAppEventsEnabled(true);
      
      // Enable advertiser tracking (iOS 14.5+)
      if (Platform.OS === 'ios') {
        // Must be called AFTER user grants ATT. We request ATT in app/_layout.tsx.
        // If user denied, the SDK will ignore enabling.
        try {
          Settings.setAdvertiserTrackingEnabled(true);
        } catch (e) {
          console.warn('⚠️ Unable to enable advertiser tracking (ATT likely denied):', e);
        }
      }

      this.isInitialized = true;
      console.log('✅ Facebook Analytics initialized successfully');
    } catch (error) {
      console.error('❌ Facebook Analytics initialization failed:', error);
      // Don't throw error - just disable analytics
      this.isInitialized = true;
    }
  }

  // CORE CONVERSION EVENTS

  /**
   * Helper method to check if Facebook SDK is available
   */
  private isFacebookAvailable(): boolean {
    return Platform.OS !== 'web' && AppEventsLogger && Settings;
  }

  /**
   * Track app installation - automatically handled by Facebook SDK
   */
  trackAppInstall(): void {
    if (!this.isFacebookAvailable()) {
      console.log('📱 App Install tracking skipped (web platform)');
      return;
    }
    console.log('📱 App Install tracked automatically by Facebook SDK');
  }

  /**
   * Track user registration/signup
   */
  trackCompleteRegistration(parameters?: EventParameters): void {
    if (!this.isFacebookAvailable()) {
      console.log('📱 Complete Registration tracking skipped (web platform)');
      return;
    }
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
    if (!this.isFacebookAvailable()) {
      console.log(`📱 Purchase tracking skipped (web platform): $${value} ${currency}`);
      return;
    }
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
    if (!this.isFacebookAvailable()) {
      console.log(`📱 View Content tracking skipped (web platform): ${contentName}`);
      return;
    }
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
    if (!this.isFacebookAvailable()) {
      console.log(`📱 Add To Cart tracking skipped (web platform): ${subscriptionTier} - $${value}`);
      return;
    }
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
    if (!this.isFacebookAvailable()) {
      console.log(`📱 Welcome Bonus Claimed tracking skipped (web platform): ${picksWon} picks`);
      return;
    }
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
    if (!this.isFacebookAvailable()) {
      console.log(`📱 Chat Usage tracking skipped (web platform): ${messageCount} messages`);
      return;
    }
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
    if (!this.isFacebookAvailable()) {
      console.log(`📱 Daily Return tracking skipped (web platform): ${daysStreak} day streak`);
      return;
    }
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
    if (!this.isFacebookAvailable()) {
      console.log('📱 Subscription Cancelled tracking skipped (web platform)');
      return;
    }
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
    if (!this.isFacebookAvailable()) {
      console.log(`📱 Trial Start tracking skipped (web platform): ${trialType} for ${trialDuration} days`);
      return;
    }
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
    if (!this.isFacebookAvailable()) {
      console.log('📱 User properties setting skipped (web platform)');
      return;
    }
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
    if (!this.isFacebookAvailable()) {
      console.log(`📱 Custom event tracking skipped (web platform): ${eventName}`);
      return;
    }
    try {
      AppEventsLogger.logEvent(eventName, parameters);
      console.log(`✅ Custom event tracked: ${eventName}`);
    } catch (error) {
      console.error(`❌ Failed to track custom event ${eventName}:`, error);
    }
  }
}

export default FacebookAnalyticsService.getInstance();
