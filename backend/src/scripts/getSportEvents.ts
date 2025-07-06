import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// If no API key in .env, ask user to input it
const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY || 'P7wI'; // Using first 4 chars from error message
console.log('🔑 API Key starts with:', SPORTRADAR_API_KEY.substring(0, 4));

// Using Odds Comparison API endpoints - testing various formats
const BASE_URL = 'https://api.sportradar.us';

// API endpoints to try based on subscriptions and documentation
const ENDPOINTS = [
  // Basic endpoints format
  { name: 'List All Sports', url: `${BASE_URL}/oddscomparison/production/v2/en/sports.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'Basketball Sports', url: `${BASE_URL}/oddscomparison/production/v2/en/sports/basketball.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'Football Sports', url: `${BASE_URL}/oddscomparison/production/v2/en/sports/american_football.json?api_key=${SPORTRADAR_API_KEY}` },
  
  // Try with different version format (trial)
  { name: 'List Sports v3', url: `${BASE_URL}/oddscomparison/trial/v3/en/sports.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'List Sports v4', url: `${BASE_URL}/oddscomparison/trial/v4/en/sports.json?api_key=${SPORTRADAR_API_KEY}` },
  
  // Trial API endpoints
  { name: 'Sports Trial', url: `${BASE_URL}/oddscomparison/trial/v2/en/sports.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'NBA Trial', url: `${BASE_URL}/oddscomparison/trial/v2/en/sports/basketball/nba.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'NFL Trial', url: `${BASE_URL}/oddscomparison/trial/v2/en/sports/american_football/nfl.json?api_key=${SPORTRADAR_API_KEY}` },
  
  // NBA endpoint
  { name: 'NBA Daily Schedule', url: `${BASE_URL}/nba/trial/v8/en/games/2024/06/05/schedule.json?api_key=${SPORTRADAR_API_KEY}` },
  
  // With different region formatting
  { name: 'Sports US', url: `${BASE_URL}/oddscomparison-us/trial/v2/en/sports.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'Sports EU', url: `${BASE_URL}/oddscomparison-eu/trial/v2/en/sports.json?api_key=${SPORTRADAR_API_KEY}` },
  
  // Player Props specific
  { name: 'Player Props Sports', url: `${BASE_URL}/oddscomparison-player-props/trial/v2/en/sports.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'NBA Player Props', url: `${BASE_URL}/oddscomparison-player-props/trial/v2/en/sports/basketball/nba.json?api_key=${SPORTRADAR_API_KEY}` },
  
  // Regular odds specific
  { name: 'Regular Odds Sports', url: `${BASE_URL}/oddscomparison-standard/trial/v2/en/sports.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'NBA Regular Odds', url: `${BASE_URL}/oddscomparison-standard/trial/v2/en/sports/basketball/nba.json?api_key=${SPORTRADAR_API_KEY}` },
  
  // Prematch odds specific
  { name: 'Prematch Sports', url: `${BASE_URL}/oddscomparison-prematch/trial/v2/en/sports.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'NBA Prematch', url: `${BASE_URL}/oddscomparison-prematch/trial/v2/en/sports/basketball/nba.json?api_key=${SPORTRADAR_API_KEY}` },
  
  // Direct sport APIs
  { name: 'NBA API', url: `${BASE_URL}/nba/trial/v8/en/league/hierarchy.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'NFL API', url: `${BASE_URL}/nfl/trial/v7/en/league/hierarchy.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'MLB API', url: `${BASE_URL}/mlb/trial/v7/en/league/hierarchy.json?api_key=${SPORTRADAR_API_KEY}` },
  { name: 'NHL API', url: `${BASE_URL}/nhl/trial/v7/en/league/hierarchy.json?api_key=${SPORTRADAR_API_KEY}` },
];

async function testSportRadarEndpoints() {
  console.log('🧪 Testing multiple endpoints to find working ones...\n');
  
  let successfulEndpoints = [];
  
  for (const endpoint of ENDPOINTS) {
    try {
      console.log(`🔍 Testing endpoint: ${endpoint.name}`);
      console.log(`🔗 URL: ${endpoint.url.replace(SPORTRADAR_API_KEY, '***')}`);
      
      const response = await fetch(endpoint.url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log(`✅ Success! Status: ${response.status}`);
        const data = await response.json();
        successfulEndpoints.push({
          name: endpoint.name,
          url: endpoint.url,
          data: data
        });
        
        // Save successful response to file
        fs.writeFileSync(
          path.join(__dirname, `../../data/${endpoint.name.replace(/\s/g, '_').toLowerCase()}.json`), 
          JSON.stringify(data, null, 2)
        );
        
        console.log(`💾 Data saved to data/${endpoint.name.replace(/\s/g, '_').toLowerCase()}.json`);
      } else {
        console.log(`❌ Failed with status: ${response.status}`);
      }
    } catch (error: any) {
      console.error(`❌ Error testing ${endpoint.name}:`, error.message);
    }
    
    console.log('-------------------');
  }
  
  console.log('\n📊 Results Summary:');
  if (successfulEndpoints.length > 0) {
    console.log(`✅ ${successfulEndpoints.length} working endpoints found!`);
    console.log('Working endpoints:');
    successfulEndpoints.forEach(endpoint => {
      console.log(`- ${endpoint.name}`);
    });
    
    console.log('\n🎉 Success! You can now use the working endpoints in your application.');
    console.log('\nHere are the working endpoint URLs:');
    successfulEndpoints.forEach(endpoint => {
      console.log(`${endpoint.name}: ${endpoint.url.replace(SPORTRADAR_API_KEY, '***')}`);
    });
  } else {
    console.log('❌ No working endpoints found.');
    console.log('\n👉 Troubleshooting steps:');
    console.log('1. Verify your API key is correct - current key begins with:', SPORTRADAR_API_KEY.substring(0, 4));
    console.log('2. Check your SportRadar subscription status - you need an active trial or paid subscription');
    console.log('3. Ensure you are using the complete API key, not just the prefix');
    console.log('4. Confirm IP restrictions - some API keys are restricted to specific IPs');
    console.log('5. Check if your trial period has expired');
    console.log('\n📝 Next steps:');
    console.log('1. Contact SportRadar support to confirm your subscription details');
    console.log('2. Verify the complete API key (not just the prefix)');
    console.log('3. Consider updating to a paid subscription if needed');
  }
}

// Make sure the data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log(`\n🎯 Testing SportRadar API endpoints...\n`);
testSportRadarEndpoints(); 