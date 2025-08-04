import { supabaseAdmin } from '../services/supabase/client';
import { fetchAllGameData } from './fetchTheOddsGames';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { SUPPORTED_SPORTS, getActiveSportConfigs, BOOKMAKER_CONFIG, logSportStatus } from './multiSportConfig';

// Multi-sport configuration - now using centralized config
// Legacy constants for backwards compatibility
const MLB_PROP_MARKETS = SUPPORTED_SPORTS.MLB.propMarkets;
const TEAM_ODDS_BOOKMAKERS = BOOKMAKER_CONFIG.teamOdds;
const PLAYER_PROPS_BOOKMAKER = BOOKMAKER_CONFIG.playerProps;

/**
 * Converts decimal odds format to American odds format
 * Examples:
 * - 2.0 decimal odds = +100 American odds
 * - 1.5 decimal odds = -200 American odds
 * 
 * @param decimalOdds Decimal odds (e.g., 1.5, 2.25, etc.)
 * @returns American odds (e.g., -200, +125, etc.)
 */
function convertDecimalToAmerican(decimalOdds: number): number {
  if (decimalOdds <= 1) {
    return -1000; // Minimum value for extremely low decimal odds
  }
  
  if (decimalOdds < 2) {
    // For favorites (odds less than 2.0 in decimal)
    return Math.round(-100 / (decimalOdds - 1));
  } else {
    // For underdogs (odds 2.0 or greater in decimal)
    return Math.round((decimalOdds - 1) * 100);
  }
}

interface PlayerPropOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

interface PlayerPropMarket {
  key: string;
  outcomes: PlayerPropOutcome[];
}

interface PlayerPropBookmaker {
  key: string;
  title: string;
  markets: PlayerPropMarket[];
}

interface PlayerPropsData {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: PlayerPropBookmaker[];
}

