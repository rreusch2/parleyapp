const axios = require('axios');
const cheerio = require('cheerio');

async function analyzeESPNStructure() {
  try {
    console.log('🔍 Analyzing ESPN injury page structure...');
    
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
    
    // Look for team headers
    console.log('\n🏈 Looking for team headers...');
    let teamCount = 0;
    
    // Check images with alt text
    $('img[alt]').each((index, element) => {
      const altText = $(element).attr('alt');
      if (altText && altText.length > 3 && 
          !altText.toLowerCase().includes('logo') && 
          !altText.toLowerCase().includes('espn') && 
          !altText.toLowerCase().includes('bet')) {
        console.log(`📍 Team image found: "${altText}"`);
        teamCount++;
        if (teamCount > 5) return false; // Stop after 5 for brevity
      }
    });
    
    // Look for table structure
    console.log('\n📊 Analyzing table structure...');
    const tables = $('table');
    console.log(`Found ${tables.length} tables`);
    
    tables.each((tableIndex, table) => {
      if (tableIndex < 3) { // Look at first 3 tables
        const $table = $(table);
        const headers = $table.find('thead th, tr:first-child td');
        
        console.log(`\nTable ${tableIndex + 1}:`);
        console.log('Headers:', headers.map((i, el) => $(el).text().trim()).get());
        
        // Look at first few rows
        const rows = $table.find('tbody tr');
        console.log(`Rows: ${rows.length}`);
        
        rows.slice(0, 3).each((rowIndex, row) => {
          const cells = $(row).find('td');
          const rowData = cells.map((i, cell) => $(cell).text().trim()).get();
          console.log(`Row ${rowIndex + 1}:`, rowData);
        });
      }
    });
    
    // Look for specific team sections
    console.log('\n🔎 Looking for team sections...');
    
    // Try to find Arizona Diamondbacks section specifically
    $('*').each((index, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      
      if (text.includes('Arizona Diamondbacks') || text.includes('Diamondbacks')) {
        console.log(`Found Arizona reference: "${text}" in ${element.tagName || element.name}`);
        
        // Look for following table
        const nextTable = $el.nextAll('table').first();
        if (nextTable.length > 0) {
          console.log('Found table after Arizona reference');
          const firstRow = nextTable.find('tbody tr').first();
          if (firstRow.length > 0) {
            const cells = firstRow.find('td');
            console.log('First injury row:', cells.map((i, cell) => $(cell).text().trim()).get());
          }
        }
        
        return false; // Stop after first match
      }
    });
    
  } catch (error) {
    console.error('❌ Error analyzing ESPN structure:', error.message);
  }
}

analyzeESPNStructure(); 