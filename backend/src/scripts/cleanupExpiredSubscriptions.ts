#!/usr/bin/env ts-node

import { SubscriptionTierService } from '../services/subscriptionTierService';
import { supabaseAdmin } from '../config/supabase';

/**
 * Daily cleanup script for expired day passes and welcome bonuses
 * Run this as a cron job: 0 0 * * * (every day at midnight)
 */
async function cleanupExpiredSubscriptions() {
  console.log('🧹 Starting subscription cleanup process...');
  
  try {
    // Clean up expired day passes and welcome bonuses
    const results = await SubscriptionTierService.cleanupExpiredBonuses();
    
    console.log(`✅ Cleanup completed successfully:`);
    console.log(`   - ${results.expiredDayPasses} expired day passes cleaned up`);
    console.log(`   - ${results.expiredWelcomeBonuses} expired welcome bonuses cleaned up`);
    
    // Log cleanup summary to database for monitoring
    await supabaseAdmin
      .from('system_logs')
      .insert({
        event_type: 'subscription_cleanup',
        message: `Cleaned up ${results.expiredDayPasses} day passes and ${results.expiredWelcomeBonuses} welcome bonuses`,
        metadata: {
          expiredDayPasses: results.expiredDayPasses,
          expiredWelcomeBonuses: results.expiredWelcomeBonuses,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();
    
  } catch (error) {
    console.error('❌ Error during subscription cleanup:', error);
    
    // Log error to database
    await supabaseAdmin
      .from('system_logs')
      .insert({
        event_type: 'subscription_cleanup_error',
        message: `Subscription cleanup failed: ${error.message}`,
        metadata: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      });
    
    process.exit(1);
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupExpiredSubscriptions()
    .then(() => {
      console.log('🎉 Subscription cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Subscription cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupExpiredSubscriptions };
