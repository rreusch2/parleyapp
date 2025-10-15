import { supabase } from './api/supabaseClient';

export interface SubscriptionStatus {
  isActive: boolean;
  isPro: boolean;
  tier: 'free' | 'pro_monthly' | 'pro_yearly' | 'pro_lifetime';
  status: 'active' | 'inactive' | 'cancelled' | 'expired' | 'past_due';
  expiresAt: Date | null;
  daysRemaining: number | null;
  isLifetime: boolean;
}

class SubscriptionCheckerService {
  private currentStatus: SubscriptionStatus | null = null;
  private lastChecked: Date | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Auto-refresh subscription status every 5 minutes
    this.startPeriodicCheck();
  }

  /**
   * Get current user's subscription status
   */
  async getSubscriptionStatus(forceRefresh = false): Promise<SubscriptionStatus> {
    // Use cached status if available and not forcing refresh
    if (this.currentStatus && !forceRefresh && this.isRecentCheck()) {
      return this.currentStatus;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.warn('⚠️ User not authenticated for subscription check');
        return this.createDefaultStatus();
      }

      // Get user profile with subscription info
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, subscription_expires_at')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.warn('⚠️ Could not fetch user profile:', profileError);
        return this.createDefaultStatus();
      }

      const status = this.parseSubscriptionData(profile);
      this.currentStatus = status;
      this.lastChecked = new Date();

      console.log('🔍 Subscription status checked:', {
        tier: status.tier,
        isActive: status.isActive,
        daysRemaining: status.daysRemaining
      });

      return status;
    } catch (error) {
      console.error('❌ Error checking subscription status:', error);
      return this.createDefaultStatus();
    }
  }

  /**
   * Check if user has an active Pro subscription
   */
  async isPro(forceRefresh = false): Promise<boolean> {
    const status = await this.getSubscriptionStatus(forceRefresh);
    return status.isPro;
  }

  /**
   * Check if user can access Pro features
   */
  async canAccessProFeatures(): Promise<boolean> {
    return await this.isPro();
  }

  /**
   * Get subscription tier
   */
  async getSubscriptionTier(): Promise<string> {
    const status = await this.getSubscriptionStatus();
    return status.tier;
  }

  /**
   * Force refresh subscription status from database
   */
  async refreshStatus(): Promise<SubscriptionStatus> {
    return await this.getSubscriptionStatus(true);
  }

  /**
   * Listen for subscription changes (for real-time updates)
   */
  subscribeToChanges(callback: (status: SubscriptionStatus) => void): () => void {
    const checkForChanges = async () => {
      const newStatus = await this.getSubscriptionStatus(true);
      
      // Compare with current status
      if (!this.currentStatus || this.hasStatusChanged(this.currentStatus, newStatus)) {
        callback(newStatus);
      }
    };

    // Check immediately
    checkForChanges();

    // Set up periodic checks every 30 seconds
    const interval = setInterval(checkForChanges, 30000);

    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  }

  private parseSubscriptionData(profile: any): SubscriptionStatus {
    const tier = profile.subscription_tier || 'free';
    const status = profile.subscription_status || 'inactive';
    const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    
    const isLifetime = tier === 'pro_lifetime';
    const now = new Date();
    
    let isActive = false;
    let isPro = false;
    let daysRemaining: number | null = null;

    if (isLifetime) {
      // Lifetime subscriptions never expire
      isActive = status === 'active';
      isPro = true;
      daysRemaining = null;
    } else if (tier.startsWith('pro_') && expiresAt) {
      // Time-based subscriptions
      isActive = status === 'active' && expiresAt > now;
      isPro = isActive;
      daysRemaining = isActive ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    } else {
      // Free tier or invalid subscription
      isActive = false;
      isPro = false;
      daysRemaining = null;
    }

    return {
      isActive,
      isPro,
      tier: tier as SubscriptionStatus['tier'],
      status: status as SubscriptionStatus['status'],
      expiresAt,
      daysRemaining,
      isLifetime
    };
  }

  private createDefaultStatus(): SubscriptionStatus {
    return {
      isActive: false,
      isPro: false,
      tier: 'free',
      status: 'inactive',
      expiresAt: null,
      daysRemaining: null,
      isLifetime: false
    };
  }

  private isRecentCheck(): boolean {
    if (!this.lastChecked) return false;
    const now = new Date();
    const timeDiff = now.getTime() - this.lastChecked.getTime();
    return timeDiff < 300000; // 5 minutes
  }

  private hasStatusChanged(old: SubscriptionStatus, newStatus: SubscriptionStatus): boolean {
    return (
      old.isActive !== newStatus.isActive ||
      old.tier !== newStatus.tier ||
      old.status !== newStatus.status ||
      old.daysRemaining !== newStatus.daysRemaining
    );
  }

  private startPeriodicCheck(): void {
    // Check every 5 minutes
    this.checkInterval = setInterval(async () => {
      try {
        await this.getSubscriptionStatus(true);
      } catch (error) {
        console.error('❌ Periodic subscription check failed:', error);
      }
    }, 300000); // 5 minutes
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.currentStatus = null;
    this.lastChecked = null;
  }
}

// Export singleton instance
export const subscriptionChecker = new SubscriptionCheckerService();
export default subscriptionChecker;
