// Performance configuration for the entire app
import { Platform } from 'react-native';

export const performanceConfig = {
  // Bundle optimization
  enableHermes: true,
  enableCodeSplitting: true,
  
  // Image optimization
  imageConfig: {
    enableFastImage: true,
    defaultCachePolicy: 'immutable',
    preloadCriticalImages: true,
    compressionQuality: 0.8,
  },
  
  // API optimization
  apiConfig: {
    timeout: 8000,
    maxRetries: 2,
    enableConcurrentRequests: true,
    enableRequestCaching: true,
  },
  
  // UI optimization
  uiConfig: {
    enableLazyLoading: true,
    enableVirtualization: true,
    animationDuration: Platform.OS === 'ios' ? 300 : 250,
    enableNativeDriver: true,
  },
  
  // Memory management
  memoryConfig: {
    enableAutomaticCleanup: true,
    maxCachedItems: 50,
    cleanupInterval: 300000, // 5 minutes
  },
  
  // Development optimizations
  devConfig: {
    enableFlipperInDev: __DEV__,
    enableReactDevTools: __DEV__,
    enablePerformanceMonitor: __DEV__,
    logPerformanceMetrics: __DEV__,
  },
  
  // Production optimizations
  prodConfig: {
    removeConsoleStatements: !__DEV__,
    enableMinification: !__DEV__,
    enableDeadCodeElimination: !__DEV__,
    optimizeBundle: !__DEV__,
  }
};

// Performance thresholds for monitoring
export const performanceThresholds = {
  // Loading times (in milliseconds)
  appStartup: 2000,
  screenTransition: 500,
  apiResponse: 3000,
  imageLoad: 1500,
  
  // Memory usage (in MB)
  maxMemoryUsage: Platform.OS === 'ios' ? 200 : 150,
  memoryWarningThreshold: Platform.OS === 'ios' ? 150 : 100,
  
  // FPS thresholds
  minFPS: 55,
  targetFPS: 60,
  
  // Bundle size (in MB)
  maxBundleSize: 10,
  warningBundleSize: 8,
};

export default performanceConfig;
