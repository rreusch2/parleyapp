import axios from 'axios';

const SPORTSDATA_API_KEY = 'd174f0ac08504e45806435851b5ab630';
const SPORTSDATA_BASE_URL = 'https://api.sportsdata.io/v3/nfl';

async function debugNFLData() {
  try {
    console.log('🔍 Testing SportsData.io API...\n');

    // Test 1: Try to fetch players for 2024 season
    console.log('1️⃣ Testing Players endpoint...');
    const playersResponse = await axios.get(
      `${SPORTSDATA_BASE_URL}/scores/json/Players/2024?key=${SPORTSDATA_API_KEY}`
    );
    
    console.log(`✅ Players API works! Found ${playersResponse.data.length} players`);
    
    // Look for Jaden Daniels specifically
    const jadenCandidates = playersResponse.data.filter((p: any) => 
      (p.Name?.includes('Daniels') || p.LastName?.includes('Daniels')) && 
      p.Position === 'QB'
    );
    
    console.log('\n🔍 QB Daniels candidates:', jadenCandidates.map((p: any) => ({
      PlayerID: p.PlayerID,
      Name: p.Name,
      FirstName: p.FirstName,
      LastName: p.LastName,
      Team: p.Team,
      Position: p.Position
    })));

    // Test 2: Try headshots endpoint
    console.log('\n2️⃣ Testing Headshots endpoint...');
    const headshotsResponse = await axios.get(
      `${SPORTSDATA_BASE_URL}/headshots/json/Headshots?key=${SPORTSDATA_API_KEY}`
    );
    
    console.log(`✅ Headshots API works! Found ${headshotsResponse.data.length} headshots`);
    
    // Look for any Daniels in headshots
    const jadenHeadshots = headshotsResponse.data.filter((h: any) => 
      h.Name?.includes('Daniels') && h.Position === 'QB'
    );
    
    console.log('\n🔍 QB Daniels headshots:', jadenHeadshots.map((h: any) => ({
      PlayerID: h.PlayerID,
      Name: h.Name,
      Team: h.Team,
      Position: h.Position,
      UsaTodayHeadshotUrl: h.UsaTodayHeadshotUrl ? 'YES' : 'NO'
    })));

    // Test 3: Show first 5 Washington QBs from SportsData
    console.log('\n3️⃣ Washington QBs in SportsData:');
    const washingtonQBs = playersResponse.data.filter((p: any) => 
      p.Team === 'WAS' && p.Position === 'QB'
    );
    
    washingtonQBs.slice(0, 5).forEach((qb: any) => {
      console.log(`- PlayerID: ${qb.PlayerID}, Name: "${qb.Name}", FirstName: "${qb.FirstName}", LastName: "${qb.LastName}"`);
    });

    console.log('\n✅ Debug complete!');

  } catch (error: any) {
    console.error('❌ Error during debug:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

debugNFLData();
