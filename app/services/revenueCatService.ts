import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  PurchasesError,
  PURCHASE_TYPE,
  PACKAGE_TYPE,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Platform, Alert } from 'react-native';
import { supabase } from './api/supabaseClient';

import Constants from 'expo-constants';

// RevenueCat API Keys - You'll need to set these up in RevenueCat dashboard
const REVENUECAT_API_KEY = Platform.select({
  ios: Constants.expoConfig?.extra?.revenueCatIosApiKey || process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || 'your_ios_key_here',
  android: Constants.expoConfig?.extra?.revenueCatAndroidApiKey || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || 'your_android_key_here',
});

// Product identifier mappings - Platform specific with tiered subscriptions
const PRODUCT_IDENTIFIERS = Platform.select({
  ios: {
    // Pro Tier
    pro_weekly: 'com.parleyapp.premium_weekly',
    pro_monthly: 'com.parleyapp.premium_monthly', 
    pro_yearly: 'com.parleyapp.premiumyearly',
    pro_daypass: 'com.parleyapp.prodaypass',
    pro_lifetime: 'com.parleyapp.premium_lifetime',
    // Elite Tier (matching App Store Connect)
    elite_daypass: 'com.parleyapp.elitedaypass',
    elite_weekly: 'com.parleyapp.allstarweekly',
    elite_monthly: 'com.parleyapp.allstarmonthly', 
    elite_yearly: 'com.parleyapp.allstaryearly',
    elite_lifetime: 'com.parleyapp.premium_lifetime',
    // Legacy products (maintain backward compatibility)
    weekly: 'com.parleyapp.premium_weekly',
    monthly: 'com.parleyapp.premium_monthly',
    yearly: 'com.parleyapp.premiumyearly',
    lifetime: 'com.parleyapp.premium_lifetime',
  },
  android: {
    // Pro Tier
    pro_weekly: 'com.parleyapp.pro_weekly:weekly-pro2025',
    pro_monthly: 'com.parleyapp.pro_monthly:monthly-pro2025',
    pro_yearly: 'com.parleyapp.pro_yearly:yearly-pro2025',
    pro_daypass: 'com.parleyapp.prodaypass',
    pro_lifetime: 'com.parleyapp.premium_lifetime',
    // Elite Tier (matching App Store Connect base IDs)
    elite_daypass: 'com.parleyapp.elitedaypass',
    elite_weekly: 'com.parleyapp.allstarweekly:weekly-elite2025',
    elite_monthly: 'com.parleyapp.allstarmonthly:monthly-elite2025',
    elite_yearly: 'com.parleyapp.allstaryearly:yearly-elite2025',
    elite_lifetime: 'com.parleyapp.premium_lifetime',
    // Legacy products (maintain backward compatibility)
    weekly: 'com.parleyapp.premium_weekly:weekly-pro2025',
    monthly: 'com.parleyapp.premium_monthly:monthly-pro2025',
    yearly: 'com.parleyapp.premiumyearly:yearly-pro2025',
    lifetime: 'com.parleyapp.premium_lifetime',
  },
}) as { [key: string]: string };

// Subscription tiers and plans
export type SubscriptionTier = 'free' | 'pro' | 'elite';
export type SubscriptionPlan = 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'pro_weekly' | 'pro_monthly' | 'pro_yearly' | 'pro_daypass' | 'pro_lifetime' | 'elite_daypass' | 'elite_weekly' | 'elite_monthly' | 'elite_yearly' | 'elite_lifetime';

// Tier configuration
export const SUBSCRIPTION_TIERS = {
  free: { 
    picks: 2, 
    insights: 2, 
    chatMessages: 3,
    playOfTheDay: false,
    advancedProfessorLock: false
  },
  pro: { 
    picks: 20, 
    insights: 8, 
    chatMessages: 'unlimited' as const,
    playOfTheDay: true,
    advancedProfessorLock: false,
    pricing: { weekly: 12.49, monthly: 24.99, yearly: 149.99, daypass: 6.49, lifetime: 349.99 }
  },
  elite: { 
    picks: 30, 
    insights: 12, 
    chatMessages: 'unlimited' as const,
    playOfTheDay: true,
    advancedProfessorLock: true,
    pricing: { daypass: 8.99, weekly: 14.99, monthly: 29.99, yearly: 199.99, lifetime: 399.99 }
  },

};

