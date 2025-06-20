import dotenv from 'dotenv';
import { supabaseAdmin } from '../services/supabase/client';

dotenv.config();

async function clearMLBGames() {
  console.log('🗑️  Clearing all MLB games from sports_events table...\n');

  try {
    // Get current count
    const { data: beforeCount, error: countError } = await supabaseAdmin
      .from('sports_events')
      .select('id', { count: 'exact' })
      .eq('sport', 'MLB');

    if (countError) {
      console.error('❌ Error getting count:', countError);
      return;
    }

    console.log(`📊 Current MLB games: ${beforeCount?.length || 0}`);

    // Delete all MLB games
    const { error: deleteError } = await supabaseAdmin
      .from('sports_events')
      .delete()
      .eq('sport', 'MLB');

    if (deleteError) {
      console.error('❌ Error deleting MLB games:', deleteError);
      return;
    }

    console.log('✅ Successfully cleared all MLB games from database');

    // Verify deletion
    const { data: afterCount, error: verifyError } = await supabaseAdmin
      .from('sports_events')
      .select('id', { count: 'exact' })
      .eq('sport', 'MLB');

    if (verifyError) {
      console.error('❌ Error verifying deletion:', verifyError);
      return;
    }

    console.log(`📊 Remaining MLB games: ${afterCount?.length || 0}`);

  } catch (error) {
    console.error('💥 Error clearing MLB games:', error);
  }
}

clearMLBGames().then(() => {
  console.log('\n✅ Clear operation completed');
  process.exit(0);
}).catch(err => {
  console.error('💥 Script failed:', err);
  process.exit(1);
}); 