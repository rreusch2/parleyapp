import { supabaseAdmin } from '../services/supabase/client';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupDuplicates(dryRun = true) {
  console.log(`🧹 ${dryRun ? 'DRY RUN: ' : ''}Cleaning up duplicate MLB games...\n`);

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

    // Find duplicates and determine which to keep/delete
    const duplicateGroups = Array.from(gameGroups.entries()).filter(([key, games]) => games.length > 1);
    
    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    let toDelete: string[] = [];
    let toKeep: string[] = [];

    duplicateGroups.forEach(([matchupKey, games]) => {
      // Sort by: 1. Most recent created_at, 2. External ID length (longer usually better)
      games.sort((a, b) => {
        const dateCompare = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (dateCompare !== 0) return dateCompare;
        
        // If same date, prefer the one with longer external_event_id (usually more detailed)
        return (b.external_event_id?.toString().length || 0) - (a.external_event_id?.toString().length || 0);
      });

      // Keep the first (best) one, delete the rest
      const [keep, ...deleteThese] = games;
      toKeep.push(keep.id);
      toDelete.push(...deleteThese.map(g => g.id));

      console.log(`🏟️  ${matchupKey}:`);
      console.log(`   ✅ KEEP: ${keep.id} (${keep.external_event_id}, created: ${keep.created_at})`);
      deleteThese.forEach(game => {
        console.log(`   ❌ DELETE: ${game.id} (${game.external_event_id}, created: ${game.created_at})`);
      });
      console.log();
    });

    console.log(`📈 Summary:`);
    console.log(`   Duplicate groups: ${duplicateGroups.length}`);
    console.log(`   Games to keep: ${toKeep.length}`);
    console.log(`   Games to delete: ${toDelete.length}`);
    console.log(`   Space savings: ${((toDelete.length / mlbGames.length) * 100).toFixed(1)}%`);

    if (dryRun) {
      console.log('\n🔍 This was a DRY RUN. No games were actually deleted.');
      console.log('To actually delete duplicates, run: npm run cleanup-duplicates --execute');
      return;
    }

    // Actually delete the duplicates
    if (toDelete.length > 0) {
      console.log('\n🗑️  Deleting duplicate games...');
      
      const { error: deleteError } = await supabaseAdmin
        .from('sports_events')
        .delete()
        .in('id', toDelete);

      if (deleteError) {
        console.error('❌ Error deleting duplicates:', deleteError);
        return;
      }

      console.log(`✅ Successfully deleted ${toDelete.length} duplicate games`);
    }

    // Verify cleanup
    const { data: remainingGames, error: verifyError } = await supabaseAdmin
      .from('sports_events')
      .select('id')
      .eq('sport', 'MLB');

    if (verifyError) {
      console.error('❌ Error verifying cleanup:', verifyError);
      return;
    }

    console.log(`\n✅ Cleanup complete! Remaining MLB games: ${remainingGames?.length || 0}`);

  } catch (error) {
    console.error('💥 Error during cleanup:', error);
  }
}

// Check command line arguments
const shouldExecute = process.argv.includes('--execute');
const isDryRun = !shouldExecute;

// Run the cleanup
cleanupDuplicates(isDryRun).then(() => {
  console.log('\n✅ Cleanup script completed');
  process.exit(0);
}).catch(err => {
  console.error('💥 Script failed:', err);
  process.exit(1);
}); 