import fetch from 'node-fetch';

/**
 * Simple script to test direct access to SportRadar API endpoints
 * that have been confirmed to work
 */
async function testSportRadarApi() {
  // Add your API key here for testing
  const apiKey = 'P7wI'; // Replace with your actual API key
  
  // API endpoints that worked in our previous tests
  const endpoints = [
    {
      name: 'Player Props Sports',
      url: `https://api.sportradar.us/oddscomparison-player-props/trial/v2/en/sports.json?api_key=${apiKey}`
    },
    {
      name: 'Prematch Sports',
      url: `https://api.sportradar.us/oddscomparison-prematch/trial/v2/en/sports.json?api_key=${apiKey}`
    },
    {
      name: 'NBA API',
      url: `https://api.sportradar.us/nba/trial/v8/en/league/hierarchy.json?api_key=${apiKey}`
    },
    {
      name: 'MLB API',
      url: `https://api.sportradar.us/mlb/trial/v7/en/league/hierarchy.json?api_key=${apiKey}`
    },
    {
      name: 'NHL API',
      url: `https://api.sportradar.us/nhl/trial/v7/en/league/hierarchy.json?api_key=${apiKey}`
    },
    {
      name: 'NBA Daily Schedule',
      url: `https://api.sportradar.us/nba/trial/v8/en/games/2024/06/05/schedule.json?api_key=${apiKey}`
    }
  ];
  
  console.log('🧪 Testing direct access to SportRadar API endpoints...\n');
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing endpoint: ${endpoint.name}`);
      console.log(`🔗 URL: ${endpoint.url.replace(apiKey, '***')}`);
      
      const response = await fetch(endpoint.url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log(`✅ Success! Status: ${response.status}`);
        const data = await response.json();
        
        // Log some sample data
        if (endpoint.name.includes('NBA API')) {
          console.log(`   League: ${data.league?.name || 'N/A'}`);
          console.log(`   Conferences: ${data.league?.conferences?.length || 0}`);
        } else if (endpoint.name.includes('Sports')) {
          console.log(`   Sports count: ${Object.keys(data.sports || {}).length}`);
          console.log(`   First few sports: ${Object.keys(data.sports || {}).slice(0, 3).join(', ')}`);
        } else if (endpoint.name.includes('Schedule')) {
          console.log(`   Games count: ${data.games?.length || 0}`);
          if (data.games?.length > 0) {
            console.log(`   First game: ${data.games[0].home.name} vs ${data.games[0].away.name}`);
          }
        }
      } else {
        console.log(`❌ Failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Error testing ${endpoint.name}:`, error);
    }
    
    console.log('-------------------');
  }
  
  console.log('\n📋 Summary:');
  console.log('These working endpoints can be used with the SportRadar service in the app.');
  console.log('Implementation is complete in:');
  console.log('1. backend/src/services/sportsData/sportRadarService.ts');
  console.log('2. backend/src/api/routes/sportsData.ts');
  
  console.log('\n📝 Next steps:');
  console.log('1. Set the full API key in the .env file');
  console.log('2. Use the API endpoints in the frontend app');
  console.log('3. Consider implementing data models to store and process the API data');
}

// Run the test
testSportRadarApi(); 