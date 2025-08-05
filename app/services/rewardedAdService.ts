import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { admobService } from './admobService';

export type RewardType = 'extra_pick' | 'extra_trend';

interface RewardState {
  date: string;
  extraPicksEarned: number;
  extraTrendsEarned: number;
}

interface RewardLimits {
  maxExtraPicksPerDay: number;
  maxExtraTrendsPerDay: number;
}

class RewardedAdService {
  private readonly STORAGE_KEY = 'rewarded_ad_state';
  private readonly limits: RewardLimits = {
    maxExtraPicksPerDay: 3,
    maxExtraTrendsPerDay: 3,
  };

  private rewardCallbacks: Map<RewardType, (() => void)[]> = new Map([
    ['extra_pick', []],
    ['extra_trend', []],
  ]);

  constructor() {
    this.initializeRewardTracking();
  }

  private async initializeRewardTracking() {
    try {
      await this.resetDailyCountsIfNeeded();
    } catch (error) {
      console.error('Error initializing reward tracking:', error);
    }
  }

  private getTodayDateString(): string {
    return new Date().toDateString();
  }

  private async getRewardState(): Promise<RewardState> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error getting reward state:', error);
    }

    // Default state
    return {
      date: this.getTodayDateString(),
      extraPicksEarned: 0,
      extraTrendsEarned: 0,
    };
  }

  private async saveRewardState(state: RewardState): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving reward state:', error);
    }
  }

  private async resetDailyCountsIfNeeded(): Promise<void> {
    const state = await this.getRewardState();
    const today = this.getTodayDateString();

    if (state.date !== today) {
      // New day, reset counts
      const newState: RewardState = {
        date: today,
        extraPicksEarned: 0,
        extraTrendsEarned: 0,
      };
      await this.saveRewardState(newState);
    }
  }

  public async canEarnReward(rewardType: RewardType): Promise<boolean> {
    // Skip on web platform
    if (Platform.OS === 'web') {
      return false;
    }

    await this.resetDailyCountsIfNeeded();
    const state = await this.getRewardState();

    switch (rewardType) {
      case 'extra_pick':
        return state.extraPicksEarned < this.limits.maxExtraPicksPerDay;
      case 'extra_trend':
        return state.extraTrendsEarned < this.limits.maxExtraTrendsPerDay;
      default:
        return false;
    }
  }

  public async getRemainingRewards(rewardType: RewardType): Promise<number> {
    await this.resetDailyCountsIfNeeded();
    const state = await this.getRewardState();

    switch (rewardType) {
      case 'extra_pick':
        return Math.max(0, this.limits.maxExtraPicksPerDay - state.extraPicksEarned);
      case 'extra_trend':
        return Math.max(0, this.limits.maxExtraTrendsPerDay - state.extraTrendsEarned);
      default:
        return 0;
    }
  }

  public async getEarnedRewardsToday(rewardType: RewardType): Promise<number> {
    await this.resetDailyCountsIfNeeded();
    const state = await this.getRewardState();

    switch (rewardType) {
      case 'extra_pick':
        return state.extraPicksEarned;
      case 'extra_trend':
        return state.extraTrendsEarned;
      default:
        return 0;
    }
  }

  public async showRewardedAd(rewardType: RewardType): Promise<boolean> {
    // Skip on web platform
    if (Platform.OS === 'web') {
      console.log('🌐 Rewarded ads not available on web platform');
      return false;
    }

    // Check if user can earn this reward
    if (!(await this.canEarnReward(rewardType))) {
      console.log(`❌ Daily limit reached for ${rewardType}`);
      return false;
    }

    // Check if ad is ready
    if (!admobService.isRewardedAdReady()) {
      console.log('⚠️ Rewarded ad not ready');
      return false;
    }

    try {
      console.log(`🎬 Showing rewarded ad for ${rewardType}`);
      
      // Set up one-time reward listener
      const rewardPromise = new Promise<boolean>((resolve) => {
        const onRewardEarned = async () => {
          console.log(`🎉 User earned reward: ${rewardType}`);
          await this.recordRewardEarned(rewardType);
          
          // Notify callbacks
          const callbacks = this.rewardCallbacks.get(rewardType) || [];
          callbacks.forEach(callback => callback());
          
          // Clear this specific callback
          this.rewardCallbacks.set(rewardType, []);
          resolve(true);
        };

        // Show the ad with callback
        admobService.showRewardedAd(onRewardEarned).then((adShown) => {
          if (!adShown) {
            resolve(false);
          }
          // If ad was shown successfully, wait for reward callback
        }).catch(() => {
          resolve(false);
        });
      });

      // Wait for reward or timeout
      const result = await Promise.race([
        rewardPromise,
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 30000)) // 30 second timeout
      ]);

      return result;
    } catch (error) {
      console.error(`❌ Error showing rewarded ad for ${rewardType}:`, error);
      return false;
    }
  }

  private async recordRewardEarned(rewardType: RewardType): Promise<void> {
    await this.resetDailyCountsIfNeeded();
    const state = await this.getRewardState();

    switch (rewardType) {
      case 'extra_pick':
        state.extraPicksEarned = Math.min(
          state.extraPicksEarned + 1, 
          this.limits.maxExtraPicksPerDay
        );
        break;
      case 'extra_trend':
        state.extraTrendsEarned = Math.min(
          state.extraTrendsEarned + 1, 
          this.limits.maxExtraTrendsPerDay
        );
        break;
    }

    await this.saveRewardState(state);
    console.log(`✅ Recorded reward for ${rewardType}. New state:`, state);
  }

  public onRewardEarned(rewardType: RewardType, callback: () => void): void {
    const callbacks = this.rewardCallbacks.get(rewardType) || [];
    callbacks.push(callback);
    this.rewardCallbacks.set(rewardType, callbacks);
  }

  public removeRewardCallback(rewardType: RewardType, callback: () => void): void {
    const callbacks = this.rewardCallbacks.get(rewardType) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
      this.rewardCallbacks.set(rewardType, callbacks);
    }
  }

  public async getRewardStats(): Promise<{
    extraPicksEarned: number;
    extraTrendsEarned: number;
    extraPicksRemaining: number;
    extraTrendsRemaining: number;
    maxExtraPicksPerDay: number;
    maxExtraTrendsPerDay: number;
  }> {
    await this.resetDailyCountsIfNeeded();
    const state = await this.getRewardState();

    return {
      extraPicksEarned: state.extraPicksEarned,
      extraTrendsEarned: state.extraTrendsEarned,
      extraPicksRemaining: this.limits.maxExtraPicksPerDay - state.extraPicksEarned,
      extraTrendsRemaining: this.limits.maxExtraTrendsPerDay - state.extraTrendsEarned,
      maxExtraPicksPerDay: this.limits.maxExtraPicksPerDay,
      maxExtraTrendsPerDay: this.limits.maxExtraTrendsPerDay,
    };
  }

  public isAdReady(): boolean {
    return admobService.isRewardedAdReady();
  }

  public getAdType(): 'TEST' | 'PRODUCTION' {
    return admobService.getAdType();
  }
}

// Export singleton instance
export const rewardedAdService = new RewardedAdService();