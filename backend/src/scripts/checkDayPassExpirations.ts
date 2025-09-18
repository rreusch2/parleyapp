import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for admin operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ExpiredDayPassUser {
  id: string;
  email: string;
  subscription_tier: string;
  subscription_plan_type: string;
  subscription_expires_at: string;
  subscription_started_at: string;
}

/**
 * Check for expired Pro Day Pass subscriptions and revert users to Free tier
 * This should be run every hour via cron job or similar scheduler
 */
export async function checkAndProcessDayPassExpirations(): Promise<void> {
  try {
    console.log('🔍 Checking for expired Pro Day Pass subscriptions...');
    const now = new Date().toISOString();

    // Find users with expired day pass subscriptions (Pro or Elite)
    const { data: expiredUsers, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, subscription_tier, subscription_plan_type, subscription_expires_at, subscription_started_at, base_subscription_tier')
      .eq('subscription_plan_type', 'daypass')
      .in('subscription_tier', ['pro', 'elite'])
      .not('subscription_expires_at', 'is', null)
      .lt('subscription_expires_at', now);

    if (fetchError) {
      console.error('❌ Error fetching expired day pass users:', fetchError);
      throw fetchError;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('✅ No expired Pro Day Pass subscriptions found');
      return;
    }

    console.log(`📋 Found ${expiredUsers.length} expired Pro Day Pass subscription(s)`);

    // Process each expired user
    for (const user of expiredUsers as ExpiredDayPassUser[]) {
      try {
        console.log(`⏰ Processing expired day pass for user: ${user.email} (expires: ${user.subscription_expires_at})`);
        
        // Revert user to their base subscription tier (default to free)
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_tier: (user as any).base_subscription_tier || 'free',
            subscription_status: 'inactive',
            subscription_plan_type: null,
            subscription_product_id: null,
            subscription_expires_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`❌ Failed to revert user ${user.email} to free tier:`, updateError);
          continue;
        }

        console.log(`✅ Successfully reverted ${user.email} from Day Pass to base tier`);
        
        // Log the action for audit purposes
        await logDayPassExpiration(user);
        
      } catch (userError) {
        console.error(`❌ Error processing user ${user.email}:`, userError);
        continue;
      }
    }

    console.log(`🎉 Completed processing ${expiredUsers.length} expired Pro Day Pass subscriptions`);

  } catch (error) {
    console.error('❌ Critical error in checkAndProcessDayPassExpirations:', error);
    throw error;
  }
}

/**
 * Log day pass expiration for audit purposes
 */
async function logDayPassExpiration(user: ExpiredDayPassUser): Promise<void> {
  try {
    // Create an audit log entry (you can expand this to store in a dedicated audit table if needed)
    console.log(`📝 AUDIT LOG: User ${user.email} (${user.id}) Pro Day Pass expired at ${user.subscription_expires_at}, reverted to Free tier`);
    
    // Optionally store in a dedicated audit table or send notification
    // await supabaseAdmin.from('subscription_audit_log').insert({
    //   user_id: user.id,
    //   action: 'daypass_expired',
    //   previous_tier: 'pro',
    //   new_tier: 'free',
    //   expiration_date: user.subscription_expires_at,
    //   processed_at: new Date().toISOString()
    // });
    
  } catch (error) {
    console.error('⚠️ Failed to log day pass expiration:', error);
    // Don't throw here - logging failure shouldn't stop the main process
  }
}

/**
 * Standalone function to run the expiration check
 * Can be called directly or via scheduler
 */
export async function runDayPassExpirationCheck(): Promise<void> {
  const startTime = Date.now();
  console.log('🚀 Starting Pro Day Pass expiration check...');
  
  try {
    await checkAndProcessDayPassExpirations();
    const duration = Date.now() - startTime;
    console.log(`✅ Pro Day Pass expiration check completed successfully in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Pro Day Pass expiration check failed after ${duration}ms:`, error);
    process.exit(1);
  }
}

// Allow running this script directly
if (require.main === module) {
  runDayPassExpirationCheck();
}
