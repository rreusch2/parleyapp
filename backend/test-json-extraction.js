const axios = require('axios');

async function testJSONExtraction() {
  try {
    console.log('🔍 Testing JSON extraction from ESPN...');
    
    const url = 'https://www.espn.com/mlb/injuries';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000
    });
    
    const html = response.data;
    
    // Try different patterns to find the JSON data
    console.log('\n🔎 Looking for JSON patterns...');
    
    // Pattern 1: Look for "data": followed by object
    const pattern1 = html.match(/"data":\s*({.*?"dropdownTeams".*?})/s);
    console.log('Pattern 1 (data + dropdownTeams):', pattern1 ? 'FOUND' : 'NOT FOUND');
    
    // Pattern 2: Look for teams array
    const pattern2 = html.match(/"teams":\s*\[(.*?)\]/s);
    console.log('Pattern 2 (teams array):', pattern2 ? 'FOUND' : 'NOT FOUND');
    
    // Pattern 3: Look for displayName (team names)
    const pattern3 = html.match(/"displayName":\s*"([^"]+)"/g);
    console.log('Pattern 3 (displayName):', pattern3 ? `FOUND ${pattern3.length} matches` : 'NOT FOUND');
    if (pattern3) {
      console.log('Team names found:', pattern3.slice(0, 5).map(match => match.replace(/"displayName":\s*"([^"]+)"/, '$1')));
    }
    
    // Pattern 4: Look for statusDesc
    const pattern4 = html.match(/"statusDesc":\s*"([^"]+)"/g);
    console.log('Pattern 4 (statusDesc):', pattern4 ? `FOUND ${pattern4.length} matches` : 'NOT FOUND');
    if (pattern4) {
      console.log('Status examples:', pattern4.slice(0, 5).map(match => match.replace(/"statusDesc":\s*"([^"]+)"/, '$1')));
    }
    
    // Pattern 5: Look for the whole window.__NEXT_DATA__ or similar
    const pattern5 = html.match(/window\.__NEXT_DATA__\s*=\s*({.*?});/s);
    console.log('Pattern 5 (NEXT_DATA):', pattern5 ? 'FOUND' : 'NOT FOUND');
    
    // Pattern 6: Look for any large JSON object
    const pattern6 = html.match(/({.*?"Arizona Diamondbacks".*?})/s);
    console.log('Pattern 6 (Arizona Diamondbacks):', pattern6 ? 'FOUND' : 'NOT FOUND');
    
    // If we found something, try to parse a small sample
    if (pattern3 && pattern4) {
      console.log('\n✅ Found injury data patterns! The JSON structure is embedded in the HTML.');
      
      // Try to find a more complete JSON structure
      const fullPattern = html.match(/({.*?"teams":\s*\[.*?"dropdownTeams".*?})/s);
      if (fullPattern) {
        try {
          const data = JSON.parse(fullPattern[1]);
          console.log('\n🎉 Successfully parsed JSON data!');
          console.log(`Teams found: ${data.teams ? data.teams.length : 0}`);
          
          if (data.teams && data.teams[0]) {
            const firstTeam = data.teams[0];
            console.log(`First team: ${firstTeam.displayName}`);
            console.log(`Injuries: ${firstTeam.items ? firstTeam.items.length : 0}`);
            
            if (firstTeam.items && firstTeam.items[0]) {
              const firstInjury = firstTeam.items[0];
              console.log('Sample injury:', {
                player: firstInjury.athlete?.name,
                position: firstInjury.athlete?.position,
                status: firstInjury.statusDesc,
                returnDate: firstInjury.date
              });
            }
          }
        } catch (error) {
          console.log('❌ Failed to parse JSON:', error.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing JSON extraction:', error.message);
  }
}

testJSONExtraction(); 