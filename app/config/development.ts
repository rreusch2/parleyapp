/**
 * Development Configuration
 * 
 * This file contains settings that should only be used during development.
 * IMPORTANT: Always set these to false before building for production!
 */

export const DEV_CONFIG = {
  /**
   * 🔥 FORCE PRO STATUS IN DEVELOPMENT 🔥
   * 
   * ✅ true  = Test with all Pro features unlocked (recommended for development)
   * ❌ false = Test as a free user with limited features
   * 
   * HOW TO USE:
   * 1. Set to true to develop/test Pro features without payment
   * 2. Set to false to test free user experience and upgrade flows
   * 
   * ⚠️  WARNING: Must be false in production builds!
   */
  FORCE_PRO_STATUS: false,

  /**
   * API Configuration
   * Use local endpoints during development
   */
  USE_LOCAL_API: false,
  LOCAL_API_URL: 'http://localhost:3001',
  PRODUCTION_API_URL: 'https://api.predictiveplay.com',

  /**
   * Mock Data
   * Use mock data when backend is unavailable
   */
  USE_MOCK_DATA: false,

  /**
   * Test Pro Subscription Mode
   * Allow upgrading to Pro without payment for testing
   */
  ENABLE_TEST_PRO_SUBSCRIPTION: false,

  /**
   * Debug Features
   */
  SHOW_DEBUG_INFO: false,
  LOG_API_CALLS: false,
  LOG_SUBSCRIPTION_STATUS: false,

  /**
   * Test User Configuration
   * Default user for development testing
   */
  TEST_USER_ID: 'f08b56d3-d4ec-4815-b502-6647d723d2a6',
  TEST_USER_EMAIL: 'test@predictiveplay.com',
}; 