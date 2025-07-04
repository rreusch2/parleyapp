/**
 * Production Configuration
 * 
 * This file contains settings that should be used in production builds.
 * IMPORTANT: All URLs must be replaced with actual production endpoints!
 */

export const PROD_CONFIG = {
  /**
   * 🔥 PRODUCTION ENVIRONMENT SETTINGS 🔥
   * 
   * ⚠️  WARNING: These MUST be updated with real production URLs!
   * The placeholder URLs below will NOT work in production.
   */
  
  /**
   * API Configuration
   * Replace with your actual production endpoints
   */
  USE_LOCAL_API: false,
  
  // 🚨 REPLACE THESE WITH YOUR ACTUAL PRODUCTION URLS 🚨
  PRODUCTION_API_URL: 'https://api.parleyapp.com',
  PRODUCTION_PYTHON_API_URL: 'https://python-api.parleyapp.com',
  
  /**
   * App Store Requirements
   */
  FORCE_PRO_STATUS: false, // Must be false for App Store
  USE_MOCK_DATA: false,    // Must be false for App Store
  
  /**
   * Debug Features - All disabled for production
   */
  SHOW_DEBUG_INFO: false,
  LOG_API_CALLS: false,
  LOG_SUBSCRIPTION_STATUS: false,
  
  /**
   * Environment Detection
   */
  IS_PRODUCTION: true,
  
  /**
   * App Store Specific Settings
   */
  APP_STORE_BUILD: true,
  ENABLE_ANALYTICS: true,
  ENABLE_CRASH_REPORTING: true,
};

/**
 * Environment-aware configuration
 * Automatically selects the right config based on NODE_ENV
 */
export const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.EXPO_PUBLIC_BACKEND_URL || PROD_CONFIG.PRODUCTION_API_URL;
  }
  return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
};

export const getPythonApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.EXPO_PUBLIC_PYTHON_API_URL || PROD_CONFIG.PRODUCTION_PYTHON_API_URL;
  }
  return process.env.EXPO_PUBLIC_PYTHON_API_URL || 'http://localhost:8001';
};

/**
 * Pre-build validation
 * Call this function during build to ensure production readiness
 */
export const validateProductionConfig = () => {
  const errors: string[] = [];
  
  if (process.env.NODE_ENV === 'production') {
    const backendUrl = getApiUrl();
    const pythonUrl = getPythonApiUrl();
    
    // Check for localhost references
    if (backendUrl.includes('localhost')) {
      errors.push('❌ Backend URL still contains localhost! Update EXPO_PUBLIC_BACKEND_URL');
    }
    
    if (pythonUrl.includes('localhost')) {
      errors.push('❌ Python API URL still contains localhost! Update EXPO_PUBLIC_PYTHON_API_URL');
    }
    
    // Check for placeholder URLs
    if (backendUrl.includes('parleyapp.com') && backendUrl.includes('api.parleyapp.com')) {
      errors.push('⚠️  Backend URL appears to be a placeholder. Update with your actual production URL');
    }
    
    if (pythonUrl.includes('parleyapp.com') && pythonUrl.includes('python-api.parleyapp.com')) {
      errors.push('⚠️  Python API URL appears to be a placeholder. Update with your actual production URL');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: errors.filter(e => e.includes('⚠️')),
    criticalErrors: errors.filter(e => e.includes('❌'))
  };
};

/**
 * App Store preparation checklist
 */
export const APP_STORE_CHECKLIST = [
  '✅ Replace all localhost URLs with production URLs',
  '✅ Set NODE_ENV=production',
  '✅ Update EXPO_PUBLIC_BACKEND_URL environment variable',
  '✅ Update EXPO_PUBLIC_PYTHON_API_URL environment variable',
  '✅ Test all API endpoints from production URLs',
  '✅ Verify no console.log statements in production code',
  '✅ Enable analytics and crash reporting',
  '✅ Update app.config.js with production bundle identifier',
  '✅ Test on physical device before submission',
  '✅ Run validateProductionConfig() to check for issues',
]; 