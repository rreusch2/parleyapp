import { Request, Response, NextFunction } from 'express';
import { SubscriptionTierService } from '../services/subscriptionTierService';

// Extend Request interface to include subscription data
declare global {
  namespace Express {
    interface Request {
      userSubscription?: {
        effectiveTier: 'free' | 'pro' | 'elite';
        source: 'day_pass' | 'subscription' | 'welcome_bonus' | 'free';
        expiresAt?: string | null;
        isDayPass: boolean;
        isWelcomeBonus: boolean;
        dailyLimits: {
          totalPicks: number;
          teamPicks: number;
          playerProps: number;
          insights: number;
          chatMessages: number;
        };
        featureAccess: {
          playOfTheDay: boolean;
          professionalInsights: boolean;
          advancedProfessorLock: boolean;
          premiumAnalytics: boolean;
          unlimitedChat: boolean;
          trendAnalysis: boolean;
        };
      };
    }
  }
}

/**
 * Middleware to calculate and attach user subscription information to requests
 */
export async function attachSubscriptionInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.query.userId as string || req.body.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // Get effective subscription tier
    const tierResult = await SubscriptionTierService.getEffectiveTier(userId);
    
    // Get limits and feature access
    const dailyLimits = SubscriptionTierService.getDailyPickLimits(tierResult.effectiveTier);
    const featureAccess = SubscriptionTierService.getFeatureAccess(tierResult.effectiveTier);

    // Attach to request object
    req.userSubscription = {
      ...tierResult,
      dailyLimits,
      featureAccess
    };

    next();
  } catch (error) {
    console.error('Error attaching subscription info:', error);
    res.status(500).json({ error: 'Failed to retrieve subscription information' });
  }
}

/**
 * Middleware to require specific subscription tier
 */
export function requireTier(requiredTier: 'pro' | 'elite') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userSubscription) {
      return res.status(500).json({ error: 'Subscription middleware not applied' });
    }

    const tierHierarchy = { 'free': 0, 'pro': 1, 'elite': 2 };
    const userLevel = tierHierarchy[req.userSubscription.effectiveTier];
    const requiredLevel = tierHierarchy[requiredTier];

    if (userLevel < requiredLevel) {
      return res.status(403).json({ 
        error: `${requiredTier} subscription required`,
        currentTier: req.userSubscription.effectiveTier,
        requiredTier,
        upgradeRequired: true
      });
    }

    next();
  };
}

/**
 * Middleware to check daily limits
 */
export function checkDailyLimit(limitType: 'totalPicks' | 'teamPicks' | 'playerProps' | 'insights' | 'chatMessages') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userSubscription) {
        return res.status(500).json({ error: 'Subscription middleware not applied' });
      }

      const limit = req.userSubscription.dailyLimits[limitType];
      
      // -1 means unlimited
      if (limit === -1) {
        return next();
      }

      const userId = req.query.userId as string || req.body.userId as string;
      
      // Check current usage (you'll need to implement these queries based on your needs)
      let currentUsage = 0;
      
      // Example usage check - adjust based on your table structure
      if (limitType === 'totalPicks') {
        // Check ai_predictions for today
        const today = new Date().toISOString().split('T')[0];
        // Add your usage check logic here
      }

      if (currentUsage >= limit) {
        return res.status(429).json({
          error: `Daily ${limitType} limit exceeded`,
          limit,
          currentUsage,
          upgradeRequired: req.userSubscription.effectiveTier === 'free'
        });
      }

      next();
    } catch (error) {
      console.error(`Error checking ${limitType} limit:`, error);
      res.status(500).json({ error: 'Failed to check usage limits' });
    }
  };
}
