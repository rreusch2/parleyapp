import { supabase } from './api/supabaseClient';
import revenueCatService, { SubscriptionPlan, SUBSCRIPTION_TIERS } from './revenueCatService';
import ReferralService from './referralService';
import GiveawayService from './giveawayService';
import ReviewService from './reviewService';

interface UpgradeRecommendation {
  shouldRecommend: boolean;
  fromTier: 'free' | 'pro' | 'elite';
  toTier: 'pro' | 'elite';
  reason: string;
  benefits: string[];
  discountAvailable?: {
    percentage: number;
    expiresAt: string;
  };
}

interface TierUsageAnalytics {
  dailyPicksUsed: number;
  maxDailyPicks: number;
  chatMessagesUsed: number;
  insightsViewed: number;
  daysActive: number;
  engagementScore: number;
}

class TierUpgradeService {
  private static instance: TierUpgradeService;

  public static getInstance(): TierUpgradeService {
    if (!TierUpgradeService.instance) {
      TierUpgradeService.instance = new TierUpgradeService();
    }
    return TierUpgradeService.instance;
  }

  /**
   * Analyze user behavior and recommend tier upgrades
   */
  async getUpgradeRecommendation(userId: string): Promise<UpgradeRecommendation | null> {
    try {
      const [userProfile, usageAnalytics, referralPricing] = await Promise.all([
        this.getUserProfile(userId),
        this.getUserUsageAnalytics(userId),
        ReferralService.getInstance().getReferralPricing(userId)
      ]);

      if (!userProfile) return null;

      const currentTier = userProfile.subscription_tier as 'free' | 'pro' | 'elite';

      // Free to Pro upgrade recommendations
      if (currentTier === 'free') {
        return this.analyzeFreeToPro(usageAnalytics, referralPricing);
      }

      // Pro to Elite upgrade recommendations
      if (currentTier === 'pro') {
        return this.analyzeProToElite(usageAnalytics, referralPricing);
      }

      return null; // Elite users don't need upgrades
    } catch (error) {
      console.error('Error getting upgrade recommendation:', error);
      return null;
    }
  }

  /**
   * Process tier upgrade with proper RevenueCat integration
   */
  async processTierUpgrade(userId: string, newPlan: SubscriptionPlan): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current subscription info
      const customerInfo = await revenueCatService.getCustomerInfo();
      const currentTier = await this.getCurrentTier(userId);

      // Attempt the upgrade purchase
      const purchaseResult = await revenueCatService.purchasePackage(newPlan);

      if (!purchaseResult.success) {
        return { success: false, error: purchaseResult.error };
      }

      // Update user profile with new tier
      const newTier = this.getTierFromPlan(newPlan);
      await this.updateUserTier(userId, newTier, newPlan);

      // Trigger upgrade events
      await this.triggerUpgradeEvents(userId, currentTier, newTier);

