// Mock module for native components on web platform
// This prevents native-only modules from breaking web builds

// RevenueCat mocks
export const configure = () => Promise.resolve();
export const getOfferings = () => Promise.resolve({ current: null });
export const purchasePackage = () => Promise.resolve({ success: false });
export const restorePurchases = () => Promise.resolve({});
export const getCustomerInfo = () => Promise.resolve({ entitlements: { active: {} } });
export const setLogLevel = () => {};
export const logIn = () => Promise.resolve();
export const logOut = () => Promise.resolve();
export const setAttributes = () => Promise.resolve();

// RevenueCat UI mock
export const presentCustomerCenter = () => Promise.reject(new Error('Customer Center not available on web'));

// Google Mobile Ads mocks
export const TestIds = {};
export const GoogleMobileAds = {};
export const InterstitialAd = {};
export const RewardedAd = {};
export const BannerAd = {};
export const NativeAd = {};

// AppsFlyer mocks
export const initSdk = () => Promise.resolve();
export const startSdk = () => Promise.resolve();
export const logEvent = () => Promise.resolve();

// SSE mock
export class EventSource {
  constructor() {}
  addEventListener() {}
  removeEventListener() {}  
  close() {}
}

// Store Review mock
export const isAvailableAsync = () => Promise.resolve(false);
export const requestReview = () => Promise.resolve();

// Mock functions that might be called
export const initialize = () => Promise.resolve();
export const show = () => Promise.resolve();
export const load = () => Promise.resolve();
export const isLoaded = () => false;

// Default export as a comprehensive mock object
const mockModule = {
  default: {},
  
  // RevenueCat
  configure,
  getOfferings,
  purchasePackage,
  restorePurchases,
  getCustomerInfo,
  setLogLevel,
  logIn,
  logOut,
  setAttributes,
  presentCustomerCenter,
  
  // Google Ads
  TestIds,
  GoogleMobileAds,
  InterstitialAd,
  RewardedAd,
  BannerAd,
  NativeAd,
  
  // AppsFlyer
  initSdk,
  startSdk,
  logEvent,
  
  // SSE
  EventSource,
  
  // Store Review
  isAvailableAsync,
  requestReview,
  
  // Common functions
  initialize,
  show,
  load,
  isLoaded,
};

// Support both ES6 and CommonJS
export default mockModule;
module.exports = mockModule;
