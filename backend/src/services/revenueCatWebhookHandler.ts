import { supabaseAdmin } from '../config/supabase';

interface RevenueCatWebhookEvent {
  api_version: string;
  event: {
    id: string;
    type: string;
    event_timestamp_ms: number;
    app_user_id: string;
    aliases?: string[];
    original_app_user_id?: string;
    product_id?: string;
    period_type?: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    environment?: string;
    presented_offering_id?: string;
    transaction_id?: string;
    original_transaction_id?: string;
    is_family_share?: boolean;
    country_code?: string;
    app_id?: string;
    entitlement_id?: string;
    entitlement_ids?: string[];
  };
}

interface UserSubscriptionUpdate {
  subscription_tier: 'free' | 'pro' | 'elite';
  revenuecat_customer_id?: string;
  subscription_product_id?: string;
  subscription_plan_type?: string;
  subscription_started_at?: string;
  subscription_renewed_at?: string;
  auto_renew_enabled?: boolean;
}

export class RevenueCatWebhookHandler {
  
  /**
   * Main webhook handler - processes all RevenueCat webhook events
   */
  static async handleWebhook(event: RevenueCatWebhookEvent): Promise<void> {
    console.log(`🔔 Processing RevenueCat webhook: ${event.event.type} for user ${event.event.app_user_id}`);
    
    try {
      switch (event.event.type) {
        // Initial purchase events
        case 'INITIAL_PURCHASE':
        case 'NON_RENEWING_PURCHASE':
          await this.handlePurchase(event);
          break;
        
        // Renewal events  
        case 'RENEWAL':
          await this.handleRenewal(event);
          break;
        
        // Cancellation/Expiration events
        case 'CANCELLATION':
          await this.handleCancellation(event);
          break;
        
        case 'EXPIRATION':
          await this.handleExpiration(event);
          break;
        
        // Billing issues
        case 'BILLING_ISSUE':
          await this.handleBillingIssue(event);
          break;
        
        // Refunds
        case 'UNCANCELLATION':
          await this.handleUncancellation(event);
          break;
        
        default:
          console.log(`ℹ️ Unhandled webhook event type: ${event.event.type}`);
          break;
      }
      
      // Log successful processing
      await this.logWebhookEvent(event, 'processed', null);
      
    } catch (error) {
      console.error(`❌ Error processing webhook ${event.event.type}:`, error);
      await this.logWebhookEvent(event, 'error', error.message);
      throw error;
    }
  }

  /**
   * Handle initial purchases and non-renewing purchases
   */
  private static async handlePurchase(event: RevenueCatWebhookEvent): Promise<void> {
    const { app_user_id, product_id, entitlement_ids = [] } = event.event;
    
    // Determine tier from entitlements
    const tier = this.determineTierFromEntitlements(entitlement_ids);
    
    // Handle day passes (non-renewing products)
    if (this.isDayPassProduct(product_id)) {
      await this.grantDayPass(app_user_id, tier);
      return;
    }
    
    // Handle renewable subscriptions
    const updateData: UserSubscriptionUpdate = {
      subscription_tier: tier,
      revenuecat_customer_id: app_user_id,
      subscription_product_id: product_id,
      subscription_plan_type: this.extractPlanType(product_id),
      subscription_started_at: new Date(event.event.purchased_at_ms!).toISOString(),
      auto_renew_enabled: true
    };
    
    await this.updateUserSubscription(app_user_id, updateData);
  }

  /**
   * Handle subscription renewals
   */
  private static async handleRenewal(event: RevenueCatWebhookEvent): Promise<void> {
    const { app_user_id, entitlement_ids = [] } = event.event;
    
    const tier = this.determineTierFromEntitlements(entitlement_ids);
    
    const updateData: UserSubscriptionUpdate = {
      subscription_tier: tier,
      subscription_renewed_at: new Date(event.event.purchased_at_ms!).toISOString(),
      auto_renew_enabled: true
    };
    
    await this.updateUserSubscription(app_user_id, updateData);
  }

