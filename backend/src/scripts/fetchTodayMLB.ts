import dotenv from 'dotenv';
import { supabaseAdmin } from '../services/supabase/client';

dotenv.config();

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
  // More precise duplicate checking - same teams and similar time (within 4 hours)
  const gameTime = new Date(gameData.start_time);
  const startRange = new Date(gameTime.getTime() - 4 * 60 * 60 * 1000); // 4 hours before
  const endRange = new Date(gameTime.getTime() + 4 * 60 * 60 * 1000);   // 4 hours after

  const { data: existingGame, error: checkError } = await supabaseAdmin
    .from('sports_events')
    .select('id, external_event_id, home_team, away_team, start_time')
    .eq('home_team', gameData.home_team)
    .eq('away_team', gameData.away_team)
    .eq('sport', 'MLB')
    .gte('start_time', startRange.toISOString())
    .lte('start_time', endRange.toISOString())
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error(`Error checking for existing game ${gameData.away_team} @ ${gameData.home_team}:`, checkError);
    return;
  }

  if (existingGame) {
    console.log(`⚠️  Duplicate found: ${gameData.away_team} @ ${gameData.home_team} - updating`);
    
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
      console.log(`✅ Updated: ${gameData.away_team} @ ${gameData.home_team}`);
    }
    return;
  }

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
    console.log(`✅ Stored: ${gameData.away_team} @ ${gameData.home_team} (${gameData.status}) - ${new Date(gameData.start_time).toLocaleString()}`);
  }
}

async function fetchTodayMLBGames() {
  console.log('🔄 Fetching today\'s MLB games with proper timezone handling...\n');

  try {
    // Get today's date in various formats for ESPN API
    const today = new Date();
    const todayESPN = today.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    const todayStr = today.toDateString();
    
    console.log(`📅 Fetching games for ${todayStr} (ESPN format: ${todayESPN})`);
    
    // Fetch from ESPN's scoreboard with today's specific date
    const espnUrl = `http://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${todayESPN}`;
    console.log(`🔗 Fetching from: ${espnUrl}\n`);
    
    const response = await fetch(espnUrl);
    const espnData: any = await response.json();

    if (!espnData || !espnData.events) {
      console.log('❌ No events found in ESPN response');
      return;
    }

    console.log(`📊 ESPN returned ${espnData.events.length} total games`);
    
    // Process each game with detailed logging
    let todayCount = 0;
    let otherDaysCount = 0;
    
    for (const event of espnData.events) {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find((team: any) => team.homeAway === 'home');
      const awayTeam = competition.competitors.find((team: any) => team.homeAway === 'away');
      
      // Parse the game date and check if it's actually today
      const gameDate = new Date(event.date);
      const gameDateStr = gameDate.toDateString();
      const isToday = gameDateStr === todayStr;
      
      const status = mapESPNStatus(competition.status.type.name);
      
      console.log(`\n🏟️  ${awayTeam.team.displayName} @ ${homeTeam.team.displayName}`);
      console.log(`   ESPN Date: ${event.date}`);
      console.log(`   Parsed Date: ${gameDate.toLocaleString()}`);
      console.log(`   Game Date String: ${gameDateStr}`);
      console.log(`   Today String: ${todayStr}`);
      console.log(`   Is Today: ${isToday ? '✅' : '❌'}`);
      console.log(`   Status: ${status} (ESPN: ${competition.status.type.name})`);
      
      if (isToday) {
        todayCount++;
        
        await storeGameData({
          external_event_id: event.id.toString(),
          sport: 'MLB',
          league: 'MLB',
          home_team: homeTeam.team.displayName,
          away_team: awayTeam.team.displayName,
          start_time: gameDate.toISOString(),
          status: status,
          source: 'ESPN',
          stats: {
            venue: competition.venue?.fullName || 'Unknown',
            city: competition.venue?.address?.city || 'Unknown',
            home_score: homeTeam.score ? parseInt(homeTeam.score) : null,
            away_score: awayTeam.score ? parseInt(awayTeam.score) : null,
            spectators: competition.attendance || null,
            event_thumb: null,
            home_logo: homeTeam.team.logo,
            away_logo: awayTeam.team.logo,
            league_logo: null,
            status_detail: competition.status.type.detail || competition.status.type.name,
          },
          odds: {}
        });
      } else {
        otherDaysCount++;
        console.log(`   ⏭️  Skipping (not today)`);
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Games for today (${todayStr}): ${todayCount}`);
    console.log(`   Games for other days: ${otherDaysCount}`);
    console.log(`   Total games processed: ${todayCount}`);
    
    // Check what we have in the database now
    const { data: dbGames, error } = await supabaseAdmin
      .from('sports_events')
      .select('id, home_team, away_team, start_time, status')
      .eq('sport', 'MLB')
      .order('start_time', { ascending: true });

    if (dbGames) {
      console.log(`\n📊 Current database status:`);
      console.log(`   Total MLB games stored: ${dbGames.length}`);
      
      const statusCounts = dbGames.reduce((counts, game) => {
        counts[game.status] = (counts[game.status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} games`);
      });
      
      console.log(`\n🎯 Games stored:`);
      dbGames.forEach((game, index) => {
        const gameTime = new Date(game.start_time).toLocaleString();
        console.log(`   ${index + 1}. ${game.away_team} @ ${game.home_team} - ${gameTime} (${game.status})`);
      });
    }

  } catch (error) {
    console.error('💥 Error in fetchTodayMLBGames:', error);
  }
}

fetchTodayMLBGames().then(() => {
  console.log('\n✅ Finished fetching today\'s MLB games');
  process.exit(0);
}).catch(err => {
  console.error('💥 Script failed:', err);
  process.exit(1);
}); 