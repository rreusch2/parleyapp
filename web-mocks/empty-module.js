// Mock module for native components on web platform
// This prevents native-only modules from breaking web builds

export default {};

// Export common patterns that native modules might expect
export const TestIds = {};
export const GoogleMobileAds = {};
export const AdMob = {};
export const InterstitialAd = {};
export const RewardedAd = {};
export const BannerAd = {};
export const NativeAd = {};

// Mock functions that might be called
export const initialize = () => Promise.resolve();
export const show = () => Promise.resolve();
export const load = () => Promise.resolve();
export const isLoaded = () => false;

// Default export for modules that expect it
module.exports = {
  default: {},
  TestIds: {},
  GoogleMobileAds: {},
  AdMob: {},
  InterstitialAd: {},
  RewardedAd: {},
  BannerAd: {},
  NativeAd: {},
  initialize: () => Promise.resolve(),
  show: () => Promise.resolve(),
  load: () => Promise.resolve(),
  isLoaded: () => false,
};