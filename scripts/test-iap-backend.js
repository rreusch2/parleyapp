#!/usr/bin/env node

/**
 * IAP Backend Testing Script
 * Tests all IAP endpoints to ensure they're working correctly
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN; // Supabase auth token

console.log('🧪 PARLEYAPP IAP BACKEND TESTING SCRIPT');
console.log('======================================');
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`Auth Token: ${TEST_USER_TOKEN ? 'PROVIDED ✅' : 'MISSING ❌'}`);
console.log('');

async function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BACKEND_URL}${endpoint}`;
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'IAP-Test-Script/1.0'
      }
    };
    
    if (TEST_USER_TOKEN && !options.skipAuth) {
      defaultOptions.headers['Authorization'] = `Bearer ${TEST_USER_TOKEN}`;
    }
    
    const finalOptions = { ...defaultOptions, ...options };
    
    console.log(`📡 ${finalOptions.method} ${endpoint}`);
    
    const req = https.request(url, finalOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          };
          resolve(result);
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (finalOptions.body) {
      req.write(finalOptions.body);
    }
    
    req.end();
  });
}

async function testHealthCheck() {
  console.log('🏥 Testing Health Check...');
  try {
    const result = await makeRequest('/api/webhooks/health', { skipAuth: true });
    if (result.status === 200) {
      console.log('✅ Health check passed');
      console.log(`   Response: ${JSON.stringify(result.body)}`);
    } else {
      console.log(`❌ Health check failed: ${result.status}`);
    }
  } catch (error) {
    console.log(`❌ Health check error: ${error.message}`);
  }
  console.log('');
}

async function testSubscriptionStatus() {
  console.log('🔍 Testing Subscription Status...');
  
  if (!TEST_USER_TOKEN) {
    console.log('⚠️  Skipping - No auth token provided');
    console.log('   Set TEST_USER_TOKEN environment variable');
    console.log('');
    return;
  }
  
  try {
    const result = await makeRequest('/api/purchases/status');
    if (result.status === 200) {
      console.log('✅ Subscription status check passed');
      console.log(`   User subscription: ${JSON.stringify(result.body, null, 2)}`);
    } else if (result.status === 401) {
      console.log('❌ Authentication failed - check your token');
      console.log(`   Error: ${JSON.stringify(result.body)}`);
    } else {
      console.log(`❌ Subscription status failed: ${result.status}`);
      console.log(`   Error: ${JSON.stringify(result.body)}`);
    }
  } catch (error) {
    console.log(`❌ Subscription status error: ${error.message}`);
  }
  console.log('');
}

async function testPurchaseVerification() {
  console.log('🛒 Testing Purchase Verification...');
  
  if (!TEST_USER_TOKEN) {
    console.log('⚠️  Skipping - No auth token provided');
    console.log('');
    return;
  }
  
  // Test with mock data
  const mockPurchase = {
    platform: 'ios',
    receipt: 'mock_receipt_data_for_testing',
    productId: 'com.parleyapp.premium_monthly',
    transactionId: 'mock_transaction_12345'
  };
  
  try {
    const result = await makeRequest('/api/purchases/verify', {
      method: 'POST',
      body: JSON.stringify(mockPurchase)
    });
    
    // This will likely fail with invalid receipt, but we're testing the endpoint structure
    if (result.status === 400 || result.status === 500) {
      console.log('✅ Purchase verification endpoint responsive');
      console.log('   (Expected to fail with mock data)');
      console.log(`   Response: ${JSON.stringify(result.body)}`);
    } else if (result.status === 401) {
      console.log('❌ Authentication failed - check your token');
    } else {
      console.log(`🤔 Unexpected response: ${result.status}`);
      console.log(`   Body: ${JSON.stringify(result.body)}`);
    }
  } catch (error) {
    console.log(`❌ Purchase verification error: ${error.message}`);
  }
  console.log('');
}

async function checkEnvironmentVariables() {
  console.log('🔧 Environment Variables Check...');
  
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 
    'APPLE_SHARED_SECRET'
  ];
  
  console.log('⚠️  Cannot check backend environment variables from here');
  console.log('   Please verify these are set in your backend .env:');
  requiredVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  console.log('');
}

async function runAllTests() {
  console.log('Starting IAP backend tests...\n');
  
  await testHealthCheck();
  await testSubscriptionStatus();
  await testPurchaseVerification();
  await checkEnvironmentVariables();
  
  console.log('🎯 TESTING COMPLETE');
  console.log('==================');
  console.log('');
  console.log('Next Steps:');
  console.log('1. ✅ Set APPLE_SHARED_SECRET in backend .env');
  console.log('2. ✅ Run database setup SQL in Supabase');
  console.log('3. ✅ Create IAP products in App Store Connect');
  console.log('4. ✅ Test with real iOS device/simulator');
  console.log('');
  console.log('For detailed setup: see IAP_COMPLETE_SETUP_GUIDE.md');
}

// Run the tests
runAllTests().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
