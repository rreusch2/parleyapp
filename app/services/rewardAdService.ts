import { 
  AdMobRewarded, 
  setTestDeviceIDAsync,
  AdMobBanner,
  AdMobInterstitial,
} from 'expo-ads-admob';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Test ad unit IDs for development
const TEST_REWARD_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';

// Production ad unit IDs from your AdMob account
const PRODUCTION_REWARD_AD_UNIT_ID = Constants.expoConfig?.extra?.admobRewardAdUnitId || 'ca-app-pub-9584826565591456/9182858395';

// Use test ads in development, production ads in production
const REWARD_AD_UNIT_ID = __DEV__ ? TEST_REWARD_AD_UNIT_ID : PRODUCTION_REWARD_AD_UNIT_ID;

export interface AdReward {
  type: string;
  amount: number;
}

export interface RewardAdCallbacks {
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: string) => void;
  onAdOpened?: () => void;
  onAdClosed?: () => void;
  onRewarded?: (reward: AdReward) => void;
  onAdFailedToShow?: (error: string) => void;
}

class RewardAdService {
  private isLoaded = false;
  private isLoading = false;
  private callbacks: RewardAdCallbacks = {};

  async initialize() {
    try {
      // Set test device for development
      if (__DEV__) {
        await setTestDeviceIDAsync('EMULATOR');
      }

      // Load the first ad
      await this.loadAd();
      
      console.log('✅ RewardAdService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RewardAdService:', error);
    }
  }

  async loadAd(callbacks?: RewardAdCallbacks): Promise<void> {
    if (this.isLoading || this.isLoaded) {
      return;
    }

    try {
      this.isLoading = true;
      this.callbacks = callbacks || {};

      console.log('📱 Loading reward ad...', REWARD_AD_UNIT_ID);

      await AdMobRewarded.setAdUnitID(REWARD_AD_UNIT_ID);
      await AdMobRewarded.requestAdAsync();

      this.isLoaded = true;
      this.isLoading = false;

      console.log('✅ Reward ad loaded successfully');
      this.callbacks.onAdLoaded?.();

    } catch (error) {
      this.isLoading = false;
      this.isLoaded = false;
      
      console.error('❌ Failed to load reward ad:', error);
      this.callbacks.onAdFailedToLoad?.(error?.toString() || 'Unknown error');
    }
  }

  async showAd(callbacks?: RewardAdCallbacks): Promise<boolean> {
    try {
      if (!this.isLoaded) {
        console.warn('⚠️ Reward ad not loaded yet. Loading now...');
        await this.loadAd(callbacks);
        
        if (!this.isLoaded) {
          console.error('❌ Failed to load ad for showing');
          callbacks?.onAdFailedToShow?.('Ad not loaded');
          return false;
        }
      }

      // Merge callbacks
      this.callbacks = { ...this.callbacks, ...callbacks };

      console.log('🎬 Showing reward ad...');

      // Set up event listeners
      this.setupAdEventListeners();

      // Show the ad
      await AdMobRewarded.showAdAsync();
      
      // Mark as not loaded since it was consumed
      this.isLoaded = false;
      
      return true;

    } catch (error) {
      console.error('❌ Failed to show reward ad:', error);
      this.callbacks.onAdFailedToShow?.(error?.toString() || 'Unknown error');
      
      // Try to load a new ad for next time
      this.loadAd();
      
      return false;
    }
  }

  private setupAdEventListeners() {
    // Set up rewarded ad event listeners
    AdMobRewarded.addEventListener('rewardedVideoDidLoad', () => {
      console.log('📱 Rewarded ad did load');
      this.callbacks.onAdLoaded?.();
    });

    AdMobRewarded.addEventListener('rewardedVideoDidFailToLoad', (error) => {
      console.error('❌ Rewarded ad failed to load:', error);
      this.callbacks.onAdFailedToLoad?.(error);
    });

    AdMobRewarded.addEventListener('rewardedVideoDidOpen', () => {
      console.log('👁️ Rewarded ad opened');
      this.callbacks.onAdOpened?.();
    });

    AdMobRewarded.addEventListener('rewardedVideoDidClose', () => {
      console.log('👋 Rewarded ad closed');
      this.callbacks.onAdClosed?.();
      
      // Preload next ad
      this.loadAd();
    });

    AdMobRewarded.addEventListener('rewardedVideoUserDidEarnReward', (reward) => {
      console.log('🎉 User earned reward:', reward);
      this.callbacks.onRewarded?.(reward);
    });

    AdMobRewarded.addEventListener('rewardedVideoDidFailToPresent', (error) => {
      console.error('❌ Rewarded ad failed to present:', error);
      this.callbacks.onAdFailedToShow?.(error);
    });
  }

