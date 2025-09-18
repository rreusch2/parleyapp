/**
 * Meta Setup Debugger - Test your Facebook/Meta configuration
 * Run this to diagnose and fix your tracking issues
 */

const axios = require('axios');

class MetaSetupDebugger {
  constructor() {
    // Your app configuration
    this.APP_ID = process.env.META_APP_ID || '1019527860059930'; // From your app.config.js
    this.ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN'; // Replace with your token from Graph API Explorer
    this.BUSINESS_ID = '165102258592246'; // From your setup
    this.AD_ACCOUNT_ID = '23853159778740687'; // From your setup
    this.TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || 'TEST12345'; // From Events Manager > App > Test Events
  }

  /**
   * Run all debugging tests
   */
  async runAllTests() {
    console.log('🔍 Starting Meta Setup Debugging...\n');
    
    try {
      await this.testAppAccess();
      await this.testDataSources();
      await this.testBusinessPermissions();
      await this.testAdAccountAccess();
      await this.testEventSubmission();
      
      console.log('\n✅ Meta debugging completed!');
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Fix any permission errors shown above');
      console.log('2. Clean up duplicate data sources in Events Manager');
      console.log('3. Rebuild your app with the iOS tracking fixes');
      console.log('4. Test event tracking using the test script');
      
    } catch (error) {
      console.error('❌ Debug test failed:', error.message);
    }
  }

  /**
   * Test access to your app
   */
  async testAppAccess() {
    console.log('🔧 Testing App Access...');
    
    try {
      const response = await axios.get(`https://graph.facebook.com/v18.0/${this.APP_ID}`, {
        params: {
          access_token: this.ACCESS_TOKEN,
          fields: 'id,name,category,app_domains'
        }
      });
      
      console.log('✅ App access successful');
      console.log(`   App Name: ${response.data.name}`);
      console.log(`   App ID: ${response.data.id}`);
      console.log(`   Category: ${response.data.category}`);
      
    } catch (error) {
      console.error('❌ App access failed:', error.response?.data || error.message);
      console.log('   💡 FIX: Generate new access token with app permissions');
    }
  }

  /**
   * Test data sources access
   */
  async testDataSources() {
    console.log('\n📊 Testing Data Sources...');
    
    // Prefer your real App ID; optionally include an extra dataset via env
    const datasets = [this.APP_ID];
    if (process.env.META_EXTRA_DATASET_ID) {
      datasets.push(process.env.META_EXTRA_DATASET_ID);
    }
    
    for (const datasetId of datasets) {
      try {
        const response = await axios.get(`https://graph.facebook.com/v18.0/${datasetId}`, {
          params: {
            access_token: this.ACCESS_TOKEN,
            fields: 'id,name,creation_time,business'
          }
        });
        
        console.log(`✅ Dataset ${datasetId} accessible`);
        console.log(`   Name: ${response.data.name}`);
        console.log(`   Created: ${response.data.creation_time}`);
        
      } catch (error) {
        console.error(`❌ Dataset ${datasetId} failed:`, error.response?.data?.error || error.message);
        
        if (error.response?.data?.error?.code === 100) {
          console.log('   💡 FIX: Add dataset permissions in Business Manager');
          console.log('   💡 FIX: Or delete this unused dataset');
        }
      }
    }
  }

  /**
   * Test business manager permissions
   */
  async testBusinessPermissions() {
    console.log('\n🏢 Testing Business Manager Permissions...');
    
    try {
      const response = await axios.get(`https://graph.facebook.com/v18.0/${this.BUSINESS_ID}`, {
        params: {
          access_token: this.ACCESS_TOKEN,
          fields: 'id,name,created_time'
        }
      });
      
      console.log('✅ Business Manager access successful');
      console.log(`   Business: ${response.data.name}`);
      console.log(`   ID: ${response.data.id}`);
      
    } catch (error) {
      console.error('❌ Business Manager access failed:', error.response?.data || error.message);
      console.log('   💡 FIX: Add business_management permission to access token');
    }
  }

  /**
   * Test ad account access
   */
  async testAdAccountAccess() {
    console.log('\n💰 Testing Ad Account Access...');
    
    try {
      const response = await axios.get(`https://graph.facebook.com/v18.0/act_${this.AD_ACCOUNT_ID}`, {
        params: {
          access_token: this.ACCESS_TOKEN,
          fields: 'id,name,account_status,currency'
        }
      });
      
      console.log('✅ Ad Account access successful');
      console.log(`   Account: ${response.data.name}`);
      console.log(`   Status: ${response.data.account_status}`);
      console.log(`   Currency: ${response.data.currency}`);
      
    } catch (error) {
      console.error('❌ Ad Account access failed:', error.response?.data || error.message);
      console.log('   💡 FIX: Add ads_management permission to access token');
    }
  }

  /**
   * Test event submission to your app
   */
  async testEventSubmission() {
    console.log('\n🎯 Testing Event Submission...');
    
    try {
      const eventData = {
        data: [{
          event_name: 'ViewContent',
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'app',
          app_data: {
            application_tracking_enabled: true,
            advertiser_tracking_enabled: true
          },
          custom_data: {
            content_name: 'Debug Test Event',
            content_category: 'test'
          }
        }],
        // Use your real Test Event Code from Events Manager
        test_event_code: this.TEST_EVENT_CODE
      };

      const response = await axios.post(`https://graph.facebook.com/v18.0/${this.APP_ID}/activities`, eventData, {
        params: {
          access_token: this.ACCESS_TOKEN
        }
      });
      
      console.log('✅ Test event submitted successfully');
      console.log('   📱 Check Events Manager > Test Events tab');
      
    } catch (error) {
      console.error('❌ Event submission failed:', error.response?.data || error.message);
      console.log('   💡 FIX: Check app permissions and event data format');
    }
  }

  /**
   * Generate access token instructions
   */
  static getAccessTokenInstructions() {
    console.log('\n🔑 HOW TO GET ACCESS TOKEN:');
    console.log('1. Go to https://developers.facebook.com/tools/explorer/');
    console.log('2. Select your app: Predictive Play');
    console.log('3. Select these permissions:');
    console.log('   - ads_management');
    console.log('   - business_management');
    console.log('   - events_management');
    console.log('4. Click "Generate Access Token"');
    console.log('5. Copy the token and replace YOUR_ACCESS_TOKEN in this script');
    console.log('6. Set env vars when running:');
    console.log('   META_APP_ID=1019527860059930 META_TEST_EVENT_CODE=YOUR_CODE META_ACCESS_TOKEN=EAAB... node scripts/debug-meta-setup.js');
  }
}

// Usage:
// 1. Replace YOUR_ACCESS_TOKEN with your actual token
// 2. Run: node scripts/debug-meta-setup.js

const debugger = new MetaSetupDebugger();

// Show instructions if no token provided
if (debugger.ACCESS_TOKEN === 'YOUR_ACCESS_TOKEN') {
  MetaSetupDebugger.getAccessTokenInstructions();
} else {
  debugger.runAllTests();
}

module.exports = MetaSetupDebugger;
