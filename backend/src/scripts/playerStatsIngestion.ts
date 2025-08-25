import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Load environment variables
config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PlayerGameStats {
  playerId: string;
  playerName: string;
  sport: string;
  team: string;
  gameDate: string;
  opponent: string;
  isHome: boolean;
  stats: {
    hits?: number;
    atBats?: number;
    homeRuns?: number;
    rbis?: number;
    runsScored?: number;
    stolenBases?: number;
    strikeouts?: number;
    walks?: number;
    totalBases?: number;
    points?: number;
    rebounds?: number;
    assists?: number;
  };
  gameResult?: string;
}

class PlayerStatsIngestion {
  
  async fetchMLBPlayerStats(playerId: string, days: number = 10): Promise<PlayerGameStats[]> {
    try {
      // MLB Stats API endpoint for player game logs
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await axios.get(
        `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&season=2024&startDate=${startDate}&endDate=${endDate}`
      );

      const games = response.data.stats?.[0]?.splits || [];
      const player = response.data.people?.[0];
      
      return games.map((game: any) => ({
        playerId,
        playerName: player?.fullName || '',
        sport: 'MLB',
        team: game.team?.abbreviation || '',
        gameDate: game.date,
        opponent: game.opponent?.abbreviation || '',
        isHome: game.isHome || false,
        stats: {
          hits: game.stat?.hits || 0,
          atBats: game.stat?.atBats || 0,
          homeRuns: game.stat?.homeRuns || 0,
          rbis: game.stat?.rbi || 0,
          runsScored: game.stat?.runs || 0,
          stolenBases: game.stat?.stolenBases || 0,
          strikeouts: game.stat?.strikeOuts || 0,
          walks: game.stat?.baseOnBalls || 0,
          totalBases: game.stat?.totalBases || 0,
        },
        gameResult: game.isWin ? 'W' : 'L'
      }));
    } catch (error) {
      console.error(`Error fetching MLB stats for player ${playerId}:`, error);
      return [];
    }
  }

