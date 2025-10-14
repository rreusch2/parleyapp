// Performance optimization utilities for React Native
import { InteractionManager, Platform } from 'react-native';

/**
 * Delays heavy operations until after interactions are complete
 * This prevents blocking the UI during navigation/animations
 */
export const runAfterInteractions = (callback: () => void | Promise<void>) => {
  return InteractionManager.runAfterInteractions(callback);
};

/**
 * Batches multiple async operations to run concurrently instead of sequentially
 * This significantly reduces loading time
 */
export const batchAsyncOperations = async (
  operations: (() => Promise<any>)[]
): Promise<PromiseSettledResult<any>[]> => {
  return Promise.allSettled(operations.map(op => op()));
};

/**
 * Creates a timeout wrapper for operations that might hang
 * Prevents infinite loading states
 */
export const withTimeout = <T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  timeoutMessage: string = 'Operation timed out'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
};

/**
 * Debounces rapid function calls to improve performance
 * Useful for search inputs, scroll handlers, etc.
 */
export const debounce = <T extends (...args: any[]) => void>(
  func: T, 
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Memory management for component cleanup
 */
export const createAbortController = () => {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
    isAborted: () => controller.signal.aborted
  };
};

/**
 * iOS-specific optimizations
 */
export const iosOptimizations = {
  // Enable Hermes if not already enabled
  checkHermesEnabled: () => {
    if (Platform.OS === 'ios' && (global as any).HermesInternal) {
      console.log('✅ Hermes enabled - optimized startup performance');
      return true;
    }
    console.warn('⚠️ Hermes not detected - consider enabling for better performance');
    return false;
  },

  // Remove console logs in production
  disableProductionLogs: () => {
    if (!__DEV__) {
      console.log = () => {};
      console.warn = () => {};
      console.error = () => {};
    }
  }
};
