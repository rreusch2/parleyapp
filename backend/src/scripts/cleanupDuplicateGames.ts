import { supabase } from '../services/supabase/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('cleanupDuplicateGames');

interface GameEntry {
  id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  created_at: string;
  has_odds: boolean;
}

async function cleanupDuplicateGames() {
  try {
    logger.info('🧹 Starting cleanup of duplicate games...');

    // Get all games from the last few days
    const { data: games, error } = await supabase
      .from('sports_events')
      .select('id, home_team, away_team, start_time, created_at, metadata')
      .gte('start_time', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
      .lte('start_time', new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    if (!games || games.length === 0) {
      logger.info('No games found to process');
      return;
    }

    logger.info(`📊 Found ${games.length} total games`);

    // Process games to identify duplicates
    const gameGroups: { [key: string]: GameEntry[] } = {};
    
    games.forEach(game => {
      const key = `${game.away_team}_vs_${game.home_team}`;
      const hasOdds = game.metadata && 
                     game.metadata.full_data && 
                     game.metadata.full_data.bookmakers && 
                     Array.isArray(game.metadata.full_data.bookmakers) &&
                     game.metadata.full_data.bookmakers.length > 0;

      if (!gameGroups[key]) {
        gameGroups[key] = [];
      }

      gameGroups[key].push({
        id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        start_time: game.start_time,
        created_at: game.created_at,
        has_odds: hasOdds
      });
    });

    // Find duplicates and identify which ones to delete
    const toDelete: string[] = [];
    let duplicateGroupsFound = 0;

    Object.entries(gameGroups).forEach(([matchup, gameEntries]) => {
      if (gameEntries.length > 1) {
        duplicateGroupsFound++;
        logger.info(`🔍 Found ${gameEntries.length} duplicates for: ${matchup}`);
        
        // Sort by has_odds (true first), then by created_at (newest first)
        gameEntries.sort((a, b) => {
          if (a.has_odds !== b.has_odds) {
            return b.has_odds ? 1 : -1; // has_odds = true comes first
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        // Keep the first one (best quality), mark others for deletion
        const toKeep = gameEntries[0];
        const toDeleteFromGroup = gameEntries.slice(1);

        logger.info(`  ✅ Keeping: ${toKeep.id} (odds: ${toKeep.has_odds}, created: ${toKeep.created_at})`);
        
        toDeleteFromGroup.forEach(game => {
          logger.info(`  ❌ Deleting: ${game.id} (odds: ${game.has_odds}, created: ${game.created_at})`);
          toDelete.push(game.id);
        });
      }
    });

    if (toDelete.length === 0) {
      logger.info('✨ No duplicates found - database is clean!');
      return;
    }

    logger.info(`🗑️  Found ${duplicateGroupsFound} duplicate groups with ${toDelete.length} games to delete`);

    // Delete the duplicate games in batches
    const batchSize = 10;
    let deletedCount = 0;

    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      
      const { error: deleteError } = await supabase
        .from('sports_events')
        .delete()
        .in('id', batch);

      if (deleteError) {
        logger.error(`Error deleting batch: ${deleteError.message}`);
        throw deleteError;
      }

      deletedCount += batch.length;
      logger.info(`🗑️  Deleted batch ${Math.ceil((i + 1) / batchSize)} - ${deletedCount}/${toDelete.length} games removed`);
    }

    logger.info(`✅ Cleanup completed successfully!`);
    logger.info(`📊 Summary:`);
    logger.info(`   - Duplicate groups found: ${duplicateGroupsFound}`);
    logger.info(`   - Games deleted: ${deletedCount}`);
    logger.info(`   - Games remaining: ${games.length - deletedCount}`);

    // Verify cleanup
    const { data: remainingGames, error: verifyError } = await supabase
      .from('sports_events')
      .select('id, home_team, away_team, metadata')
      .gte('start_time', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
      .lte('start_time', new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString());

    if (!verifyError && remainingGames) {
      const gamesWithOdds = remainingGames.filter(game => 
        game.metadata && 
        game.metadata.full_data && 
        game.metadata.full_data.bookmakers &&
        Array.isArray(game.metadata.full_data.bookmakers) &&
        game.metadata.full_data.bookmakers.length > 0
      ).length;

      logger.info(`🎯 Verification: ${remainingGames.length} games remaining, ${gamesWithOdds} have odds data`);
    }

  } catch (error) {
    logger.error(`❌ Error during cleanup: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupDuplicateGames()
    .then(() => {
      logger.info('🎉 Duplicate cleanup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupDuplicateGames }; 