const axios = require('axios');
const cheerio = require('cheerio');

async function testInjuryScraping() {
  try {
    console.log('🏥 Testing ESPN injury scraping...');
    
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
    
    const $ = cheerio.load(response.data);
    
    console.log('✅ Successfully fetched ESPN injury page');
    console.log(`📄 Page title: ${$('title').text()}`);
    
    // Look for injury tables
    const tables = $('table');
    console.log(`📊 Found ${tables.length} tables on the page`);
    
    // Sample some injury data
    let injuryCount = 0;
    $('table tbody tr').each((index, row) => {
      if (index < 5) { // Show first 5 for testing
        const cells = $(row).find('td');
        if (cells.length >= 4) {
          const playerName = cells.eq(0).text().trim();
          const position = cells.eq(1).text().trim();
          const status = cells.eq(3).text().trim();
          
          if (playerName && position && status) {
            console.log(`🏈 Player: ${playerName} | Position: ${position} | Status: ${status}`);
            injuryCount++;
          }
        }
      }
    });
    
    console.log(`\n✅ Found ${injuryCount} sample injuries`);
    console.log('🎉 ESPN injury scraping test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing injury scraping:', error.message);
  }
}

testInjuryScraping(); 