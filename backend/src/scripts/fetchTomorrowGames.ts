import dotenv from 'dotenv';
import { supabaseAdmin } from '../services/supabase/client';
import fetch from 'node-fetch';

dotenv.config();

// Helper function to format date for ESPN API
function formatDateForESPN(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Helper to map ESPN status
function mapESPNStatus(espnStatus: string): string {
  const status = espnStatus.toLowerCase();
  if (status.includes('final') || status.includes('completed')) {
    return 'completed';
  } else if (status.includes('in progress') || status.includes('live') || status.includes('active')) {
    return 'live';
  } else if (status.includes('postponed') || status.includes('suspended')) {
    return 'postponed';
  } else if (status.includes('cancelled') || status.includes('canceled')) {
    return 'cancelled';
  } else if (status.includes('scheduled') || status.includes('pre') || status.includes('upcoming')) {
    return 'scheduled';
  }
  return 'scheduled';
}

// Store game data with duplicate checking
async function storeGameData(gameData: any) {
  // Check for duplicates by team matchup and date
  const gameDate = new Date(gameData.start_time);
  const startOfDay = new Date(gameDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(gameDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const { data: existingGame, error: checkError } = await supabaseAdmin
    .from('sports_events')
    .select('id, external_event_id, home_team, away_team')
    .eq('home_team', gameData.home_team)
    .eq('away_team', gameData.away_team)
    .eq('sport', gameData.sport)
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString())
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error(`Error checking for existing game ${gameData.away_team} @ ${gameData.home_team}:`, checkError);
    return;
  }

  if (existingGame) {
    console.log(`⚠️  Duplicate found: ${gameData.away_team} @ ${gameData.home_team} - updating instead`);
    
    const { error: updateError } = await supabaseAdmin
      .from('sports_events')
      .update({
        ...gameData,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingGame.id);

    if (updateError) {
      console.error('Error updating game:', updateError);
    } else {
      console.log(`✅ Updated game: ${gameData.away_team} @ ${gameData.home_team}`);
    }
    return;
  }

  // Store game data matching existing schema
  const fullGameData = {
    ...gameData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error: insertError } = await supabaseAdmin
    .from('sports_events')
    .insert([fullGameData]);

  if (insertError) {
    console.error('Error storing game:', insertError);
  } else {
    console.log(`✅ Stored new game: ${gameData.away_team} @ ${gameData.home_team} (${gameData.status})`);
  }
}

// Fetch tomorrow's games for a specific sport
async function fetchTomorrowGamesForSport(sport: string, espnSport: string): Promise<number> {
  console.log(`\n📅 Fetching ${sport} games for tomorrow...`);
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formattedDate = formatDateForESPN(tomorrow);
  const displayDate = tomorrow.toDateString();
  
  console.log(`🔗 Fetching ${sport} games for ${displayDate} (${formattedDate})`);
  
  try {
    const espnUrl = `http://site.api.espn.com/apis/site/v2/sports/${espnSport}/scoreboard?dates=${formattedDate}`;
    console.log(`   URL: ${espnUrl}`);
    
    const response = await fetch(espnUrl);
    const espnData: any = await response.json();

    if (espnData && espnData.events && espnData.events.length > 0) {
      console.log(`   Found ${espnData.events.length} ${sport} games for tomorrow`);

      for (const event of espnData.events) {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find((team: any) => team.homeAway === 'home');
        const awayTeam = competition.competitors.find((team: any) => team.homeAway === 'away');
        
        const status = mapESPNStatus(competition.status.type.name);
        
        console.log(`   Processing: ${awayTeam.team.displayName} @ ${homeTeam.team.displayName} (${status})`);

        await storeGameData({
          external_event_id: event.id.toString(),
          sport: sport,
          league: sport,
          home_team: homeTeam.team.displayName,
          away_team: awayTeam.team.displayName,
          start_time: new Date(event.date).toISOString(),
          status: status,
          source: 'ESPN_tomorrow_fetch',
          stats: {
            venue: competition.venue?.fullName || 'TBD',
            city: competition.venue?.address?.city || 'TBD',
            home_score: homeTeam.score ? parseInt(homeTeam.score) : null,
            away_score: awayTeam.score ? parseInt(awayTeam.score) : null,
            home_logo: homeTeam.team.logo,
            away_logo: awayTeam.team.logo,
            status_detail: competition.status.type.detail || competition.status.type.name,
          },
          odds: {}
        });
      }
      
      return espnData.events.length;
    } else {
      console.log(`   No ${sport} games found for tomorrow`);
      return 0;
    }
    
  } catch (error) {
    console.error(`❌ Error fetching ${sport} games for tomorrow:`, error);
    return 0;
  }
}

// Main function to fetch tomorrow's games
export async function fetchTomorrowGames(): Promise<void> {
  console.log('🚀 Fetching tomorrow\'s games for DeepSeek orchestration...\n');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toDateString();

  console.log(`📅 Target date: ${tomorrowStr}\n`);

  // Sports to fetch - using your existing working ESPN endpoints
  const sportsConfig = [
    { sport: 'MLB', espnSport: 'baseball/mlb' },
    { sport: 'NBA', espnSport: 'basketball/nba' },
    { sport: 'NHL', espnSport: 'hockey/nhl' },
    { sport: 'NFL', espnSport: 'football/nfl' },
  ];

  let totalGamesStored = 0;
  const results: Record<string, number> = {};

  // Fetch games for each sport
  for (const config of sportsConfig) {
    const gamesStored = await fetchTomorrowGamesForSport(config.sport, config.espnSport);
    results[config.sport] = gamesStored;
    totalGamesStored += gamesStored;

    // Small delay to be respectful to ESPN API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n📊 Tomorrow\'s Games Summary:');
  console.log(`   Date: ${tomorrowStr}`);
  Object.entries(results).forEach(([sport, count]) => {
    console.log(`   ${sport}: ${count} games`);
  });
  console.log(`   Total: ${totalGamesStored} games`);

  // Check database status for tomorrow
  const tomorrowStart = new Date(tomorrow);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const { data: dbGames, error: dbError } = await supabaseAdmin
    .from('sports_events')
    .select('sport, status')
    .gte('start_time', tomorrowStart.toISOString())
    .lte('start_time', tomorrowEnd.toISOString());

  if (dbError) {
    console.error('❌ Error checking database:', dbError);
  } else {
    console.log('\n🗄️ Database status for tomorrow:');
    const sportCounts = dbGames?.reduce((counts, game) => {
      counts[game.sport] = (counts[game.sport] || 0) + 1;
      return counts;
    }, {} as Record<string, number>) || {};

    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(`   ${sport}: ${count} games in database`);
    });

    const scheduledGames = dbGames?.filter(game => game.status === 'scheduled').length || 0;
    console.log(`   Scheduled games ready for DeepSeek: ${scheduledGames}`);
  }

  console.log('\n✅ Tomorrow\'s games fetch complete - ready for DeepSeek orchestration!');
}

// Run the script if called directly
if (require.main === module) {
  fetchTomorrowGames()
    .then(() => {
      console.log('\n🎯 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
} 