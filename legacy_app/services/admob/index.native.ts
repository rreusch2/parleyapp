// Native AdMob exports for iOS/Android
let RewardedAd: any;
let RewardedAdEventType: any;
let TestIds: any;
let AdEventType: any;

try {
  const AdMob = require('react-native-google-mobile-ads');
  RewardedAd = AdMob.RewardedAd;
  RewardedAdEventType = AdMob.RewardedAdEventType;
  TestIds = AdMob.TestIds;
  AdEventType = AdMob.AdEventType;
} catch (error) {
  // Fallback if package is not available
  RewardedAd = {
    createForAdRequest: () => ({
      addAdEventListener: () => () => {},
      load: () => {},
      show: () => {},
    })
  };
  RewardedAdEventType = {
    LOADED: 'loaded',
    EARNED_REWARD: 'earned_reward'
  };
  AdEventType = {
    CLOSED: 'closed'
  };
  TestIds = {
    REWARDED: 'test-rewarded-id'
  };
}

export { RewardedAd, RewardedAdEventType, TestIds, AdEventType };
