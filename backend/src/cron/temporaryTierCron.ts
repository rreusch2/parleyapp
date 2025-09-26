import cron from 'node-cron';
import { supabaseAdmin } from '../services/supabase/client';
import { logger } from '../utils/logger';

/**
 * Downgrades expired temporary tiers (e.g., day pass or promo overlays)
 * Runs every 5 minutes.
 */
export function initTemporaryTierCron() {
  logger.info('⏱️ Initializing Temporary Tier cleanup cron');

  const task = cron.schedule('*/5 * * * *', async () => {
    try {
      const nowIso = new Date().toISOString();
      // Find users where temporary tier expired
      const { data: expired, error: selErr } = await supabaseAdmin
        .from('profiles')
        .select('id, temporary_tier, temporary_tier_expires_at, base_subscription_tier')
        .eq('temporary_tier_active', true)
        .not('temporary_tier_expires_at', 'is', null)
        .lt('temporary_tier_expires_at', nowIso);

      if (selErr) {
        logger.error('❌ TemporaryTierCron select error', selErr);
        return;
      }

      if (!expired || expired.length === 0) return;

      for (const row of expired as any[]) {
        const { error: updErr } = await supabaseAdmin
          .from('profiles')
          .update({
            temporary_tier_active: false,
            temporary_tier: null,
            temporary_tier_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        if (updErr) {
          logger.error('❌ TemporaryTierCron update error', { id: row.id, err: updErr });
        } else {
          logger.info(`✅ Cleared expired temporary tier for user ${row.id}`);
        }
      }
    } catch (e) {
      logger.error('❌ TemporaryTierCron exception', e as any);
    }
  }, { scheduled: true, timezone: 'America/New_York' });

  task.start();
}
