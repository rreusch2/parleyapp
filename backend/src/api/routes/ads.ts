import express, { Request, Response } from 'express';
import { createLogger } from '../../utils/logger';
import { supabaseAdmin } from '../../services/supabase/client';
import { authenticateUser } from '../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

const router = express.Router();
const logger = createLogger('adsRoutes');

const MAX_DAILY_AD_REWARDS = 5;

function getStartEndOfTodayTZ(tz?: string) {
  // Fallback simple UTC day boundaries to avoid heavy deps
  const now = new Date();
  // Using UTC to keep consistent; backend already uses 24h reset pattern elsewhere
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// GET /api/ads/reward/status - current user's daily ad reward status
router.get('/reward/status', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch profile counters
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('daily_ad_rewards_used, last_ad_reward_reset, subscription_tier, welcome_bonus_claimed, welcome_bonus_expires_at')
      .eq('id', userId)
      .single();

    const { start, end } = getStartEndOfTodayTZ();

    // Count audit rows for today
    const { count: grantsTodayCount } = await supabaseAdmin
      .from('ad_reward_grants')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());

    const used = Math.max(0, profile?.daily_ad_rewards_used || 0);
    const remaining = Math.max(0, MAX_DAILY_AD_REWARDS - used);

    return res.json({
      success: true,
      data: {
        usedClientCounter: used,
        usedAuditCount: grantsTodayCount || 0,
        remaining,
        dailyLimit: MAX_DAILY_AD_REWARDS,
      }
    });
  } catch (err) {
    logger.error('Error getting reward status', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ads/reward/grant - grant 1 extra pick after client EARNED_REWARD
router.post('/reward/grant', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { ad_unit_id, transaction_id, reward_item, reward_amount = 1 } = req.body || {};

    // If this is a chat unlock reward, only audit it and do not affect pick counters
    if (reward_item === 'chat_send') {
      const now = new Date();
      const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      await supabaseAdmin
        .from('ad_reward_grants')
        .insert({
          user_id: userId,
          ad_network: 'admob',
          ad_unit_id,
          reward_item: 'chat_send',
          reward_amount: reward_amount,
          transaction_id: transaction_id || null,
          verified: false,
          expires_at: endOfDay.toISOString(),
          metadata: { source: 'client_grant', context: 'chat' }
        });

      return res.json({
        success: true,
        message: 'Chat unlock granted.'
      });
    }

    // Get and possibly reset counters
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('daily_ad_rewards_used, last_ad_reward_reset, subscription_tier')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    let used = profile.daily_ad_rewards_used || 0;
    const now = new Date();

    if (profile.last_ad_reward_reset) {
      const last = new Date(profile.last_ad_reward_reset);
      const hours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
      if (hours >= 24) {
        used = 0;
        await supabaseAdmin
          .from('profiles')
          .update({ daily_ad_rewards_used: 0, last_ad_reward_reset: now.toISOString() })
          .eq('id', userId);
      }
    } else {
      await supabaseAdmin
        .from('profiles')
        .update({ last_ad_reward_reset: now.toISOString() })
        .eq('id', userId);
    }

    if (used >= MAX_DAILY_AD_REWARDS) {
      return res.status(429).json({
        error: 'Daily rewarded-ad limit reached',
        dailyLimit: MAX_DAILY_AD_REWARDS,
        used,
        remaining: 0,
      });
    }

    // Insert audit record (unverified; SSV will mark verified later)
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    await supabaseAdmin
      .from('ad_reward_grants')
      .insert({
        user_id: userId,
        ad_network: 'admob',
        ad_unit_id,
        reward_item: reward_item || 'extra_pick',
        reward_amount: reward_amount,
        transaction_id: transaction_id || null,
        verified: false,
        expires_at: endOfDay.toISOString(),
        metadata: { source: 'client_grant' }
      });

    // Increment counter
    const newUsed = used + 1;
    await supabaseAdmin
      .from('profiles')
      .update({ daily_ad_rewards_used: newUsed, last_ad_reward_reset: now.toISOString() })
      .eq('id', userId);

    const adRewardsRemaining = Math.max(0, MAX_DAILY_AD_REWARDS - newUsed);

    return res.json({
      success: true,
      adRewardsUsed: newUsed,
      adRewardsRemaining,
      dailyLimit: MAX_DAILY_AD_REWARDS,
      message: 'Extra pick granted for today.'
    });
  } catch (err) {
    logger.error('Error granting ad reward', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/ads/reward/ssv - AdMob Server-Side Verification callback
// NOTE: For production, you should verify signature per AdMob SSV docs.
router.get('/reward/ssv', async (req: Request, res: Response) => {
  try {
    const {
      user_id: userId,
      ad_unit: adUnitId,
      reward_item,
      reward_amount,
      transaction_id,
      key_id,
      signature,
      custom_data,
    } = req.query as any;

    if (!userId) {
      return res.status(400).json({ error: 'Missing user_id' });
    }

    // Try to find a recent unverified grant for this user and attach transaction_id
    const { data: recentGrants } = await supabaseAdmin
      .from('ad_reward_grants')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentGrants && recentGrants.length > 0) {
      await supabaseAdmin
        .from('ad_reward_grants')
        .update({
          verified: true,
          transaction_id: (transaction_id as string) || null,
          metadata: { source: 'ssv', key_id, signature, custom_data }
        })
        .eq('id', recentGrants[0].id);
    } else if (transaction_id) {
      // Insert a verified audit row (will not affect UI counters which use profiles)
      await supabaseAdmin
        .from('ad_reward_grants')
        .insert({
          user_id: userId,
          ad_network: 'admob',
          ad_unit_id: adUnitId as string,
          reward_item: (reward_item as string) || 'extra_pick',
          reward_amount: Number(reward_amount) || 1,
          transaction_id: transaction_id as string,
          verified: true,
          metadata: { source: 'ssv_only', key_id, signature, custom_data }
        });
    }

    // Respond with 200 OK as required by AdMob
    return res.status(200).send('OK');
  } catch (err) {
    logger.error('Error in SSV callback', err);
    return res.status(200).send('OK'); // Always 200 to prevent retries storm; log for investigation
  }
});

export default router;
