import { supabase } from './api/supabaseClient';
import { Alert } from 'react-native';

interface PointsBalance {
  totalPoints: number;
  availablePoints: number;
  pendingPoints: number;
  lifetimeEarned: number;
}

interface PointsRedemption {
  id: string;
  type: 'discount' | 'free_month' | 'tier_upgrade' | 'subscription_credit';
  pointsCost: number;
  dollarValue: number;
  description: string;
  tierRequired?: 'free' | 'pro' | 'elite';
}

interface PointsTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'earned' | 'redeemed';
  source: string;
  description: string;
  createdAt: string;
}

class PointsService {
  private static instance: PointsService;

  public static getInstance(): PointsService {
    if (!PointsService.instance) {
      PointsService.instance = new PointsService();
    }
    return PointsService.instance;
  }

  /**
   * Get available redemption options
   */
  getRedemptionOptions(): PointsRedemption[] {
    return [
      {
        id: 'discount_1000',
        type: 'discount',
        pointsCost: 1000,
        dollarValue: 10,
        description: '$10 off any subscription',
      },
      {
        id: 'discount_2500',
        type: 'discount',
        pointsCost: 2500,
        dollarValue: 25,
        description: '$25 off any subscription',
      },
      {
        id: 'free_pro_month',
        type: 'free_month',
        pointsCost: 2000,
        dollarValue: 20,
        description: '1 month Pro free',
        tierRequired: 'free',
      },
      {
        id: 'free_elite_month',
        type: 'free_month',
        pointsCost: 3000,
        dollarValue: 30,
        description: '1 month Elite free',
        tierRequired: 'free',
      },
      {
        id: 'pro_to_elite_upgrade',
        type: 'tier_upgrade',
        pointsCost: 1000,
        dollarValue: 10,
        description: 'Upgrade Pro to Elite for 1 month',
        tierRequired: 'pro',
      },
      {
        id: 'discount_5000',
        type: 'discount',
        pointsCost: 5000,
        dollarValue: 50,
        description: '$50 off any subscription (50% off most plans)',
      },
      {
        id: 'discount_10000',
        type: 'discount',
        pointsCost: 10000,
        dollarValue: 100,
        description: '$100 off lifetime subscription',
      },
    ];
  }

  /**
   * Get user's points balance
   */
  async getPointsBalance(userId: string): Promise<PointsBalance> {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('referral_points, referral_points_pending, referral_points_lifetime')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return { totalPoints: 0, availablePoints: 0, pendingPoints: 0, lifetimeEarned: 0 };
      }

