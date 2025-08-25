import axios from 'axios';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NFLPlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  external_player_id?: string;
}

interface NFLPlayerStats {
  player_id: string;
  game_date: string;
  opponent: string;
  is_home: boolean;
  game_result?: string;
  passing_yards: number;
  rushing_yards: number;
  receiving_yards: number;
  receptions: number;
  passing_tds: number;
  rushing_tds: number;
  receiving_tds: number;
}

// ESPN API endpoints
const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

/**
 * Get ESPN athlete ID from player name
 */
async function getESPNAthleteId(playerName: string, team: string): Promise<string | null> {
  try {
    // Search for the player
    const searchUrl = `${ESPN_API_BASE}/athletes?limit=5&search=${encodeURIComponent(playerName)}`;
    const response = await axios.get(searchUrl);
    
    if (!response.data?.items?.length) {
      return null;
    }
    
    // Try to match by team as well
    const teamAbbr = team.toUpperCase();
    const athlete = response.data.items.find((item: any) => {
      const athleteTeam = item?.team?.abbreviation;
      return athleteTeam && athleteTeam.toUpperCase() === teamAbbr;
    }) || response.data.items[0]; // Default to first result if no team match
    
    return athlete?.id || null;
  } catch (error) {
    console.error(`Error finding ESPN ID for ${playerName}:`, (error as any)?.message || error);
    return null;
  }
}

/**
 * Fetch player game stats from ESPN
 */
async function fetchPlayerGameStats(playerId: string, espnId: string | null): Promise<NFLPlayerStats[]> {
  try {
    if (!espnId) {
      console.log(`⚠️ No ESPN ID found for player ${playerId}`);
      return [];
    }
    
    // Get player position
    const { data: playerInfo } = await supabase
      .from('players')
      .select('position, team, name')
      .eq('id', playerId)
      .single();
    
    if (!playerInfo) {
      console.error(`❌ Player not found: ${playerId}`);
      return [];
    }
    
    const position = playerInfo.position?.toUpperCase();
    const playerTeam = playerInfo.team;
    const playerName = playerInfo.name;
    
    // Get athlete stats from ESPN
    const statsUrl = `${ESPN_API_BASE}/athletes/${espnId}/stats`;
    const response = await axios.get(statsUrl);
    
    if (!response.data?.splits?.categories?.length) {
      console.log(`⚠️ No stats found for ${playerName}`);
      return [];
    }
    
    // Get game log data
    const gameLogUrl = `${ESPN_API_BASE}/athletes/${espnId}/gamelog`;
    const gameLogResponse = await axios.get(gameLogUrl);
    
    if (!gameLogResponse.data?.events?.length) {
      console.log(`⚠️ No game logs found for ${playerName}`);
      return [];
    }
    
    // Get last 10 games
    const games = gameLogResponse.data.events.slice(0, 10);
    
    // Transform game logs to our format
    const transformedStats: NFLPlayerStats[] = games.map((game: any) => {
      // Extract game details
      const gameDate = game.date;
      const competitions = game.competitions?.[0];
      if (!competitions) return null;
      
      const homeTeam = competitions.competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = competitions.competitors.find((c: any) => c.homeAway === 'away');
      
      if (!homeTeam || !awayTeam) return null;
      
      const isHome = homeTeam.team.abbreviation === playerTeam;
      const opponent = isHome ? awayTeam.team.abbreviation : homeTeam.team.abbreviation;
      
      // Get game result
      const playerTeamScore = isHome ? parseInt(homeTeam.score) : parseInt(awayTeam.score);
      const opponentScore = isHome ? parseInt(awayTeam.score) : parseInt(homeTeam.score);
      const gameResult = playerTeamScore > opponentScore ? 'W' : playerTeamScore < opponentScore ? 'L' : 'T';
      
      // Get player stats for this game
      const stats = game.stats || [];
      
      // Initialize stats with zeros
      const playerGameStat: NFLPlayerStats = {
        player_id: playerId,
        game_date: gameDate,
        opponent,
        is_home: isHome,
        game_result: gameResult,
        passing_yards: 0,
        rushing_yards: 0,
        receiving_yards: 0,
        receptions: 0,
        passing_tds: 0,
        rushing_tds: 0,
        receiving_tds: 0
      };
      
      // Parse stats based on position
      if (['QB'].includes(position)) {
        // Find passing stats
        const passingStats = stats.find((s: any) => s.name === 'passing');
        if (passingStats?.stats) {
          playerGameStat.passing_yards = parseInt(passingStats.stats.find((s: any) => s.name === 'passingYards')?.value || '0');
          playerGameStat.passing_tds = parseInt(passingStats.stats.find((s: any) => s.name === 'passingTouchdowns')?.value || '0');
        }
        
        // QBs can also have rushing stats
        const rushingStats = stats.find((s: any) => s.name === 'rushing');
        if (rushingStats?.stats) {
          playerGameStat.rushing_yards = parseInt(rushingStats.stats.find((s: any) => s.name === 'rushingYards')?.value || '0');
          playerGameStat.rushing_tds = parseInt(rushingStats.stats.find((s: any) => s.name === 'rushingTouchdowns')?.value || '0');
        }
      } else if (['RB', 'FB'].includes(position)) {
        // Find rushing stats
        const rushingStats = stats.find((s: any) => s.name === 'rushing');
        if (rushingStats?.stats) {
          playerGameStat.rushing_yards = parseInt(rushingStats.stats.find((s: any) => s.name === 'rushingYards')?.value || '0');
          playerGameStat.rushing_tds = parseInt(rushingStats.stats.find((s: any) => s.name === 'rushingTouchdowns')?.value || '0');
        }
        
        // RBs can also have receiving stats
        const receivingStats = stats.find((s: any) => s.name === 'receiving');
        if (receivingStats?.stats) {
          playerGameStat.receiving_yards = parseInt(receivingStats.stats.find((s: any) => s.name === 'receivingYards')?.value || '0');
          playerGameStat.receptions = parseInt(receivingStats.stats.find((s: any) => s.name === 'receptions')?.value || '0');
          playerGameStat.receiving_tds = parseInt(receivingStats.stats.find((s: any) => s.name === 'receivingTouchdowns')?.value || '0');
        }
      } else if (['WR', 'TE'].includes(position)) {
        // Find receiving stats
        const receivingStats = stats.find((s: any) => s.name === 'receiving');
        if (receivingStats?.stats) {
          playerGameStat.receiving_yards = parseInt(receivingStats.stats.find((s: any) => s.name === 'receivingYards')?.value || '0');
          playerGameStat.receptions = parseInt(receivingStats.stats.find((s: any) => s.name === 'receptions')?.value || '0');
          playerGameStat.receiving_tds = parseInt(receivingStats.stats.find((s: any) => s.name === 'receivingTouchdowns')?.value || '0');
        }
      }
      
      return playerGameStat;
    }).filter(Boolean) as NFLPlayerStats[];
    
    return transformedStats;
  } catch (error) {
    console.error(`❌ Error fetching stats for player ${playerId}:`, (error as any)?.message || error);
    return [];
  }
}

