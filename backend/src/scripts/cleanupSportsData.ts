import { supabase } from '../services/supabase/client';

const VALID_LEAGUES = ['NBA', 'NFL', 'MLB', 'NHL'];

async function cleanupSportsData() {
  try {
    console.log('Starting sports data cleanup...');

    // Update old sport names to league names
    const sportMappings = {
      'Basketball': 'NBA',
      'American Football': 'NFL',
      'Baseball': 'MLB',
      'Ice Hockey': 'NHL'
    };

    for (const [oldSport, newLeague] of Object.entries(sportMappings)) {
      const { data, error } = await supabase
        .from('sports_events')
        .update({ 
          sport: newLeague,
          league: newLeague 
        })
        .eq('sport', oldSport);

      if (error) {
        console.error(`Error updating ${oldSport} to ${newLeague}:`, error);
      } else {
        console.log(`Updated games from ${oldSport} to ${newLeague}`);
      }
    }

    // Delete any games that don't belong to our supported leagues
    const { error: deleteError } = await supabase
      .from('sports_events')
      .delete()
      .not('league', 'in', `(${VALID_LEAGUES.map(l => `'${l}'`).join(',')})`);

    if (deleteError) {
      console.error('Error deleting unsupported leagues:', deleteError);
    } else {
      console.log('Deleted games from unsupported leagues');
    }

    console.log('Sports data cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    process.exit();
  }
}

cleanupSportsData(); 