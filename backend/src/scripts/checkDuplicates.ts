import { supabaseAdmin } from '../services/supabase/client';
import dotenv from 'dotenv';

dotenv.config();

async function checkForDuplicates() {
  console.log('🔍 Checking for duplicate MLB games in sports_events table...\n');

  try {
    // Get all MLB events
    const { data: mlbGames, error } = await supabaseAdmin
      .from('sports_events')
      .select('*')
      .eq('sport', 'MLB')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching MLB games:', error);
      return;
    }

    if (!mlbGames || mlbGames.length === 0) {
      console.log('✅ No MLB games found in database');
      return;
    }

    console.log(`📊 Total MLB games: ${mlbGames.length}`);

    // Group games by matchup and date
    const gameGroups = new Map<string, any[]>();
    
    mlbGames.forEach(game => {
      const gameDate = new Date(game.start_time).toDateString();
      const matchupKey = `${game.away_team}@${game.home_team}@${gameDate}`;
      
      if (!gameGroups.has(matchupKey)) {
        gameGroups.set(matchupKey, []);
      }
      gameGroups.get(matchupKey)!.push(game);
    });

    // Find duplicates
    const duplicates = Array.from(gameGroups.entries()).filter(([key, games]) => games.length > 1);
    
    console.log(`🔢 Unique matchups: ${gameGroups.size}`);
    console.log(`🔥 Duplicate groups: ${duplicates.length}\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    // Display duplicates
    duplicates.forEach(([matchupKey, games], index) => {
      console.log(`🏟️  Duplicate #${index + 1}: ${matchupKey}`);
      games.forEach((game, i) => {
        console.log(`   Game ${i + 1}:`);
        console.log(`     ID: ${game.id}`);
        console.log(`     External ID: ${game.external_event_id}`);
        console.log(`     Status: ${game.status}`);
        console.log(`     Start Time: ${game.start_time}`);
        console.log(`     Created: ${game.created_at}`);
        console.log(`     Updated: ${game.updated_at}`);
      });
      console.log();
    });

    // Summary statistics
    const totalDuplicates = duplicates.reduce((sum, [, games]) => sum + games.length, 0);
    const extraGames = totalDuplicates - duplicates.length; // Total games - one per group
    
    console.log(`📈 Summary:`);
    console.log(`   Total duplicate games: ${totalDuplicates}`);
    console.log(`   Extra games to remove: ${extraGames}`);
    console.log(`   Potential space savings: ${((extraGames / mlbGames.length) * 100).toFixed(1)}%`);

    // Show distribution by external_event_id sources
    const sourceStats = new Map<string, number>();
    mlbGames.forEach(game => {
      const prefix = game.external_event_id?.toString().substring(0, 5) || 'unknown';
      sourceStats.set(prefix, (sourceStats.get(prefix) || 0) + 1);
    });

    console.log(`\n🔧 External ID patterns:`);
    Array.from(sourceStats.entries()).forEach(([prefix, count]) => {
      console.log(`   ${prefix}*: ${count} games`);
    });

    return {
      totalGames: mlbGames.length,
      uniqueMatchups: gameGroups.size,
      duplicateGroups: duplicates.length,
      extraGames,
      duplicates
    };

  } catch (error) {
    console.error('💥 Error checking duplicates:', error);
  }
}

// Run the check
checkForDuplicates().then(() => {
  console.log('\n✅ Duplicate check completed');
  process.exit(0);
}).catch(err => {
  console.error('💥 Script failed:', err);
  process.exit(1);
}); 