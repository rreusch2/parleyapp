#!/usr/bin/env node

// Import the fetch function from compiled JS file
const { fetchAllGameData } = require('../dist/scripts/fetchTheOddsGames');

// Run the fetcher
console.log('📈 TheOdds API Fetcher');
console.log('=======================');

fetchAllGameData()
  .then((count) => {
    console.log(`✅ Successfully fetched ${count} games with odds data`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  }); 