  async fetchWNBAPlayerStats(playerId: string, days: number = 10): Promise<PlayerGameStats[]> {
    try {
      // ESPN WNBA API or Basketball Reference scraping
      const response = await axios.get(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/athletes/${playerId}/gamelog`
      );

      const games = response.data.events?.slice(0, days) || [];
      
      return games.map((game: any) => ({
        playerId,
        playerName: response.data.athlete?.displayName || '',
        sport: 'WNBA',
        team: game.team?.abbreviation || '',
        gameDate: game.date,
        opponent: game.opponent?.abbreviation || '',
        isHome: game.isHome || false,
        stats: {
          points: game.stats?.points || 0,
          rebounds: game.stats?.rebounds || 0,
          assists: game.stats?.assists || 0,
        },
        gameResult: game.result
      }));
    } catch (error) {
      console.error(`Error fetching WNBA stats for player ${playerId}:`, error);
      return [];
    }
  }

  async fetchNBAPlayerStats(playerId: string, days: number = 10): Promise<PlayerGameStats[]> {
    try {
      // Free: balldontlie.io API (rate-limited). Maps NBA player ID to game logs.
      // Note: caller must provide balldontlie player ID (not internal UUID).
      const end = new Date();
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        'player_ids[]': String(playerId),
        'per_page': '100',
        'start_date': start.toISOString().split('T')[0],
        'end_date': end.toISOString().split('T')[0]
      });
      const resp = await axios.get(`https://www.balldontlie.io/api/v1/stats?${params.toString()}`);
      const stats = resp.data?.data || [];
      return stats.slice(0, days).map((g: any) => ({
        playerId,
        playerName: `${g.player?.first_name || ''} ${g.player?.last_name || ''}`.trim(),
        sport: 'NBA',
        team: g.team?.abbreviation || '',
        gameDate: g.game?.date?.slice(0, 10),
        opponent: '',
        isHome: false,
        stats: {
          points: g.pts || 0,
          rebounds: g.reb || 0,
          assists: g.ast || 0,
          three_pointers: g.fg3m || 0
        },
        gameResult: undefined
      }));
    } catch (error) {
      console.error(`Error fetching NBA stats for player ${playerId}:`, (error as any).message || error);
      return [];
    }
  }

  async fetchNFLPlayerStatsESPN(playerSlugOrId: string, days: number = 10): Promise<PlayerGameStats[]> {
    try {
      // Free-ish approach: ESPN JSON endpoints per player (subject to change and throttling)
      // This is a placeholder scaffold to integrate once mapping is settled.
      // For now, return empty to avoid brittle scraping.
      return [];
    } catch (error) {
      console.error(`Error fetching NFL stats for player ${playerSlugOrId}:`, (error as any).message || error);
      return [];
    }
  }

  async fetchCFBPlayerStatsCFBD(apiKey: string, playerId: number, season: number, days: number = 10): Promise<PlayerGameStats[]> {
    try {
      // CollegeFootballData.com has a free tier (API key required) with rate limits
      // Placeholder: integrate when API key is configured in env.
      return [];
    } catch (error) {
      console.error(`Error fetching CFB stats for player ${playerId}:`, (error as any).message || error);
      return [];
    }
  }

  async fetchUFCStats(fighterName: string, lastEvents: number = 3): Promise<PlayerGameStats[]> {
    try {
      // UFCStats.com scraping would be needed; placeholder to avoid brittle scraping here.
      return [];
    } catch (error) {
      console.error(`Error fetching UFC stats for fighter ${fighterName}:`, (error as any).message || error);
      return [];
    }
  }

  async storePlayerStats(stats: PlayerGameStats[]): Promise<void> {
    try {
      const records = stats.map(stat => ({
        player_id: stat.playerId,
        player_name: stat.playerName,
        sport: stat.sport,
        team: stat.team,
        game_date: stat.gameDate,
        opponent: stat.opponent,
        is_home: stat.isHome,
        hits: stat.stats.hits || 0,
        at_bats: stat.stats.atBats || 0,
        home_runs: stat.stats.homeRuns || 0,
        rbis: stat.stats.rbis || 0,
        runs_scored: stat.stats.runsScored || 0,
        stolen_bases: stat.stats.stolenBases || 0,
        strikeouts: stat.stats.strikeouts || 0,
        walks: stat.stats.walks || 0,
        total_bases: stat.stats.totalBases || 0,
        points: stat.stats.points || 0,
        rebounds: stat.stats.rebounds || 0,
        assists: stat.stats.assists || 0,
        game_result: stat.gameResult,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('player_recent_stats')
        .upsert(records, { 
          onConflict: 'player_id,game_date,opponent',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Error storing player stats:', error instanceof Error ? error.message : String(error));
      } else {
        console.log(`✅ Stored ${records.length} player game records`);
      }
    } catch (error) {
      console.error('Error in storePlayerStats:', error instanceof Error ? error.message : String(error));
    }
  }

  async updateAllActivePlayers(): Promise<void> {
    try {
      // Fetch active players from database
      const { data: players, error } = await supabase
        .from('players')
        .select('id, player_name, external_player_id, sport, team')
        .in('sport', ['MLB', 'WNBA', 'NBA', 'NFL'])
        .limit(50);

      if (error) throw error;
      if (!players?.length) {
        console.log('No active players found');
        return;
      }

      console.log(`📊 Updating stats for ${players.length} players...`);
      let totalUpdated = 0;

      for (const player of players) {
        try {
          console.log(`\n🔄 Processing ${player.player_name} (${player.sport})...`);
          
          let gameStats: PlayerGameStats[] = [];
          
          if (player.sport === 'MLB' && player.external_player_id) {
            gameStats = await this.fetchMLBPlayerStats(player.external_player_id, 10);
          } else if (player.sport === 'WNBA') {
            gameStats = await this.fetchWNBAPlayerStats(player.id, 10);
          } else if (player.sport === 'NBA' && player.external_player_id) {
            gameStats = await this.fetchNBAPlayerStats(player.external_player_id, 10);
          } else if (player.sport === 'NFL' && player.external_player_id) {
            gameStats = await this.fetchNFLPlayerStatsESPN(player.external_player_id, 10);
          }

          if (gameStats.length > 0) {
            await this.upsertPlayerStats(player.id, gameStats);
            totalUpdated += gameStats.length;
            console.log(`✅ Updated ${gameStats.length} games for ${player.player_name}`);
          } else {
            console.log(`⚠️ No recent games found for ${player.player_name}`);
          }
        } catch (error) {
          console.error(`❌ Error updating ${player.player_name}:`, (error as any)?.message || error);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ Updated ${totalUpdated} total game records for ${players.length} players`);
    } catch (error) {
      console.error('Error updating all players:', error);
    }
  }

  async upsertPlayerStats(playerId: string, stats: PlayerGameStats[]): Promise<void> {
    try {
      const records = stats.map(stat => ({
        player_id: playerId,
        player_name: stat.playerName,
        sport: stat.sport,
        team: stat.team,
        game_date: stat.gameDate,
        opponent: stat.opponent,
        is_home: stat.isHome,
        hits: stat.stats.hits || 0,
        at_bats: stat.stats.atBats || 0,
        home_runs: stat.stats.homeRuns || 0,
        rbis: stat.stats.rbis || 0,
        runs_scored: stat.stats.runsScored || 0,
        stolen_bases: stat.stats.stolenBases || 0,
        strikeouts: stat.stats.strikeouts || 0,
        walks: stat.stats.walks || 0,
        total_bases: stat.stats.totalBases || 0,
        points: stat.stats.points || 0,
        rebounds: stat.stats.rebounds || 0,
        assists: stat.stats.assists || 0,
        game_result: stat.gameResult,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('player_recent_stats')
        .upsert(records, { 
          onConflict: 'player_id,game_date,opponent',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Error storing player stats:', error instanceof Error ? error.message : String(error));
      } else {
        console.log(`✅ Stored ${records.length} player game records`);
      }
    } catch (error) {
      console.error('Error in upsertPlayerStats:', error instanceof Error ? error.message : String(error));
    }
  }

  async generateTrendsData(): Promise<void> {
    // TO DO: implement trends data generation
  }
}

// Run daily updates
export async function runDailyStatsUpdate(): Promise<void> {
  console.log('🚀 Starting daily player stats update pipeline...');
  const startTime = Date.now();
  
  try {
    const ingestion = new PlayerStatsIngestion();
    
    // Step 1: Update all active player stats
    console.log('\n📊 STEP 1: Updating player statistics...');
    await ingestion.updateAllActivePlayers();
    
    // Step 2: Generate trends data
    console.log('\n📈 STEP 2: Generating player trends...');
    await ingestion.generateTrendsData();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n✅ DAILY STATS UPDATE COMPLETE!');
    console.log(`⏱️ Total execution time: ${duration} seconds`);
    console.log(`🎯 Pipeline completed successfully at ${new Date().toISOString()}`);
    
  } catch (error) {
    console.error('❌ Fatal error in daily stats update pipeline:', error);
    throw error;
  }
}

// Export comprehensive stats update for cron integration
export async function runComprehensiveStatsUpdate(): Promise<void> {
  console.log('🔄 COMPREHENSIVE STATS UPDATE STARTING...');
  
  try {
    // Run the daily stats update
    await runDailyStatsUpdate();
    
    console.log('✅ Comprehensive stats update completed successfully');
  } catch (error) {
    console.error('❌ Comprehensive stats update failed:', error);
    process.exit(1); // Exit with error for cron monitoring
  }
}

// For manual testing
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--comprehensive')) {
    runComprehensiveStatsUpdate().catch(console.error);
  } else if (args.includes('--trends-only')) {
    const ingestion = new PlayerStatsIngestion();
    ingestion.generateTrendsData().catch(console.error);
  } else {
    runDailyStatsUpdate().catch(console.error);
  }
}
