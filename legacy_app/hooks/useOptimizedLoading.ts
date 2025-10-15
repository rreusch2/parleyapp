// Optimized loading hook for faster dashboard initialization
import { useState, useCallback, useRef } from 'react';
import { batchAsyncOperations, withTimeout, createAbortController } from '../utils/performanceOptimizer';

interface LoadingState {
  isLoading: boolean;
  error: string | null;
  progress: number;
}

interface OptimizedLoadingOptions {
  timeout?: number;
  enableProgress?: boolean;
  retryCount?: number;
}

export const useOptimizedLoading = (options: OptimizedLoadingOptions = {}) => {
  const { timeout = 10000, enableProgress = true, retryCount = 2 } = options;
  
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    progress: 0
  });
  
  const abortControllerRef = useRef<ReturnType<typeof createAbortController> | null>(null);
  const retryAttemptsRef = useRef(0);

  const updateProgress = useCallback((progress: number) => {
    if (enableProgress) {
      setState(prev => ({ ...prev, progress: Math.min(100, Math.max(0, progress)) }));
    }
  }, [enableProgress]);

  const executeWithRetry = useCallback(async (operation: () => Promise<any>) => {
    try {
      return await operation();
    } catch (error) {
      if (retryAttemptsRef.current < retryCount) {
        retryAttemptsRef.current++;
        console.warn(`Operation failed, retrying... (${retryAttemptsRef.current}/${retryCount})`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        return executeWithRetry(operation);
      }
      throw error;
    }
  }, [retryCount]);

  const loadData = useCallback(async (operations: (() => Promise<any>)[]) => {
    // Reset state
    setState({ isLoading: true, error: null, progress: 0 });
    retryAttemptsRef.current = 0;
    
    // Create abort controller for cancellation
    abortControllerRef.current = createAbortController();
    const { signal, isAborted } = abortControllerRef.current;

    try {
      updateProgress(10);

      // Batch all operations to run concurrently instead of sequentially
      const batchedOperations = operations.map(op => 
        () => withTimeout(executeWithRetry(op), timeout)
      );

      updateProgress(20);

      // Execute all operations concurrently
      const results = await batchAsyncOperations(batchedOperations);
      
      if (isAborted()) return;
      
      updateProgress(90);

      // Check for failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn('Some operations failed:', failures);
        // Continue anyway - partial loading is better than no loading
      }

      updateProgress(100);
      setState({ isLoading: false, error: null, progress: 100 });

      return results.map(result => 
        result.status === 'fulfilled' ? result.value : null
      );

    } catch (error) {
      if (!isAborted()) {
        console.error('Optimized loading failed:', error);
        setState({ 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Loading failed', 
          progress: 0 
        });
      }
      return null;
    }
  }, [timeout, updateProgress, executeWithRetry]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState({ isLoading: false, error: null, progress: 0 });
    }
  }, []);

  return {
    ...state,
    loadData,
    abort,
    isAborted: () => abortControllerRef.current?.isAborted() || false
  };
};
