import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  initializeAdMobSDK,
  isAdMobReady,
  getRewardAdUnitId,
  isAdMobAvailable
} from './admobUtils';

export type RewardType = 'extra_pick' | 'extra_trend';

interface DailyAdTracker {
  date: string;
  extraPicksEarned: number;
  extraTrendsEarned: number;
}

class RewardAdService {
  private readonly STORAGE_KEY = 'daily_ad_tracker';
  private readonly MAX_PICKS_PER_DAY = 3;
  private readonly MAX_TRENDS_PER_DAY = 3;
  private rewardedAd: any = null;

  constructor() {
    // SDK initialization is handled by admobUtils
    // Ensure SDK is initialized early
    if (Platform.OS !== 'web' && isAdMobAvailable) {
      setTimeout(() => {
        initializeAdMobSDK()
          .then(success => console.log(`🚀 AdMob SDK early initialization: ${success ? 'success' : 'failed'}`))
          .catch(err => console.error('❌ Early initialization error:', err));
      }, 1000);
    }
  }

  private getTodayDateString(): string {
    return new Date().toDateString();
  }

  public async getDailyTracker(): Promise<DailyAdTracker> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Reset if new day
        if (data.date !== this.getTodayDateString()) {
          return this.resetDailyTracker();
        }
        return data;
      }
    } catch (error) {
      console.error('Error getting daily tracker:', error);
    }

    return this.resetDailyTracker();
  }

  private async resetDailyTracker(): Promise<DailyAdTracker> {
    const newTracker: DailyAdTracker = {
      date: this.getTodayDateString(),
      extraPicksEarned: 0,
      extraTrendsEarned: 0,
    };

    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(newTracker));
    } catch (error) {
      console.error('Error saving daily tracker:', error);
    }

    return newTracker;
  }

  public async canWatchAd(rewardType: RewardType): Promise<boolean> {
    if (Platform.OS === 'web' || !isAdMobAvailable) return false;

    const tracker = await this.getDailyTracker();
    
    switch (rewardType) {
      case 'extra_pick':
        return tracker.extraPicksEarned < this.MAX_PICKS_PER_DAY;
      case 'extra_trend':
        return tracker.extraTrendsEarned < this.MAX_TRENDS_PER_DAY;
      default:
        return false;
    }
  }

  public async getExtraRewardsAvailable(rewardType: RewardType): Promise<number> {
    const tracker = await this.getDailyTracker();
    
    switch (rewardType) {
      case 'extra_pick':
        return tracker.extraPicksEarned;
      case 'extra_trend':
        return tracker.extraTrendsEarned;
      default:
        return 0;
    }
  }

  public async showRewardedAd(rewardType: RewardType): Promise<boolean> {
    if (Platform.OS === 'web' || !isAdMobAvailable || !RewardedAd) {
      return false;
    }

    // Ensure SDK is initialized
    const initialized = await initializeAdMobSDK();
    if (!initialized) {
      console.log('❌ AdMob SDK not initialized');
      return false;
    }

    // Check if user can watch ad
    if (!(await this.canWatchAd(rewardType))) {
      console.log(`❌ Daily limit reached for ${rewardType}`);
      return false;
    }

    try {
      // Create new ad instance
      const adUnitId = getRewardAdUnitId();
      console.log(`🎬 Creating rewarded ad with unit ID: ${adUnitId}`);
      console.log(`📊 Debug info: RewardedAd available=${!!RewardedAd}, adType=${__DEV__ ? 'TEST' : 'PROD'}`);
      
      this.rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      // Load the ad
      await new Promise<void>((resolve, reject) => {
        this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
          console.log('✅ Rewarded ad loaded successfully');
          resolve();
        });

        this.rewardedAd.addAdEventListener(RewardedAdEventType.ERROR, (error: any) => {
          console.error('❌ Ad load error:', error);
          console.error('Error details:', JSON.stringify(error));
          // Try to provide more specific error message
          const errorMessage = error?.message || error?.code || 'Unknown ad error';
          console.log(`Ad error message: ${errorMessage}`);
          reject(new Error(`Ad load error: ${errorMessage}`));
        });

        console.log('🔄 Loading rewarded ad...');
        this.rewardedAd.load();

        // Timeout after 15 seconds (increased from 10)
        setTimeout(() => reject(new Error('Ad load timeout after 15 seconds')), 15000);
      });

      // Show the ad and wait for reward
      const rewarded = await new Promise<boolean>((resolve) => {
        this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward: any) => {
          console.log('🎉 User earned reward:', reward);
          resolve(true);
        });

        this.rewardedAd.addAdEventListener(RewardedAdEventType.CLOSED, () => {
          resolve(false);
        });

        this.rewardedAd.show();
      });

      if (rewarded) {
        await this.recordReward(rewardType);
      }

      return rewarded;
    } catch (error) {
      console.error('❌ Error showing reward ad:', error);
      console.error('Error stack:', error?.stack);
      
      // Log detailed diagnostic information
      console.log(`Debug info - isAdMobAvailable: ${isAdMobAvailable}`);
      console.log(`Debug info - RewardedAd exists: ${!!RewardedAd}`);
      console.log(`Debug info - rewardedAd instance exists: ${!!this.rewardedAd}`);
      console.log(`Debug info - Platform: ${Platform.OS}, Version: ${Platform.Version}`);
      
      return false;
    }
  }

  private async recordReward(rewardType: RewardType): Promise<void> {
    const tracker = await this.getDailyTracker();

    switch (rewardType) {
      case 'extra_pick':
        tracker.extraPicksEarned = Math.min(tracker.extraPicksEarned + 1, this.MAX_PICKS_PER_DAY);
        break;
      case 'extra_trend':
        tracker.extraTrendsEarned = Math.min(tracker.extraTrendsEarned + 1, this.MAX_TRENDS_PER_DAY);
        break;
    }

    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(tracker));
      console.log(`✅ Recorded reward for ${rewardType}. New tracker:`, tracker);
    } catch (error) {
      console.error('Error saving reward:', error);
    }
  }
}

