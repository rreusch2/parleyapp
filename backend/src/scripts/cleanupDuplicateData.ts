// Cleanup script to remove duplicate test data
// This safely removes only today's player props data to avoid constraint conflicts

import { supabaseAdmin } from '../services/supabase/client';

async function cleanupTodaysPlayerProps(): Promise<void> {
  console.log('🧹 Cleaning up today\'s duplicate player props data...');
  
  try {
    // First, check how much data we have
    const { count: totalToday, error: countError } = await supabaseAdmin
      .from('player_props_odds')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().split('T')[0]);
    
    if (countError) {
      console.error('❌ Error checking data count:', countError.message);
      return;
    }
    
    console.log(`📊 Found ${totalToday || 0} player props records from today`);
    
    if (!totalToday || totalToday === 0) {
      console.log('✅ No today\'s data to clean up!');
      return;
    }
    
    // Delete today's player props data
    const { error: deleteError } = await supabaseAdmin
      .from('player_props_odds')
      .delete()
      .gte('created_at', new Date().toISOString().split('T')[0]);
    
    if (deleteError) {
      console.error('❌ Error cleaning up data:', deleteError.message);
      return;
    }
    
    console.log(`✅ Successfully cleaned up ${totalToday} duplicate records from today`);
    
    // Verify cleanup
    const { count: remainingCount, error: remainingError } = await supabaseAdmin
      .from('player_props_odds')
      .select('*', { count: 'exact', head: true });
    
    if (!remainingError) {
      console.log(`📊 Total player props remaining in database: ${remainingCount || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', (error as Error).message);
  }
}

async function cleanupDuplicatePlayers(): Promise<void> {
  console.log('🧹 Cleaning up any duplicate test players...');
  
  try {
    // Remove players created today with theodds prefix (test data)
    const { error: deleteError } = await supabaseAdmin
      .from('players')
      .delete()
      .like('external_player_id', 'theodds_%')
      .gte('created_at', new Date().toISOString().split('T')[0]);
    
    if (deleteError) {
      console.error('❌ Error cleaning up test players:', deleteError.message);
      return;
    }
    
    console.log('✅ Cleaned up test players from today');
    
  } catch (error) {
    console.error('❌ Player cleanup failed:', (error as Error).message);
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting safe database cleanup...\n');
  
  await cleanupTodaysPlayerProps();
  await cleanupDuplicatePlayers();
  
  console.log('\n✅ Cleanup complete! You can now run the setup script again.');
  console.log('\nRun: npm run setup-odds-integration');
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => console.log('\n🎉 All done!'))
    .catch((error: Error) => {
      console.error('\n❌ Cleanup failed:', error.message);
      process.exit(1);
    });
}

export { cleanupTodaysPlayerProps, cleanupDuplicatePlayers }; 