// Platform-aware AdMob exports
import { Platform } from 'react-native';

// Re-export based on platform
export const RewardedAd = Platform.OS === 'web' 
  ? require('./index.web').RewardedAd 
  : require('./index.native').RewardedAd;

export const RewardedAdEventType = Platform.OS === 'web'
  ? require('./index.web').RewardedAdEventType
  : require('./index.native').RewardedAdEventType;

export const AdEventType = Platform.OS === 'web'
  ? require('./index.web').AdEventType
  : require('./index.native').AdEventType;

export const TestIds = Platform.OS === 'web'
  ? require('./index.web').TestIds
  : require('./index.native').TestIds;
