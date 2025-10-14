import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanupBrokenPlayerPropsOdds() {
  console.log('🧹 Starting comprehensive cleanup of ALL broken player props odds data...');
  
  try {
    // Find ALL broken records (not just those before a certain date)
    const { data: brokenData, error: countError } = await supabaseAdmin
      .from('player_props_odds')
      .select('id, created_at, over_odds, under_odds')
      .or('and(over_odds.not.is.null,under_odds.is.null),and(over_odds.is.null,under_odds.not.is.null)');

    if (countError) {
      console.error('❌ Error counting broken records:', countError);
      return;
    }

    console.log(`📊 Found ${brokenData.length} broken records to clean up`);
    
    if (brokenData.length === 0) {
      console.log('✅ No broken records found. All good!');
      return;
    }

    // Show breakdown
    const overOnlyCount = brokenData.filter(r => r.over_odds && !r.under_odds).length;
    const underOnlyCount = brokenData.filter(r => !r.over_odds && r.under_odds).length;
    console.log(`   - ${overOnlyCount} records with only over odds`);
    console.log(`   - ${underOnlyCount} records with only under odds`);

    // Delete the broken records in batches
    const batchSize = 100;
    let deletedCount = 0;
    
    for (let i = 0; i < brokenData.length; i += batchSize) {
      const batch = brokenData.slice(i, i + batchSize);
      const ids = batch.map(record => record.id);
      
      const { error: deleteError } = await supabaseAdmin
        .from('player_props_odds')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error(`❌ Error deleting batch ${i / batchSize + 1}:`, deleteError);
        continue;
      }

      deletedCount += batch.length;
      console.log(`🗑️  Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records (${deletedCount}/${brokenData.length} total)`);
    }

    console.log(`🎉 Cleanup complete! Deleted ${deletedCount} broken records.`);
    
    // Show the final state
    const { data: finalCount, error: finalError } = await supabaseAdmin
      .from('player_props_odds')
      .select('id', { count: 'exact' });

    const { data: completeCount, error: completeError } = await supabaseAdmin
      .from('player_props_odds')
      .select('id', { count: 'exact' })
      .not('over_odds', 'is', null)
      .not('under_odds', 'is', null);

    if (!finalError && !completeError) {
      console.log(`✅ Database now has ${completeCount.length} complete records with both over and under odds!`);
      console.log(`📊 Total records: ${finalCount.length}`);
      console.log(`📊 Completion rate: ${((completeCount.length / finalCount.length) * 100).toFixed(1)}%`);
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run the cleanup
cleanupBrokenPlayerPropsOdds(); 