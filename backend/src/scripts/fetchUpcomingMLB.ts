import dotenv from 'dotenv';
import { supabaseAdmin } from '../services/supabase/client';

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
    .eq('sport', 'MLB')
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString())
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error(`Error checking for existing game ${gameData.away_team} @ ${gameData.home_team}:`, checkError);
    return;
  }

  if (existingGame) {
    console.log(`⚠️  Duplicate found: ${gameData.away_team} @ ${gameData.home_team} (${gameData.start_time}) - updating instead`);
    
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

async function fetchUpcomingMLBGames() {
  console.log('🔄 Fetching upcoming MLB games for next 7 days...\n');

  try {
    const today = new Date();
    let totalGamesFetched = 0;
    let newGamesStored = 0;

    // Fetch games for the next 7 days
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      
      const formattedDate = formatDateForESPN(targetDate);
      const displayDate = targetDate.toDateString();
      
      console.log(`📅 Fetching games for ${displayDate} (${formattedDate})...`);
      
      try {
        const espnUrl = i === 0 
          ? 'http://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard'
          : `http://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${formattedDate}`;
        
        const response = await fetch(espnUrl);
        const espnData: any = await response.json();

        if (espnData && espnData.events && espnData.events.length > 0) {
          console.log(`   Found ${espnData.events.length} games`);
          totalGamesFetched += espnData.events.length;

          for (const event of espnData.events) {
            const competition = event.competitions[0];
            const homeTeam = competition.competitors.find((team: any) => team.homeAway === 'home');
            const awayTeam = competition.competitors.find((team: any) => team.homeAway === 'away');
            
            const status = mapESPNStatus(competition.status.type.name);
            
            console.log(`   Processing: ${awayTeam.team.displayName} @ ${homeTeam.team.displayName} (${status})`);

            await storeGameData({
              external_event_id: event.id.toString(),
              sport: 'MLB',
              league: 'MLB',
              home_team: homeTeam.team.displayName,
              away_team: awayTeam.team.displayName,
              start_time: new Date(event.date).toISOString(),
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
            
            newGamesStored++;
          }
        } else {
          console.log(`   No games found for ${displayDate}`);
        }
        
        // Small delay to be respectful to ESPN API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error fetching games for ${displayDate}:`, error);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total games fetched: ${totalGamesFetched}`);
    console.log(`   Games processed: ${newGamesStored}`);
    
    // Show current stats
    const { data: allGames, error } = await supabaseAdmin
      .from('sports_events')
      .select('status')
      .eq('sport', 'MLB');

    if (allGames) {
      const statusCounts = allGames.reduce((counts, game) => {
        counts[game.status] = (counts[game.status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
      
      console.log(`\n📈 Current MLB games in database:`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} games`);
      });
    }

  } catch (error) {
    console.error('💥 Error in fetchUpcomingMLBGames:', error);
  }
}

fetchUpcomingMLBGames().then(() => {
  console.log('\n✅ Finished fetching upcoming MLB games');
  process.exit(0);
}).catch(err => {
  console.error('💥 Script failed:', err);
  process.exit(1);
}); 