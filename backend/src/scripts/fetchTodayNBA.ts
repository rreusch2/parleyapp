import dotenv from 'dotenv';
import { supabaseAdmin } from '../services/supabase/client';

dotenv.config();

interface ESPNEvent {
  id: string;
  name: string;
  shortName: string;
  date: string;
  competitions: Array<{
    id: string;
    date: string;
    competitors: Array<{
      id: string;
      team: {
        id: string;
        displayName: string;
        abbreviation: string;
        location: string;
        name: string;
        logo?: string;
      };
      homeAway: 'home' | 'away';
    }>;
    status: {
      type: {
        id: string;
        name: string;
        description: string;
        detail: string;
      };
    };
    venue?: {
      fullName: string;
    };
  }>;
  season?: {
    year: number;
    type: number;
  };
}

interface ESPNResponse {
  events: ESPNEvent[];
}

async function storeGameData(event: ESPNEvent): Promise<boolean> {
  try {
    const competition = event.competitions[0];
    if (!competition || competition.competitors.length !== 2) {
      console.log('⚠️ Invalid competition structure');
      return false;
    }

    const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
    const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

    if (!homeTeam || !awayTeam) {
      console.log('⚠️ Could not identify home/away teams');
      return false;
    }

    // Parse date and convert to local time
    const gameDate = new Date(competition.date);
    const gameDateStr = gameDate.toLocaleString();
    const gameDateOnly = gameDate.toDateString();

    // Map ESPN status to our status
    let status = 'scheduled';
    const espnStatus = competition.status.type.name;
    if (espnStatus === 'STATUS_FINAL') {
      status = 'completed';
    } else if (espnStatus === 'STATUS_IN_PROGRESS') {
      status = 'live';
    }

    console.log(`🏀 ${awayTeam.team.displayName} @ ${homeTeam.team.displayName}`);
    console.log(`   ESPN Date: ${competition.date}`);
    console.log(`   Parsed Date: ${gameDateStr}`);
    console.log(`   Game Date String: ${gameDateOnly}`);
    console.log(`   Today String: ${new Date().toDateString()}`);
    console.log(`   Is Today: ${gameDateOnly === new Date().toDateString() ? '✅' : '❌'}`);
    console.log(`   Status: ${status} (ESPN: ${espnStatus})`);

    // Check for duplicates using enhanced detection
    const { data: existingGames, error: queryError } = await supabaseAdmin
      .from('sports_events')
      .select('*')
      .eq('sport', 'NBA')
      .eq('home_team', homeTeam.team.displayName)
      .eq('away_team', awayTeam.team.displayName)
      .gte('start_time', new Date(gameDate.getTime() - 6 * 60 * 60 * 1000).toISOString()) // 6 hours before
      .lte('start_time', new Date(gameDate.getTime() + 6 * 60 * 60 * 1000).toISOString()); // 6 hours after

    if (queryError) {
      console.error('❌ Error checking for duplicates:', queryError.message);
      return false;
    }

    if (existingGames && existingGames.length > 0) {
      console.log(`⚠️ Duplicate game found: ${awayTeam.team.displayName} @ ${homeTeam.team.displayName} on ${gameDateStr}`);
      return false;
    }

    // Store the game
    const gameData = {
      external_event_id: event.id,
      sport: 'NBA',
      league: 'NBA',
      home_team: homeTeam.team.displayName,
      away_team: awayTeam.team.displayName,
      start_time: gameDate.toISOString(),
      status: status,
      source: 'ESPN',
      stats: {
        venue: competition.venue?.fullName || 'Unknown',
        home_logo: homeTeam.team.logo || null,
        away_logo: awayTeam.team.logo || null,
        status_detail: competition.status.type.detail || competition.status.type.name,
      },
      odds: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: insertError } = await supabaseAdmin
      .from('sports_events')
      .insert([gameData]);

    if (insertError) {
      console.error('❌ Error storing game:', insertError.message);
      return false;
    }

    console.log(`✅ Stored: ${awayTeam.team.displayName} @ ${homeTeam.team.displayName} (${status}) - ${gameDateStr}`);
    return true;

  } catch (error) {
    console.error('❌ Error in storeGameData:', error);
    return false;
  }
}

async function fetchTodayNBAGames() {
  try {
    console.log('🔄 Fetching today\'s NBA games with proper timezone handling...\n');

    // Get today's date in various formats
    const today = new Date();
    const todayStr = today.toDateString();
    const todayESPN = today.getFullYear().toString() + 
                     (today.getMonth() + 1).toString().padStart(2, '0') + 
                     today.getDate().toString().padStart(2, '0');

    console.log(`📅 Fetching games for ${todayStr} (ESPN format: ${todayESPN})`);
    
    // Fetch from ESPN's NBA scoreboard with today's specific date
    const espnUrl = `http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${todayESPN}`;
    console.log(`🔗 Fetching from: ${espnUrl}\n`);
    
    const response = await fetch(espnUrl);
    if (!response.ok) {
      throw new Error(`ESPN API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as ESPNResponse;
    console.log(`📊 ESPN returned ${data.events?.length || 0} total games\n`);

    if (!data.events || data.events.length === 0) {
      console.log('📭 No games found for today');
      return;
    }

    let todayGamesCount = 0;
    let otherDaysCount = 0;
    let gamesStored = 0;
    const storedGames: string[] = [];

    // Process each game
    for (const event of data.events) {
      const gameDate = new Date(event.competitions[0].date);
      const gameDateStr = gameDate.toDateString();
      
      if (gameDateStr === todayStr) {
        todayGamesCount++;
        const stored = await storeGameData(event);
        if (stored) {
          gamesStored++;
          const competition = event.competitions[0];
          const homeTeam = competition.competitors.find(c => c.homeAway === 'home')?.team.displayName;
          const awayTeam = competition.competitors.find(c => c.homeAway === 'away')?.team.displayName;
          const gameTime = gameDate.toLocaleString();
          
          // Map status
          let status = 'scheduled';
          const espnStatus = competition.status.type.name;
          if (espnStatus === 'STATUS_FINAL') {
            status = 'completed';
          } else if (espnStatus === 'STATUS_IN_PROGRESS') {
            status = 'live';
          }
          
          storedGames.push(`${awayTeam} @ ${homeTeam} - ${gameTime} (${status})`);
        }
      } else {
        otherDaysCount++;
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Games for today (${todayStr}): ${todayGamesCount}`);
    console.log(`   Games for other days: ${otherDaysCount}`);
    console.log(`   Total games processed: ${data.events.length}`);

    // Get current database status
    const { data: dbStats, error: statsError } = await supabaseAdmin
      .from('sports_events')
      .select('status')
      .eq('sport', 'NBA');

    if (!statsError && dbStats) {
      const statusCounts = dbStats.reduce((acc, game) => {
        acc[game.status] = (acc[game.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`\n📊 Current database status:`);
      console.log(`   Total NBA games stored: ${dbStats.length}`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} games`);
      });
    }

    if (storedGames.length > 0) {
      console.log(`\n🎯 Games stored:`);
      storedGames.forEach((game, index) => {
        console.log(`   ${index + 1}. ${game}`);
      });
    }

    console.log('\n✅ Finished fetching today\'s NBA games');

  } catch (error) {
    console.error('❌ Error fetching NBA games:', error);
    process.exit(1);
  }
}

// Run the script
fetchTodayNBAGames(); 