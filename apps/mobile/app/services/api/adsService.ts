import { supabase } from './supabaseClient';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';

export type AdRewardStatus = {
  usedClientCounter: number;
  usedAuditCount: number;
  remaining: number;
  dailyLimit: number;
};

export const adsService = {
  async getAuthToken(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    } catch (e) {
      console.warn('adsService.getAuthToken error', e);
      return null;
    }
  },

  async getRewardStatus(): Promise<AdRewardStatus | null> {
    try {
      const token = await this.getAuthToken();
      if (!token) return null;
      const res = await fetch(`${BASE_URL}/api/ads/reward/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data || null;
    } catch (e) {
      console.warn('adsService.getRewardStatus error', e);
      return null;
    }
  },

  async grantExtraPick(options?: { adUnitId?: string; transactionId?: string; rewardItem?: string; rewardAmount?: number; }): Promise<{ success: boolean; message?: string; remaining?: number; }>{
    try {
      const token = await this.getAuthToken();
      if (!token) return { success: false, message: 'Not authenticated' };

      const body = {
        ad_unit_id: options?.adUnitId || 'NOT_USED',
        transaction_id: options?.transactionId || null,
        reward_item: options?.rewardItem || 'extra_pick',
        reward_amount: options?.rewardAmount || 1,
      };

      const res = await fetch(`${BASE_URL}/api/ads/reward/grant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const json = await res.json();
      if (res.ok && json?.success) {
        return { success: true, remaining: json?.adRewardsRemaining, message: json?.message };
      }
      return { success: false, message: json?.error || 'Failed to grant extra pick' };
    } catch (e) {
      console.warn('adsService.grantExtraPick error', e);
      return { success: false, message: 'Network error' };
    }
  }
};
