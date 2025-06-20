import { supabaseAdmin } from '../services/supabase/client';
import dotenv from 'dotenv';

dotenv.config();

async function checkGameStatuses() {
  console.log('🔍 Checking MLB game statuses and dates...\n');

  try {
    const { data: mlbGames, error } = await supabaseAdmin
      .from('sports_events')
      .select('*')
      .eq('sport', 'MLB')
      .order('start_time', { ascending: true });

    if (error) {
      console.error('❌ Error fetching MLB games:', error);
      return;
    }

    if (!mlbGames || mlbGames.length === 0) {
      console.log('❌ No MLB games found in database');
      return;
    }

    console.log(`📊 Total MLB games: ${mlbGames.length}\n`);

    // Group by status
    const statusGroups = mlbGames.reduce((groups, game) => {
      const status = game.status || 'unknown';
      if (!groups[status]) groups[status] = [];
      groups[status].push(game);
      return groups;
    }, {} as Record<string, any[]>);

    console.log('📈 Games by Status:');
    Object.entries(statusGroups).forEach(([status, games]) => {
      console.log(`   ${status}: ${(games as any[]).length} games`);
    });
    console.log();

    // Group by date
    const today = new Date().toDateString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toDateString();
    
    const dateGroups = {
      today: mlbGames.filter(game => new Date(game.start_time).toDateString() === today),
      tomorrow: mlbGames.filter(game => new Date(game.start_time).toDateString() === tomorrow),
      future: mlbGames.filter(game => new Date(game.start_time) > new Date(tomorrow)),
      past: mlbGames.filter(game => new Date(game.start_time) < new Date(today))
    };

    console.log('📅 Games by Date:');
    console.log(`   Today (${today}): ${dateGroups.today.length} games`);
    console.log(`   Tomorrow: ${dateGroups.tomorrow.length} games`);
    console.log(`   Future: ${dateGroups.future.length} games`);
    console.log(`   Past: ${dateGroups.past.length} games`);
    console.log();

    // Show today's games in detail
    if (dateGroups.today.length > 0) {
      console.log('🏟️  Today\'s Games:');
      dateGroups.today.forEach((game, index) => {
        const gameTime = new Date(game.start_time).toLocaleTimeString();
        const status = game.status || 'unknown';
        const homeScore = game.stats?.home_score || '?';
        const awayScore = game.stats?.away_score || '?';
        
        console.log(`   ${index + 1}. ${game.away_team} @ ${game.home_team}`);
        console.log(`      Time: ${gameTime} | Status: ${status} | Score: ${awayScore}-${homeScore}`);
        console.log(`      External ID: ${game.external_event_id || 'none'}`);
        console.log(`      Source: ${game.source || 'unknown'}`);
        console.log();
      });
    }

    // Show upcoming games (next 3 days)
    const upcomingGames = mlbGames.filter(game => {
      const gameDate = new Date(game.start_time);
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      return gameDate > now && gameDate <= threeDaysFromNow && game.status === 'scheduled';
    });

    console.log(`🎯 Upcoming Games (Next 3 Days): ${upcomingGames.length}`);
    upcomingGames.slice(0, 5).forEach((game, index) => {
      const gameDate = new Date(game.start_time).toLocaleDateString();
      const gameTime = new Date(game.start_time).toLocaleTimeString();
      console.log(`   ${index + 1}. ${game.away_team} @ ${game.home_team} - ${gameDate} ${gameTime}`);
    });

    if (upcomingGames.length > 5) {
      console.log(`   ... and ${upcomingGames.length - 5} more`);
    }

    // Check for potential issues
    console.log('\n⚠️  Potential Issues:');
    
    const completedInFuture = mlbGames.filter(game => 
      game.status === 'completed' && new Date(game.start_time) > new Date()
    );
    if (completedInFuture.length > 0) {
      console.log(`   ❌ ${completedInFuture.length} games marked "completed" but scheduled in future`);
    }

    const scheduledInPast = mlbGames.filter(game => 
      game.status === 'scheduled' && new Date(game.start_time) < new Date(Date.now() - 3 * 60 * 60 * 1000)
    );
    if (scheduledInPast.length > 0) {
      console.log(`   ⚠️  ${scheduledInPast.length} games still "scheduled" but 3+ hours past start time`);
    }

    const liveInPast = mlbGames.filter(game => 
      game.status === 'live' && new Date(game.start_time) < new Date(Date.now() - 6 * 60 * 60 * 1000)
    );
    if (liveInPast.length > 0) {
      console.log(`   ⚠️  ${liveInPast.length} games still "live" but 6+ hours past start time`);
    }

    if (completedInFuture.length === 0 && scheduledInPast.length === 0 && liveInPast.length === 0) {
      console.log('   ✅ No obvious status mapping issues detected');
    }

  } catch (error) {
    console.error('💥 Error checking game statuses:', error);
  }
}

checkGameStatuses().then(() => {
  console.log('\n✅ Status check completed');
  process.exit(0);
}).catch(err => {
  console.error('💥 Script failed:', err);
  process.exit(1);
}); 