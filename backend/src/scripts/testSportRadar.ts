import sportRadarService from '../services/sportsData/sportRadarService';

/**
 * Simple test script to try out the SportRadar service
 */
async function testSportRadarService() {
  try {
    console.log('🧪 Testing SportRadar Service\n');

    // Test player props sports endpoint
    console.log('📊 Fetching Player Props Sports...');
    const sports = await sportRadarService.getAvailableSports();
    console.log('✅ Success! Found', Object.keys(sports.sports || {}).length, 'sports');
    
    // Test NBA hierarchy endpoint
    console.log('\n📊 Fetching NBA Hierarchy...');
    const nbaHierarchy = await sportRadarService.getNbaHierarchy();
    console.log('✅ Success!', nbaHierarchy?.league?.name || 'NBA');
    
    // Test NBA schedule
    const today = new Date();
    const year = today.getFullYear().toString();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    
    console.log(`\n📊 Fetching NBA Schedule for ${year}-${month}-${day}...`);
    const nbaSchedule = await sportRadarService.getNbaDailySchedule(year, month, day);
    console.log('✅ Success!', nbaSchedule?.games?.length || 0, 'games found');
    
    // If there are games, fetch a boxscore for the first game
    if (nbaSchedule?.games?.length > 0) {
      const gameId = nbaSchedule.games[0].id;
      console.log(`\n📊 Fetching Boxscore for game ${gameId}...`);
      const boxscore = await sportRadarService.getNbaGameBoxscore(gameId);
      console.log('✅ Success!', boxscore ? 'Boxscore retrieved' : 'No boxscore data');
    }
    
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error testing SportRadar service:', error);
  }
}

// Run the test
testSportRadarService(); 