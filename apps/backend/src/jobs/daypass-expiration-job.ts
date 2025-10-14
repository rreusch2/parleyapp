import cron from 'node-cron';
import { supabaseAdmin } from '../lib/supabase';

/**
 * Day Pass Expiration Job
 * Runs every 10 minutes to check for expired day passes and downgrade users
 * This ensures users lose access exactly 24 hours after purchase
 */

export function startDayPassExpirationJob() {
  // Run every 10 minutes: '*/10 * * * *'
  cron.schedule('*/10 * * * *', async () => {
    try {
      console.log('🕐 Running day pass expiration check...');
      
      // Call the database function to expire day passes
      const { data, error } = await supabaseAdmin.rpc('expire_day_passes');
      
      if (error) {
        console.error('❌ Error expiring day passes:', error);
        return;
      }
      
      const expiredCount = data || 0;
      
      if (expiredCount > 0) {
        console.log(`⏰ Expired ${expiredCount} day pass(es)`);
        
        // Optional: Send notification or log to analytics
        // await sendDayPassExpirationNotification(expiredCount);
      } else {
        console.log('✅ No day passes to expire');
      }
      
    } catch (error) {
      console.error('❌ Day pass expiration job failed:', error);
    }
  });
  
  console.log('🔄 Day pass expiration job started (runs every 10 minutes)');
}

// Optional: Function to get day pass expiration stats
export async function getDayPassStats() {
  try {
    const { data: activeStats } = await supabaseAdmin
      .from('profiles')
      .select('day_pass_tier, day_pass_expires_at')
      .not('day_pass_expires_at', 'is', null)
      .gt('day_pass_expires_at', new Date().toISOString());
    
    const { data: expiredToday } = await supabaseAdmin
      .from('revenuecat_webhook_events')
      .select('event_data')
      .eq('event_type', 'DAY_PASS_EXPIRED')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    return {
      activeDayPasses: activeStats?.length || 0,
      expiredToday: expiredToday?.reduce((total, event) => {
        const data = event.event_data as { expired_count: number };
        return total + (data.expired_count || 0);
      }, 0) || 0
    };
  } catch (error) {
    console.error('Error getting day pass stats:', error);
    return { activeDayPasses: 0, expiredToday: 0 };
  }
}
