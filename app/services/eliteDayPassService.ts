import { supabase } from './api/supabaseClient';
import revenueCatService from './revenueCatService';

export interface EliteDayPassResult {
  success: boolean;
  expiresAt?: string;
  error?: string;
}

class EliteDayPassService {
  /**
   * Purchase and activate Elite Day Pass (24-hour Elite tier access)
   */
  async purchaseEliteDayPass(userId: string): Promise<EliteDayPassResult> {
    try {
      // First, attempt the RevenueCat purchase
      const purchaseResult = await revenueCatService.purchasePackage('elite_daypass');
      
      if (!purchaseResult.success) {
        return {
          success: false,
          error: purchaseResult.error || 'Purchase failed'
        };
      }

      // RevenueCat service updates the DB for day pass. Read back expiration from profile.
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_expires_at')
        .eq('id', userId)
        .single();

      const expiresAt = profile?.subscription_expires_at || new Date(Date.now() + 24*60*60*1000).toISOString();

      return {
        success: true,
        expiresAt,
      };

    } catch (error) {
      console.error('Elite Day Pass purchase error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Check if user has an active Elite Day Pass
   */
  async checkEliteDayPassStatus(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('check_elite_daypass_status', { user_id_param: userId });

      if (error) {
        console.error('Elite Day Pass status check error:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Elite Day Pass status check error:', error);
      return false;
    }
  }

  /**
   * Get Elite Day Pass expiration time for user
   */
  async getEliteDayPassExpiration(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('temporary_tier_expires_at')
        .eq('id', userId)
        .eq('temporary_tier', 'elite')
        .eq('temporary_tier_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return data.temporary_tier_expires_at;
    } catch (error) {
      console.error('Elite Day Pass expiration check error:', error);
      return null;
    }
  }

  /**
   * Format remaining time for Elite Day Pass
   */
  formatRemainingTime(expiresAt: string): string {
    const now = new Date();
    const expiration = new Date(expiresAt);
    const remainingMs = expiration.getTime() - now.getTime();

    if (remainingMs <= 0) {
      return 'Expired';
    }

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }
}

export default new EliteDayPassService();