/**
 * Main function to update NFL player stats
 */
async function updateNFLPlayerStats() {
  try {
    console.log('🏈 Starting NFL player stats update...');
    
    // Get active NFL players
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, team, position, external_player_id')
      .eq('sport', 'NFL')
      .eq('active', true);
    
    if (error) throw error;
    
    console.log(`Found ${players?.length || 0} active NFL players`);
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    let updatedCount = 0;
    
    for (let i = 0; i < (players?.length || 0); i += batchSize) {
      const batch = players!.slice(i, i + batchSize);
      
      // Process each player in the batch
      const promises = batch.map(async (player) => {
        try {
          console.log(`Processing ${player.name || 'Unknown player'}...`);
          
          // Get or store ESPN ID
          let espnId = player.external_player_id;
          
          if (!espnId) {
            espnId = await getESPNAthleteId(player.name, player.team);
            
            if (espnId) {
              // Store ESPN ID for future use
              await supabase
                .from('players')
                .update({ external_player_id: espnId })
                .eq('id', player.id);
              
              console.log(`✅ Updated ESPN ID for ${player.name}: ${espnId}`);
            }
          }
          
          // Fetch player stats
          const stats = await fetchPlayerGameStats(player.id, espnId);
          
          if (stats.length === 0) {
            console.log(`No stats found for ${player.name}`);
            return null;
          }
          
          console.log(`Found ${stats.length} games for ${player.name}`);
          
          // Insert stats into database
          const { data, error } = await supabase
            .from('player_recent_stats')
            .upsert(stats, {
              onConflict: 'player_id,game_date,opponent'
            });
          
          if (error) {
            console.error(`❌ Error inserting stats for ${player.name}:`, error);
            return null;
          }
          
          console.log(`✅ Updated ${stats.length} games for ${player.name}`);
          return stats.length;
        } catch (error) {
          console.error(`❌ Error processing ${player.name}:`, (error as any)?.message || error);
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      const validResults = results.filter(Boolean) as number[];
      updatedCount += validResults.reduce((sum, count) => sum + count, 0);
      
      // Sleep to avoid rate limiting
      if (i + batchSize < (players?.length || 0)) {
        console.log('Waiting 1s to avoid rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ NFL player stats update complete! Updated ${updatedCount} game stats`);
    
  } catch (error) {
    console.error('❌ Error updating NFL player stats:', (error as any)?.message || error);
  }
}

// Run the update
updateNFLPlayerStats().then(() => {
  console.log('🏁 NFL player stats update script finished');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
