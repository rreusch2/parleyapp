import { supabaseAdmin } from '../config/supabase';

interface UserProfile {
  id: string;
  subscription_tier: 'free' | 'pro' | 'elite';
  day_pass_tier?: 'pro' | 'elite' | null;
  day_pass_expires_at?: string | null;
  welcome_bonus_claimed?: boolean;
  welcome_bonus_expires_at?: string | null;
}

interface EffectiveTierResult {
  effectiveTier: 'free' | 'pro' | 'elite';
  source: 'day_pass' | 'subscription' | 'welcome_bonus' | 'free';
  expiresAt?: string | null;
  isDayPass: boolean;
  isWelcomeBonus: boolean;
}

export class SubscriptionTierService {

  /**
   * Calculate the effective subscription tier for a user
   * Priority: Day Pass > Welcome Bonus > Subscription > Free
   */
  static async getEffectiveTier(userId: string): Promise<EffectiveTierResult> {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        subscription_tier,
        day_pass_tier,
        day_pass_expires_at,
        welcome_bonus_claimed,
        welcome_bonus_expires_at
      `)
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return {
        effectiveTier: 'free',
        source: 'free',
        isDayPass: false,
        isWelcomeBonus: false
      };
    }

    const now = new Date();

    // 1. Check for active day pass (highest priority)
    if (profile.day_pass_tier && profile.day_pass_expires_at) {
      const dayPassExpiry = new Date(profile.day_pass_expires_at);
      if (now < dayPassExpiry) {
        return {
          effectiveTier: profile.day_pass_tier as 'pro' | 'elite',
          source: 'day_pass',
          expiresAt: profile.day_pass_expires_at,
          isDayPass: true,
          isWelcomeBonus: false
        };
      }
    }

    // 2. Check for active welcome bonus (second priority)
    if (profile.welcome_bonus_claimed && profile.welcome_bonus_expires_at) {
      const welcomeExpiry = new Date(profile.welcome_bonus_expires_at);
      if (now < welcomeExpiry) {
        return {
          effectiveTier: 'pro', // Welcome bonus gives pro access
          source: 'welcome_bonus',
          expiresAt: profile.welcome_bonus_expires_at,
          isDayPass: false,
          isWelcomeBonus: true
        };
      }
    }

    // 3. Use subscription tier (RevenueCat managed)
    if (profile.subscription_tier && profile.subscription_tier !== 'free') {
      return {
        effectiveTier: profile.subscription_tier,
        source: 'subscription',
        isDayPass: false,
        isWelcomeBonus: false
      };
    }

    // 4. Default to free tier
    return {
      effectiveTier: 'free',
      source: 'free',
      isDayPass: false,
      isWelcomeBonus: false
    };
  }

  /**
   * Get daily pick limits based on effective tier
   */
  static getDailyPickLimits(effectiveTier: 'free' | 'pro' | 'elite'): {
    totalPicks: number;
    teamPicks: number;
    playerProps: number;
    insights: number;
    chatMessages: number;
  } {
    switch (effectiveTier) {
      case 'elite':
        return {
          totalPicks: 30,
          teamPicks: 15,
          playerProps: 15,
          insights: 12,
          chatMessages: -1 // Unlimited
        };
      
      case 'pro':
        return {
          totalPicks: 20,
          teamPicks: 10,
          playerProps: 10,
          insights: 8,
          chatMessages: -1 // Unlimited
        };
      
      case 'free':
      default:
        return {
          totalPicks: 2,
          teamPicks: 1,
          playerProps: 1,
          insights: 2,
          chatMessages: 3
        };
    }
  }

  /**
   * Check if user has access to specific features
   */
  static getFeatureAccess(effectiveTier: 'free' | 'pro' | 'elite'): {
    playOfTheDay: boolean;
    professionalInsights: boolean;
    advancedProfessorLock: boolean;
    premiumAnalytics: boolean;
    unlimitedChat: boolean;
    trendAnalysis: boolean;
  } {
    const baseFeatures = {
      playOfTheDay: false,
      professionalInsights: false,
      advancedProfessorLock: false,
      premiumAnalytics: false,
      unlimitedChat: false,
      trendAnalysis: false
    };

    switch (effectiveTier) {
      case 'elite':
        return {
          ...baseFeatures,
          playOfTheDay: true,
          professionalInsights: true,
          advancedProfessorLock: true,
          premiumAnalytics: true,
          unlimitedChat: true,
          trendAnalysis: true
        };
      
      case 'pro':
        return {
          ...baseFeatures,
          playOfTheDay: true,
          professionalInsights: true,
          advancedProfessorLock: false, // Elite exclusive
          premiumAnalytics: false, // Elite exclusive
          unlimitedChat: true,
          trendAnalysis: false // Elite exclusive
        };
      
      case 'free':
      default:
        return baseFeatures;
    }
  }

  /**
   * Clean up expired day passes and welcome bonuses
   */
  static async cleanupExpiredBonuses(): Promise<{
    expiredDayPasses: number;
    expiredWelcomeBonuses: number;
  }> {
    const now = new Date();

    // Clean up expired day passes
    const { error: dayPassError, count: dayPassCount } = await supabaseAdmin
      .from('profiles')
      .update({
        day_pass_tier: null,
        day_pass_expires_at: null,
        updated_at: now.toISOString()
      })
      .lt('day_pass_expires_at', now.toISOString())
      .not('day_pass_tier', 'is', null);

    if (dayPassError) {
      console.error('Error cleaning up expired day passes:', dayPassError);
    }

    // Clean up expired welcome bonuses
    const { error: welcomeError, count: welcomeCount } = await supabaseAdmin
      .from('profiles')
      .update({
        welcome_bonus_claimed: false,
        welcome_bonus_expires_at: null,
        updated_at: now.toISOString()
      })
      .lt('welcome_bonus_expires_at', now.toISOString())
      .eq('welcome_bonus_claimed', true);

    if (welcomeError) {
      console.error('Error cleaning up expired welcome bonuses:', welcomeError);
    }

    console.log(`🧹 Cleanup completed: ${dayPassCount || 0} day passes, ${welcomeCount || 0} welcome bonuses expired`);

    return {
      expiredDayPasses: dayPassCount || 0,
      expiredWelcomeBonuses: welcomeCount || 0
    };
  }

  /**
   * Grant day pass access
   */
  static async grantDayPass(userId: string, tier: 'pro' | 'elite'): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        day_pass_tier: tier,
        day_pass_granted_at: now.toISOString(),
        day_pass_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to grant day pass: ${error.message}`);
    }

    console.log(`✅ Granted ${tier} day pass to user ${userId}, expires at ${expiresAt.toISOString()}`);
  }

  /**
   * Batch check effective tiers for multiple users
   */
  static async batchGetEffectiveTiers(userIds: string[]): Promise<Map<string, EffectiveTierResult>> {
    const results = new Map<string, EffectiveTierResult>();
    
    // Process in chunks to avoid overwhelming the database
    const chunkSize = 50;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const promises = chunk.map(userId => 
        this.getEffectiveTier(userId).then(result => ({ userId, result }))
      );
      
      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(({ userId, result }) => {
        results.set(userId, result);
      });
    }
    
    return results;
  }

  /**
   * Check if user tier has recently changed (for notifications)
   */
  static async checkTierChanges(userId: string, previousTier: string): Promise<{
    hasChanged: boolean;
    upgrade: boolean;
    downgrade: boolean;
    newTier: string;
  }> {
    const { effectiveTier } = await this.getEffectiveTier(userId);
    
    const tierHierarchy = { 'free': 0, 'pro': 1, 'elite': 2 };
    const previousLevel = tierHierarchy[previousTier as keyof typeof tierHierarchy] || 0;
    const currentLevel = tierHierarchy[effectiveTier] || 0;
    
    return {
      hasChanged: previousTier !== effectiveTier,
      upgrade: currentLevel > previousLevel,
      downgrade: currentLevel < previousLevel,
      newTier: effectiveTier
    };
  }
}
