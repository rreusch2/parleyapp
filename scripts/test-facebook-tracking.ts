/**
 * Facebook/Meta Tracking Test Script
 * Use this to verify your Facebook SDK integration and event tracking
 */

import { Platform } from 'react-native';
import facebookAnalyticsService from '../app/services/facebookAnalyticsService';

export class FacebookTrackingTester {
  
  /**
   * Run comprehensive Facebook tracking tests
   */
  static async runAllTests(): Promise<void> {
    console.log('🧪 Starting Facebook Tracking Tests...');
    console.log('📱 Platform:', Platform.OS);
    
    try {
      // Test 1: Initialize Facebook SDK
      await this.testInitialization();
      
      // Test 2: Test Core Conversion Events
      await this.testCoreEvents();
      
      // Test 3: Test Custom ParleyApp Events
      await this.testCustomEvents();
      
      // Test 4: Test User Properties
      await this.testUserProperties();
      
      console.log('✅ All Facebook tracking tests completed!');
      console.log('📊 Check Events Manager Test Events tab to verify events were received');
      
    } catch (error) {
      console.error('❌ Facebook tracking tests failed:', error);
    }
  }
  
  /**
   * Test Facebook SDK initialization
   */
  private static async testInitialization(): Promise<void> {
    console.log('\n🔧 Test 1: Facebook SDK Initialization');
    
    try {
      await facebookAnalyticsService.initialize();
      console.log('✅ Facebook SDK initialized successfully');
      
      // Track app install (should happen automatically)
      facebookAnalyticsService.trackAppInstall();
      console.log('✅ App Install tracked');
      
    } catch (error) {
      console.error('❌ Initialization test failed:', error);
      throw error;
    }
  }
  
  /**
   * Test core conversion events that Meta optimizes for
   */
  private static async testCoreEvents(): Promise<void> {
    console.log('\n📊 Test 2: Core Conversion Events');
    
    try {
      // Test CompleteRegistration event
      facebookAnalyticsService.trackCompleteRegistration({
        fb_registration_method: 'email',
        test_user: 'true'
      });
      console.log('✅ CompleteRegistration event tracked');
      
      // Test ViewContent event
      facebookAnalyticsService.trackViewContent('Test Daily Picks', {
        test_event: 'true'
      });
      console.log('✅ ViewContent event tracked');
      
      // Test AddToCart event (subscription intent)
      facebookAnalyticsService.trackAddToCart('Pro Monthly', 24.99, {
        test_event: 'true'
      });
      console.log('✅ AddToCart event tracked');
      
      // Test Purchase event
      facebookAnalyticsService.trackPurchase(24.99, 'USD', {
        fb_content_type: 'subscription',
        fb_content_name: 'Test Pro Subscription',
        test_event: 'true'
      });
      console.log('✅ Purchase event tracked');
      
      // Test StartTrial event
      facebookAnalyticsService.trackTrialStart('Yearly Pro', 3);
      console.log('✅ StartTrial event tracked');
      
    } catch (error) {
      console.error('❌ Core events test failed:', error);
      throw error;
    }
  }
  
  /**
   * Test custom ParleyApp-specific events
   */
  private static async testCustomEvents(): Promise<void> {
    console.log('\n🎰 Test 3: Custom ParleyApp Events');
    
    try {
      // Test Welcome Bonus event
      facebookAnalyticsService.trackWelcomeBonusClaimed(5);
      console.log('✅ WelcomeBonusClaimed event tracked');
      
      // Test Chat Usage event
      facebookAnalyticsService.trackChatUsage(3, 'free');
      console.log('✅ ChatUsage event tracked');
      
      // Test Daily Return event
      facebookAnalyticsService.trackDailyReturn(7);
      console.log('✅ DailyReturn event tracked');
      
      // Test custom event
      facebookAnalyticsService.trackCustomEvent('TestCustomEvent', {
        test_parameter: 'test_value',
        event_source: 'tracking_test'
      });
      console.log('✅ Custom event tracked');
      
    } catch (error) {
      console.error('❌ Custom events test failed:', error);
      throw error;
    }
  }
  
  /**
   * Test user properties for better ad targeting
   */
  private static async testUserProperties(): Promise<void> {
    console.log('\n👤 Test 4: User Properties');
    
    try {
      facebookAnalyticsService.setUserProperties({
        subscription_tier: 'pro',
        days_since_install: '7',
        favorite_sport: 'mlb',
        test_user: 'true'
      });
      console.log('✅ User properties set');
      
    } catch (error) {
      console.error('❌ User properties test failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate test events for Events Manager debugging
   */
  static async generateTestEvents(): Promise<void> {
    console.log('🚀 Generating test events for Events Manager...');
    
    // Generate multiple events with slight delays to simulate real usage
    const events = [
      () => facebookAnalyticsService.trackCompleteRegistration({ test_user: 'debug' }),
      () => facebookAnalyticsService.trackViewContent('Debug Daily Picks'),
      () => facebookAnalyticsService.trackAddToCart('Debug Pro', 19.99),
      () => facebookAnalyticsService.trackWelcomeBonusClaimed(5),
      () => facebookAnalyticsService.trackChatUsage(1, 'free'),
      () => facebookAnalyticsService.trackPurchase(19.99, 'USD', { test_purchase: 'debug' })
    ];
    
    for (let i = 0; i < events.length; i++) {
      try {
        events[i]();
        console.log(`✅ Test event ${i + 1} sent`);
        
        // Small delay between events
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Test event ${i + 1} failed:`, error);
      }
    }
    
    console.log('📱 Check Events Manager > Test Events tab now!');
  }
}

// Usage examples:
// FacebookTrackingTester.runAllTests();
// FacebookTrackingTester.generateTestEvents();

export default FacebookTrackingTester;
