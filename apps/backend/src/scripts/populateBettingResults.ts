import { supabase } from '../services/supabase/client';

/**
 * Utility script to populate betting results for existing player game stats
 * Uses typical MLB betting lines for each prop type
 */

// Typical MLB betting lines (these would normally come from a sportsbook API)
const TYPICAL_MLB_LINES = {
  'hits': 1.5,
  'home_runs': 0.5,
  'walks': 0.5,
  'strikeouts': 1.5,  // For pitchers, this would be much higher
  'at_bats': 4.5
};

interface PlayerGameStat {
  id: string;
  player_id: string;
  stats: any;
  betting_results: any;
  players: {
    name: string;
    team: string;
    position: string;
  };
}

async function populateBettingResults(limit: number = 100) {
  try {
    console.log('Starting to populate betting results...');
    
    // Get player game stats that don't have betting results yet
    const { data: playerStats, error } = await supabase
      .from('player_game_stats')
      .select(`
        id,
        player_id,
        stats,
        betting_results,
        players!inner(name, team, position, sport)
      `)
      .eq('players.sport', 'MLB')
      .or('betting_results.is.null,betting_results.eq.{}')
      .limit(limit);

    if (error) {
      console.error('Error fetching player stats:', error);
      return;
    }

    if (!playerStats || playerStats.length === 0) {
      console.log('No player stats found that need betting results');
      return;
    }

    console.log(`Found ${playerStats.length} records to process`);

    let processedCount = 0;
    const batchSize = 10;

    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < playerStats.length; i += batchSize) {
      const batch = playerStats.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (record: PlayerGameStat) => {
        try {
          const gameStats = record.stats || {};
          const bettingResults: any = {};
          
          // Process each prop type
          Object.keys(TYPICAL_MLB_LINES).forEach(propType => {
            const line = TYPICAL_MLB_LINES[propType as keyof typeof TYPICAL_MLB_LINES];
            const actualValue = gameStats[propType];
            
            if (actualValue !== undefined && actualValue !== null) {
              bettingResults[propType] = {
                line: line,
                result: actualValue >= line ? 'over' : 'under',
                sportsbook: 'DraftKings',
                actual_value: actualValue
              };
            }
          });

          // Only update if we have some betting results
          if (Object.keys(bettingResults).length > 0) {
            const { error: updateError } = await supabase
              .from('player_game_stats')
              .update({ betting_results: bettingResults })
              .eq('id', record.id);

            if (updateError) {
              console.error(`Error updating record ${record.id}:`, updateError);
            } else {
              processedCount++;
              if (processedCount % 10 === 0) {
                console.log(`Processed ${processedCount} records...`);
              }
            }
          }
        } catch (recordError) {
          console.error(`Error processing record ${record.id}:`, recordError);
        }
      }));

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Successfully processed ${processedCount} records`);
    
    // Show some sample results
    const { data: sampleResults, error: sampleError } = await supabase
      .from('player_game_stats')
      .select(`
        betting_results,
        players!inner(name, team)
      `)
      .eq('players.sport', 'MLB')
      .not('betting_results', 'eq', '{}')
      .limit(5);

    if (sampleResults && sampleResults.length > 0) {
      console.log('\n📊 Sample betting results:');
      sampleResults.forEach((sample, index) => {
        console.log(`${index + 1}. ${sample.players?.name} (${sample.players?.team}):`, 
                   JSON.stringify(sample.betting_results, null, 2));
      });
    }

  } catch (error: any) {
    console.error('Error in populateBettingResults:', error);
  }
}

// Function to test the trends after populating data
async function testTrends() {
  try {
    const { TrendAnalysisService } = await import('../services/trendAnalysisService');
    const trendService = new TrendAnalysisService();
    
    console.log('\n🔍 Testing trends analysis...');
    const trends = await trendService.getMLBRecurringTrends(10);
    
    console.log(`Found ${trends.length} trends:`);
    trends.forEach((trend, index) => {
      console.log(`${index + 1}. ${trend.playerName} (${trend.team}) - ${trend.propType}: ${trend.streakLength} ${trend.streakType.toUpperCase()} in a row (${trend.confidence}% confidence)`);
    });
    
  } catch (error: any) {
    console.error('Error testing trends:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 Populating betting results for MLB player stats...\n');
  
  await populateBettingResults(200); // Process 200 records
  
  console.log('\n⏳ Waiting 2 seconds before testing trends...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testTrends();
  
  console.log('\n✅ Done!');
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { populateBettingResults, testTrends }; 