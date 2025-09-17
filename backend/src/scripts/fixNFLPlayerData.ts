import axios from 'axios';
import { supabaseAdmin } from '../services/supabase/client';
import { v4 as uuidv4 } from 'uuid';

// Read API key from env (do NOT hardcode secrets). Set SPORTSDATA_API_KEY in backend/.env
const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY;
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
  if (!SPORTSDATA_API_KEY) {
    console.warn('⚠️ SPORTSDATA_API_KEY is not set. Skipping Players endpoint and relying on headshots.');
    return [];
  }
  try {
    console.log('🏈 Fetching NFL players from SportsData.io Players endpoint...');
    // Full list of NFL players
    const url = `${SPORTSDATA_BASE_URL}/scores/json/Players?key=${SPORTSDATA_API_KEY}`;
    const response = await axios.get(url, { timeout: 60000 });
    const players: SportsDataPlayer[] = response.data || [];
    console.log(`✅ Fetched ${players.length} players from SportsData.io`);
    return players;
  } catch (error) {
    console.warn('⚠️ Error fetching SportsData Players. Will fallback to headshots only.', error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function fetchSportsDataHeadshots(): Promise<SportsDataHeadshot[]> {
  try {
    console.log('📸 Fetching NFL headshots from SportsData.io...');
    if (!SPORTSDATA_API_KEY) {
      throw new Error('SPORTSDATA_API_KEY is not set');
    }
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
      .eq('active', true)
      .in('sport_key', ['nfl', 'americanfootball_nfl']);

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

function pickHeadshotUrl(h: SportsDataHeadshot | undefined): string | null {
  if (!h) return null;
  return (
    h.PreferredHostedHeadshotUrl ||
    h.HostedHeadshotNoBackgroundUrl ||
    h.HostedHeadshotWithBackgroundUrl ||
    h.UsaTodayHeadshotNoBackgroundUrl ||
    h.UsaTodayHeadshotUrl ||
    null
  );
}

function isInitialDotFormat(n: string | null | undefined): boolean {
  if (!n) return false;
  return /^\s*[A-Za-z]\.[A-Za-z][A-Za-z'\-]*\s*$/.test(n);
}

async function upsertNFLPlayer(
  playerIdStr: string,
  fullName: string,
  teamAbbr: string | undefined,
  position: string | undefined,
  jersey: number | undefined,
  headshotUrl: string | null
): Promise<void> {
  const sport = 'NFL';
  const sport_key = 'americanfootball_nfl';
  const team = teamAbbr ? normalizeTeamName(teamAbbr) : '';

  // Does a player with this external_player_id already exist?
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('players')
    .select('id, name, player_key, sport_key')
    .eq('external_player_id', playerIdStr)
    .maybeSingle();

  if (existingErr) {
    console.error(`❌ Error checking existing player ${playerIdStr}:`, existingErr.message);
    return;
  }

  if (existing) {
    // Update in place to preserve FK references
    const updatePayload: any = {
      name: fullName,
      player_name: fullName,
      sport,
      sport_key,
      team,
      position: position || null,
      jersey_number: jersey ?? null,
      active: true,
      updated_at: new Date().toISOString(),
    };

    // Standardize player_key if it looks legacy and not already set to stable scheme
    const desiredKey = `nfl_${playerIdStr}`;
    if (existing.player_key !== desiredKey) {
      updatePayload.player_key = desiredKey;
    }

    const { error: updErr } = await supabaseAdmin
      .from('players')
      .update(updatePayload)
      .eq('id', existing.id);

    if (updErr) {
      // If unique violation on player_key, retry without changing player_key
      if (updErr.message && updErr.message.toLowerCase().includes('duplicate key')) {
        console.warn(`⚠️ Player key conflict for ${playerIdStr}, updating without player_key`);
        const { error: updRetryErr } = await supabaseAdmin
          .from('players')
          .update({ ...updatePayload, player_key: undefined })
          .eq('id', existing.id);
        if (updRetryErr) {
          console.error(`❌ Update retry failed for ${playerIdStr}:`, updRetryErr.message);
        }
      } else {
        console.error(`❌ Error updating player ${playerIdStr}:`, updErr.message);
      }
    } else {
      console.log(`✅ Updated player ${fullName} (${playerIdStr})`);
    }

    // Ensure headshot present
    if (headshotUrl) {
      await insertPlayerHeadshot(existing.id, headshotUrl, fullName);
    }
    return;
  }

  // Insert new player
  const newId = uuidv4();
  const insertPayload: any = {
    id: newId,
    external_player_id: playerIdStr,
    name: fullName,
    player_name: fullName,
    player_key: `nfl_${playerIdStr}`,
    team,
    sport,
    sport_key,
    position: position || null,
    jersey_number: jersey ?? null,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: insErr } = await supabaseAdmin
    .from('players')
    .insert(insertPayload);

  if (insErr) {
    if (insErr.message && insErr.message.toLowerCase().includes('duplicate key')) {
      console.warn(`⚠️ Duplicate detected when inserting ${playerIdStr}. Attempting upsert-like update.`);
      // Try update path if row somehow exists but was not fetched
      const { data: row, error: getErr } = await supabaseAdmin
        .from('players')
        .select('id')
        .eq('external_player_id', playerIdStr)
        .maybeSingle();
      if (!getErr && row) {
        const { error: updErr2 } = await supabaseAdmin
          .from('players')
          .update({ ...insertPayload, id: undefined, created_at: undefined })
          .eq('id', row.id);
        if (updErr2) {
          console.error(`❌ Failed to update existing duplicate for ${playerIdStr}:`, updErr2.message);
        }
      } else {
        console.error(`❌ Could not resolve duplicate for ${playerIdStr}:`, getErr?.message);
      }
    } else {
      console.error(`❌ Error inserting player ${playerIdStr}:`, insErr.message);
    }
  } else {
    console.log(`🆕 Inserted new NFL player ${fullName} (${playerIdStr})`);
    if (headshotUrl) {
      await insertPlayerHeadshot(newId, headshotUrl, fullName);
    }
  }
}

async function fixNFLPlayerData(): Promise<void> {
  try {
    console.log('🚀 Starting NFL Player Data Fix...\n');

    if (!SPORTSDATA_API_KEY) {
      console.warn('⚠️ SPORTSDATA_API_KEY not set. Set it in backend/.env to enable full ingestion. Proceeding with limited mode.');
    }

    // Step 1: Fetch data from both sources
    const [sportsDataPlayers, sportsDataHeadshots, dbPlayers] = await Promise.all([
      fetchSportsDataPlayers(),
      fetchSportsDataHeadshots(),
      getNFLPlayersFromDatabase()
    ]);

    // Create lookup maps
    const sportsDataHeadshotMap = new Map<string, SportsDataHeadshot>();
    sportsDataHeadshots.forEach(headshot => {
      sportsDataHeadshotMap.set(headshot.PlayerID.toString(), headshot);
    });
    const sportsDataPlayerMap = new Map<string, SportsDataPlayer>();
    sportsDataPlayers.forEach(p => {
      sportsDataPlayerMap.set(p.PlayerID.toString(), p);
    });

    console.log('\n📊 Data Summary:');
    console.log(`- SportsData Players: ${sportsDataPlayers.length}`);
    console.log(`- SportsData Headshots: ${sportsDataHeadshots.length}`);
    console.log(`- Database Players (NFL sport_key in ['nfl','americanfootball_nfl'] & active): ${dbPlayers.length}\n`);

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

    // Step 2: Update existing DB players (fix abbreviated names, normalize sport_key)
    let nameUpdates = 0;
    let headshotInserts = 0;
    let upsertsNew = 0;
    let skipped = 0;

    for (const dbPlayer of dbPlayers) {
      const sportsDataHeadshot = sportsDataHeadshotMap.get(dbPlayer.external_player_id);
      const sportsDataPlayer = sportsDataPlayerMap.get(dbPlayer.external_player_id);

      const fullNameFromSportsData = sportsDataPlayer
        ? `${sportsDataPlayer.FirstName} ${sportsDataPlayer.LastName}`.trim()
        : (sportsDataHeadshot?.Name || dbPlayer.name);

      const needNameUpdate = isAbbreviatedName(dbPlayer.name) && fullNameFromSportsData && fullNameFromSportsData !== dbPlayer.name;

      if (needNameUpdate || dbPlayer.sport !== 'NFL') {
        const { error } = await supabaseAdmin
          .from('players')
          .update({
            name: fullNameFromSportsData,
            player_name: fullNameFromSportsData,
            sport: 'NFL',
            sport_key: 'americanfootball_nfl',
            updated_at: new Date().toISOString()
          })
          .eq('id', dbPlayer.id);

        if (!error) {
          if (needNameUpdate) nameUpdates++;
        } else {
          console.error(`❌ Failed updating player ${dbPlayer.name}:`, error.message);
        }
        await new Promise(r => setTimeout(r, 50));
      }

      // Ensure headshot
      const headshotUrl = pickHeadshotUrl(sportsDataHeadshot);
      if (headshotUrl) {
        await insertPlayerHeadshot(dbPlayer.id, headshotUrl, fullNameFromSportsData || dbPlayer.name);
        headshotInserts++;
        await new Promise(r => setTimeout(r, 50));
      }
    }

    // Step 3: Insert missing players based on SportsData sources
    // Build set of existing external IDs in DB for NFL
    const existingIds = new Set(dbPlayers.map(p => p.external_player_id));

    // Prefer Players dataset; fallback to headshots-only entries not present in Players
    const candidateIds = new Set<string>();
    sportsDataPlayers.forEach(p => candidateIds.add(p.PlayerID.toString()));
    sportsDataHeadshots.forEach(h => candidateIds.add(h.PlayerID.toString()));

    for (const playerIdStr of candidateIds) {
      if (existingIds.has(playerIdStr)) continue; // already present

      const p = sportsDataPlayerMap.get(playerIdStr);
      const h = sportsDataHeadshotMap.get(playerIdStr);

      const fullName = p ? `${p.FirstName} ${p.LastName}`.trim() : (h?.Name || '').trim();
      if (!fullName) {
        skipped++;
        continue;
      }

      const team = p?.Team || h?.Team || '';
      const position = p?.Position || h?.Position || '';
      const jersey = p?.Number || h?.Jersey;
      const headshotUrl = pickHeadshotUrl(h);

      await upsertNFLPlayer(playerIdStr, fullName, team, position, jersey, headshotUrl);
      upsertsNew++;
      await new Promise(r => setTimeout(r, 50));
    }

    console.log('\n🎉 NFL Player Data Fix & Ingestion Complete!');
    console.log(`✅ Player name updates: ${nameUpdates}`);
    console.log(`✅ Headshot inserts: ${headshotInserts}`);
    console.log(`🆕 New/Upserted players: ${upsertsNew}`);
    console.log(`⚠️ Skipped (insufficient data): ${skipped}`);
    console.log(`📊 Total DB players processed: ${dbPlayers.length}`);

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