export interface PurchaseResult {
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}

export interface SubscriptionPackage {
  identifier: string;
  packageType: PACKAGE_TYPE;
  product: {
    identifier: string;
    description: string;
    title: string;
    price: number;
    priceString: string;
    currencyCode: string;
  };
}

class RevenueCatService {
  private isInitialized = false;
  private currentOffering: PurchasesOffering | null = null;
  /**
   * Packages transformed for UI display (lightweight)
   */
  private packages: SubscriptionPackage[] = [];
  /**
   * Raw RevenueCat package objects used for purchasing.
   * We keep these separate so we always pass the correct object shape back to
   * react-native-purchases when calling `purchasePackage`.
   */
  private rcPackages: PurchasesPackage[] = [];

  /**
   * Initialize RevenueCat SDK
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ RevenueCat already initialized');
      return;
    }

    try {
      console.log('🔄 Initializing RevenueCat...');
      
      if (!REVENUECAT_API_KEY) {
        throw new Error('RevenueCat API key not configured');
      }

      // Configure RevenueCat
      await Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
        appUserID: undefined, // Will be set when user logs in

        userDefaultsSuiteName: undefined,
        useAmazon: false,
        shouldShowInAppMessagesAutomatically: true,
      });

      // Set log level for debugging
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      console.log('✅ RevenueCat configured successfully');
      
      // Set up user ID if user is already logged in
      await this.setUserID();
      
      // Load offerings
      await this.loadOfferings();
      
      this.isInitialized = true;
      console.log('🎉 RevenueCat initialization complete');
      
    } catch (error) {
      console.error('❌ Failed to initialize RevenueCat:', error);
      throw error;
    }
  }

  /**
   * Set user ID for RevenueCat
   */
  async setUserID(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await Purchases.logIn(user.id);
        console.log('👤 RevenueCat user ID set:', user.id);
        // Sync subscriber attributes (email, display name, tier, etc.)
        await this.syncSubscriberAttributes();
      }
    } catch (error) {
      console.error('⚠️ Failed to set RevenueCat user ID:', error);
      // Non-fatal error, continue without user ID
    }
  }

  /**
   * Load available offerings from RevenueCat
   */
  async loadOfferings(): Promise<void> {
    try {
      console.log('📦 Loading RevenueCat offerings...');
      
      const offerings = await Purchases.getOfferings();
      
      if (offerings.current) {
        console.log('✅ Found default offering:', offerings.current.identifier);
        this.currentOffering = offerings.current;
        
        // Save raw RevenueCat package objects for purchasing
        this.rcPackages = this.currentOffering.availablePackages;

        // Create lightweight copies for UI display purposes only
        this.packages = this.rcPackages.map(pkg => ({
          identifier: pkg.identifier,
          packageType: pkg.packageType,
          product: {
            identifier: pkg.product.identifier,
            description: pkg.product.description,
            title: pkg.product.title,
            price: pkg.product.price,
            priceString: pkg.product.priceString,
            currencyCode: pkg.product.currencyCode,
          },
        }));

        console.log(`✅ Loaded ${this.rcPackages.length} raw packages total:`);
        this.rcPackages.forEach(p => console.log(`   • ${p.identifier} → ${p.product.identifier}`));
      } else {
        console.warn('⚠️ No current offering found');
        this.currentOffering = null;
        this.packages = [];
      }
      
    } catch (error) {
      console.error('❌ Failed to load offerings:', error);
      throw error;
    }
  }

  /**
   * Purchase a subscription package
   */
  async purchasePackage(planId: SubscriptionPlan): Promise<PurchaseResult> {
    try {
      console.log('🛒 Starting purchase for plan:', planId);
      
      if (!this.isInitialized) {
        console.log('🔄 RevenueCat not initialized, initializing now...');
        await this.initialize();
      }

      // Find the package for this plan
      const targetPackage = this.findPackageForPlan(planId);
      if (!targetPackage) {
        console.error('❌ No package found for plan:', planId);
        console.log('📦 Available packages:', this.currentOffering?.availablePackages.map(pkg => ({
          identifier: pkg.identifier,
          packageType: pkg.packageType,
          productId: pkg.product.identifier
        })));
        
        throw new Error(`No package found for plan: ${planId}`);
      }

      console.log('📦 Found package:', {
        identifier: targetPackage.identifier,
        packageType: targetPackage.packageType,
        productId: targetPackage.product.identifier,
        price: targetPackage.product.priceString
      });

      // Make the purchase
      console.log('💳 Attempting to purchase package...');
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(targetPackage);
      
      console.log('✅ Purchase successful!', {
        productIdentifier,
        entitlements: Object.keys(customerInfo.entitlements.active),
        activeEntitlements: customerInfo.entitlements.active,
        originalAppUserId: customerInfo.originalAppUserId
      });

      // Update user's subscription status in Supabase
      console.log('🔄 Updating user subscription status in Supabase...');
      await this.updateUserSubscriptionStatus(customerInfo, planId);

      // Sync attributes to RevenueCat for better customer context
      await this.syncSubscriberAttributes();

      return {
        success: true,
        customerInfo,
      };

    } catch (error: any) {
      console.error('❌ Purchase failed:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        code: error?.code,
        underlyingErrorMessage: error?.underlyingErrorMessage,
        type: typeof error,
        constructor: error?.constructor?.name
      });
      
      // Handle specific RevenueCat errors
      if (error && typeof error === 'object' && error.code) {
        return this.handlePurchaseError(error);
      }
      
      // Handle generic errors
      return {
        success: false,
        error: error?.message || error?.toString() || 'Purchase failed',
      };
    }
  }

  /**
   * Find the correct package for a subscription plan
   */
  private findPackageForPlan(planId: SubscriptionPlan): any {
    if (!this.rcPackages || this.rcPackages.length === 0) {
      console.log('⚠️ No packages available to search');
      return null;
    }

    // Map plan IDs to package types
    const packageTypeMap = {
      weekly: PACKAGE_TYPE.WEEKLY,
      monthly: PACKAGE_TYPE.MONTHLY,
      yearly: PACKAGE_TYPE.ANNUAL,
      lifetime: PACKAGE_TYPE.LIFETIME,
      pro_weekly: PACKAGE_TYPE.WEEKLY,
      pro_monthly: PACKAGE_TYPE.MONTHLY,
      pro_yearly: PACKAGE_TYPE.ANNUAL,
      pro_daypass: PACKAGE_TYPE.UNKNOWN,
      elite_weekly: PACKAGE_TYPE.WEEKLY,
      elite_monthly: PACKAGE_TYPE.MONTHLY,
      elite_yearly: PACKAGE_TYPE.ANNUAL,
    };

    console.log('🔍 Finding package for plan:', planId);
    
    // Try to find by direct product identifier first (most reliable)
    const productId = PRODUCT_IDENTIFIERS[planId];
    console.log('🔍 Looking for product ID:', productId);
    
    if (productId) {
      // Search in the combined packages list
      const foundPackage = this.rcPackages.find(pkg => pkg.product.identifier === productId);
      if (foundPackage) {
        console.log('✅ Found package by product ID');
        return foundPackage;
      }
    }
    
    // If not found by direct ID, try using package type
    const packageType = packageTypeMap[planId];
    if (packageType && this.currentOffering) {
      console.log('🔍 Looking for package type:', packageType);
      
      // Check if this is a pro or elite plan
      const isElitePlan = planId.startsWith('elite_');
      const isProPlan = planId.startsWith('pro_') || (!planId.startsWith('elite_') && !planId.startsWith('pro_'));
      
      // Filter packages based on plan type
      const targetPackage = this.rcPackages.find(pkg => {
        if (pkg.packageType !== packageType) return false;
        
        const productId = pkg.product.identifier;
        if (isElitePlan && productId.includes('allstar')) return true;
        if (isProPlan && !productId.includes('allstar')) return true;
        return false;
      });
      
      if (targetPackage) {
        console.log('✅ Found package by type and plan category');
        return targetPackage;
      }
    }

    console.log('❌ No package found for plan:', planId);
    return null;
  }

  /**
   * Handle purchase errors
   */
  private handlePurchaseError(error: PurchasesError): PurchaseResult {
    console.error('RevenueCat Purchase Error:', {
      code: error.code,
      message: error.message,
      underlyingErrorMessage: error.underlyingErrorMessage,
    });

    let errorMessage = 'Purchase failed. Please try again.';
    const errorCode = error.code;

    if (errorCode === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      console.log('ℹ️ User cancelled purchase');
      return { success: false, error: 'cancelled' };
    } else if (errorCode === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR) {
      errorMessage = 'App Store connection problem. Please try again.';
    } else if (errorCode === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR) {
      errorMessage = 'Purchases are not allowed on this device.';
    } else if (errorCode === PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR) {
      errorMessage = 'Invalid purchase. Please try again.';
    } else if (errorCode === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR) {
      errorMessage = 'This product is not available. Please try a different plan.';
    } else if (errorCode === PURCHASES_ERROR_CODE.NETWORK_ERROR) {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else if (errorCode === PURCHASES_ERROR_CODE.RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR) {
        errorMessage = 'This receipt is already in use by another account.';
    } else {
      errorMessage = error.message || 'An unexpected error occurred.';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Update user's subscription status in Supabase with detailed plan information
   */
  private async updateUserSubscriptionStatus(customerInfo: CustomerInfo, planId?: SubscriptionPlan): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🔍 Checking user entitlements:', {
        allEntitlements: Object.keys(customerInfo.entitlements.all),
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        entitlementDetails: customerInfo.entitlements.active,
        originalAppUserId: customerInfo.originalAppUserId,
        latestExpirationDate: customerInfo.latestExpirationDate
      });

      // Check if user has active entitlements - try multiple possible entitlement names
      const possibleEntitlements = ["predictiveplaypro", "pro", "premium", "parleyapp_pro"];
      let hasActiveSubscription = false;
      let activeEntitlementName = null;
      let activeEntitlement = null;

      for (const entitlementName of possibleEntitlements) {
        const entitlement = customerInfo.entitlements.active[entitlementName];
        if (entitlement?.isActive === true) {
          hasActiveSubscription = true;
          activeEntitlementName = entitlementName;
          activeEntitlement = entitlement;
          console.log(`✅ Found active entitlement: ${entitlementName}`);
          break;
        }
      }

      // If no specific entitlement found, check if there are any active entitlements at all
      if (!hasActiveSubscription && Object.keys(customerInfo.entitlements.active).length > 0) {
        console.log('🔍 No specific entitlement found, checking all active entitlements...');
        const firstActiveEntitlement = Object.values(customerInfo.entitlements.active)[0];
        if (firstActiveEntitlement?.isActive === true) {
          hasActiveSubscription = true;
          activeEntitlementName = Object.keys(customerInfo.entitlements.active)[0];
          activeEntitlement = firstActiveEntitlement;
          console.log(`✅ Using first active entitlement: ${activeEntitlementName}`);
        }
      }

      // If this is a Day Pass purchase, skip client-side DB mutation and let server-side RPC handle it
      if (planId && planId.includes('daypass')) {
        console.log('⏭️ Day Pass detected (planId). Skipping client-side DB update; server RPC will persist state.');
        return;
      }

      // Determine subscription plan type from product identifier or planId
      let subscriptionPlanType: string | null = null;
      let subscriptionProductId: string | null = null;
      let subscriptionStatus = hasActiveSubscription ? 'active' : 'inactive';
      let subscriptionExpiresAt: string | null = null;
      let autoRenewEnabled: boolean | null = null;

      if (hasActiveSubscription && activeEntitlement) {
        // Get product identifier from active entitlement
        subscriptionProductId = activeEntitlement.productIdentifier;
        // If the product itself is a day pass, let server RPC handle DB writes
        if (subscriptionProductId && subscriptionProductId.includes('daypass')) {
          console.log('⏭️ Day Pass detected (productId). Skipping client-side DB update; server RPC will persist state.');
          return;
        }
        
        // Map product ID to plan type
        const productToPlanMap: { [key: string]: string } = {
          'com.parleyapp.premium_weekly': 'weekly',
          'com.parleyapp.premium_monthly': 'monthly', 
          'com.parleyapp.premiumyearly': 'yearly',
          'com.parleyapp.premium_lifetime': 'lifetime'
        };
        
        subscriptionPlanType = productToPlanMap[subscriptionProductId] || null;
        
        // Use planId if provided (from purchase flow) - extract the base plan type
        if (planId && !subscriptionPlanType) {
          // Extract the base plan type from planId (e.g., "elite_weekly" -> "weekly")
          if (planId.includes('weekly')) {
            subscriptionPlanType = 'weekly';
          } else if (planId.includes('monthly')) {
            subscriptionPlanType = 'monthly';
          } else if (planId.includes('yearly')) {
            subscriptionPlanType = 'yearly';
          } else if (planId.includes('lifetime')) {
            subscriptionPlanType = 'lifetime';
          } else if (planId.includes('daypass')) {
            // Day pass handled by server RPC
            subscriptionPlanType = 'daypass';
          }
        }
        
        // Set expiration date
        if (activeEntitlement.expirationDate) {
          subscriptionExpiresAt = activeEntitlement.expirationDate;
        } else if (customerInfo.latestExpirationDate) {
          subscriptionExpiresAt = customerInfo.latestExpirationDate;
        }
        
        // Check auto-renew status (lifetime subscriptions don't auto-renew)
        autoRenewEnabled = subscriptionPlanType !== 'lifetime';
        
        console.log('📊 Subscription details extracted:', {
          planType: subscriptionPlanType,
          productId: subscriptionProductId,
          expiresAt: subscriptionExpiresAt,
          autoRenew: autoRenewEnabled
        });
      }

      // Determine subscription tier based on product ID - FIXED Elite detection
      // CRITICAL: Only update tier if we have active subscription, otherwise preserve existing tier
      let subscriptionTier: string | null = null;
      let maxDailyPicks: number | null = null;
      
      if (hasActiveSubscription && subscriptionProductId) {
        // Check if it's an Elite subscription (contains 'allstar') or Elite Day Pass product ID
        if (subscriptionProductId.includes('allstar') || subscriptionProductId === 'com.parleyapp.elitedaypass') {
          subscriptionTier = 'elite';
          maxDailyPicks = 30;
        } else {
          // All other active subscriptions are Pro
          subscriptionTier = 'pro';
          maxDailyPicks = 20;
        }
      }
      
      console.log('📊 Subscription status determination:', {
        hasActiveSubscription,
        activeEntitlementName,
        subscriptionPlanType,
        subscriptionProductId,
        detectedTier: subscriptionTier,
        maxDailyPicks,
        willUpdateTier: subscriptionTier !== null
      });
      
      // Prepare update data - ONLY update tier if we detected one, otherwise preserve existing
      const updateData: any = {
        subscription_status: subscriptionStatus,
        subscription_expires_at: subscriptionExpiresAt,
        revenuecat_customer_id: customerInfo.originalAppUserId,
        updated_at: new Date().toISOString(),
      };
      
      // Only update tier and picks if we have active subscription
      if (subscriptionTier !== null) {
        updateData.subscription_tier = subscriptionTier;
        updateData.max_daily_picks = maxDailyPicks;
      }
      
      // Only update plan-specific fields if we have an active subscription
      if (hasActiveSubscription) {
        updateData.subscription_plan_type = subscriptionPlanType;
        updateData.subscription_product_id = subscriptionProductId;
        updateData.auto_renew_enabled = autoRenewEnabled;
        updateData.subscription_renewed_at = new Date().toISOString();
        
        // Set subscription_started_at only if it's a new subscription
        // (we'll check if the user was previously free tier)
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_started_at')
          .eq('id', user.id)
          .single();
          
        if (currentProfile?.subscription_tier === 'free' || !currentProfile?.subscription_started_at) {
          updateData.subscription_started_at = new Date().toISOString();
        }
      } else {
        // Clear subscription-specific fields when downgrading to free
        updateData.subscription_plan_type = null;
        updateData.subscription_product_id = null;
        updateData.auto_renew_enabled = null;
      }
      
      // Update user profile
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        console.error('❌ Failed to update user subscription status:', error);
        throw error;
      }

      console.log(`✅ User subscription status updated in Supabase:`, {
        tierUpdated: subscriptionTier !== null,
        tier: subscriptionTier || '(preserved existing)',
        planType: subscriptionPlanType,
        productId: subscriptionProductId,
        expiresAt: subscriptionExpiresAt
      });
    } catch (error) {
      console.error('❌ Failed to update subscription status:', error);
      throw error;
    }
  }

  /**
   * Sync user info to RevenueCat subscriber attributes
   * - Reserved keys: $email, $displayName, $phoneNumber
   * - Custom keys: subscription_tier, subscription_plan_type, referral_code, trial_used,
   *                sport_preferences, app_version, platform
   */
  private async syncSubscriberAttributes(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile fields
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, phone_number, referral_code, trial_used, sport_preferences, subscription_tier, subscription_plan_type')
        .eq('id', user.id)
        .single();

      const attributes: Record<string, string> = {};

      // Reserved attributes
      if (user.email) attributes['$email'] = String(user.email);
      if (profile?.username) attributes['$displayName'] = String(profile.username);
      else if (user.email) attributes['$displayName'] = String(user.email);
      if (profile?.phone_number) attributes['$phoneNumber'] = String(profile.phone_number);

      // Custom attributes
      if (profile?.subscription_tier) attributes['subscription_tier'] = String(profile.subscription_tier);
      if (profile?.subscription_plan_type) attributes['subscription_plan_type'] = String(profile.subscription_plan_type);
      if (profile?.referral_code) attributes['referral_code'] = String(profile.referral_code);
      if (typeof profile?.trial_used !== 'undefined' && profile?.trial_used !== null) attributes['trial_used'] = String(!!profile.trial_used);
      if (profile?.sport_preferences) {
        try {
          const sp = typeof profile.sport_preferences === 'string' ? profile.sport_preferences : JSON.stringify(profile.sport_preferences);
          if (sp && sp.length <= 500) attributes['sport_preferences'] = sp; // keep small
        } catch {}
      }

      // App context
      try {
        const appVersion = (Constants as any)?.expoConfig?.version || (Constants as any)?.manifest2?.version;
        const platform = Platform.OS;
        if (appVersion) attributes['app_version'] = String(appVersion);
        if (platform) attributes['platform'] = String(platform);
      } catch {}

      if (Object.keys(attributes).length === 0) return;

      await Purchases.setAttributes(attributes);
      console.log('📬 Synced RevenueCat subscriber attributes:', attributes);
    } catch (err) {
      console.warn('⚠️ Failed to sync RevenueCat attributes:', err);
    }
  }

  /**
   * Public helper to refresh attributes on-demand (e.g., after settings save)
   */
  public async refreshSubscriberAttributes(): Promise<void> {
    await this.syncSubscriberAttributes();
  }

  /**
   * Get customer info (subscription status)
   */
  async getCustomerInfo(): Promise<CustomerInfo> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const customerInfo = await Purchases.getCustomerInfo();
      console.log('📊 Customer info:', {
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        originalAppUserId: customerInfo.originalAppUserId,
      });

      return customerInfo;
    } catch (error) {
      console.error('❌ Failed to get customer info:', error);
      throw error;
    }
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      
      console.log('🔍 Checking for active subscription:', {
        allEntitlements: Object.keys(customerInfo.entitlements.all),
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        entitlementDetails: customerInfo.entitlements.active
      });

      // Check if user has active entitlements - try multiple possible entitlement names
      const possibleEntitlements = ["predictiveplaypro", "pro", "premium", "parleyapp_pro"];
      
      for (const entitlementName of possibleEntitlements) {
        const entitlement = customerInfo.entitlements.active[entitlementName];
        if (entitlement?.isActive === true) {
          console.log(`✅ Found active subscription via entitlement: ${entitlementName}`);
          return true;
        }
      }

      // If no specific entitlement found, check if there are any active entitlements at all
      if (Object.keys(customerInfo.entitlements.active).length > 0) {
        console.log('🔍 No specific entitlement found, checking all active entitlements...');
        const firstActiveEntitlement = Object.values(customerInfo.entitlements.active)[0];
        if (firstActiveEntitlement?.isActive === true) {
          const entitlementName = Object.keys(customerInfo.entitlements.active)[0];
          console.log(`✅ Found active subscription via first entitlement: ${entitlementName}`);
          return true;
        }
      }

      console.log('ℹ️ No active subscription found');
      return false;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(): Promise<PurchaseResult> {
    try {
      console.log('🔄 Restoring purchases...');
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      const customerInfo = await Purchases.restorePurchases();
      
      // Update user's subscription status in Supabase
      await this.updateUserSubscriptionStatus(customerInfo);

      // Sync attributes after restore in case profile changed
      await this.syncSubscriberAttributes();

      const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;
      
      if (hasActiveSubscription) {
        Alert.alert(
          'Purchases Restored',
          'Your previous purchases have been restored successfully.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases were found for this account.',
          [{ text: 'OK' }]
        );
      }

      return {
        success: true,
        customerInfo,
      };

    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      
      Alert.alert(
        'Restore Failed',
        'Could not restore purchases. Please try again.',
        [{ text: 'OK' }]
      );

      return {
        success: false,
        error: error.message || 'Restore failed',
      };
    }
  }

  /**
   * Refresh offerings and packages cache (call this after making changes in RC dashboard)
   */
  public async refreshOfferings(): Promise<void> {
    await this.loadOfferings();
  }

  /**
   * Get available packages
   */
  getAvailablePackages(): SubscriptionPackage[] {
    return this.packages;
  }

  /**
   * Get package by plan ID
   */
  getPackageByPlan(planId: SubscriptionPlan): SubscriptionPackage | null {
    // Try to find by matching product identifier
    const productId = PRODUCT_IDENTIFIERS[planId];
    return this.packages.find(pkg => pkg.product.identifier === productId) || null;
  }

  /**
   * Debug method to log all subscription info
   */
  async debugSubscriptionStatus(): Promise<void> {
    try {
      console.log('🔍 DEBUG: Starting subscription status check...');
      
      if (!this.isInitialized) {
        console.log('🔄 RevenueCat not initialized, initializing...');
        await this.initialize();
      }

      const customerInfo = await this.getCustomerInfo();
      
      console.log('📊 DEBUG: Full customer info:', {
        originalAppUserId: customerInfo.originalAppUserId,
        firstSeen: customerInfo.firstSeen,
        allEntitlements: Object.keys(customerInfo.entitlements.all),
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        entitlementDetails: customerInfo.entitlements.active,
        allPurchases: Object.keys(customerInfo.allPurchasedProductIdentifiers || {}),
        latestExpirationDate: customerInfo.latestExpirationDate,
        managementURL: customerInfo.managementURL,
        requestDate: customerInfo.requestDate
      });

      console.log('📦 DEBUG: Available packages:', this.packages.map(pkg => ({
        identifier: pkg.identifier,
        packageType: pkg.packageType,
        productId: pkg.product.identifier,
        price: pkg.product.priceString
      })));

      console.log('🎯 DEBUG: Current offering:', {
        identifier: this.currentOffering?.identifier,
        serverDescription: this.currentOffering?.serverDescription,
        packagesCount: this.currentOffering?.availablePackages.length || 0
      });

      const hasActive = await this.hasActiveSubscription();
      console.log('✅ DEBUG: Has active subscription:', hasActive);
      
    } catch (error) {
      console.error('❌ DEBUG: Error checking subscription status:', error);
    }
  }

  /**
   * Logout user from RevenueCat
   */
  async logout(): Promise<void> {
    try {
      await Purchases.logOut();
      console.log('👋 User logged out from RevenueCat');
    } catch (error) {
      console.error('❌ Failed to logout from RevenueCat:', error);
    }
  }
}

// Export singleton instance
export const revenueCatService = new RevenueCatService();
export default revenueCatService; 