// Export singleton instance
export const rewardAdService = new RewardAdService();

// Preload ads function to call early in app initialization
export function preloadRewardAds(): void {
  // Try to load ads in the background when app starts
  setTimeout(async () => {
    try {
      const initialized = await initializeAdMobSDK();
      console.log(`🔄 Preloading ads - SDK initialized: ${initialized}`);
      if (initialized) {
        // Try to show a pick ad
        rewardAdService.showRewardedAd('extra_pick')
          .then(() => console.log('✅ Preloaded pick ad successfully'))
          .catch(err => console.log('⚠️ Preload pick ad error:', err));
      }
    } catch (error) {
      console.error('❌ Error in preloadRewardAds:', error);
    }
  }, 3000); // Wait 3 seconds after app launch
}

// Export helper functions for components
export async function getDailyAdTracker(): Promise<DailyAdTracker> {
  return rewardAdService.getDailyTracker();
}

export async function canWatchPicksAd(): Promise<boolean> {
  return rewardAdService.canWatchAd('extra_pick');
}

export async function canWatchTrendsAd(): Promise<boolean> {
  return rewardAdService.canWatchAd('extra_trend');
}

export async function getExtraPicksAvailable(): Promise<number> {
  return rewardAdService.getExtraRewardsAvailable('extra_pick');
}

export async function getExtraTrendsAvailable(): Promise<number> {
  return rewardAdService.getExtraRewardsAvailable('extra_trend');
}

export async function showPicksRewardAd(): Promise<boolean> {
  return rewardAdService.showRewardedAd('extra_pick');
}

export async function showTrendsRewardAd(): Promise<boolean> {
  return rewardAdService.showRewardedAd('extra_trend');
}

export { DailyAdTracker };