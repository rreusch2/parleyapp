import { supabaseAdmin } from '../services/supabase/client';

async function fixJadenDaniels() {
  try {
    console.log('🔍 Checking J.Daniels status...');
    
    // Check current state
    const { data: currentPlayer, error: selectError } = await supabaseAdmin
      .from('players')
      .select('id, name, external_player_id, team, position')
      .eq('external_player_id', '23235')
      .eq('sport', 'NFL')
      .single();

    if (selectError) {
      console.error('❌ Error finding J.Daniels:', selectError);
      return;
    }

    if (currentPlayer) {
      console.log('🔍 Current player data:', currentPlayer);
      
      if (currentPlayer.name === 'J.Daniels') {
        console.log('🔄 Updating J.Daniels to Jayden Daniels...');
        
        const { error: updateError } = await supabaseAdmin
          .from('players')
          .update({ 
            name: 'Jayden Daniels',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentPlayer.id);

        if (updateError) {
          console.error('❌ Error updating J.Daniels:', updateError);
        } else {
          console.log('✅ Successfully updated J.Daniels to Jayden Daniels!');
        }
      } else {
        console.log('✅ Player name is already correct:', currentPlayer.name);
      }
    }

  } catch (error) {
    console.error('💥 Error in fixJadenDaniels:', error);
  }
}

fixJadenDaniels();
