import { Platform } from 'react-native';

// Safe AdMob imports for production builds
let AdMobModule: any = null;
let isAdMobAvailable = false;

// Only attempt to load AdMob on native platforms
if (Platform.OS !== 'web') {
  try {
    AdMobModule = require('react-native-google-mobile-ads');
    // Verify the module has the required exports
    if (AdMobModule && AdMobModule.RewardedAd && AdMobModule.default) {
      isAdMobAvailable = true;
      console.log('✅ AdMob module loaded successfully');
    } else {
      console.log('⚠️ AdMob module incomplete, disabling ads');
      isAdMobAvailable = false;
    }
  } catch (error) {
    console.log('⚠️ AdMob not available, disabling ads:', error?.message || error);
    isAdMobAvailable = false;
    AdMobModule = null;
  }
} else {
  console.log('🌐 Web platform detected, ads disabled');
}

// Export AdMob components safely with fallbacks
export const RewardedAd = isAdMobAvailable && AdMobModule ? AdMobModule.RewardedAd : null;
export const RewardedAdEventType = isAdMobAvailable && AdMobModule ? AdMobModule.RewardedAdEventType : {
  LOADED: 'loaded',
  EARNED_REWARD: 'earned_reward',
  ERROR: 'error',
  OPENED: 'opened',
  CLOSED: 'closed',
};
export const TestIds = isAdMobAvailable && AdMobModule ? AdMobModule.TestIds : {
  REWARDED: 'ca-app-pub-3940256099942544/1712485313', // iOS test rewarded ad unit ID
};
export const mobileAds = isAdMobAvailable && AdMobModule ? AdMobModule.default : null;

// Global SDK initialization state
let isSDKInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Single SDK initialization function
export async function initializeAdMobSDK(): Promise<boolean> {
  if (Platform.OS === 'web' || !isAdMobAvailable || !mobileAds) {
    return false;
  }

  if (isSDKInitialized) {
    return true;
  }

  if (initializationPromise) {
    try {
      await initializationPromise;
      return isSDKInitialized;
    } catch {
      return false;
    }
  }

  initializationPromise = (async () => {
    try {
      console.log('🚀 Initializing Google Mobile Ads SDK...');
      if (!mobileAds) {
        throw new Error('Mobile Ads module not available');
      }
      
      // Simple initialization - start the SDK
      await mobileAds().initialize();
      isSDKInitialized = true;
      console.log('✅ Google Mobile Ads SDK initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Google Mobile Ads SDK:', error?.message || error);
      isSDKInitialized = false;
      // Don't throw in production to prevent app crashes
      if (__DEV__) {
        throw error;
      }
    }
  })();

  try {
    await initializationPromise;
    return isSDKInitialized;
  } catch {
    return false;
  }
}

// Check if AdMob is available and initialized
export function isAdMobReady(): boolean {
  return isAdMobAvailable && isSDKInitialized;
}

// Get appropriate ad unit ID
export function getRewardAdUnitId(): string {
  // Always use test ads for development and TestFlight builds
  // Only use production ads when explicitly building for App Store release
  const useTestAds = __DEV__ || !Constants.isDevice || Constants.debugMode;
  
  if (useTestAds) {
    console.log('🟡 Using TEST AdMob ads for development/TestFlight');
    return TestIds.REWARDED; // ca-app-pub-3940256099942544/1712485313
  } else {
    console.log('🟢 Using PRODUCTION AdMob ads');
    return 'ca-app-pub-9584826565591456/9182858395'; // Your production rewarded ad unit ID
  }
}

export { isAdMobAvailable };