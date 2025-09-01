import express from 'express';
import { createLogger } from '../../utils/logger';
import { supabaseAdmin } from '../../services/supabase/client';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();
const logger = createLogger('coinsRoutes');

/**
 * @route GET /api/coins/balance
 * @desc Get user's coin/points balance
 * @access Private
 */
router.get('/balance', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('referral_points')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching balance:', error);
      return res.status(500).json({ error: 'Failed to fetch balance' });
    }

    return res.json({ balance: profile.referral_points || 0 });
  } catch (error: any) {
    logger.error('Error in /balance:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /api/coins/transactions
 * @desc Get user's point transaction history
 * @access Private
 */
router.get('/transactions', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get reward claims as transactions
    const { data: claims, error } = await supabaseAdmin
      .from('user_reward_claims')
      .select(`
        id,
        points_spent,
        claimed_at,
        metadata,
        reward_catalog (
          reward_name,
          reward_description
        )
      `)
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching transactions:', error);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }

    // Transform to transaction format
    const transactions = claims?.map(claim => ({
      id: claim.id,
      type: 'spend' as const,
      amount: -claim.points_spent,
      description: `Claimed: ${(claim.reward_catalog as any)?.reward_name || 'Unknown Reward'}`,
      created_at: claim.claimed_at
    })) || [];

    return res.json(transactions);
  } catch (error: any) {
    logger.error('Error in /transactions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /api/coins/award
 * @desc Award points for various actions
 * @access Private
 */
router.post('/award', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { action, amount, description } = req.body;

    if (!userId || !action || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Define point values for different actions
    const actionPoints: Record<string, number> = {
      'daily_login': 5,
      'app_share': 10,
      'app_rating': 25,
      'social_share': 15,
      'referral_signup': 25,
      'referral_subscription': 100
    };

    const pointsToAward = actionPoints[action] || amount;

    // Get current balance
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('referral_points, referral_points_lifetime')
      .eq('id', userId)
      .single();

    if (fetchError) {
      logger.error('Error fetching user for award:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }

    // Update points
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        referral_points: (user.referral_points || 0) + pointsToAward,
        referral_points_lifetime: (user.referral_points_lifetime || 0) + pointsToAward
      })
      .eq('id', userId);

    if (updateError) {
      logger.error('Error updating points:', updateError);
      return res.status(500).json({ error: 'Failed to award points' });
    }

    logger.info(`Awarded ${pointsToAward} points to user ${userId} for action: ${action}`);

    return res.json({
      success: true,
      points_awarded: pointsToAward,
      new_balance: (user.referral_points || 0) + pointsToAward,
      action,
      description: description || `Points for ${action.replace('_', ' ')}`
    });
  } catch (error: any) {
    logger.error('Error in /award:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