async function checkReferenceData(): Promise<boolean> {
  console.log('🔍 Checking reference data...');
  
  try {
    // Check sports_config
    const { data: sportsData, error: sportsError } = await supabaseAdmin
      .from('sports_config')
      .select('sport_key, sport_name')
      .in('sport_key', ['MLB', 'NBA']);
    
    if (sportsError) {
      console.error('❌ Error checking sports_config:', sportsError.message);
      return false;
    }
    
    console.log(`✅ Found ${sportsData?.length || 0} sports in sports_config`);
    if (sportsData) {
      sportsData.forEach(sport => console.log(`  - ${sport.sport_key}: ${sport.sport_name}`));
    }
    
    // Check market_types
    const { data: marketData, error: marketError } = await supabaseAdmin
      .from('market_types')
      .select('market_key, market_name')
      .in('market_key', ['h2h', 'spreads', 'totals']);
    
    if (marketError) {
      console.error('❌ Error checking market_types:', marketError.message);
      return false;
    }
    
    console.log(`✅ Found ${marketData?.length || 0} market types`);
    if (marketData) {
      marketData.forEach(market => console.log(`  - ${market.market_key}: ${market.market_name}`));
    }
    
    // Check bookmakers
    const { data: bookmakerData, error: bookmakerError } = await supabaseAdmin
      .from('bookmakers')
      .select('bookmaker_key, bookmaker_name')
      .eq('is_active', true)
      .limit(5);
    
    if (bookmakerError) {
      console.error('❌ Error checking bookmakers:', bookmakerError.message);
      return false;
    }
    
    console.log(`✅ Found ${bookmakerData?.length || 0} active bookmakers`);
    if (bookmakerData) {
      bookmakerData.forEach(bm => console.log(`  - ${bm.bookmaker_key}: ${bm.bookmaker_name}`));
    }
    
    // Check if we have minimum required data
    const hasMinimumData = 
      (sportsData?.length || 0) >= 2 && // MLB and NBA
      (marketData?.length || 0) >= 3 && // h2h, spreads, totals
      (bookmakerData?.length || 0) >= 1; // At least one bookmaker
    
    if (!hasMinimumData) {
      console.log('⚠️ Missing some reference data. Please run the setup SQL script first.');
      console.log('   psql -h your-host -U your-user -d your-db -f backend/src/scripts/setupReferenceData.sql');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking reference data:', (error as Error).message);
    return false;
  }
}

async function ensurePlayerPropTypes(): Promise<void> {
  console.log('🎯 Ensuring player prop types exist...');
  
  const propTypes = [
    { prop_key: 'batter_hits', prop_name: 'Batter Hits O/U', sport_key: 'baseball_mlb', stat_category: 'batting' },
    { prop_key: 'batter_home_runs', prop_name: 'Batter Home Runs O/U', sport_key: 'baseball_mlb', stat_category: 'power' },
    { prop_key: 'batter_rbis', prop_name: 'Batter RBIs O/U', sport_key: 'baseball_mlb', stat_category: 'batting' },
    { prop_key: 'batter_total_bases', prop_name: 'Batter Total Bases O/U', sport_key: 'baseball_mlb', stat_category: 'batting' },
    { prop_key: 'batter_runs_scored', prop_name: 'Batter Runs Scored O/U', sport_key: 'baseball_mlb', stat_category: 'batting' },
    { prop_key: 'pitcher_strikeouts', prop_name: 'Pitcher Strikeouts O/U', sport_key: 'baseball_mlb', stat_category: 'pitching' },
    { prop_key: 'pitcher_earned_runs', prop_name: 'Pitcher Earned Runs O/U', sport_key: 'baseball_mlb', stat_category: 'pitching' },
    { prop_key: 'pitcher_hits_allowed', prop_name: 'Pitcher Hits Allowed O/U', sport_key: 'baseball_mlb', stat_category: 'pitching' }
  ];
  
  for (const propType of propTypes) {
    const { error } = await supabaseAdmin
      .from('player_prop_types')
      .upsert(propType, { onConflict: 'prop_key' });
    
    if (error) {
      console.error(`❌ Error upserting prop type ${propType.prop_key}:`, error.message);
    }
  }
  
  console.log(`✅ Ensured ${propTypes.length} player prop types exist`);
}

async function fetchPlayerPropsForGame(eventId: string, sportKey: string): Promise<PlayerPropsData | null> {
  const apiKey = process.env.THEODDS_API_KEY;
  if (!apiKey) {
    console.error('❌ THEODDS_API_KEY not found');
    return null;
  }
  
  try {
    // Get sport-specific prop markets from configuration
    const sportConfig = Object.values(SUPPORTED_SPORTS).find(sport => sport.theoddsKey === sportKey);
    const propMarkets = sportConfig?.propMarkets || [];
    
    if (propMarkets.length === 0) {
      console.log(`  ⚠️ No prop markets configured for sport ${sportKey}`);
      return null;
    }
    
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds`;
    const params = {
      apiKey,
      regions: 'us',
      markets: propMarkets.join(','),
      oddsFormat: 'american',
      bookmakers: PLAYER_PROPS_BOOKMAKER  // Just get FanDuel for player props
    };
    
    console.log(`  🎯 Fetching player props for event ${eventId}...`);
    console.log(`  🔍 API URL: ${url}`);
    console.log(`  🔍 Markets: ${propMarkets.join(',')}`);
    console.log(`  🔍 Bookmaker: ${PLAYER_PROPS_BOOKMAKER}`);
    const response = await axios.get(url, { params, timeout: 30000 });
    
    if (response.status === 200 && response.data) {
      const data = response.data as PlayerPropsData;
      
      // Debug: Log what markets we actually received
      const availableMarkets = new Set<string>();
      for (const bookmaker of data.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          availableMarkets.add(market.key);
        }
      }
      console.log(`  📊 Available markets for ${data.home_team} vs ${data.away_team}:`, Array.from(availableMarkets).sort());
      
      // Check if we actually got prop markets (not just standard markets)
      let hasProps = false;
      const foundPropMarkets = Array.from(availableMarkets).filter(market => propMarkets.includes(market));
      console.log(`  🎯 Found ${foundPropMarkets.length} matching prop markets:`, foundPropMarkets);
      
      for (const bookmaker of data.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          if (propMarkets.includes(market.key)) {
            hasProps = true;
            break;
          }
        }
        if (hasProps) break;
      }
      
      if (hasProps) {
        console.log(`  ✅ Found player props for ${data.away_team} @ ${data.home_team}`);
        return data;
      } else {
        console.log(`  ⚠️ No player prop markets found for ${data.away_team} @ ${data.home_team}`);
        return null;
      }
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log(`  ⚠️ API error for event ${eventId}: ${error.response?.status} - ${error.response?.statusText}`);
    } else {
      console.log(`  ⚠️ Error fetching props for event ${eventId}: ${(error as Error).message}`);
    }
  }
  
  return null;
}

async function storePlayerPropsData(propsData: PlayerPropsData, eventId: string, sportKey: string): Promise<void> {
  console.log(`  💾 Storing player props for event ${eventId}...`);
  
  // Get game info to extract team names for players
  const { data: gameData, error: gameError } = await supabaseAdmin
    .from('sports_events')
    .select('home_team, away_team')
    .eq('id', eventId)
    .single();
  
  if (gameError) {
    console.log(`⚠️ Could not get game data for event ${eventId}: ${gameError.message}`);
    return;
  }
  
  // Group player props by player, prop type, line, and bookmaker
  const groupedProps = new Map<string, {
    playerName: string;
    propType: string;
    line: number;
    bookmaker: string;
    overOdds: number | null;
    underOdds: number | null;
    playerTeam: string;
  }>();
  
  // Filter for only DraftKings bookmaker
  const draftkingsBookmaker = propsData.bookmakers?.find(b => b.key.toLowerCase() === PLAYER_PROPS_BOOKMAKER);
  
  if (!draftkingsBookmaker) {
    console.log(`⚠️ ${PLAYER_PROPS_BOOKMAKER.toUpperCase()} bookmaker data not found`);
    return;
  }
  
  // Get sport-specific prop markets
  const sportConfig = SUPPORTED_SPORTS[sportKey.toUpperCase()];
  if (!sportConfig) {
    console.log(`⚠️ Unknown sport: ${sportKey}`);
    return;
  }
  
  const validPropMarkets = sportConfig.propMarkets;
  console.log(`  🎯 Valid prop markets for ${sportKey}: ${validPropMarkets.join(', ')}`);
  
  // Process markets from DraftKings only
  for (const market of draftkingsBookmaker.markets || []) {
    if (!validPropMarkets.includes(market.key)) {
      console.log(`  ⚠️ Skipping unsupported market: ${market.key} for sport ${sportKey}`);
      continue;
    }
    
    for (const outcome of market.outcomes || []) {
      // Extract FULL player name from outcome description (not just first name!)
      const fullPlayerName = outcome.description || 'Unknown Player';
      const line = outcome.point || 0;
      
      // We'll match against existing complete player records instead of creating incomplete ones
      let playerTeam = '';
      
      // Create unique key for grouping using FULL name
      const groupKey = `${fullPlayerName}-${market.key}-${line}-${PLAYER_PROPS_BOOKMAKER}`;
      
      // Get or create grouped prop entry
      if (!groupedProps.has(groupKey)) {
        groupedProps.set(groupKey, {
          playerName: fullPlayerName,
          propType: market.key,
          line,
          bookmaker: PLAYER_PROPS_BOOKMAKER,
          overOdds: null,
          underOdds: null,
          playerTeam
        });
      }
      
      const groupedProp = groupedProps.get(groupKey)!;
      
      // Log the outcome name and price for debugging
      console.log(`  🔍 [DEBUG] Outcome: ${outcome.name} (${outcome.price}) for ${fullPlayerName} ${market.key}`);
      
      // Detect and convert odds format if needed
      let oddsValue = outcome.price;
      
      // Check if this looks like a decimal odd (common values between 1.01 and 10.0)
      // Decimal odds are typically in formats like 1.5, 2.25, etc.
      if (oddsValue > 1 && oddsValue < 10 && !Number.isInteger(oddsValue)) {
        // This is likely a decimal odd, convert to American odds
        const convertedOdds = convertDecimalToAmerican(oddsValue);
        console.log(`  🔄 Converting likely decimal odd ${oddsValue} to American: ${convertedOdds}`);
        oddsValue = convertedOdds;
      } else if (oddsValue > 1000) {
        // This is an extremely high American odd which is suspicious (above +1000)
        console.log(`  ⚠️ Suspicious high American odd: ${oddsValue}`);
      }
      
      // Assign odds based on outcome name with more flexible matching
      const outcomeName = outcome.name.toLowerCase();
      if (outcomeName.includes('over') || outcomeName.includes('+') || outcomeName.includes('more')) {
        groupedProp.overOdds = oddsValue;
      } else if (outcomeName.includes('under') || outcomeName.includes('-') || outcomeName.includes('fewer') || outcomeName.includes('less')) {
        groupedProp.underOdds = oddsValue;
      } else {
        console.log(`  ⚠️ Unknown outcome type: ${outcome.name} - can't determine if over/under`);
      }
    }
  }
  
  // Now store only the grouped props with BOTH over and under odds
  const completeProps = [];
  let incompletePropsCount = 0;
  let extremeOddsCount = 0;
  
  for (const [groupKey, groupedProp] of groupedProps.entries()) {
    // Skip props without at least OVER odds (UNDER odds are optional)
    if (groupedProp.overOdds === null) {
      incompletePropsCount++;
      console.log(`⚠️ Skipping incomplete prop for ${groupedProp.playerName} ${groupedProp.propType}: missing OVER odds`);
      continue;
    }
    
    // Log if UNDER odds are missing but we'll still process the prop
    if (groupedProp.underOdds === null) {
      console.log(`ℹ️ Processing prop for ${groupedProp.playerName} ${groupedProp.propType} with OVER odds only (UNDER missing)`);
    }
    
    // Skip props with extreme odds values
    if ((groupedProp.overOdds !== null && Math.abs(groupedProp.overOdds) > 5000) || 
        (groupedProp.underOdds !== null && Math.abs(groupedProp.underOdds) > 5000)) {
      extremeOddsCount++;
      console.log(`⚠️ Skipping prop with extreme odds for ${groupedProp.playerName} ${groupedProp.propType}: Over=${groupedProp.overOdds}, Under=${groupedProp.underOdds}`);
      continue;
    }
    
    // This prop has both over and under odds - add to complete props list
    completeProps.push(groupedProp);
  }
  
  console.log(`📊 Stats: Found ${completeProps.length} complete props, skipped ${incompletePropsCount} incomplete props and ${extremeOddsCount} props with extreme odds`);
  
  // Process complete props
  for (const prop of completeProps) {
    try {
      // SMART MATCHING: Try to match against existing complete player records
      // First try exact match with complete player records (those with teams)
      let { data: playerData, error: playerError } = await supabaseAdmin
        .from('players')
        .select('id, name, team')
        .eq('name', prop.playerName)
        .eq('sport', sportKey.toUpperCase())
        .not('team', 'is', null)
        .not('team', 'eq', '')
        .single();
      
      let playerId: string;
      
      if (playerError || !playerData) {
        // Try fuzzy matching: look for players where the prop name contains their full name
        // e.g., "Bryce Harper" prop matches "Bryce Harper" player
        const { data: allPlayers, error: allPlayersError } = await supabaseAdmin
          .from('players')
          .select('id, name, team')
          .eq('sport', sportKey.toUpperCase())
          .not('team', 'is', null)
          .not('team', 'eq', '');
        
        if (!allPlayersError && allPlayers) {
          // Find the best match
          const matchedPlayer = allPlayers.find(player => {
            // Try exact match first
            if (player.name === prop.playerName) return true;
            
            // Try partial match - prop name contains player name
            if (prop.playerName.includes(player.name)) return true;
            
            // Try reverse - player name contains prop name (less likely but possible)
            if (player.name.includes(prop.playerName)) return true;
            
            return false;
          });
          
          if (matchedPlayer) {
            playerId = matchedPlayer.id;
            console.log(`✅ Matched "${prop.playerName}" to existing player "${matchedPlayer.name}" (${matchedPlayer.team})`);
          } else {
            // For WNBA, create new players automatically since we're building the roster
            if (sportKey.toUpperCase() === 'WNBA') {
              console.log(`🆕 Creating new WNBA player: ${prop.playerName}`);
              
              // Determine team from game data
              let playerTeam = '';
              if (gameData) {
                // Extract team from WNBA game context
                // For WNBA, we'll use team abbreviations from the game data
                const homeTeam = gameData.home_team;
                const awayTeam = gameData.away_team;
                
                // Create team abbreviations from full team names
                const homeAbbr = homeTeam.split(' ').pop() || homeTeam; // e.g., "Seattle Storm" -> "Storm"
                const awayAbbr = awayTeam.split(' ').pop() || awayTeam; // e.g., "Dallas Wings" -> "Wings"
                
                // For now, assign to home team by default (this could be improved with roster data)
                // In production, you'd want to use actual roster/team assignment data
                playerTeam = homeAbbr;
                console.log(`📍 Assigned WNBA player ${prop.playerName} to team: ${playerTeam} (from game: ${awayTeam} @ ${homeTeam})`);
              }
              
              const newPlayerId = uuidv4();
              // Create a unique player key for WNBA players
              const playerKey = `wnba_${prop.playerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${newPlayerId.slice(0, 8)}`;
              
              const { data: newPlayer, error: createError } = await supabaseAdmin
                .from('players')
                .insert({
                  id: newPlayerId,
                  external_player_id: newPlayerId, // Use UUID as external ID
                  name: prop.playerName,
                  player_name: prop.playerName, // Required field
                  player_key: playerKey, // Required field
                  team: playerTeam,
                  sport: 'WNBA',
                  position: null,
                  active: true
                })
                .select('id')
                .single();
              
              if (createError || !newPlayer) {
                console.log(`❌ Failed to create player ${prop.playerName}: ${createError?.message}`);
                continue;
              }
              
              playerId = newPlayer.id;
              console.log(`✅ Created new WNBA player: ${prop.playerName}`);
            } else {
              console.log(`⚠️ No match found for "${prop.playerName}" - SKIPPING to avoid creating incomplete records`);
              continue;
            }
          }
        } else {
          console.log(`⚠️ Could not fetch player list for matching "${prop.playerName}" - SKIPPING`);
          continue;
        }
      } else {
        playerId = playerData.id;
        console.log(`✅ Exact match: ${prop.playerName} (${playerData.team})`);
      }
      
      // Get prop type
      const { data: propTypeData, error: propTypeError } = await supabaseAdmin
        .from('player_prop_types')
        .select('id')
        .eq('prop_key', prop.propType)
        .single();
      
      if (propTypeError || !propTypeData) {
        console.log(`⚠️ Error finding prop type ${prop.propType}: ${propTypeError.message}`);
        continue;
      }
      
      // Get bookmaker
      const { data: bookmakerInfo, error: bookmakerError } = await supabaseAdmin
        .from('bookmakers')
        .select('id')
        .eq('bookmaker_key', prop.bookmaker.toLowerCase())
        .single();
      
      if (bookmakerError || !bookmakerInfo) {
        console.log(`⚠️ Error finding bookmaker ${prop.bookmaker}: ${bookmakerError.message}`);
        continue;
      }
      
      // Check if prop already exists
      const { data: existingProp, error: existingPropError } = await supabaseAdmin
        .from('player_props_odds')
        .select('id')
        .eq('event_id', eventId)
        .eq('player_id', playerId)
        .eq('prop_type_id', propTypeData.id)
        .eq('bookmaker_id', bookmakerInfo.id)
        .eq('line', prop.line)
        .maybeSingle();
      
      if (existingPropError) {
        console.log(`⚠️ Error checking existing prop: ${existingPropError.message}`);
        continue;
      }
      
      // Store or update prop odds
      if (existingProp) {
        // Update existing prop
        const { error: updateError } = await supabaseAdmin
          .from('player_props_odds')
          .update({
            over_odds: prop.overOdds !== null ? String(prop.overOdds) : null,
            under_odds: prop.underOdds !== null ? String(prop.underOdds) : null
            // Don't include updated_at since it's not in the schema
          })
          .eq('id', existingProp.id);
        
        if (updateError) {
          console.log(`⚠️ Error updating prop: ${updateError.message}`);
        } else {
          console.log(`✅ Updated player prop ${prop.playerName} ${prop.propType} (${prop.line}) with over/under odds: ${prop.overOdds}/${prop.underOdds}`);
        }
      } else {
        // Create new prop
        const { error: insertError } = await supabaseAdmin
          .from('player_props_odds')
          .insert({
            event_id: eventId,
            player_id: playerId,
            prop_type_id: propTypeData.id,
            bookmaker_id: bookmakerInfo.id,
            line: prop.line,
            over_odds: prop.overOdds !== null ? String(prop.overOdds) : null,
            under_odds: prop.underOdds !== null ? String(prop.underOdds) : null
          });
        
        if (insertError) {
          if (insertError.message.includes('duplicate key')) {
            console.log(`ℹ️ Prop already exists: ${prop.playerName} ${prop.propType} (${prop.line}) - skipping`);
          } else {
            console.log(`⚠️ Error inserting prop: ${insertError.message}`);
          }
        } else {
          console.log(`✅ Stored player prop ${prop.playerName} ${prop.propType} (${prop.line}) with over/under odds: ${prop.overOdds}/${prop.underOdds}`);
        }
      }
    } catch (error) {
      console.log(`⚠️ Error processing player prop: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log(`✅ Finished processing player props for event ${eventId}`);
  console.log(`✅ Processed ${completeProps.length} complete player props for event ${eventId}`);
}

async function fetchPlayerPropsForAllGames(): Promise<void> {
  console.log('\n🎯 Fetching player props for upcoming games...');
  
  // Import centralized multi-sport configuration
  const { getActiveSportConfigs } = await import('./multiSportConfig');
  const activeSports = getActiveSportConfigs();
  
  if (activeSports.length === 0) {
    console.log('⚠️ No active sports configured for player props');
    return;
  }
  
  let totalPropsFound = 0;
  
  // Process each active sport
  for (const sportConfig of activeSports) {
    // Skip sports that don't have prop markets (like UFC)
    if (sportConfig.propMarkets.length === 0) {
      console.log(`⚠️ Skipping ${sportConfig.sportName} - no prop markets configured`);
      continue;
    }
    
    console.log(`\n📊 Fetching ${sportConfig.sportName} player props...`);
    
    // Calculate the date window for today (from now) through the end of tomorrow
    const now = new Date();
    const tomorrowEnd = new Date(now);
    tomorrowEnd.setDate(now.getDate() + 1);
    tomorrowEnd.setUTCHours(23, 59, 59, 999);

    // Get upcoming games for this sport from the database (only today + tomorrow)
    // Use the sport name (not the TheOdds key) to match database records
    const { data: games, error: gamesError } = await supabaseAdmin
      .from('sports_events')
      .select('id, external_event_id, sport, home_team, away_team, start_time')
      .eq('sport', sportConfig.sportName)
      .gte('start_time', now.toISOString())
      .lt('start_time', tomorrowEnd.toISOString())
      .limit(10); // Limit to avoid rate limits
    
    if (gamesError) {
      console.error(`❌ Error fetching ${sportConfig.sportName} games:`, gamesError.message);
      continue;
    }
    
    if (!games || games.length === 0) {
      console.log(`⚠️ No upcoming ${sportConfig.sportName} games found`);
      continue;
    }
    
    console.log(`📊 Found ${games.length} upcoming ${sportConfig.sportName} games, fetching props...`);
    
    let propsFound = 0;
    
    for (const game of games) {
      const propsData = await fetchPlayerPropsForGame(game.external_event_id, sportConfig.theoddsKey);
      
      if (propsData) {
        await storePlayerPropsData(propsData, game.id, sportConfig.sportKey);
        propsFound++;
      }
      
      // Small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Successfully fetched props for ${propsFound} out of ${games.length} ${sportConfig.sportName} games`);
    totalPropsFound += propsFound;
  }
  
  console.log(`\n✅ Total: Successfully fetched props for ${totalPropsFound} games across all active sports`);
}

