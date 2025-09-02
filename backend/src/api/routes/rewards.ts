import express, { Request, Response } from 'express';
import { createLogger } from '../../utils/logger';
import { supabaseAdmin } from '../../services/supabase/client';
import { authenticateUser } from '../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

const router = express.Router();
const logger = createLogger('rewardRoutes');

/**
 * @route GET /api/rewards/catalog
 * @desc Get available rewards from catalog with optimized pricing
 * @access Private (authenticated users only)
 */
router.get('/catalog', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get rewards and apply optimal pricing
    const { data: rewards, error } = await supabaseAdmin
      .from('reward_catalog')
      .select('*')
      .eq('is_active', true)
      .order('points_cost', { ascending: true });

    if (error) {
      logger.error('Error fetching rewards catalog:', error);
      return res.status(500).json({ error: 'Failed to fetch rewards' });
    }

    // Apply optimal pricing override
    const optimizedRewards = (rewards || []).map(reward => {
      const optimalPricing: Record<string, number> = {
        '1 Day Pro Access': 50,
        '3 Day Pro Access': 125,
        '1 Day Elite Access': 100,
        'Weekend Elite Pass': 200
      };

      return {
        ...reward,
        points_cost: optimalPricing[reward.reward_name] || reward.points_cost
      };
    });

    return res.json({
      success: true,
      rewards: optimizedRewards
    });
  } catch (error: any) {
    logger.error('Rewards catalog error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /api/rewards/claim
 * @desc Claim a reward using points
 * @access Private
 */
router.post('/claim', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { rewardId } = req.body;

    if (!userId || !rewardId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user's current points and subscription status
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('referral_points, subscription_tier, base_subscription_tier, subscription_expires_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get reward details
    const { data: reward, error: rewardError } = await supabaseAdmin
      .from('reward_catalog')
      .select('*')
      .eq('id', rewardId)
      .eq('is_active', true)
      .single();

    if (rewardError || !reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Apply optimal pricing override (same as catalog API)
    const optimalPricing: Record<string, number> = {
      '1 Day Pro Access': 50,
      '3 Day Pro Access': 125,
      '1 Day Elite Access': 100,
      'Weekend Elite Pass': 200
    };

    const actualPointsCost = optimalPricing[reward.reward_name] || reward.points_cost;

    // Check if user has enough points (using optimal pricing)
    if ((user.referral_points || 0) < actualPointsCost) {
      return res.status(400).json({ 
        error: 'Insufficient points',
        required: actualPointsCost,
        available: user.referral_points || 0
      });
    }

    // Handle different reward types
    let expiresAt: Date | null = null;
    let originalTier = user.subscription_tier || 'free';
    let newTier = originalTier;

    if (reward.reward_type === 'temporary_upgrade') {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + reward.duration_hours);
      
      // Determine new tier
      if (reward.upgrade_tier === 'pro') {
        newTier = 'pro';
      } else if (reward.upgrade_tier === 'elite') {
        newTier = 'elite';
      }

      // Handle edge case: User already has Pro/Elite
      if (user.subscription_tier === 'pro' || user.subscription_tier === 'elite') {
        // If user already has same or higher tier, extend duration instead
        const currentExpiry = user.subscription_expires_at ? new Date(user.subscription_expires_at) : new Date();
        const now = new Date();
        
        if (currentExpiry > now) {
          // Extend current subscription
          expiresAt = new Date(currentExpiry.getTime() + (reward.duration_hours * 60 * 60 * 1000));
        } else {
          // Current subscription expired, start new temp upgrade
          expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + reward.duration_hours);
        }
        
        // If user has higher tier than reward, keep their tier but extend duration
        if (user.subscription_tier === 'elite' && reward.upgrade_tier === 'pro') {
          newTier = 'elite'; // Keep elite
        }
      }
    }

    // Start transaction
    const { error: claimError } = await supabaseAdmin
      .from('user_reward_claims')
      .insert({
        user_id: userId,
        reward_id: rewardId,
        points_spent: actualPointsCost,
        expires_at: expiresAt?.toISOString(),
        original_tier: originalTier,
        metadata: {
          reward_name: reward.reward_name,
          upgrade_tier: reward.upgrade_tier,
          duration_hours: reward.duration_hours
        }
      });

    if (claimError) {
      logger.error('Error creating reward claim:', claimError);
      return res.status(500).json({ error: 'Failed to claim reward' });
    }

    // Update user points and subscription if temporary upgrade
    const updates: any = {
      referral_points: (user.referral_points || 0) - actualPointsCost
    };

    if (reward.reward_type === 'temporary_upgrade') {
      updates.subscription_tier = newTier;
      updates.subscription_expires_at = expiresAt?.toISOString();
      updates.referral_upgrade_expires_at = expiresAt?.toISOString();
      updates.welcome_bonus_claimed = false;
      updates.welcome_bonus_expires_at = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (updateError) {
      logger.error('Error updating user after reward claim:', updateError);
      return res.status(500).json({ error: 'Failed to apply reward' });
    }

    logger.info(`User ${userId} claimed reward: ${reward.reward_name} for ${reward.points_cost} points`);

    return res.json({
      success: true,
      message: `Successfully claimed ${reward.reward_name}!`,
      reward: {
        name: reward.reward_name,
        type: reward.reward_type,
        expires_at: expiresAt?.toISOString(),
        new_tier: newTier
      },
      remaining_points: (user.referral_points || 0) - reward.points_cost
    });
  } catch (error: any) {
    logger.error('Error in /claim:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /api/rewards/my-claims
 * @desc Get user's active reward claims
 * @access Private
 */
router.get('/my-claims', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: claims, error } = await supabaseAdmin
      .from('user_reward_claims')
      .select(`
        *,
        reward_catalog (
          reward_name,
          reward_description,
          reward_type,
          upgrade_tier,
          duration_hours
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('claimed_at', { ascending: false });

    if (error) {
      logger.error('Error fetching user claims:', error);
      return res.status(500).json({ error: 'Failed to fetch claims' });
    }

    return res.json({ claims });
  } catch (error: any) {
    logger.error('Error in /my-claims:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /api/rewards/check-expiry
 * @desc Check and handle expired temporary upgrades
 * @access Private (called by cron or app startup)
 */
router.post('/check-expiry', async (req, res) => {
  try {
    const now = new Date().toISOString();

    // Find users with expired referral upgrades
    const { data: expiredUsers, error } = await supabaseAdmin
      .from('profiles')
      .select('id, base_subscription_tier, referral_upgrade_expires_at')
      .lt('referral_upgrade_expires_at', now)
      .not('referral_upgrade_expires_at', 'is', null);

    if (error) {
      logger.error('Error finding expired users:', error);
      return res.status(500).json({ error: 'Failed to check expiry' });
    }

    // Revert users back to their base subscription tier
    for (const user of expiredUsers || []) {
      await supabaseAdmin
        .from('profiles')
        .update({
          subscription_tier: user.base_subscription_tier || 'free',
          referral_upgrade_expires_at: null
        })
        .eq('id', user.id);

      // Mark reward claims as inactive
      await supabaseAdmin
        .from('user_reward_claims')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .lt('expires_at', now);
    }

    logger.info(`Processed ${expiredUsers?.length || 0} expired referral upgrades`);

    return res.json({ 
      success: true, 
      processed: expiredUsers?.length || 0 
    });
  } catch (error: any) {
    logger.error('Error in /check-expiry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
