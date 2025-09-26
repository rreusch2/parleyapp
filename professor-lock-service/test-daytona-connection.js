const axios = require('axios');

// Test script to discover Daytona endpoints
async function testDaytonaConnection() {
  const WORKSPACE_URL = process.env.DAYTONA_WORKSPACE_URL || 'https://your-workspace.daytona.io';
  const API_KEY = process.env.DAYTONA_API_KEY;
  
  if (!API_KEY || API_KEY === 'your_daytona_api_key_here') {
    console.log('❌ Please set your DAYTONA_API_KEY in .env file');
    return;
  }

  console.log(`🔍 Testing connection to: ${WORKSPACE_URL}`);
  
  // Test common endpoints
  const endpoints = [
    '/api/v1/agent',
    '/api/agent', 
    '/agent',
    '/chat',
    '/api/chat',
    '/v1/chat',
    '/health',
    '/status'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testing: ${WORKSPACE_URL}${endpoint}`);
      
      const response = await axios.get(`${WORKSPACE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      console.log(`✅ ${endpoint} - Status: ${response.status}`);
      if (response.data) {
        console.log(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 200));
      }
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ ${endpoint} - Status: ${error.response.status} (${error.response.statusText})`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`🔌 ${endpoint} - Connection refused (service may not be running)`);
      } else {
        console.log(`❌ ${endpoint} - Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n📋 Summary:');
  console.log('- Update DAYTONA_WORKSPACE_URL with your actual workspace URL');
  console.log('- Use the endpoint that returns a successful response');
  console.log('- If no endpoints work, you may need to deploy the agent service first');
}

// Run the test
testDaytonaConnection().catch(console.error);
