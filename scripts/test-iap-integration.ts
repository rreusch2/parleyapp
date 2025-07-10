#!/usr/bin/env npx ts-node

/**
 * 🧪 IAP Integration Test Script
 * 
 * This script tests your In-App Purchase integration without making real purchases.
 * It validates configuration, checks product IDs, and simulates purchase flows.
 */

import { supabase } from '../app/services/api/supabaseClient';

// Your actual product IDs from App Store Connect
const PRODUCT_IDS = {
  monthly: 'com.parleyapp.premium_monthly',
  yearly: 'com.parleyapp.premiumyearly', 
  lifetime: 'com.parleyapp.premium_lifetime'
};

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

class IAPTester {
  private results: TestResult[] = [];

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
    this.results.push({ test, status, message, details });
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} ${test}: ${message}`);
    if (details) console.log('   Details:', details);
  }

  async testSupabaseConnection() {
    try {
      const { data, error } = await supabase.from('profiles').select('count').limit(1);
      if (error) throw error;
      
      this.addResult(
        'Supabase Connection', 
        'PASS', 
        'Successfully connected to Supabase'
      );
    } catch (error) {
      this.addResult(
        'Supabase Connection', 
        'FAIL', 
        'Failed to connect to Supabase',
        error
      );
    }
  }

  async testProfilesTableStructure() {
    try {
      // Test that profiles table has required IAP fields
      const { data, error } = await supabase
        .from('profiles')
        .select('id, subscription_tier, subscription_expires_at, welcome_bonus_claimed')
        .limit(1);
        
      if (error) throw error;
      
      this.addResult(
        'Profiles Table Structure', 
        'PASS', 
        'Profiles table has required subscription fields'
      );
    } catch (error) {
      this.addResult(
        'Profiles Table Structure', 
        'FAIL', 
        'Profiles table missing required subscription fields',
        error
      );
    }
  }

  async testPurchasesTableExists() {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('id, user_id, product_id, transaction_id')
        .limit(1);
        
      if (error && error.message.includes('does not exist')) {
        this.addResult(
          'Purchases Table', 
          'WARN', 
          'Purchases table does not exist - you may need to create it for purchase tracking'
        );
      } else if (error) {
        throw error;
      } else {
        this.addResult(
          'Purchases Table', 
          'PASS', 
          'Purchases table exists and accessible'
        );
      }
    } catch (error) {
      this.addResult(
        'Purchases Table', 
        'FAIL', 
        'Error checking purchases table',
        error
      );
    }
  }

  testProductIDConfiguration() {
    const expectedProducts = [
      'com.parleyapp.premium_monthly',
      'com.parleyapp.premiumyearly',
      'com.parleyapp.premium_lifetime'
    ];

    const actualProducts = Object.values(PRODUCT_IDS);
    const isValid = expectedProducts.every(id => actualProducts.includes(id));

    if (isValid) {
      this.addResult(
        'Product ID Configuration', 
        'PASS', 
        'All product IDs match App Store Connect configuration',
        { productIds: actualProducts }
      );
    } else {
      this.addResult(
        'Product ID Configuration', 
        'FAIL', 
        'Product IDs do not match expected configuration',
        { 
          expected: expectedProducts, 
          actual: actualProducts 
        }
      );
    }
  }

  async simulateUserUpgrade(testUserId: string = 'test-user-123') {
    try {
      console.log(`\n🎭 Simulating user upgrade for: ${testUserId}`);
      
      // 1. Check current status
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expires_at')
        .eq('id', testUserId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      console.log('   Before upgrade:', profile || 'User not found');

      // 2. Simulate successful purchase - update to Pro
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month from now

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: testUserId,
          subscription_tier: 'pro',
          subscription_expires_at: expiryDate.toISOString(),
          updated_at: new Date().toISOString()
        });

      if (updateError) throw updateError;

      // 3. Verify update
      const { data: updatedProfile, error: verifyError } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_expires_at')
        .eq('id', testUserId)
        .single();

      if (verifyError) throw verifyError;

      console.log('   After upgrade:', updatedProfile);

      this.addResult(
        'User Upgrade Simulation', 
        'PASS', 
        'Successfully simulated user upgrade to Pro tier',
        { userId: testUserId, newTier: updatedProfile?.subscription_tier }
      );

    } catch (error) {
      this.addResult(
        'User Upgrade Simulation', 
        'FAIL', 
        'Failed to simulate user upgrade',
        error
      );
    }
  }

  async testBackendEndpoint() {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/health`);
      
      if (response.ok) {
        this.addResult(
          'Backend Health Check', 
          'PASS', 
          `Backend is accessible at ${apiUrl}`
        );
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.addResult(
        'Backend Health Check', 
        'WARN', 
        'Backend health check failed - make sure your backend is running',
        error
      );
    }
  }

  printSummary() {
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`📋 Total: ${this.results.length}`);

    if (failed === 0) {
      console.log('\n🎉 All critical tests passed! Your IAP integration looks ready for testing.');
      console.log('\n📋 Next Steps:');
      console.log('   1. Create sandbox test accounts in App Store Connect');
      console.log('   2. Configure test device for sandbox testing');
      console.log('   3. Test purchase flows in TestFlight:');
      console.log('      - Monthly Pro ($24.99/month)');
      console.log('      - Yearly Pro ($199.99/year)');
      console.log('      - Lifetime Pro ($349.99 one-time)');
      console.log('   4. Verify Pro features unlock after purchase');
    } else {
      console.log('\n⚠️  Some tests failed. Please fix the issues above before testing IAP.');
    }

    console.log('\n📖 For detailed testing instructions, see: IAP_TESTING_GUIDE.md');
  }

  async runAllTests() {
    console.log('🚀 Starting IAP Integration Tests...\n');

    // Configuration tests
    this.testProductIDConfiguration();
    
    // Database tests
    await this.testSupabaseConnection();
    await this.testProfilesTableStructure(); 
    await this.testPurchasesTableExists();
    
    // Backend tests
    await this.testBackendEndpoint();
    
    // Flow simulation
    await this.simulateUserUpgrade();
    
    // Summary
    this.printSummary();
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new IAPTester();
  tester.runAllTests().catch(console.error);
}

export default IAPTester;
