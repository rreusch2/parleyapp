import express from 'express';
import { createLogger } from '../../utils/logger';
import { awardReferralBonus } from '../../jobs/rewardExpiry';

const router = express.Router();
const logger = createLogger('webhooksRewards');

/**
 * @route POST /api/webhooks/subscription-success
 * @desc Handle successful subscription to award referral bonuses
 * @access Internal (called by RevenueCat/Apple webhooks)
 */
router.post('/subscription-success', async (req, res) => {
  try {
    const { userId, productId, subscriptionTier } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    logger.info(`🎯 Processing subscription success for user: ${userId}`, {
      productId,
      subscriptionTier
    });

    // Award referral bonus
    const result = await awardReferralBonus(userId);

    if (result.success) {
      logger.info(`✅ Referral bonus processing completed: ${result.message}`);
    } else {
      logger.error(`❌ Referral bonus processing failed: ${result.error}`);
    }

    return res.json({ 
      success: true, 
      message: 'Subscription processed',
      referral_result: result
    });
  } catch (error: any) {
    logger.error('Error processing subscription success:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route POST /api/webhooks/award-points
 * @desc Award points for various user actions
 * @access Internal
 */
router.post('/award-points', async (req, res) => {
  try {
    const { userId, action, points, description } = req.body;

    if (!userId || !action || !points) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Award points using coins API logic
    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3000'}/api/coins/award`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || 'internal-webhook'}`
      },
      body: JSON.stringify({ action, amount: points, description })
    });

    if (response.ok) {
      const data = await response.json();
      logger.info(`🎁 Awarded ${points} points to user ${userId} for ${action}`);
      return res.json(data);
    } else {
      throw new Error(`Award points API returned ${response.status}`);
    }
  } catch (error: any) {
    logger.error('Error awarding points:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
