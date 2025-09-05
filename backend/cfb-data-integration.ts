/**
 * College Football Data API Integration Script
 * 
 * Fetches and stores:
 * 1. Player game stats for 2025 season (current games)
 * 2. Historical player stats from 2024 season  
 * 3. Team historical data for trends and recent stats
 * 4. Game data with proper opponent mapping
 * 
 * Usage: npx ts-node scripts/cfb-data-integration.ts
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CFBD_API_KEY = process.env.CFBD_API_KEY;
const CFBD_BASE_URL = 'https://api.collegefootballdata.com';

interface CFBDGame {
  id: number;
  season: number;
  week: number;
  seasonType: string;
  startDate: string;
  completed: boolean;
  homeTeam: string;
  homePoints: number;
  awayTeam: string;
  awayPoints: number;
  venue?: string;
}

interface CFBDPlayerStat {
  id: string;
  name: string;
  stat: string;
}

interface CFBDPlayerGameStats {
  id: number;
  teams: Array<{
    team: string;
    conference: string;
    homeAway: 'home' | 'away';
    categories: Array<{
      name: string;
      types: Array<{
        name: string;
        athletes: CFBDPlayerStat[];
      }>;
    }>;
  }>;
}

interface CFBDTeamStat {
  season: number;
  team: string;
  conference: string;
  category: string;
  stat: string;
}

interface CFBDTeamRecord {
  year: number;
  team: string;
  conference: string;
  total: {
    games: number;
    wins: number;
    losses: number;
    ties: number;
  };
  conferenceGames: {
    games: number;
    wins: number;
    losses: number;
    ties: number;
  };
}

class CFBDataIntegrator {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${CFBD_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'accept': 'application/json'
        },
        params
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Get 2025 CFB games for current season
   */
  async get2025Games(): Promise<CFBDGame[]> {
    console.log('🏈 Fetching 2025 CFB games...');
    
    const games: CFBDGame[] = [];
    
    // Get Week 0, 1, 2 games for 2025
    for (let week = 0; week <= 2; week++) {
      try {
        const weekGames = await this.makeRequest('/games', {
          year: 2025,
          week: week,
          seasonType: 'regular',
          classification: 'fbs'
        });
        
        console.log(`📅 Found ${weekGames.length} games for 2025 Week ${week}`);
        games.push(...weekGames);
      } catch (error) {
        console.log(`⚠️ No data for 2025 Week ${week}, continuing...`);
      }
    }
    
    return games.filter(game => game.completed); // Only completed games
  }

  /**
   * Get player stats for specific games
   */
  async getPlayerGameStats(gameIds: number[]): Promise<any[]> {
    console.log('👥 Fetching player game stats...');
    
    const allPlayerStats: any[] = [];
    
    for (const gameId of gameIds) {
      try {
        const gameStats: CFBDPlayerGameStats = await this.makeRequest('/games/players', {
          id: gameId
        });
        
        if (gameStats && gameStats.teams) {
          allPlayerStats.push({
            gameId,
            stats: gameStats
          });
        }
      } catch (error) {
        console.log(`⚠️ No player stats for game ${gameId}`);
      }
    }
    
    return allPlayerStats;
  }

  /**
   * Get player stats for specific games
   */
  async getPlayerSeasonStats2024(gameIds: number[]): Promise<any[]> {
    const year = 2024;
    console.log('👥 Fetching player game stats...');
    
    const allPlayerStats: any[] = [];
    
    for (const gameId of gameIds) {
      try {
        const gameStats: CFBDPlayerGameStats = await this.makeRequest('/games/players', {
          id: gameId
        });
        
        if (gameStats && gameStats.teams) {
          allPlayerStats.push({
            gameId,
            stats: gameStats
          });
        }
      } catch (error) {
        console.log(`⚠️ No player stats for game ${gameId}`);
      }
    }
    
    return allPlayerStats;
  }

  /**
   * Get 2024 season stats for historical data
   */
  async get2024PlayerStats(): Promise<any[]> {
    const year = 2024;
    console.log(`📊 Fetching ${year} season player stats...`);
    
    try {
      const playerStats = await this.makeRequest('/stats/player/season', {
        year: year,
        seasonType: 'regular'
      });
      
      console.log(`📈 Found ${playerStats.length} player season stats for ${year}`);
      console.log(`📊 Retrieved ${playerStats.length} ${year} player season stats (ready for future processing)`);
      
      return playerStats;
    } catch (error) {
      console.error(`Error fetching ${year} player season stats:`, error);
      return [];
    }
  }

  /**
   * Get team historical records for trends
   */
  async getTeamRecords(): Promise<CFBDTeamRecord[]> {
    console.log('🏆 Fetching team historical records...');
    
    const records: CFBDTeamRecord[] = [];
    
    // Get records for 2024 and 2023
    for (const year of [2024, 2023]) {
      try {
        const yearRecords = await this.makeRequest('/records', {
          year: year
        });
        
        console.log(`📋 Found ${yearRecords.length} team records for ${year}`);
        records.push(...yearRecords);
      } catch (error) {
        console.log(`⚠️ No records for ${year}`);
      }
    }
    
    return records;
  }

  /**
   * Get team records for 2024 only
   */
  async getTeamRecords2024(): Promise<CFBDTeamRecord[]> {
    try {
      const yearRecords = await this.makeRequest('/records', {
        year: 2024
      });
      
      return yearRecords;
    } catch (error) {
      console.error('Error fetching 2024 team records:', error);
      return [];
    }
  }

  /**
   * Get team season stats for trends analysis
   */
  async getTeamSeasonStats(): Promise<CFBDTeamStat[]> {
    console.log('📊 Fetching team season statistics...');
    
    const stats: CFBDTeamStat[] = [];
    
    // Get team stats for 2024 and 2023
    for (const year of [2024, 2023]) {
      try {
        const yearStats = await this.makeRequest('/stats/season', {
          year: year,
          seasonType: 'regular'
        });
        
        console.log(`📈 Found ${yearStats.length} team stats for ${year}`);
        stats.push(...yearStats);
      } catch (error) {
        console.log(`⚠️ No team stats for ${year}`);
      }
    }
    
    return stats;
  }

  /**
   * Get team season stats for 2024 only
   */
  async getTeamSeasonStats2024(): Promise<CFBDTeamStat[]> {
    try {
      const yearStats = await this.makeRequest('/stats/season', {
        year: 2024
      });
      
      return yearStats;
    } catch (error) {
      console.error('Error fetching 2024 team stats:', error);
      return [];
    }
  }

  /**
   * Map CFBD player name to existing Supabase player
   */
  async findMatchingPlayer(playerName: string, teamName: string): Promise<string | null> {
    try {
      // First try exact name match
      let { data: players } = await supabase
        .from('players')
        .select('id, name, team')
        .eq('sport', 'College Football')
        .ilike('name', playerName)
        .ilike('team', `%${teamName}%`)
        .limit(1);

      if (players && players.length > 0) {
        return players[0].id;
      }

      // Try partial name match (last name)
      const lastName = playerName.split(' ').pop();
      if (lastName && lastName.length > 2) {
        ({ data: players } = await supabase
          .from('players')
          .select('id, name, team')
          .eq('sport', 'College Football')
          .ilike('name', `%${lastName}%`)
          .ilike('team', `%${teamName}%`)
          .limit(1));

        if (players && players.length > 0) {
          return players[0].id;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error finding player ${playerName}:`, error);
      return null;
    }
  }

  /**
   * Transform CFBD player stats to our schema
   */
  transformPlayerStats(gameData: any, cfbdGame: CFBDGame): any[] {
    const transformedStats: any[] = [];
    
    for (const team of gameData.stats.teams) {
      const isHome = team.homeAway === 'home';
      const opponentTeam = isHome ? cfbdGame.awayTeam : cfbdGame.homeTeam;
      
      for (const category of team.categories) {
        for (const type of category.types) {
          for (const athlete of type.athletes) {
            // Parse stat value
            const statValue = parseFloat(athlete.stat) || 0;
            
            // Build stats object based on category and type
            const stats: any = {
              // Basic game info
              opponent_team: opponentTeam,
              
              // Initialize all possible stats to 0
              passing_yards: 0,
              passing_attempts: 0,
              passing_completions: 0,
              passing_touchdowns: 0,
              interceptions: 0,
              
              rushing_yards: 0,
              rushing_attempts: 0,
              rushing_touchdowns: 0,
              
              receiving_yards: 0,
              receptions: 0,
              receiving_touchdowns: 0,
              targets: 0,
              
              tackles_total: 0,
              tackles_for_loss: 0,
              sacks: 0,
              fumbles_recovered: 0,
              
              field_goals_made: 0,
              field_goals_attempted: 0,
              extra_points_made: 0,
              
              // Set specific stat based on category and type
            };

            // Map CFBD stats to our schema
            if (category.name === 'passing') {
              if (type.name === 'YDS') stats.passing_yards = statValue;
              else if (type.name === 'ATT') stats.passing_attempts = statValue;
              else if (type.name === 'COMP') stats.passing_completions = statValue;
              else if (type.name === 'TD') stats.passing_touchdowns = statValue;
              else if (type.name === 'INT') stats.interceptions = statValue;
            } else if (category.name === 'rushing') {
              if (type.name === 'YDS') stats.rushing_yards = statValue;
              else if (type.name === 'ATT') stats.rushing_attempts = statValue;
              else if (type.name === 'TD') stats.rushing_touchdowns = statValue;
            } else if (category.name === 'receiving') {
              if (type.name === 'YDS') stats.receiving_yards = statValue;
              else if (type.name === 'REC') stats.receptions = statValue;
              else if (type.name === 'TD') stats.receiving_touchdowns = statValue;
            } else if (category.name === 'defensive') {
              if (type.name === 'TACKTOT') stats.tackles_total = statValue;
              else if (type.name === 'TFL') stats.tackles_for_loss = statValue;
              else if (type.name === 'SACKS') stats.sacks = statValue;
              else if (type.name === 'FR') stats.fumbles_recovered = statValue;
            } else if (category.name === 'kicking') {
              if (type.name === 'FGM') stats.field_goals_made = statValue;
              else if (type.name === 'FGA') stats.field_goals_attempted = statValue;
              else if (type.name === 'XPM') stats.extra_points_made = statValue;
            }

            transformedStats.push({
              playerName: athlete.name,
              playerId: athlete.id || null,
              team: team.team,
              gameId: gameData.gameId,
              game: cfbdGame,
              stats
            });
          }
        }
      }
    }
    
    return transformedStats;
  }

  /**
   * Store player game stats in Supabase  
   */
  async storePlayerGameStats(playerStats: any[]): Promise<void> {
    console.log('💾 Storing player game stats...');
    
    const recordsToInsert: any[] = [];
    let matchedPlayers = 0;
    let totalPlayers = 0;
    
    for (const playerStat of playerStats) {
      totalPlayers++;
      
      // Find matching player in our database
      const playerId = await this.findMatchingPlayer(playerStat.playerName, playerStat.team);
      
      if (playerId) {
        matchedPlayers++;
        
        recordsToInsert.push({
          player_id: playerId,
          external_game_id: playerStat.gameId.toString(),
          game_date: playerStat.game.startDate,
          season: playerStat.game.season,
          week: playerStat.game.week,
          season_type: playerStat.game.seasonType.toUpperCase(),
          stats: {
            ...playerStat.stats,
            league: 'College Football',
            sport: 'College Football'
          },
          created_at: new Date().toISOString()
        });
      }
    }
    
    console.log(`🎯 Matched ${matchedPlayers}/${totalPlayers} players to existing records`);
    
    if (recordsToInsert.length > 0) {
      // Insert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('player_game_stats')
          .insert(batch);
          
        if (error) {
          console.error('Error inserting player stats batch:', error);
        } else {
          console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(recordsToInsert.length/batchSize)} (${batch.length} records)`);
        }
      }
      
      console.log(`🎉 Successfully stored ${recordsToInsert.length} player game stats`);
    }
  }

  /**
   * Setup CFB teams in teams table first
   */
  async setupCFBTeams(): Promise<void> {
    try {
      const teamsResponse = await axios.get(
        'https://api.collegefootballdata.com/teams/fbs',
        {
          headers: {
            'Authorization': `Bearer ${CFBD_API_KEY}`,
            'Accept': 'application/json'
          }
        }
      );
      
      const teams = teamsResponse.data;
      console.log(`📋 Found ${teams.length} CFB teams`);
      
      const teamInserts = teams.map((team: any) => ({
        sport_key: 'americanfootball_ncaaf',
        team_key: team.school?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
        team_name: team.school || 'Unknown',
        team_abbreviation: team.abbreviation || team.school?.substring(0, 3).toUpperCase() || 'UNK',
        city: team.school || 'Unknown',
        conference: team.conference || null,
        division: team.division || null,
        logo_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('teams')
        .upsert(teamInserts, { 
          onConflict: 'team_key',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error('Error setting up CFB teams:', error);
      } else {
        console.log(`✅ Setup ${teamInserts.length} CFB teams`);
      }
    } catch (error) {
      console.error('Failed to setup CFB teams:', error);
    }
  }

  /**
   * Store team records in team_recent_stats table
   */
  async storeTeamRecords(records: CFBDTeamRecord[]): Promise<void> {
    console.log('🏈 Storing team records...');
    
    const teamStats: any[] = [];
    
    for (const record of records) {
      // Get team_id from teams table if exists
      const { data: teamData } = await supabase
        .from('teams')
        .select('id')
        .eq('team_name', record.team)
        .eq('sport_key', 'americanfootball_ncaaf')
        .single();

      if (teamData) {
        teamStats.push({
          team_id: teamData.id,
          team_name: record.team,
          sport: 'College Football',
          sport_key: 'americanfootball_ncaaf',
          game_date: `${record.year}-12-31`, // End of season date
          opponent_team: 'Season Total',
          opponent_team_id: teamData.id, // Use same team as placeholder
          is_home: true,
          team_score: record.total.wins,
          opponent_score: record.total.losses,
          game_result: record.total.wins > record.total.losses ? 'W' : 'L',
          margin: record.total.wins - record.total.losses,
          external_game_id: `${record.team}-${record.year}-season`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
    
    if (teamStats.length > 0) {
      const { error } = await supabase
        .from('team_recent_stats')
        .upsert(teamStats, { 
          onConflict: 'team_id,game_date,opponent_team_id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error('Error storing team records:', error);
      } else {
        console.log(`✅ Stored ${teamStats.length} team records`);
      }
    }
  }

  /**
   * Store team season stats in team_trends_data table
   */
  async storeTeamTrends(teamStats: CFBDTeamStat[]): Promise<void> {
    console.log('📈 Storing team trends data...');
    
    const trendData: any[] = [];
    
    // Group stats by team and season
    const teamSeasonMap = new Map<string, any>();
    
    for (const stat of teamStats) {
      const key = `${stat.team}-${stat.season}`;
      
      if (!teamSeasonMap.has(key)) {
        // Get team_id from teams table if exists
        const { data: teamData } = await supabase
          .from('teams')
          .select('id')
          .eq('team_name', stat.team)
          .eq('sport_key', 'americanfootball_ncaaf')
          .single();

        if (teamData) {
          teamSeasonMap.set(key, {
            team_id: teamData.id,
            team_name: stat.team,
            team_abbreviation: stat.team.substring(0, 3).toUpperCase(),
            city: stat.team,
            sport_key: 'americanfootball_ncaaf',
            games_played: 0,
            wins: 0,
            losses: 0,
            win_percentage: 0,
            avg_points_for: 0,
            avg_points_against: 0,
            avg_margin: 0,
            ats_wins: 0,
            ats_losses: 0,
            ats_percentage: 0,
            over_results: 0,
            under_results: 0,
            trend_indicator: 'neutral'
          });
        }
      }
      
      const teamData = teamSeasonMap.get(key);
      if (teamData) {
        // Map specific stats to columns
        const statValue = parseFloat(stat.stat) || 0;
        
        if (stat.category === 'totalOffense') {
          teamData.avg_points_for = statValue;
        } else if (stat.category === 'totalDefense') {
          teamData.avg_points_against = statValue;
        } else if (stat.category === 'games') {
          teamData.games_played = statValue;
        }
      }
    }
    
    for (const [key, data] of teamSeasonMap) {
      if (data) {
        // Calculate derived stats
        data.avg_margin = data.avg_points_for - data.avg_points_against;
        data.trend_indicator = data.avg_margin > 0 ? 'positive' : data.avg_margin < 0 ? 'negative' : 'neutral';
        
        trendData.push(data);
      }
    }
    
    if (trendData.length > 0) {
      const { error } = await supabase
        .from('team_trends_data')
        .upsert(trendData, { 
          onConflict: 'team_id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error('Error storing team trends:', error);
      } else {
        console.log(`✅ Stored ${trendData.length} team trend records`);
      }
    }
  }

  /**
   * Main integration function
   */
  async run(): Promise<void> {
    console.log('🚀 Starting College Football Data Integration...\n');
    
    try {
      // 1. Get 2025 games
      const games2025 = await this.get2025Games();
      console.log(`✅ Found ${games2025.length} completed 2025 games\n`);
      
      if (games2025.length > 0) {
        // 2. Get player stats for 2025 games
        const gameIds = games2025.map(g => g.id);
        const playerGameStats = await this.getPlayerGameStats(gameIds);
        
        // Transform and store player stats
        let allPlayerStats: any[] = [];
        for (const gameData of playerGameStats) {
          if (gameData.teams && Array.isArray(gameData.teams)) {
            for (const teamData of gameData.teams) {
              if (teamData.players && Array.isArray(teamData.players)) {
                for (const player of teamData.players) {
                  allPlayerStats.push({
                    ...player,
                    team: teamData.school,
                    opponent: gameData.teams.find((t: any) => t.school !== teamData.school)?.school,
                    game_date: gameData.game?.start_date?.split('T')[0] || null,
                    sport: 'College Football'
                  });
                }
              }
            }
          }
        }
        
        console.log(`🔄 Transformed ${allPlayerStats.length} player stat records\n`);
      }
      
      // First, ensure CFB teams exist in teams table
      console.log('🏫 Setting up CFB teams...');
      await this.setupCFBTeams();
      
      // Fetch and store 2024 team data only (as requested - no 2023)
      console.log('🏆 Fetching 2024 team historical records...');
      const teamRecords2024 = await this.getTeamRecords2024();
      console.log(`📋 Found ${teamRecords2024.length} team records for 2024`);
      await this.storeTeamRecords(teamRecords2024);
      
      // team_trends_data is a VIEW that auto-populates from team_recent_stats
      console.log('📊 Team trends will auto-populate from team_recent_stats view');
      
      // Fetch historical player stats for analysis
      const playerSeasonStats = await this.get2024PlayerStats();
      
      console.log('🎉 College Football Data Integration completed successfully!');
      
    } catch (error) {
      console.error('❌ CFB Data Integration failed:', error);
      console.error('Error details:', error);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  if (!CFBD_API_KEY) {
    console.error('❌ CFBD_API_KEY environment variable is required');
    process.exit(1);
  }
  
  const integrator = new CFBDataIntegrator(CFBD_API_KEY);
  await integrator.run();
}

if (require.main === module) {
  main().catch(console.error);
}

export { CFBDataIntegrator };
