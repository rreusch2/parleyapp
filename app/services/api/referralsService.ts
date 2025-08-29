import { client } from './client';

export interface ReferralReward {
  id: string;
  reward_name: string;
  reward_description: string;
  points_cost: number;
  reward_type: 'temporary_upgrade' | 'bonus_picks' | 'feature_unlock';
  upgrade_tier?: 'pro' | 'elite';
  duration_hours?: number;
  bonus_picks_count?: number;
  feature_unlocks?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferralPoints {
  available: number;
  pending: number;
  lifetime: number;
}

export interface TemporaryUpgrade {
  tier: string;
  expiresAt: string;
}

export interface UserSubscription {
  baseTier: string;
  effectiveTier: string;
  temporaryUpgrade?: TemporaryUpgrade;
}

export interface ActiveClaim {
  id: string;
  reward_id: string;
  points_spent: number;
  claimed_at: string;
  expires_at?: string;
  is_active: boolean;
  original_tier?: string;
  metadata?: any;
  referral_rewards: {
    reward_name: string;
    reward_description: string;
    upgrade_tier?: string;
    duration_hours?: number;
  };
}

export interface ReferralStatus {
  referralCode: string;
  points: ReferralPoints;
  subscription: UserSubscription;
  activeClaims: ActiveClaim[];
}

export interface ReferralStats {
  totalReferrals: number;
  recentClaims: Array<{
    id: string;
    claimed_at: string;
    points_spent: number;
    referral_rewards: {
      reward_name: string;
      points_cost: number;
    };
  }>;
}

export interface ClaimRewardResponse {
  success: boolean;
  message: string;
  claim?: ActiveClaim;
  newPointsBalance?: number;
  error?: string;
  required?: number;
  available?: number;
}

class ReferralsService {
  async getRewards(): Promise<{ success: boolean; rewards?: ReferralReward[]; error?: string }> {
    try {
      const response = await client.get('/api/referrals/rewards');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get rewards:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to load rewards'
      };
    }
  }

  async getReferralStatus(): Promise<{ success: boolean; data?: ReferralStatus; error?: string }> {
    try {
      const response = await client.get('/api/referrals/status');
      if (response.data.success) {
        return {
          success: true,
          data: {
            referralCode: response.data.referralCode,
            points: response.data.points,
            subscription: response.data.subscription,
            activeClaims: response.data.activeClaims
          }
        };
      }
      return { success: false, error: response.data.error };
    } catch (error: any) {
      console.error('Failed to get referral status:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to load referral status'
      };
    }
  }

  async claimReward(rewardId: string): Promise<ClaimRewardResponse> {
    try {
      const response = await client.post('/api/referrals/claim-reward', { rewardId });
      return response.data;
    } catch (error: any) {
      console.error('Failed to claim reward:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to claim reward',
        required: error.response?.data?.required,
        available: error.response?.data?.available
      };
    }
  }

  async getReferralStats(): Promise<{ success: boolean; stats?: ReferralStats; error?: string }> {
    try {
      const response = await client.get('/api/referrals/stats');
      if (response.data.success) {
        return {
          success: true,
          stats: response.data.stats
        };
      }
      return { success: false, error: response.data.error };
    } catch (error: any) {
      console.error('Failed to get referral stats:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to load referral stats'
      };
    }
  }

  // Helper methods for frontend logic
  formatTimeRemaining(expiresAt: string): string {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }

  getTierColor(tier: string): string {
    switch (tier.toLowerCase()) {
      case 'pro': return '#3B82F6'; // Blue
      case 'elite': return '#F59E0B'; // Amber
      default: return '#6B7280'; // Gray
    }
  }

  getTierDisplayName(tier: string): string {
    switch (tier.toLowerCase()) {
      case 'pro': return 'Pro';
      case 'elite': return 'Elite';
      case 'free': return 'Free';
      default: return tier;
    }
  }

  isRewardAffordable(reward: ReferralReward, availablePoints: number): boolean {
    return availablePoints >= reward.points_cost;
  }

  getRewardIcon(rewardType: string): string {
    switch (rewardType) {
      case 'temporary_upgrade': return '⭐';
      case 'bonus_picks': return '🎯';
      case 'feature_unlock': return '🔓';
      default: return '🎁';
    }
  }
}

export const referralsService = new ReferralsService();