  /**
   * Handle subscription cancellations
   */
  private static async handleCancellation(event: RevenueCatWebhookEvent): Promise<void> {
    const { app_user_id } = event.event;
    
    // Don't downgrade immediately - subscription remains active until expiration
    const updateData: UserSubscriptionUpdate = {
      subscription_tier: await this.getCurrentTier(app_user_id), // Keep current tier
      auto_renew_enabled: false
    };
    
    await this.updateUserSubscription(app_user_id, updateData);
  }

  /**
   * Handle subscription expiration - downgrade to free
   */
  private static async handleExpiration(event: RevenueCatWebhookEvent): Promise<void> {
    const { app_user_id } = event.event;
    
    const updateData: UserSubscriptionUpdate = {
      subscription_tier: 'free',
      auto_renew_enabled: false
    };
    
    await this.updateUserSubscription(app_user_id, updateData);
  }

  /**
   * Handle billing issues - keep subscription active but flag issue
   */
  private static async handleBillingIssue(event: RevenueCatWebhookEvent): Promise<void> {
    const { app_user_id } = event.event;
    
    // Keep current tier but note billing issue
    console.log(`⚠️ Billing issue for user ${app_user_id} - keeping subscription active`);
    
    // Could add a billing_issue_detected column if needed
  }

  /**
   * Handle uncancellation - reactivate subscription
   */
  private static async handleUncancellation(event: RevenueCatWebhookEvent): Promise<void> {
    const { app_user_id, entitlement_ids = [] } = event.event;
    
    const tier = this.determineTierFromEntitlements(entitlement_ids);
    
    const updateData: UserSubscriptionUpdate = {
      subscription_tier: tier,
      auto_renew_enabled: true
    };
    
    await this.updateUserSubscription(app_user_id, updateData);
  }

  /**
   * Grant day pass access for 24 hours
   */
  private static async grantDayPass(userId: string, tier: 'pro' | 'elite'): Promise<void> {
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
   * Update user subscription in database
   */
  private static async updateUserSubscription(userId: string, updateData: UserSubscriptionUpdate): Promise<void> {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      throw new Error(`Failed to update user subscription: ${error.message}`);
    }
    
    console.log(`✅ Updated subscription for user ${userId} to tier: ${updateData.subscription_tier}`);
  }

  /**
   * Determine subscription tier from RevenueCat entitlements
   */
  private static determineTierFromEntitlements(entitlementIds: string[]): 'pro' | 'elite' | 'free' {
    if (entitlementIds.includes('elite')) {
      return 'elite';
    } else if (entitlementIds.includes('predictiveplaypro')) {
      return 'pro';
    }
    return 'free';
  }

  /**
   * Check if product is a day pass (non-renewable)
   */
  private static isDayPassProduct(productId?: string): boolean {
    if (!productId) return false;
    return productId.includes('daypass') || productId.includes('day_pass');
  }

  /**
   * Extract plan type from product ID
   */
  private static extractPlanType(productId?: string): string {
    if (!productId) return 'unknown';
    
    if (productId.includes('weekly') || productId.includes('week')) return 'weekly';
    if (productId.includes('monthly') || productId.includes('month')) return 'monthly';
    if (productId.includes('yearly') || productId.includes('year')) return 'yearly';
    if (productId.includes('lifetime')) return 'lifetime';
    if (productId.includes('daypass') || productId.includes('day')) return 'daypass';
    
    return 'unknown';
  }

  /**
   * Get current subscription tier for user
   */
  private static async getCurrentTier(userId: string): Promise<'pro' | 'elite' | 'free'> {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      return 'free';
    }
    
    return data.subscription_tier as 'pro' | 'elite' | 'free';
  }

  /**
   * Log webhook event for debugging and audit purposes
   */
  private static async logWebhookEvent(event: RevenueCatWebhookEvent, status: string, errorMessage?: string): Promise<void> {
    try {
      // You can create a webhook_logs table if needed for debugging
      console.log(`📝 Webhook ${event.event.id} ${status}:`, {
        type: event.event.type,
        user: event.event.app_user_id,
        product: event.event.product_id,
        error: errorMessage
      });
    } catch (error) {
      console.error('Failed to log webhook event:', error);
    }
  }
}