  async isAdReady(): Promise<boolean> {
    try {
      return this.isLoaded && await AdMobRewarded.getIsReadyAsync();
    } catch (error) {
      console.error('Error checking if ad is ready:', error);
      return false;
    }
  }

  // Clean up event listeners
  removeAllListeners() {
    AdMobRewarded.removeAllListeners();
  }
}

// Create and export singleton instance
export const rewardAdService = new RewardAdService();

// Daily ad tracking functions
const DAILY_AD_STORAGE_KEY = 'daily_reward_ads';

export interface DailyAdTracker {
  date: string;
  picksAdsWatched: number;
  trendsAdsWatched: number;
}

export async function getDailyAdTracker(): Promise<DailyAdTracker> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const stored = await AsyncStorage.getItem(DAILY_AD_STORAGE_KEY);
    
    if (stored) {
      const data: DailyAdTracker = JSON.parse(stored);
      
      // If it's a new day, reset the counters
      if (data.date !== today) {
        const newData: DailyAdTracker = {
          date: today,
          picksAdsWatched: 0,
          trendsAdsWatched: 0
        };
        await AsyncStorage.setItem(DAILY_AD_STORAGE_KEY, JSON.stringify(newData));
        return newData;
      }
      
      return data;
    } else {
      // First time - create new tracker
      const newData: DailyAdTracker = {
        date: today,
        picksAdsWatched: 0,
        trendsAdsWatched: 0
      };
      await AsyncStorage.setItem(DAILY_AD_STORAGE_KEY, JSON.stringify(newData));
      return newData;
    }
  } catch (error) {
    console.error('Error getting daily ad tracker:', error);
    // Return default
    return {
      date: new Date().toISOString().split('T')[0],
      picksAdsWatched: 0,
      trendsAdsWatched: 0
    };
  }
}

export async function incrementPicksAds(): Promise<DailyAdTracker> {
  try {
    const tracker = await getDailyAdTracker();
    tracker.picksAdsWatched = Math.min(tracker.picksAdsWatched + 1, 3); // Max 3 per day
    await AsyncStorage.setItem(DAILY_AD_STORAGE_KEY, JSON.stringify(tracker));
    console.log('📈 Picks ads watched today:', tracker.picksAdsWatched);
    return tracker;
  } catch (error) {
    console.error('Error incrementing picks ads:', error);
    throw error;
  }
}

export async function incrementTrendsAds(): Promise<DailyAdTracker> {
  try {
    const tracker = await getDailyAdTracker();
    tracker.trendsAdsWatched = Math.min(tracker.trendsAdsWatched + 1, 3); // Max 3 per day
    await AsyncStorage.setItem(DAILY_AD_STORAGE_KEY, JSON.stringify(tracker));
    console.log('📈 Trends ads watched today:', tracker.trendsAdsWatched);
    return tracker;
  } catch (error) {
    console.error('Error incrementing trends ads:', error);
    throw error;
  }
}

export async function canWatchPicksAd(): Promise<boolean> {
  const tracker = await getDailyAdTracker();
  return tracker.picksAdsWatched < 3;
}

export async function canWatchTrendsAd(): Promise<boolean> {
  const tracker = await getDailyAdTracker();
  return tracker.trendsAdsWatched < 3;
}

export async function getExtraPicksAvailable(): Promise<number> {
  const tracker = await getDailyAdTracker();
  return tracker.picksAdsWatched;
}

export async function getExtraTrendsAvailable(): Promise<number> {
  const tracker = await getDailyAdTracker();
  return tracker.trendsAdsWatched;
}