      return {
        totalPoints: user.referral_points || 0,
        availablePoints: user.referral_points || 0,
        pendingPoints: user.referral_points_pending || 0,
        lifetimeEarned: user.referral_points_lifetime || 0
      };
    } catch (error) {
      console.error('Error getting points balance:', error);
      return { totalPoints: 0, availablePoints: 0, pendingPoints: 0, lifetimeEarned: 0 };
    }
  }

  /**
   * Award points to user
   */
  async awardPoints(userId: string, points: number, reason: string): Promise<boolean> {
    try {
      const currentBalance = await this.getPointsBalance(userId);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          referral_points: currentBalance.availablePoints + points,
          referral_points_lifetime: currentBalance.lifetimeEarned + points,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      // Log the points transaction
      await this.logPointsTransaction(userId, points, 'earned', reason);

      console.log(`✅ Awarded ${points} points to user ${userId}: ${reason}`);
      return true;
    } catch (error) {
      console.error('Error awarding points:', error);
      return false;
    }
  }

  /**
   * Redeem points for reward
   */
  async redeemPoints(userId: string, redemptionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const redemption = this.getRedemptionOptions().find(r => r.id === redemptionId);
      if (!redemption) {
        return { success: false, message: 'Invalid redemption option' };
      }

      const balance = await this.getPointsBalance(userId);
      if (balance.availablePoints < redemption.pointsCost) {
        return { success: false, message: `Insufficient points. Need ${redemption.pointsCost}, have ${balance.availablePoints}` };
      }

      // Check tier requirements
      if (redemption.tierRequired) {
        const { data: user, error } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', userId)
          .single();

        if (error || user.subscription_tier !== redemption.tierRequired) {
          return { success: false, message: `This reward requires ${redemption.tierRequired} tier` };
        }
      }

      // Deduct points
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          referral_points: balance.availablePoints - redemption.pointsCost,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Apply the reward
      await this.applyReward(userId, redemption);

      // Log the redemption
      await this.logPointsTransaction(userId, -redemption.pointsCost, 'redeemed', redemption.description);

      return { success: true, message: `Successfully redeemed: ${redemption.description}` };
    } catch (error) {
      console.error('Error redeeming points:', error);
      return { success: false, message: 'Failed to redeem points. Please try again.' };
    }
  }

  /**
   * Apply the actual reward to user account
   */
  private async applyReward(userId: string, redemption: PointsRedemption): Promise<void> {
    try {
      switch (redemption.type) {
        case 'discount':
          // Create discount credit for next purchase
          await supabase
            .from('referral_rewards')
            .insert({
              user_id: userId,
              reward_type: 'discount_credit',
              reward_value: redemption.dollarValue,
              description: `$${redemption.dollarValue} subscription credit`,
              status: 'active',
              expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
              created_at: new Date().toISOString()
            });
          break;

        case 'free_month':
          // Grant free subscription month
          const freeMonthExpiry = new Date();
          freeMonthExpiry.setMonth(freeMonthExpiry.getMonth() + 1);
          
          await supabase
            .from('profiles')
            .update({
              subscription_tier: redemption.description.includes('Elite') ? 'elite' : 'pro',
              referral_free_month_expires_at: freeMonthExpiry.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
          break;

        case 'tier_upgrade':
          // Upgrade tier for 1 month
          const upgradeExpiry = new Date();
          upgradeExpiry.setMonth(upgradeExpiry.getMonth() + 1);
          
          await supabase
            .from('profiles')
            .update({
              subscription_tier: 'elite',
              referral_upgrade_expires_at: upgradeExpiry.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
          break;
      }
    } catch (error) {
      console.error('Error applying reward:', error);
      throw error;
    }
  }

  /**
   * Log points transaction
   */
  private async logPointsTransaction(userId: string, points: number, type: 'earned' | 'redeemed' | 'expired', reason: string): Promise<void> {
    try {
      await supabase
        .from('referral_rewards')
        .insert({
          user_id: userId,
          reward_type: 'points',
          reward_value: Math.abs(points),
          description: `${type}: ${reason}`,
          status: type === 'earned' ? 'granted' : 'redeemed',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging points transaction:', error);
    }
  }

  /**
   * Process referral signup - award points to new user
   */
  async processReferralSignup(newUserId: string, referralCode: string): Promise<boolean> {
    try {
      // Find referrer
      const { data: referrer, error: referrerError } = await supabase
        .from('profiles')
        .select('id, referral_code')
        .eq('referral_code', referralCode)
        .single();

      if (referrerError || !referrer) {
        console.log('Invalid referral code:', referralCode);
        return false;
      }

      // Award 2,500 points to new user
      await this.awardPoints(newUserId, 2500, 'Referral signup bonus');

      // Create referral tracking record
      await supabase
        .from('referrals')
        .insert({
          referrer_id: referrer.id,
          referred_user_id: newUserId,
          referral_code: referralCode,
          status: 'pending',
          reward_type: 'points',
          reward_value: 5000, // Referrer will get 5000 points when referred user subscribes
          created_at: new Date().toISOString()
        });

      console.log('✅ Referral signup processed - 2,500 points awarded to new user');
      return true;
    } catch (error) {
      console.error('Error processing referral signup:', error);
      return false;
    }
  }

  /**
   * Process referral conversion - award points to referrer when referred user subscribes
   */
  async processReferralConversion(referredUserId: string): Promise<void> {
    try {
      // Find pending referral
      const { data: referral, error: referralError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referred_user_id', referredUserId)
        .eq('status', 'pending')
        .single();

      if (referralError || !referral) {
        console.log('No pending referral found for user:', referredUserId);
        return;
      }

      // Award 5,000 points to referrer
      await this.awardPoints(referral.referrer_id, 5000, 'Successful referral conversion');

      // Mark referral as completed
      await supabase
        .from('referrals')
        .update({
          status: 'completed',
          reward_granted: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', referral.id);

      console.log('✅ Referral conversion processed - 5,000 points awarded to referrer');
    } catch (error) {
      console.error('Error processing referral conversion:', error);
    }
  }

  /**
   * Get user's available discount credits
   */
  async getDiscountCredits(userId: string): Promise<number> {
    try {
      const { data: credits, error } = await supabase
        .from('referral_rewards')
        .select('reward_value')
        .eq('user_id', userId)
        .eq('reward_type', 'discount_credit')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString());

      if (error || !credits) return 0;

      return credits.reduce((total, credit) => total + credit.reward_value, 0);
    } catch (error) {
      console.error('Error getting discount credits:', error);
      return 0;
    }
  }
}

export default PointsService;
export { PointsBalance, PointsRedemption, PointsTransaction };