async function checkCurrentGames(): Promise<void> {
  console.log('\n🎮 Checking current games in database...');
  
  try {
    const { data: gamesData, error: gamesError } = await supabaseAdmin
      .from('sports_events')
      .select('sport, home_team, away_team, start_time, status')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(5);
    
    if (gamesError) {
      console.error('❌ Error checking games:', gamesError.message);
      return;
    }
    
    console.log(`✅ Found ${gamesData?.length || 0} upcoming games`);
    if (gamesData && gamesData.length > 0) {
      gamesData.forEach(game => {
        const startTime = new Date(game.start_time).toLocaleString();
        console.log(`  - ${game.away_team} @ ${game.home_team} (${game.sport}) - ${startTime}`);
      });
    }
  } catch (error) {
    console.error('❌ Error checking games:', (error as Error).message);
  }
}

async function checkPlayerPropsData(): Promise<void> {
  console.log('\n🎯 Checking player props data in database...');
  
  try {
    const { data: propsData, error: propsError } = await supabaseAdmin
      .from('player_props_odds')
      .select(`
        id,
        line,
        over_odds,
        under_odds,
        sports_events!inner(home_team, away_team),
        players!inner(name),
        player_prop_types!inner(prop_name)
      `)
      .limit(5);
    
    if (propsError) {
      console.error('❌ Error checking props:', propsError.message);
      return;
    }
    
    console.log(`✅ Found ${propsData?.length || 0} player prop odds records`);
    if (propsData && propsData.length > 0) {
      propsData.forEach((prop: any) => {
        console.log(`  - ${prop.players.name} ${prop.player_prop_types.prop_name} ${prop.line} (${prop.over_odds}/${prop.under_odds})`);
      });
    }
  } catch (error) {
    console.error('❌ Error checking props data:', (error as Error).message);
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting ParleyApp Multi-Sport Odds Integration Setup...');
  
  // Log active sports configuration
  logSportStatus();
  
  // Safety check for production
  if (process.env.NODE_ENV === 'production' && process.env.DEVELOPMENT_MODE === 'true') {
    console.warn('⚠️  DEVELOPMENT_MODE is enabled in production - this may affect live data!');
  }
  
  // Check reference data first
  const referenceDataOk = await checkReferenceData();
  if (!referenceDataOk) {
    console.error('❌ Reference data check failed. Exiting.');
    process.exit(1);
  }
  
  console.log('\n✅ Reference data looks good! Proceeding with multi-sport odds fetch...\n');
  
  // Ensure player prop types exist
  await ensurePlayerPropTypes();
  
  // Check current games before fetch
  await checkCurrentGames();
  
  // Fetch new games and basic odds
  console.log('\n📊 Fetching games and basic odds from TheOdds API...');
  const gameCount = await fetchAllGameData();
  
  // Fetch player props for those games
  await fetchPlayerPropsForAllGames();
  
  // Check games and props after fetch
  console.log('\n🔄 Checking data after fetch...');
  await checkCurrentGames();
  await checkPlayerPropsData();
  
  console.log(`\n✅ Setup complete! Fetched data for ${gameCount} games with basic odds and player props.`);
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => console.log('\n🎉 All done!'))
    .catch((error: Error) => {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    });
}

export { checkReferenceData, checkCurrentGames, fetchPlayerPropsForAllGames }; 