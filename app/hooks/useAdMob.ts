import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { admobService, ADMOB_CONFIG } from '../services/admobService';

export interface UseAdMobReturn {
  isAdReady: boolean;
  showRewardedAd: () => Promise<void>;
  loadAd: () => void;
  adType: 'TEST' | 'PRODUCTION';
  isTestMode: boolean;
}

export function useAdMob(): UseAdMobReturn {
  const [isAdReady, setIsAdReady] = useState(false);

  // Check ad status periodically
  useEffect(() => {
    const checkAdStatus = () => {
      setIsAdReady(admobService.isRewardedAdReady());
    };

    // Check immediately
    checkAdStatus();

    // Check every 2 seconds
    const interval = setInterval(checkAdStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  const showRewardedAd = useCallback(async () => {
    try {
      if (!isAdReady) {
        Alert.alert(
          "Ad Not Ready", 
          `${ADMOB_CONFIG.USE_TEST_ADS ? 'Test ad' : 'Ad'} is still loading. Please try again in a moment.`,
          [{ text: "OK" }]
        );
        return;
      }

      const success = await admobService.showRewardedAd();
      
      if (!success) {
        Alert.alert(
          "Ad Error", 
          "Unable to show ad at this time. Please try again later.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error showing ad:', error);
      Alert.alert(
        "Ad Error", 
        "Something went wrong. Please try again later.",
        [{ text: "OK" }]
      );
    }
  }, [isAdReady]);

  const loadAd = useCallback(() => {
    admobService.loadRewardedAd();
  }, []);

  const adType = admobService.getAdType();
  const isTestMode = ADMOB_CONFIG.USE_TEST_ADS;

  return {
    isAdReady,
    showRewardedAd,
    loadAd,
    adType,
    isTestMode,
  };
} 