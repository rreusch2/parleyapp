import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Conditional import for native platforms only
let RewardedAd: any = null;
let RewardedAdEventType: any = null;
let TestIds: any = null;
let mobileAds: any = null;

if (Platform.OS !== 'web') {
  try {
    const GoogleMobileAds = require('react-native-google-mobile-ads');
    RewardedAd = GoogleMobileAds.RewardedAd;
    RewardedAdEventType = GoogleMobileAds.RewardedAdEventType;
    TestIds = GoogleMobileAds.TestIds;
    mobileAds = GoogleMobileAds.default; // Default export
  } catch (error) {
    console.log('AdMob not available on this platform');
  }
} else {
  // Mock objects for web platform
  TestIds = {
    REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  };
  RewardedAdEventType = {
    LOADED: 'loaded',
    EARNED_REWARD: 'rewarded',
  };
}

// AdMob Configuration
const ADMOB_CONFIG = {
  // Use test ads in development, real ads in production
  USE_TEST_ADS: __DEV__,
  
  // Your real ad unit IDs (from app.config.js extra section)
  REAL_REWARD_AD_UNIT_ID: Constants.expoConfig?.extra?.admobRewardAdUnitId || 'ca-app-pub-9584826565591456/9182858395',
  
  // Test ad unit IDs (provided by Google)
  TEST_REWARD_AD_UNIT_ID: TestIds?.REWARDED || 'ca-app-pub-3940256099942544/5224354917',
};

// Get the appropriate ad unit ID based on configuration
const getRewardAdUnitId = (): string => {
  return ADMOB_CONFIG.USE_TEST_ADS 
    ? ADMOB_CONFIG.TEST_REWARD_AD_UNIT_ID 
    : ADMOB_CONFIG.REAL_REWARD_AD_UNIT_ID;
};

// Reward Ad Class
class AdMobService {
  private rewardedAd: any = null;
  private isAdLoaded = false;
  private isAdLoading = false;
  private rewardCallbacks: (() => void)[] = [];
  private isInitialized = false;

  constructor() {
    this.initializeSDK();
  }

  private async initializeSDK() {
    // Skip initialization on web platform
    if (Platform.OS === 'web' || !mobileAds) {
      console.log('🌐 AdMob not available on web platform');
      return;
    }

    try {
      console.log('🚀 Initializing Google Mobile Ads SDK...');
      await mobileAds().initialize();
      this.isInitialized = true;
      console.log('✅ Google Mobile Ads SDK initialized');
      
      // Now initialize the rewarded ad
      this.initializeRewardedAd();
    } catch (error) {
      console.error('❌ Error initializing Google Mobile Ads SDK:', error);
    }
  }

  private initializeRewardedAd() {
    // Skip initialization on web platform or if SDK not initialized
    if (Platform.OS === 'web' || !RewardedAd || !this.isInitialized) {
      return;
    }

    try {
      const adUnitId = getRewardAdUnitId();
      console.log(`🎬 Initializing AdMob with ${ADMOB_CONFIG.USE_TEST_ADS ? 'TEST' : 'PRODUCTION'} ads`);
      console.log(`Ad Unit ID: ${adUnitId}`);
      
      this.rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      // Set up event listeners
      this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('✅ Reward ad loaded successfully');
        this.isAdLoaded = true;
        this.isAdLoading = false;
      });

      this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward: any) => {
        console.log('🎉 User earned reward:', reward);
        this.isAdLoaded = false;
        
        // Call all registered reward callbacks
        this.rewardCallbacks.forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error('Error in reward callback:', error);
          }
        });
        
        // Clear callbacks after use
        this.rewardCallbacks = [];
        
        // Preload next ad
        setTimeout(() => this.loadRewardedAd(), 1000);
      });

      this.rewardedAd.addAdEventListener(RewardedAdEventType.ERROR, (error: any) => {
        console.error('❌ Reward ad error:', error);
        this.isAdLoading = false;
        this.isAdLoaded = false;
      });

      this.rewardedAd.addAdEventListener(RewardedAdEventType.OPENED, () => {
        console.log('📱 Reward ad opened');
      });

      this.rewardedAd.addAdEventListener(RewardedAdEventType.CLOSED, () => {
        console.log('🔒 Reward ad closed');
        this.isAdLoaded = false;
        // Preload next ad
        setTimeout(() => this.loadRewardedAd(), 1000);
      });

      // Load the first ad
      setTimeout(() => this.loadRewardedAd(), 1000);
    } catch (error) {
      console.error('❌ Error initializing AdMob:', error);
    }
  }

  public loadRewardedAd() {
    // Skip on web platform or if not initialized
    if (Platform.OS === 'web' || !this.rewardedAd || !this.isInitialized) {
      return;
    }

    if (this.isAdLoading || this.isAdLoaded) {
      return;
    }

    console.log('🔄 Loading reward ad...');
    this.isAdLoading = true;
    
    try {
      this.rewardedAd.load();
    } catch (error) {
      console.error('❌ Error loading reward ad:', error);
      this.isAdLoading = false;
    }
  }

  public async showRewardedAd(onRewardEarned?: () => void): Promise<boolean> {
    // Skip on web platform
    if (Platform.OS === 'web') {
      console.log('🌐 Ads not available on web platform');
      return false;
    }

    try {
      if (!this.rewardedAd || !this.isAdLoaded) {
        console.log('⚠️ Reward ad not ready, attempting to load...');
        this.loadRewardedAd();
        return false;
      }

      // Register the reward callback if provided
      if (onRewardEarned) {
        this.rewardCallbacks.push(onRewardEarned);
      }

      console.log('🎬 Showing reward ad...');
      await this.rewardedAd.show();
      return true;
    } catch (error) {
      console.error('❌ Error showing reward ad:', error);
      // Remove the callback if ad failed to show
      if (onRewardEarned) {
        const index = this.rewardCallbacks.indexOf(onRewardEarned);
        if (index > -1) {
          this.rewardCallbacks.splice(index, 1);
        }
      }
      return false;
    }
  }

  public isRewardedAdReady(): boolean {
    // Always return false on web platform
    if (Platform.OS === 'web') {
      return false;
    }
    return this.isAdLoaded && this.rewardedAd !== null;
  }

  public getAdType(): 'TEST' | 'PRODUCTION' {
    return ADMOB_CONFIG.USE_TEST_ADS ? 'TEST' : 'PRODUCTION';
  }
}

// Export singleton instance
export const admobService = new AdMobService();

// Export configuration for easy checking
export { ADMOB_CONFIG }; 