      return { success: true };
    } catch (error) {
      console.error('Error processing tier upgrade:', error);
      return { success: false, error: 'Failed to process upgrade. Please try again.' };
    }
  }

  /**
   * Handle subscription downgrades (cancellations)
   */
  async processDowngrade(userId: string, reason?: string): Promise<void> {
    try {
      const currentTier = await this.getCurrentTier(userId);
      
      // Update user profile
      await supabase
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_plan_type: null,
          subscription_product_id: null,
          auto_renew_enabled: false,
          downgrade_reason: reason,
          downgraded_at: new Date().toISOString()
        })
        .eq('id', userId);

      console.log(`📉 User downgraded from ${currentTier} to free:`, userId);
    } catch (error) {
      console.error('Error processing downgrade:', error);
    }
  }

  /**
   * Get tier-specific feature limits and usage
   */
  async getTierUsageStatus(userId: string): Promise<{
    currentTier: string;
    usage: TierUsageAnalytics;
    limits: any;
    utilizationPercentage: number;
  }> {
    try {
      const [userProfile, usageAnalytics] = await Promise.all([
        this.getUserProfile(userId),
        this.getUserUsageAnalytics(userId)
      ]);

      const currentTier = userProfile?.subscription_tier || 'free';
      const limits = SUBSCRIPTION_TIERS[currentTier as keyof typeof SUBSCRIPTION_TIERS];

      const utilizationPercentage = Math.round(
        (usageAnalytics.dailyPicksUsed / usageAnalytics.maxDailyPicks) * 100
      );

      return {
        currentTier,
        usage: usageAnalytics,
        limits,
        utilizationPercentage
      };
    } catch (error) {
      console.error('Error getting tier usage status:', error);
      return {
        currentTier: 'free',
        usage: {
          dailyPicksUsed: 0,
          maxDailyPicks: 2,
          chatMessagesUsed: 0,
          insightsViewed: 0,
          daysActive: 0,
          engagementScore: 0
        },
        limits: SUBSCRIPTION_TIERS.free,
        utilizationPercentage: 0
      };
    }
  }

  /**
   * Analyze Free to Pro upgrade opportunity
   */
  private analyzeFreeToPro(usage: TierUsageAnalytics, referralPricing: any): UpgradeRecommendation {
    const shouldRecommend = 
      usage.dailyPicksUsed >= usage.maxDailyPicks * 0.8 || // Using 80%+ of free picks
      usage.chatMessagesUsed >= 3 || // Hit chat limit
      usage.engagementScore >= 70; // High engagement

    if (!shouldRecommend) {
      return {
        shouldRecommend: false,
        fromTier: 'free',
        toTier: 'pro',
        reason: 'User not ready for upgrade',
        benefits: []
      };
    }

    const benefits = [
      '20 daily AI picks (vs 2 free)',
      'Unlimited AI chat with Professor Lock',
      '8 daily insights (vs 2 free)',
      'Play of the Day feature',
      'Advanced analytics',
      'Priority support'
    ];

    let reason = 'Unlock your full betting potential';
    if (usage.dailyPicksUsed >= usage.maxDailyPicks) {
      reason = 'You\'ve maxed out your daily picks - upgrade for 10x more!';
    } else if (usage.chatMessagesUsed >= 3) {
      reason = 'Get unlimited access to Professor Lock\'s expertise';
    }

    return {
      shouldRecommend: true,
      fromTier: 'free',
      toTier: 'pro',
      reason,
      benefits,
      discountAvailable: referralPricing.hasDiscount ? {
        percentage: referralPricing.discountPercent,
        expiresAt: referralPricing.discountExpiresAt
      } : undefined
    };
  }

  /**
   * Analyze Pro to Elite upgrade opportunity
   */
  private analyzeProToElite(usage: TierUsageAnalytics, referralPricing: any): UpgradeRecommendation {
    const shouldRecommend = 
      usage.dailyPicksUsed >= 18 || // Using 90%+ of pro picks
      usage.insightsViewed >= 7 || // Using most insights
      usage.engagementScore >= 85; // Very high engagement

    if (!shouldRecommend) {
      return {
        shouldRecommend: false,
        fromTier: 'pro',
        toTier: 'elite',
        reason: 'User satisfied with Pro tier',
        benefits: []
      };
    }

    const benefits = [
      '30 daily AI picks (vs 20 pro)',
      '12 daily insights (vs 8 pro)',
      'Lock of the Day - highest confidence pick',
      'Advanced Professor Lock with deeper analysis',
      'Elite theme and exclusive features',
      'Early access to new features',
      'Priority support with faster response'
    ];

    const reason = usage.dailyPicksUsed >= 18 
      ? 'You\'re maxing out Pro - Elite gives you 50% more picks!'
      : 'Take your betting to the elite level with premium features';

    return {
      shouldRecommend: true,
      fromTier: 'pro',
      toTier: 'elite',
      reason,
      benefits,
      discountAvailable: referralPricing.hasDiscount ? {
        percentage: referralPricing.discountPercent,
        expiresAt: referralPricing.discountExpiresAt
      } : undefined
    };
  }

  /**
   * Trigger events after successful upgrade
   */
  private async triggerUpgradeEvents(userId: string, fromTier: string, toTier: string): Promise<void> {
    try {
      // Trigger review prompt for upgrades
      await ReviewService.getInstance().triggerReview({
        eventType: 'tier_upgrade',
        metadata: {
          upgradeFrom: fromTier,
          upgradeTo: toTier
        }
      });

      // Enter user in giveaway for subscription purchase
      await GiveawayService.getInstance().triggerAutoEntry(userId, 'subscription_purchase', {
        tier: toTier
      });

      console.log(`🎉 Upgrade events triggered: ${fromTier} → ${toTier}`);
    } catch (error) {
      console.error('Error triggering upgrade events:', error);
    }
  }

  private async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_plan_type, created_at')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getUserUsageAnalytics(userId: string): Promise<TierUsageAnalytics> {
    try {
      // Get user's current tier limits
      const profile = await this.getUserProfile(userId);
      const currentTier = profile?.subscription_tier || 'free';
      const tierLimits = SUBSCRIPTION_TIERS[currentTier as keyof typeof SUBSCRIPTION_TIERS];

      // Calculate days since signup
      const signupDate = new Date(profile?.created_at || new Date());
      const daysActive = Math.floor((Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24));

      // Mock usage data - in production, you'd query actual usage tables
      const dailyPicksUsed = currentTier === 'free' ? 2 : (currentTier === 'pro' ? 18 : 25);
      const chatMessagesUsed = currentTier === 'free' ? 3 : 15;
      const insightsViewed = currentTier === 'free' ? 2 : (currentTier === 'pro' ? 7 : 10);

      const engagementScore = Math.min(100, 
        (dailyPicksUsed / tierLimits.picks) * 40 + 
        (chatMessagesUsed / 10) * 30 + 
        (insightsViewed / tierLimits.insights) * 30
      );

      return {
        dailyPicksUsed,
        maxDailyPicks: tierLimits.picks,
        chatMessagesUsed,
        insightsViewed,
        daysActive,
        engagementScore: Math.round(engagementScore)
      };
    } catch (error) {
      console.error('Error getting usage analytics:', error);
      return {
        dailyPicksUsed: 0,
        maxDailyPicks: 2,
        chatMessagesUsed: 0,
        insightsViewed: 0,
        daysActive: 0,
        engagementScore: 0
      };
    }
  }

  private async getCurrentTier(userId: string): Promise<string> {
    const profile = await this.getUserProfile(userId);
    return profile?.subscription_tier || 'free';
  }

  private getTierFromPlan(plan: SubscriptionPlan): 'pro' | 'elite' {
    if (plan.includes('elite')) return 'elite';
    return 'pro';
  }

  private async updateUserTier(userId: string, tier: string, plan: SubscriptionPlan): Promise<void> {
    await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_plan_type: plan,
        subscription_started_at: new Date().toISOString(),
        subscription_renewed_at: new Date().toISOString(),
        auto_renew_enabled: true
      })
      .eq('id', userId);
  }
}

export default TierUpgradeService;
export type { UpgradeRecommendation, TierUsageAnalytics };
