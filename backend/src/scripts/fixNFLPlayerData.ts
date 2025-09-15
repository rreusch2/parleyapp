import axios from 'axios';
import { supabaseAdmin } from '../services/supabase/client';

const SPORTSDATA_API_KEY = 'd174f0ac08504e45806435851b5ab630';
const SPORTSDATA_BASE_URL = 'https://api.sportsdata.io/v3/nfl';

interface SportsDataPlayer {
  PlayerID: number;
  Team: string;
  Number: number;
  FirstName: string;
  LastName: string;
  Position: string;
  Status: string;
  Height: string;
  Weight: number;
  BirthDate: string;
  College: string;
  Experience: number;
  FantasyPosition: string;
  Active: boolean;
  PositionCategory: string;
  Name: string;
  Age: number;
  ExperienceString: string;
  BirthDateString: string;
  HeightFeet: number;
  HeightInches: number;
  UpcomingGameOpponent: string;
  UpcomingGameWeek: number;
  ShortName: string;
  AverageDraftPosition: number;
  DepthChartPosition: string;
  DepthChartOrder: number;
  GlobalTeamID: number;
  TeamID: number;
  FantasyPlayerKey: string;
  PlayerSeasonID: number;
  UsaTodayPlayerID: number;
  UsaTodayHeadshotUrl: string;
  UsaTodayHeadshotNoBackgroundUrl: string;
  UsaTodayHeadshotUpdated: string;
  UsaTodayHeadshotNoBackgroundUpdated: string;
}

interface SportsDataHeadshot {
  PlayerID: number;
  Name: string;
  TeamID: number;
  Team: string;
  Position: string;
  Jersey?: number;
  PreferredHostedHeadshotUrl?: string;
  PreferredHostedHeadshotUpdated?: string;
  HostedHeadshotWithBackgroundUrl?: string;
  HostedHeadshotWithBackgroundUpdated?: string;
  HostedHeadshotNoBackgroundUrl?: string;
  HostedHeadshotNoBackgroundUpdated?: string;
  // Legacy fields (likely empty in current API)
  UsaTodayPlayerID?: number;
  UsaTodayHeadshotUrl?: string;
  UsaTodayHeadshotNoBackgroundUrl?: string;
  UsaTodayHeadshotUpdated?: string;
  UsaTodayHeadshotNoBackgroundUpdated?: string;
}

interface DatabasePlayer {
  id: string;
  external_player_id: string;
  name: string;
  position: string;
  team: string;
  sport: string;
  jersey_number: number | null;
  active: boolean;
}

async function fetchSportsDataPlayers(): Promise<SportsDataPlayer[]> {
  console.log('⚠️  Note: Using headshots data for player names since Players endpoint returns 0 results');
  // Return empty array since we'll use headshots data for name updates
  return [];
}

async function fetchSportsDataHeadshots(): Promise<SportsDataHeadshot[]> {
  try {
    console.log('📸 Fetching NFL headshots from SportsData.io...');
    const response = await axios.get(
      `${SPORTSDATA_BASE_URL}/headshots/json/Headshots?key=${SPORTSDATA_API_KEY}`
    );
    
    console.log(`✅ Fetched ${response.data.length} NFL headshots from SportsData.io`);
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching SportsData headshots:', error);
    throw error;
  }
}

