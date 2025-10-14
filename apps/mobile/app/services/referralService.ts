import { supabase } from './api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

interface ReferralData {
  referralCode: string;
  referralCount: number;
  successfulReferrals: number;
  discountActive: boolean;
  discountExpiresAt: string | null;
}

interface ReferralBonus {
  hasBonus: boolean;
  bonusType: 'points' | 'free_trial';
  bonusValue: number;
  description: string;
}

interface PointsBalance {
  totalPoints: number;
  availablePoints: number;
  pendingPoints: number;
  lifetimeEarned: number;
}

interface PointsRedemption {
  id: string;
  type: 'discount' | 'free_month' | 'tier_upgrade';
  pointsCost: number;
  value: number;
  description: string;
}

class ReferralService {
  private static instance: ReferralService;
  private readonly STORAGE_KEY = 'parley_referral_data';

  public static getInstance(): ReferralService {
    if (!ReferralService.instance) {
      ReferralService.instance = new ReferralService();
    }
    return ReferralService.instance;
  }

  /**
   * Generate unique referral code for user
   */
  async generateReferralCode(userId: string): Promise<string> {
    try {
      // Generate unique 6-character code
      const code = this.generateUniqueCode();
      
      // Update user profile with referral code
      const { error } = await supabase
        .from('profiles')
        .update({ referral_code: code })
        .eq('id', userId);

      if (error) throw error;

      return code;
    } catch (error) {
      console.error('Error generating referral code:', error);
      throw error;
    }
  }

  /**
   * Process referral when new user signs up with referral code
   */
  async processReferral(newUserId: string, referralCode: string): Promise<boolean> {
    try {
      // Find the referrer
      const { data: referrer, error: referrerError } = await supabase
        .from('profiles')
        .select('id, referral_code')
        .eq('referral_code', referralCode)
        .single();

      if (referrerError || !referrer) {
        console.log('Invalid referral code:', referralCode);
        return false;
      }

      // Update new user with referrer info
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ referred_by: referralCode })
        .eq('id', newUserId);

      if (updateError) throw updateError;

      // Store referral relationship for tracking
      await this.trackReferralSignup(referrer.id, newUserId, referralCode);

      return true;
    } catch (error) {
      console.error('Error processing referral:', error);
      return false;
    }
  }

  /**
   * Activate referral discount when referred user subscribes to Pro
   */
  async activateReferralReward(referredUserId: string): Promise<void> {
    try {
      // Get the referrer info
      const { data: referredUser, error: userError } = await supabase
        .from('profiles')
        .select('referred_by')
        .eq('id', referredUserId)
        .single();

      if (userError || !referredUser?.referred_by) return;

      // Find and reward the referrer
      const { data: referrer, error: referrerError } = await supabase
        .from('profiles')
        .select('id, referral_code')
        .eq('referral_code', referredUser.referred_by)
        .single();

      if (referrerError || !referrer) return;

      // Activate 25% discount for 30 days
      const discountExpiry = new Date();
      discountExpiry.setDate(discountExpiry.getDate() + 30);

      const { error: rewardError } = await supabase
        .from('profiles')
        .update({
          referral_discount_active: true,
          referral_discount_expires_at: discountExpiry.toISOString()
        })
        .eq('id', referrer.id);

      if (rewardError) throw rewardError;

      // Track successful referral
      await this.trackSuccessfulReferral(referrer.id, referredUserId);

      console.log('✅ Referral reward activated for user:', referrer.id);
    } catch (error) {
      console.error('Error activating referral reward:', error);
    }
  }

  /**
   * Get referral discount pricing for user
   */
  async getReferralPricing(userId: string): Promise<{ hasDiscount: boolean; discountPercent: number; originalPrices: any; discountedPrices: any }> {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('referral_discount_active, referral_discount_expires_at')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return { hasDiscount: false, discountPercent: 0, originalPrices: null, discountedPrices: null };
      }

      const now = new Date();
      const expiresAt = user.referral_discount_expires_at ? new Date(user.referral_discount_expires_at) : null;
      const hasActiveDiscount = user.referral_discount_active && expiresAt && now < expiresAt;

      if (!hasActiveDiscount) {
        // Deactivate expired discount
        if (user.referral_discount_active) {
          await supabase
            .from('profiles')
            .update({ referral_discount_active: false })
            .eq('id', userId);
        }
        return { hasDiscount: false, discountPercent: 0, originalPrices: null, discountedPrices: null };
      }

      // Calculate 25% discount prices
      const originalPrices = {
        weekly: 9.99,
        monthly: 24.99,
        yearly: 199.99,
        lifetime: 349.99
      };

      const discountedPrices = {
        weekly: Math.round((originalPrices.weekly * 0.75) * 100) / 100,
        monthly: Math.round((originalPrices.monthly * 0.75) * 100) / 100,
        yearly: Math.round((originalPrices.yearly * 0.75) * 100) / 100,
        lifetime: Math.round((originalPrices.lifetime * 0.75) * 100) / 100
      };

      return {
        hasDiscount: true,
        discountPercent: 25,
        originalPrices,
        discountedPrices
      };
    } catch (error) {
      console.error('Error getting referral pricing:', error);
      return { hasDiscount: false, discountPercent: 0, originalPrices: null, discountedPrices: null };
    }
  }

  /**
   * Get user's referral stats
   */
  async getReferralStats(userId: string): Promise<ReferralData> {
    try {
      const { data: user, error } = await supabase
        .from('profiles')
        .select('referral_code, referral_discount_active, referral_discount_expires_at')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Count referrals
      const { count: totalReferrals } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('referred_by', user.referral_code || '');

      // Count successful referrals (users who subscribed)
      const { count: successfulReferrals } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('referred_by', user.referral_code || '')
        .neq('subscription_tier', 'free');

      return {
        referralCode: user.referral_code || '',
        referralCount: totalReferrals || 0,
        successfulReferrals: successfulReferrals || 0,
        discountActive: user.referral_discount_active || false,
        discountExpiresAt: user.referral_discount_expires_at
      };
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return {
        referralCode: '',
        referralCount: 0,
        successfulReferrals: 0,
        discountActive: false,
        discountExpiresAt: null
      };
    }
  }

  private generateUniqueCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async trackReferralSignup(referrerId: string, newUserId: string, referralCode: string): Promise<void> {
    // Log referral signup for analytics
    console.log(`📊 Referral signup tracked: ${referralCode} -> ${newUserId}`);
  }

  private async trackSuccessfulReferral(referrerId: string, referredUserId: string): Promise<void> {
    // Log successful referral for analytics
    console.log(`🎉 Successful referral tracked: ${referrerId} -> ${referredUserId}`);
  }
}

export default ReferralService;
