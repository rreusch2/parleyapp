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

// CFBD API key
const CFBD_API_KEY = process.env.CFBD_API_KEY;

// Check if API key exists
if (!CFBD_API_KEY) {
  console.error('❌ CFBD_API_KEY is missing in environment variables');
  process.exit(1);
}

// College Football Data API base URL
const CFBD_BASE_URL = 'https://api.collegefootballdata.com';

// Headers for CFBD API
const headers = {
  'Authorization': `Bearer ${CFBD_API_KEY}`,
  'Accept': 'application/json'
};

interface CFBPlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  external_player_id?: string;
}

interface CFBPlayerStats {
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

/**
 * Fetch player game stats from CFBD API
 */
async function fetchPlayerGameStats(playerId: string, teamId: string, year: number = new Date().getFullYear()): Promise<CFBPlayerStats[]> {
  try {
    // First, get player info to determine position
    const { data: playerInfo } = await supabase
      .from('players')
      .select('position')
      .eq('id', playerId)
      .single();
    
    if (!playerInfo) {
      console.error(`❌ Player not found: ${playerId}`);
      return [];
    }
    
    const position = playerInfo.position?.toUpperCase();
    
    // Determine which stats to fetch based on position
    let statsEndpoint = '';
    if (['QB'].includes(position)) {
      statsEndpoint = '/stats/player/passing';
    } else if (['RB', 'FB'].includes(position)) {
      statsEndpoint = '/stats/player/rushing';
    } else if (['WR', 'TE'].includes(position)) {
      statsEndpoint = '/stats/player/receiving';
    } else {
      console.log(`⚠️ Unsupported position for player ${playerId}: ${position}`);
      return [];
    }
    
    // Get team name for the player
    const { data: playerData } = await supabase
      .from('players')
      .select('team')
      .eq('id', playerId)
      .single();
    
    if (!playerData?.team) {
      console.error(`❌ Player team not found: ${playerId}`);
      return [];
    }
    
    // Fetch stats from CFBD API
    const response = await axios.get(`${CFBD_BASE_URL}${statsEndpoint}`, {
      headers,
      params: {
        year,
        team: playerData.team,
        excludeGarbageTime: false
      }
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error(`❌ Invalid response for player ${playerId}`);
      return [];
    }
    
    // Find the player in the response
    const playerStats = response.data.filter((stat: any) => {
      // Match by name similarity since CFBD doesn't have consistent IDs
      const playerName = stat.player?.toLowerCase();
      const { data: player } = supabase
        .from('players')
        .select('name, player_name')
        .eq('id', playerId)
        .single();
      
      const dbPlayerName = (player?.player_name || player?.name || '').toLowerCase();
      return playerName.includes(dbPlayerName) || dbPlayerName.includes(playerName);
    });
    
    if (!playerStats.length) {
      console.log(`⚠️ No stats found for player ${playerId}`);
      return [];
    }
    
    // Get game data to enrich stats
    const gameIds = [...new Set(playerStats.map((stat: any) => stat.gameId))];
    const gameData: Record<string, any> = {};
    
    for (const gameId of gameIds) {
      const gameResponse = await axios.get(`${CFBD_BASE_URL}/games`, {
        headers,
        params: {
          id: gameId,
          year
        }
      });
      
      if (gameResponse.data && gameResponse.data.length > 0) {
        const game = gameResponse.data[0];
        gameData[gameId] = {
          date: game.start_date,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          homeScore: game.home_points,
          awayScore: game.away_points
        };
      }
    }
    
    // Transform stats to our format
    const transformedStats: CFBPlayerStats[] = playerStats.map((stat: any) => {
      const game = gameData[stat.gameId];
      if (!game) return null;
      
      const isHome = game.homeTeam === playerData.team;
      const opponent = isHome ? game.awayTeam : game.homeTeam;
      const teamScore = isHome ? game.homeScore : game.awayScore;
      const opponentScore = isHome ? game.awayScore : game.homeScore;
      const gameResult = teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'T';
      
      // Initialize stats with zeros
      const playerGameStat: CFBPlayerStats = {
        player_id: playerId,
        game_date: game.date,
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
      
      // Fill in stats based on position/endpoint
      if (statsEndpoint === '/stats/player/passing') {
        playerGameStat.passing_yards = stat.yards || 0;
        playerGameStat.passing_tds = stat.touchdowns || 0;
      } else if (statsEndpoint === '/stats/player/rushing') {
        playerGameStat.rushing_yards = stat.yards || 0;
        playerGameStat.rushing_tds = stat.touchdowns || 0;
      } else if (statsEndpoint === '/stats/player/receiving') {
        playerGameStat.receiving_yards = stat.yards || 0;
        playerGameStat.receptions = stat.receptions || 0;
        playerGameStat.receiving_tds = stat.touchdowns || 0;
      }
      
      return playerGameStat;
    }).filter(Boolean) as CFBPlayerStats[];
    
    return transformedStats;
  } catch (error) {
    console.error(`❌ Error fetching stats for player ${playerId}:`, (error as any)?.message || error);
    return [];
  }
}

/**
 * Main function to update CFB player stats
 */
async function updateCFBPlayerStats() {
  try {
    console.log('🏈 Starting CFB player stats update...');
    
    // Get active CFB players
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, team, position, external_player_id')
      .eq('sport', 'CFB')
      .eq('active', true);
    
    if (error) throw error;
    
    console.log(`Found ${players?.length || 0} active CFB players`);
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    let updatedCount = 0;
    
    for (let i = 0; i < (players?.length || 0); i += batchSize) {
      const batch = players!.slice(i, i + batchSize);
      
      // Process each player in the batch
      const promises = batch.map(async (player) => {
        try {
          console.log(`Processing ${player.name || 'Unknown player'}...`);
          
          // Fetch player stats
          const stats = await fetchPlayerGameStats(player.id, player.team);
          
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
    
    console.log(`✅ CFB player stats update complete! Updated ${updatedCount} game stats`);
    
  } catch (error) {
    console.error('❌ Error updating CFB player stats:', (error as any)?.message || error);
  }
}

// Run the update
updateCFBPlayerStats().then(() => {
  console.log('🏁 CFB player stats update script finished');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