async function getNFLPlayersFromDatabase(): Promise<DatabasePlayer[]> {
  try {
    console.log('🔍 Fetching NFL players from database...');
    const { data, error } = await supabaseAdmin
      .from('players')
      .select('id, external_player_id, name, position, team, sport, jersey_number, active')
      .eq('sport', 'NFL')
      .eq('active', true);

    if (error) {
      console.error('❌ Error fetching database players:', error);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} NFL players from database`);
    return data || [];
  } catch (error) {
    console.error('❌ Error querying database:', error);
    throw error;
  }
}

async function updatePlayerName(playerId: string, newName: string, oldName: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('players')
      .update({ 
        name: newName,
        updated_at: new Date().toISOString()
      })
      .eq('id', playerId);

    if (error) {
      console.error(`❌ Error updating player ${oldName} -> ${newName}:`, error);
      throw error;
    }

    console.log(`✅ Updated player name: "${oldName}" -> "${newName}"`);
  } catch (error) {
    console.error('❌ Error updating player name:', error);
    throw error;
  }
}

async function insertPlayerHeadshot(playerId: string, headshotUrl: string, playerName: string): Promise<void> {
  try {
    // Check if headshot already exists
    const { data: existingHeadshot } = await supabaseAdmin
      .from('player_headshots')
      .select('id')
      .eq('player_id', playerId)
      .single();

    if (existingHeadshot) {
      console.log(`⚠️  Headshot already exists for ${playerName}`);
      return;
    }

    const { error } = await supabaseAdmin
      .from('player_headshots')
      .insert({
        player_id: playerId,
        headshot_url: headshotUrl,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error(`❌ Error inserting headshot for ${playerName}:`, error);
      throw error;
    }

    console.log(`✅ Added headshot for ${playerName}`);
  } catch (error) {
    console.error('❌ Error inserting headshot:', error);
    throw error;
  }
}

function isAbbreviatedName(name: string): boolean {
  // Check if name contains abbreviated patterns like "J.Daniels", "A.Richardson"
  return /^[A-Z]\.[A-Z]/i.test(name) || name.split(' ').some(part => /^[A-Z]\./.test(part));
}

function normalizeTeamName(sportsDataTeam: string): string {
  // Map SportsData.io team names to our database format
  const teamMap: Record<string, string> = {
    'ARI': 'ARI', // Arizona Cardinals
    'ATL': 'ATL', // Atlanta Falcons
    'BAL': 'BAL', // Baltimore Ravens
    'BUF': 'BUF', // Buffalo Bills
    'CAR': 'CAR', // Carolina Panthers
    'CHI': 'CHI', // Chicago Bears
    'CIN': 'CIN', // Cincinnati Bengals
    'CLE': 'CLE', // Cleveland Browns
    'DAL': 'DAL', // Dallas Cowboys
    'DEN': 'DEN', // Denver Broncos
    'DET': 'DET', // Detroit Lions
    'GB': 'GB',   // Green Bay Packers
    'HOU': 'HOU', // Houston Texans
    'IND': 'IND', // Indianapolis Colts
    'JAX': 'JAX', // Jacksonville Jaguars
    'KC': 'KC',   // Kansas City Chiefs
    'LV': 'LV',   // Las Vegas Raiders
    'LAC': 'LAC', // Los Angeles Chargers
    'LAR': 'LAR', // Los Angeles Rams
    'MIA': 'MIA', // Miami Dolphins
    'MIN': 'MIN', // Minnesota Vikings
    'NE': 'NE',   // New England Patriots
    'NO': 'NO',   // New Orleans Saints
    'NYG': 'NYG', // New York Giants
    'NYJ': 'NYJ', // New York Jets
    'PHI': 'PHI', // Philadelphia Eagles
    'PIT': 'PIT', // Pittsburgh Steelers
    'SF': 'SF',   // San Francisco 49ers
    'SEA': 'SEA', // Seattle Seahawks
    'TB': 'TB',   // Tampa Bay Buccaneers
    'TEN': 'TEN', // Tennessee Titans
    'WAS': 'WAS', // Washington Commanders
  };

  return teamMap[sportsDataTeam] || sportsDataTeam;
}

async function fixNFLPlayerData(): Promise<void> {
  try {
    console.log('🚀 Starting NFL Player Data Fix...\n');

    // Step 1: Fetch data from both sources
    const [sportsDataHeadshots, dbPlayers] = await Promise.all([
      fetchSportsDataHeadshots(),
      getNFLPlayersFromDatabase()
    ]);

    // Create lookup map for headshots (which contains player names)
    const sportsDataHeadshotMap = new Map<string, SportsDataHeadshot>();

    // Map SportsData headshots by PlayerID
    sportsDataHeadshots.forEach(headshot => {
      sportsDataHeadshotMap.set(headshot.PlayerID.toString(), headshot);
    });

    console.log('\n📊 Data Summary:');
    console.log(`- SportsData Headshots: ${sportsDataHeadshots.length}`);
    console.log(`- Database Players: ${dbPlayers.length}\n`);

    // DEBUG: Check for Jaden Daniels specifically
    const jadenInSportsData = sportsDataHeadshots.find(h => 
      h.Name?.includes('Daniels') && h.Position === 'QB' && h.Team === 'WAS'
    );
    if (jadenInSportsData) {
      console.log('🔍 DEBUG: Found Jaden Daniels in SportsData headshots:', {
        PlayerID: jadenInSportsData.PlayerID,
        Name: jadenInSportsData.Name,
        Team: jadenInSportsData.Team,
        Position: jadenInSportsData.Position,
        HasHeadshotUrl: !!jadenInSportsData.UsaTodayHeadshotUrl
      });
    }

    // DEBUG: Check what external_player_id we have for J.Daniels
    const jadenInDB = dbPlayers.find(p => p.name.includes('J.Daniels'));
    if (jadenInDB) {
      console.log('🔍 DEBUG: J.Daniels in database:', {
        external_player_id: jadenInDB.external_player_id,
        name: jadenInDB.name,
        team: jadenInDB.team,
        position: jadenInDB.position
      });
      
      const matchingSportsDataHeadshot = sportsDataHeadshotMap.get(jadenInDB.external_player_id);
      console.log('🔍 DEBUG: Matching SportsData headshot:', matchingSportsDataHeadshot ? 'FOUND' : 'NOT FOUND');
      if (matchingSportsDataHeadshot) {
        console.log('🔍 DEBUG: SportsData name for J.Daniels:', matchingSportsDataHeadshot.Name);
      }
    }

    // Step 2: Process player name updates and headshot inserts
    let nameUpdates = 0;
    let headshotInserts = 0;
    let skipped = 0;

    for (const dbPlayer of dbPlayers) {
      const sportsDataHeadshot = sportsDataHeadshotMap.get(dbPlayer.external_player_id);
      
      if (!sportsDataHeadshot) {
        // Only log first 10 to avoid spam
        if (skipped < 10) {
          console.log(`⚠️  No SportsData headshot match for DB player: ${dbPlayer.name} (ID: ${dbPlayer.external_player_id})`);
        }
        skipped++;
        continue;
      }

      // Check if we need to update the name
      const isCurrentNameAbbreviated = isAbbreviatedName(dbPlayer.name);
      const fullNameFromSportsData = sportsDataHeadshot.Name;
      
      if (isCurrentNameAbbreviated && fullNameFromSportsData && fullNameFromSportsData !== dbPlayer.name) {
        console.log(`🔄 Name update needed: "${dbPlayer.name}" -> "${fullNameFromSportsData}"`);
        await updatePlayerName(dbPlayer.id, fullNameFromSportsData, dbPlayer.name);
        nameUpdates++;
        
        // Add a small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check if we need to add a headshot - use the correct field names
      const headshotUrl = sportsDataHeadshot.PreferredHostedHeadshotUrl || 
                         sportsDataHeadshot.HostedHeadshotNoBackgroundUrl ||
                         sportsDataHeadshot.HostedHeadshotWithBackgroundUrl;
      
      if (headshotUrl) {
        const playerDisplayName = fullNameFromSportsData || dbPlayer.name;
        await insertPlayerHeadshot(
          dbPlayer.id, 
          headshotUrl, 
          playerDisplayName
        );
        headshotInserts++;
        
        // Add a small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n🎉 NFL Player Data Fix Complete!');
    console.log(`✅ Player name updates: ${nameUpdates}`);
    console.log(`✅ Headshot inserts: ${headshotInserts}`);
    console.log(`⚠️  Skipped (no SportsData match): ${skipped}`);
    console.log(`📊 Total processed: ${dbPlayers.length}`);

  } catch (error) {
    console.error('💥 Fatal error in fixNFLPlayerData:', error);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  fixNFLPlayerData()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { fixNFLPlayerData };
