import { Router, Request, Response } from 'express';
import { SubscriptionTierService } from '../services/subscriptionTierService';
import { attachSubscriptionInfo } from './subscription-middleware';

const router = Router();

/**
 * GET /api/subscription/status
 * Get comprehensive subscription status for a user
 */
router.get('/status', attachSubscriptionInfo, async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    
    if (!req.userSubscription) {
      return res.status(500).json({ error: 'Subscription middleware failed' });
    }

    res.json({
      userId,
      subscription: {
        effectiveTier: req.userSubscription.effectiveTier,
        source: req.userSubscription.source,
        expiresAt: req.userSubscription.expiresAt,
        isDayPass: req.userSubscription.isDayPass,
        isWelcomeBonus: req.userSubscription.isWelcomeBonus
      },
      limits: req.userSubscription.dailyLimits,
      features: req.userSubscription.featureAccess,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '2.0'
      }
    });

  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

/**
 * GET /api/subscription/tier
 * Simple endpoint to just get the effective tier (for legacy compatibility)
 */
router.get('/tier', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const { effectiveTier, source, isDayPass, isWelcomeBonus } = 
      await SubscriptionTierService.getEffectiveTier(userId);

    res.json({
      tier: effectiveTier,
      source,
      isDayPass,
      isWelcomeBonus
    });

  } catch (error) {
    console.error('Error getting subscription tier:', error);
    res.status(500).json({ error: 'Failed to get subscription tier' });
  }
});

/**
 * POST /api/subscription/day-pass/grant
 * Grant day pass access (for payment processing)
 */
router.post('/day-pass/grant', async (req: Request, res: Response) => {
  try {
    const { userId, tier, purchaseToken } = req.body;
    
    if (!userId || !tier) {
      return res.status(400).json({ error: 'Missing userId or tier' });
    }
    
    if (!['pro', 'elite'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be pro or elite' });
    }

    // Grant day pass
    await SubscriptionTierService.grantDayPass(userId, tier);
    
    // Get updated subscription status
    const updatedStatus = await SubscriptionTierService.getEffectiveTier(userId);
    
    res.json({
      success: true,
      message: `${tier} day pass granted successfully`,
      subscription: updatedStatus,
      expiresIn: '24 hours'
    });

  } catch (error) {
    console.error('Error granting day pass:', error);
    res.status(500).json({ error: 'Failed to grant day pass' });
  }
});

/**
 * POST /api/subscription/cleanup
 * Manual trigger for subscription cleanup (admin only)
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const results = await SubscriptionTierService.cleanupExpiredBonuses();
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      results
    });

  } catch (error) {
    console.error('Error during manual cleanup:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

export default router;
