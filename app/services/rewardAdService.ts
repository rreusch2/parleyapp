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
      this.rewardedAd = RewardedAd.createForAdRequest(adUnitId);

      // Load the ad
      await new Promise<void>((resolve, reject) => {
        this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
          resolve();
        });

        this.rewardedAd.addAdEventListener(RewardedAdEventType.ERROR, (error: any) => {
          console.error('❌ Ad load error:', error);
          reject(error);
        });

        this.rewardedAd.load();

        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('Ad load timeout')), 10000);
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