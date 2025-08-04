import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { 
  rewardAdService, 
  getDailyAdTracker, 
  incrementPicksAds, 
  incrementTrendsAds,
  canWatchPicksAd,
  canWatchTrendsAd,
  getExtraPicksAvailable,
  getExtraTrendsAvailable,
  DailyAdTracker 
} from '../services/rewardAdService';
import { useSubscription } from '../services/subscriptionContext';

interface UseRewardAdsReturn {
  // State
  isAdLoading: boolean;
  isAdReady: boolean;
  dailyTracker: DailyAdTracker | null;
  
  // Picks-related
  canWatchPicksAdToday: boolean;
  extraPicksAvailable: number;
  showPicksRewardAd: () => Promise<boolean>;
  
  // Trends-related
  canWatchTrendsAdToday: boolean;
  extraTrendsAvailable: number;
  showTrendsRewardAd: () => Promise<boolean>;
  
  // General
  refreshAdStatus: () => Promise<void>;
  initializeAds: () => Promise<void>;
}

export function useRewardAds(): UseRewardAdsReturn {
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [isAdReady, setIsAdReady] = useState(false);
  const [dailyTracker, setDailyTracker] = useState<DailyAdTracker | null>(null);
  const [canWatchPicksAdToday, setCanWatchPicksAdToday] = useState(false);
  const [canWatchTrendsAdToday, setCanWatchTrendsAdToday] = useState(false);
  const [extraPicksAvailable, setExtraPicksAvailable] = useState(0);
  const [extraTrendsAvailable, setExtraTrendsAvailable] = useState(0);
  
  const { subscriptionTier } = useSubscription();

  // Initialize ads and load daily tracker
  const initializeAds = useCallback(async () => {
    try {
      console.log('🚀 Initializing reward ads...');
      await rewardAdService.initialize();
      await refreshAdStatus();
    } catch (error) {
      console.error('❌ Failed to initialize ads:', error);
    }
  }, []);

  // Refresh all ad-related state
  const refreshAdStatus = useCallback(async () => {
    try {
      const [tracker, canPicksAd, canTrendsAd, extraPicks, extraTrends, adReady] = await Promise.all([
        getDailyAdTracker(),
        canWatchPicksAd(),
        canWatchTrendsAd(),
        getExtraPicksAvailable(),
        getExtraTrendsAvailable(),
        rewardAdService.isAdReady()
      ]);

      setDailyTracker(tracker);
      setCanWatchPicksAdToday(canPicksAd);
      setCanWatchTrendsAdToday(canTrendsAd);
      setExtraPicksAvailable(extraPicks);
      setExtraTrendsAvailable(extraTrends);
      setIsAdReady(adReady);

      console.log('📊 Ad status refreshed:', {
        picksAdsWatched: tracker.picksAdsWatched,
        trendsAdsWatched: tracker.trendsAdsWatched,
        canPicksAd,
        canTrendsAd,
        adReady
      });
    } catch (error) {
      console.error('❌ Failed to refresh ad status:', error);
    }
  }, []);

  // Show reward ad for extra picks
  const showPicksRewardAd = useCallback(async (): Promise<boolean> => {
    // Only allow for free users
    if (subscriptionTier !== 'free') {
      Alert.alert('Feature Not Available', 'Reward ads are only available for free accounts.');
      return false;
    }

    if (!canWatchPicksAdToday) {
      Alert.alert(
        'Daily Limit Reached',
        'You\'ve already watched the maximum number of ads for extra picks today. The limit resets tomorrow!'
      );
      return false;
    }

    try {
      setIsAdLoading(true);

      const success = await rewardAdService.showAd({
        onAdOpened: () => {
          console.log('📱 Picks reward ad opened');
        },
        onAdClosed: () => {
          console.log('👋 Picks reward ad closed');
          setIsAdLoading(false);
        },
        onRewarded: async (reward) => {
          console.log('🎉 User earned picks reward!', reward);
          try {
            await incrementPicksAds();
            await refreshAdStatus();
            
            Alert.alert(
              'Reward Earned! 🎉',
              'You\'ve unlocked 1 extra pick for today! Check out your new predictions.',
              [{ text: 'Awesome!', style: 'default' }]
            );
          } catch (error) {
            console.error('❌ Error processing picks reward:', error);
          }
        },
        onAdFailedToShow: (error) => {
          console.error('❌ Picks reward ad failed to show:', error);
          setIsAdLoading(false);
          Alert.alert(
            'Ad Not Available',
            'Sorry, we couldn\'t load an ad right now. Please try again in a moment.'
          );
        }
      });

      if (!success) {
        setIsAdLoading(false);
      }

      return success;
    } catch (error) {
      console.error('❌ Failed to show picks reward ad:', error);
      setIsAdLoading(false);
      Alert.alert(
        'Error',
        'Something went wrong while loading the ad. Please try again.'
      );
      return false;
    }
  }, [canWatchPicksAdToday, subscriptionTier, refreshAdStatus]);

  // Show reward ad for extra trends
  const showTrendsRewardAd = useCallback(async (): Promise<boolean> => {
    // Only allow for free users
    if (subscriptionTier !== 'free') {
      Alert.alert('Feature Not Available', 'Reward ads are only available for free accounts.');
      return false;
    }

    if (!canWatchTrendsAdToday) {
      Alert.alert(
        'Daily Limit Reached',
        'You\'ve already watched the maximum number of ads for extra trends today. The limit resets tomorrow!'
      );
      return false;
    }

    try {
      setIsAdLoading(true);

      const success = await rewardAdService.showAd({
        onAdOpened: () => {
          console.log('📱 Trends reward ad opened');
        },
        onAdClosed: () => {
          console.log('👋 Trends reward ad closed');
          setIsAdLoading(false);
        },
        onRewarded: async (reward) => {
          console.log('🎉 User earned trends reward!', reward);
          try {
            await incrementTrendsAds();
            await refreshAdStatus();
            
            Alert.alert(
              'Reward Earned! 🎉',
              'You\'ve unlocked 1 extra trend for today! Check out your new insights.',
              [{ text: 'Awesome!', style: 'default' }]
            );
          } catch (error) {
            console.error('❌ Error processing trends reward:', error);
          }
        },
        onAdFailedToShow: (error) => {
          console.error('❌ Trends reward ad failed to show:', error);
          setIsAdLoading(false);
          Alert.alert(
            'Ad Not Available',
            'Sorry, we couldn\'t load an ad right now. Please try again in a moment.'
          );
        }
      });

      if (!success) {
        setIsAdLoading(false);
      }

      return success;
    } catch (error) {
      console.error('❌ Failed to show trends reward ad:', error);
      setIsAdLoading(false);
      Alert.alert(
        'Error',
        'Something went wrong while loading the ad. Please try again.'
      );
      return false;
    }
  }, [canWatchTrendsAdToday, subscriptionTier, refreshAdStatus]);

  // Initialize on mount
  useEffect(() => {
    initializeAds();
  }, [initializeAds]);

  // Refresh ad status periodically and when subscription changes
  useEffect(() => {
    refreshAdStatus();
    
    // Refresh every 30 seconds to keep ad status current
    const interval = setInterval(refreshAdStatus, 30000);
    
    return () => clearInterval(interval);
  }, [refreshAdStatus, subscriptionTier]);

  return {
    isAdLoading,
    isAdReady,
    dailyTracker,
    canWatchPicksAdToday,
    extraPicksAvailable,
    showPicksRewardAd,
    canWatchTrendsAdToday,
    extraTrendsAvailable,
    showTrendsRewardAd,
    refreshAdStatus,
    initializeAds
  };
}