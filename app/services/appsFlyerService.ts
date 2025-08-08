import appsFlyer from 'react-native-appsflyer';
import { Platform } from 'react-native';

class AppsFlyerService {
  private static instance: AppsFlyerService;
  private isInitialized = false;

  // Your AppsFlyer credentials from the setup
  private readonly DEV_KEY = 'NgBrVqoMhaRVeeaekgT9xX';
  private readonly APP_ID = 'id6748275790'; // iOS App ID
  private readonly ANDROID_PACKAGE = 'com.parleyapp.mobile'; // Android package name

  static getInstance(): AppsFlyerService {
    if (!AppsFlyerService.instance) {
      AppsFlyerService.instance = new AppsFlyerService();
    }
    return AppsFlyerService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔥 AppsFlyer already initialized');
      return;
    }

    try {
      // Configure AppsFlyer
      const options = {
        devKey: this.DEV_KEY,
        isDebug: __DEV__, // Enable debug mode in development
        appId: Platform.OS === 'ios' ? this.APP_ID : this.ANDROID_PACKAGE,
        onInstallConversionDataListener: true, // Required for attribution
        onDeepLinkListener: true, // Required for deep linking
        timeToWaitForATTUserAuthorization: 10, // iOS 14+ ATT timeout
      };

      console.log('🚀 Initializing AppsFlyer with options:', options);

      // Initialize AppsFlyer
      await appsFlyer.initSdk(options);
      
      this.isInitialized = true;
      console.log('✅ AppsFlyer initialized successfully');

      // Set up conversion data listener
      this.setupConversionDataListener();
      
      // Set up deep link listener
      this.setupDeepLinkListener();

    } catch (error) {
      console.error('❌ AppsFlyer initialization failed:', error);
      throw error;
    }
  }

  private setupConversionDataListener(): void {
    appsFlyer.onInstallConversionData((data) => {
      console.log('📊 AppsFlyer Install Conversion Data:', JSON.stringify(data, null, 2));
      
      if (data.type === 'onInstallConversionDataLoaded') {
        // This is where you get attribution data for new installs
        const conversionData = data.data;
        
        // Track TikTok attribution
        if (conversionData.media_source === 'tiktokforbusiness_int') {
          console.log('🎯 TikTok attribution detected!');
          this.handleTikTokAttribution(conversionData);
        }
        
        // Store attribution data for analytics
        this.storeAttributionData(conversionData);
      }
    });
  }

  private setupDeepLinkListener(): void {
    appsFlyer.onDeepLink((data) => {
      console.log('🔗 AppsFlyer Deep Link:', JSON.stringify(data, null, 2));
      
      if (data.type === 'onDeepLinking') {
        // Handle deep link data
        const deepLinkData = data.data;
        // You can navigate to specific screens based on deep link parameters
      }
    });
  }

  private handleTikTokAttribution(conversionData: any): void {
    console.log('🎯 Processing TikTok attribution:', conversionData);
    
    // Extract TikTok campaign data
    const tiktokData = {
      campaign: conversionData.campaign || 'unknown',
      adgroup: conversionData.adgroup || 'unknown',
      creative: conversionData.creative || 'unknown',
      media_source: conversionData.media_source,
      install_time: conversionData.install_time,
    };

    // You can send this to your analytics or backend
    this.trackTikTokInstall(tiktokData);
  }

  private async storeAttributionData(data: any): Promise<void> {
    try {
      // Store attribution data in AsyncStorage or send to your backend
      console.log('💾 Storing attribution data:', data);
      
      // Example: Send to your backend for analysis
      // await this.sendAttributionToBackend(data);
      
    } catch (error) {
      console.error('❌ Failed to store attribution data:', error);
    }
  }

  // Track custom events for TikTok optimization
  async trackEvent(eventName: string, eventValues?: Record<string, any>): Promise<void> {
    if (!this.isInitialized) {
      console.warn('⚠️ AppsFlyer not initialized, skipping event:', eventName);
      return;
    }

    try {
      console.log(`📈 Tracking AppsFlyer event: ${eventName}`, eventValues);
      await appsFlyer.logEvent(eventName, eventValues || {});
    } catch (error) {
      console.error(`❌ Failed to track event ${eventName}:`, error);
    }
  }

  // Predefined events for sports betting app
  async trackSubscription(plan: string, revenue: number): Promise<void> {
    await this.trackEvent('af_purchase', {
      af_revenue: revenue,
      af_currency: 'USD',
      subscription_plan: plan,
      af_content_type: 'subscription',
    });
  }

  async trackSignup(method: string): Promise<void> {
    await this.trackEvent('af_complete_registration', {
      af_registration_method: method,
    });
  }

  async trackPredictionView(): Promise<void> {
    await this.trackEvent('af_content_view', {
      af_content_type: 'prediction',
    });
  }

  async trackTikTokInstall(data: any): Promise<void> {
    await this.trackEvent('tiktok_install', {
      campaign: data.campaign,
      adgroup: data.adgroup,
      creative: data.creative,
      media_source: data.media_source,
    });
  }

  // Get AppsFlyer ID for advanced tracking
  getAppsFlyerId(): Promise<string | null> {
    return new Promise((resolve) => {
      appsFlyer.getAppsFlyerUID((error: Error | null, uid: string) => {
        if (error) {
          console.error('❌ Failed to get AppsFlyer ID:', error);
          resolve(null);
        } else {
          console.log('🆔 AppsFlyer ID:', uid);
          resolve(uid);
        }
      });
    });
  }

  // Enable/disable debug mode (removed - not available in this version)
  // setDebugMode method is not available in react-native-appsflyer
  // Debug mode is controlled via initSdk options instead
}

export default AppsFlyerService.getInstance();
