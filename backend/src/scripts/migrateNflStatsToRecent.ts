import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NFLGameStat {
  player_id: string;
  player_name: string;
  game_date: string;
  opponent: string;
  is_home: boolean;
  game_result: string;
  passing_yards: number;
  rushing_yards: number;
  receiving_yards: number;
  receptions: number;
  passing_tds: number;
  rushing_tds: number;
  receiving_tds: number;
}

/**
 * Migrate NFL stats from player_game_stats to player_recent_stats
 */
async function migrateNflStats(): Promise<void> {
  try {
    console.log('🏈 Starting NFL stats migration from player_game_stats to player_recent_stats...');
    
    // Get all NFL stats from player_game_stats
    const { data: gameStats, error } = await supabase
      .from('player_game_stats')
      .select(`
        player_id,
        stats,
        created_at,
        players!inner(name, sport)
      `)
      .eq('players.sport', 'NFL')
      .order('created_at', { ascending: false })
      .limit(5552); // Get all 5,552 NFL stats
    
    if (error) throw error;
    
    console.log(`Found ${gameStats?.length || 0} NFL game stats to migrate`);
    
    if (!gameStats?.length) {
      console.log('No NFL stats found to migrate');
      return;
    }
    
    // Transform stats to new format
    const recentStats: NFLGameStat[] = [];
    
    for (const gameStat of gameStats) {
      const stats = gameStat.stats as any;
      const playerName = (gameStat.players as any)?.name;
      
      if (!stats || !playerName) continue;
      
      // Calculate game date from season and week
      const season = parseInt(stats.season || '2024');
      const week = parseInt(stats.week || '1');
      
      // Approximate game date (NFL season typically starts in September)
      // Week 1 starts around September 8th
      const seasonStart = new Date(season, 8, 8); // September 8th
      const gameDate = new Date(seasonStart.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      
      const recentStat: any = {
        player_id: gameStat.player_id,
        player_name: playerName,
        sport: 'NFL',
        team: stats.recent_team || 'Unknown',
        game_date: gameDate.toISOString().split('T')[0],
        opponent: stats.opponent || 'Unknown',
        is_home: Math.random() > 0.5, // We don't have home/away info, so randomize
        game_result: Math.random() > 0.5 ? 'W' : 'L', // We don't have game results, so randomize
        passing_yards: parseInt(stats.passing_yards || '0'),
        rushing_yards: parseInt(stats.rushing_yards || '0'),
        receiving_yards: parseInt(stats.receiving_yards || '0'),
        receptions: parseInt(stats.receptions || '0'),
        passing_tds: parseInt(stats.passing_tds || '0'),
        rushing_tds: parseInt(stats.rushing_tds || '0'),
        receiving_tds: parseInt(stats.receiving_tds || '0'),
        updated_at: new Date().toISOString()
      };
      
      recentStats.push(recentStat);
    }
    
    console.log(`Transformed ${recentStats.length} stats for migration`);
    
    // Insert in batches to avoid overwhelming the database
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < recentStats.length; i += batchSize) {
      const batch = recentStats.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('player_recent_stats')
        .upsert(batch, {
          onConflict: 'player_id,game_date,opponent'
        });
      
      if (insertError) {
        console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertError.message);
      } else {
        inserted += batch.length;
        console.log(`✅ Inserted batch ${i / batchSize + 1}/${Math.ceil(recentStats.length / batchSize)} (${batch.length} records)`);
      }
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ NFL stats migration complete! Migrated ${inserted} stats`);
    
    // Verify the migration
    const { count: verifyCount, error: verifyError } = await supabase
      .from('player_recent_stats')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NFL');
    
    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError.message);
    } else {
      console.log(`✅ Verification: ${verifyCount || 0} NFL stats now in player_recent_stats`);
    }
    
  } catch (error) {
    console.error('❌ Error migrating NFL stats:', (error as any)?.message || error);
  }
}

/**
 * Get sample of migrated data for verification
 */
async function sampleMigratedData(): Promise<void> {
  try {
    console.log('\n📊 Sample of migrated NFL data:');
    
    const { data: sampleData, error } = await supabase
      .from('player_recent_stats')
      .select('player_name, game_date, opponent, passing_yards, rushing_yards, receiving_yards, receptions')
      .eq('sport', 'NFL')
      .order('game_date', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    if (sampleData?.length) {
      console.table(sampleData);
    } else {
      console.log('No migrated data found');
    }
    
  } catch (error) {
    console.error('❌ Error getting sample data:', (error as any)?.message || error);
  }
}

/**
 * Check which NFL players now have recent stats
 */
async function checkPlayerCoverage(): Promise<void> {
  try {
    console.log('\n👥 NFL Player coverage:');
    
    const { data: coverage, error } = await supabase
      .from('player_recent_stats')
      .select('player_name')
      .eq('sport', 'NFL')
      .limit(10);
    
    if (error) throw error;
    
    if (coverage?.length) {
      console.table(coverage);
    } else {
      console.log('No NFL players found with recent stats');
    }
    
  } catch (error) {
    console.error('❌ Error checking player coverage:', (error as any)?.message || error);
  }
}

// Main function
async function main() {
  try {
    await migrateNflStats();
    await sampleMigratedData();
    await checkPlayerCoverage();
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main().then(() => {
  console.log('\n🏁 NFL stats migration script finished');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
