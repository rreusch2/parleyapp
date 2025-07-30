/**
 * User Preferences Integration Test Script
 * 
 * This script tests the complete user preferences flow:
 * 1. API endpoint for saving preferences to Supabase
 * 2. Onboarding flow with preferences modal before subscription modal
 * 3. Pick distribution locking for free users
 */

const { execSync } = require('child_process');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '../.env' });

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test API settings
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test-user@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

// Test data
const testPreferences = {
  sport_preferences: { mlb: true, wnba: true, ufc: false },
  betting_style: 'aggressive',
  pick_distribution: { auto: false, custom: { mlb_team: 7, mlb_props: 8, wnba_team: 5, wnba_props: 0 } }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Print a formatted header
 */
function printHeader(text) {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.cyan + ' ' + text + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset + '\n');
}

/**
 * Sign up a test user and get auth token
 */
async function getAuthToken() {
  try {
    printHeader('Creating test user and getting auth token');

    // Try to delete existing test user if it exists
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('email', TEST_USER_EMAIL)
        .limit(1);

      if (users && users.length > 0) {
        console.log(`🗑️ Removing existing test user: ${TEST_USER_EMAIL}`);
        await supabase.auth.admin.deleteUser(users[0].id);
      }
    } catch (error) {
      console.log(`ℹ️ No existing test user found or unable to delete`);
    }

    // Create a new test user
    console.log(`🔑 Creating test user: ${TEST_USER_EMAIL}`);
    const { data, error } = await supabase.auth.signUp({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }

    console.log(`✅ Test user created with ID: ${data.user.id}`);
    return { token: data.session.access_token, userId: data.user.id };
  } catch (error) {
    console.error(`${colors.red}❌ Auth error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Test updating user preferences via API
 */
async function testPreferencesAPI(token, userId) {
  try {
    printHeader('Testing user preferences API endpoint');
    console.log('📦 Test data:', JSON.stringify(testPreferences, null, 2));

    // Call the API to update preferences
    const response = await axios.put(
      `${API_BASE_URL}/api/user/preferences`,
      testPreferences,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`${colors.green}✅ API response: ${response.status} ${JSON.stringify(response.data)}${colors.reset}`);

    // Verify database was updated correctly
    console.log('\n🔍 Verifying database updates...');
    const { data, error } = await supabase
      .from('profiles')
      .select('sport_preferences, betting_style, pick_distribution')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    console.log('📋 Database values:');
    console.log(JSON.stringify(data, null, 2));

    // Check if values match
    const sportPrefsMatch = JSON.stringify(data.sport_preferences) === JSON.stringify(testPreferences.sport_preferences);
    const bettingStyleMatch = data.betting_style === testPreferences.betting_style;
    const pickDistMatch = JSON.stringify(data.pick_distribution) === JSON.stringify(testPreferences.pick_distribution);

    if (sportPrefsMatch && bettingStyleMatch && pickDistMatch) {
      console.log(`${colors.green}✅ All preferences correctly saved to database!${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Database values don't match test data:${colors.reset}`);
      if (!sportPrefsMatch) console.log(`${colors.red}  - Sport preferences mismatch${colors.reset}`);
      if (!bettingStyleMatch) console.log(`${colors.red}  - Betting style mismatch${colors.reset}`);
      if (!pickDistMatch) console.log(`${colors.red}  - Pick distribution mismatch${colors.reset}`);
    }

  } catch (error) {
    console.error(`${colors.red}❌ API test failed: ${error.message}${colors.reset}`);
    if (error.response) {
      console.error(`${colors.red}Status: ${error.response.status}${colors.reset}`);
      console.error(`${colors.red}Response: ${JSON.stringify(error.response.data)}${colors.reset}`);
    }
  }
}

/**
 * Main test function
 */
async function runTests() {
  printHeader('USER PREFERENCES INTEGRATION TEST');
  console.log('🔧 Testing environment:');
  console.log(`  - API URL: ${API_BASE_URL}`);
  console.log(`  - Supabase URL: ${supabaseUrl}`);

  try {
    // Get auth token for API calls
    const { token, userId } = await getAuthToken();
    
    // Test preferences API
    await testPreferencesAPI(token, userId);

    console.log('\n📱 UI Flow Manual Testing Instructions:');
    console.log('1. Test Signup Flow:');
    console.log('   - Create a new account');
    console.log('   - Verify User Preferences modal appears before Subscription modal');
    console.log('   - Set preferences and verify they save correctly');
    
    console.log('\n2. Test Settings Flow:');
    console.log('   - Log in as a free user');
    console.log('   - Go to Settings and open User Preferences');
    console.log('   - Try to set custom Pick Distribution');
    console.log('   - Verify upgrade prompt appears');
    
    console.log('\n3. Test Pro User Experience:');
    console.log('   - Log in as a pro user');
    console.log('   - Verify custom Pick Distribution is available without prompts');

    printHeader('TEST COMPLETE');
  } catch (error) {
    console.error(`${colors.red}❌ Test failed: ${error.message}${colors.reset}`);
  }
}

// Run the tests
runTests();
