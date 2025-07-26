const axios = require('axios');
require('dotenv').config();

const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

async function testWebSearch(query) {
  console.log(`Testing web search for: "${query}"`);
  
  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        q: query,
        key: GOOGLE_SEARCH_API_KEY,
        cx: GOOGLE_SEARCH_ENGINE_ID,
        num: 5,
        safe: 'off',
        dateRestrict: 'm1'
      },
      timeout: 10000
    });
    
    const items = response.data.items || [];
    
    if (items.length === 0) {
      console.log('No results found');
      return [];
    }
    
    const results = items.map(item => ({
      title: item.title || 'No title',
      link: item.link || '',
      snippet: item.snippet || 'No description available',
      source: 'Google Custom Search',
      publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time'] || 
                    item.pagemap?.metatags?.[0]?.['og:updated_time'] ||
                    item.pagemap?.metatags?.[0]?.['date']
    })).filter(result => result.link && result.title !== 'No title');
    
    console.log(`\n=== SEARCH RESULTS (${results.length} found) ===`);
    results.forEach((result, i) => {
      console.log(`${i+1}. ${result.title}`);
      console.log(`   Source: ${result.source}`);
      console.log(`   Snippet: ${result.snippet}`);
      console.log(`   Link: ${result.link}`);
      if (result.publishedDate) {
        console.log(`   Published: ${result.publishedDate}`);
      }
      console.log('---');
    });
    
    return results;
  } catch (error) {
    console.error('Search failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Test with Hulk Hogan query
testWebSearch('Hulk Hogan death 2025').catch(console.error);
