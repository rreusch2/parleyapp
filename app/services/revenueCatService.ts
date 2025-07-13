import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  PurchasesError,
  PURCHASE_TYPE,
  PACKAGE_TYPE,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform, Alert } from 'react-native';
import { supabase } from './api/supabaseClient';

import Constants from 'expo-constants';

// RevenueCat API Keys - You'll need to set these up in RevenueCat dashboard
const REVENUECAT_API_KEY = Platform.select({
  ios: Constants.expoConfig?.extra?.revenueCatApiKey || process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || 'your_ios_key_here',
  android: Constants.expoConfig?.extra?.revenueCatApiKey || process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || 'your_android_key_here',
});

// Product identifier mappings
const PRODUCT_IDENTIFIERS = {
  monthly: 'com.parleyapp.premium_monthly',
  yearly: 'com.parleyapp.premiumyearly',
  lifetime: 'com.parleyapp.premium_lifetime',
};

export type SubscriptionPlan = 'monthly' | 'yearly' | 'lifetime';

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
  private packages: SubscriptionPackage[] = [];

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
        observerMode: false,
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
        this.currentOffering = offerings.current;
        
        // Convert packages to our format
        this.packages = this.currentOffering.availablePackages.map(pkg => ({
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
        
        console.log(`✅ Loaded ${this.packages.length} packages:`, 
          this.packages.map(p => `${p.identifier} - ${p.product.priceString}`));
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
      await this.updateUserSubscriptionStatus(customerInfo);

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
    if (!this.currentOffering) {
      return null;
    }

    // Map plan IDs to package types
    const packageTypeMap = {
      monthly: PACKAGE_TYPE.MONTHLY,
      yearly: PACKAGE_TYPE.ANNUAL,
      lifetime: PACKAGE_TYPE.LIFETIME,
    };

    // Try to find by package type first
    const packageType = packageTypeMap[planId];
    let targetPackage = this.currentOffering.availablePackages.find(
      pkg => pkg.packageType === packageType
    );

    // If not found by type, try to find by product identifier
    if (!targetPackage) {
      const productId = PRODUCT_IDENTIFIERS[planId];
      targetPackage = this.currentOffering.availablePackages.find(
        pkg => pkg.product.identifier === productId
      );
    }

    return targetPackage;
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
    
    switch (error.code) {
      case 'PURCHASE_CANCELLED':
        console.log('ℹ️ User cancelled purchase');
        return { success: false, error: 'cancelled' };
      
      case 'STORE_PROBLEM':
        errorMessage = 'App Store connection problem. Please try again.';
        break;
      
      case 'PURCHASE_NOT_ALLOWED':
        errorMessage = 'Purchases are not allowed on this device.';
        break;
      
      case 'PURCHASE_INVALID':
        errorMessage = 'Invalid purchase. Please try again.';
        break;
      
      case 'PRODUCT_NOT_AVAILABLE':
        errorMessage = 'This product is not available. Please try a different plan.';
        break;
      
      case 'NETWORK_ERROR':
        errorMessage = 'Network error. Please check your connection and try again.';
        break;
      
      default:
        errorMessage = error.message || 'An unexpected error occurred.';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }

  /**
   * Update user's subscription status in Supabase
   */
  private async updateUserSubscriptionStatus(customerInfo: CustomerInfo): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🔍 Checking user entitlements:', {
        allEntitlements: Object.keys(customerInfo.entitlements.all),
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
        entitlementDetails: customerInfo.entitlements.active
      });

      // Check if user has active entitlements - try multiple possible entitlement names
      const possibleEntitlements = ["predictiveplaypro", "pro", "premium", "parleyapp_pro"];
      let hasActiveSubscription = false;
      let activeEntitlementName = null;

      for (const entitlementName of possibleEntitlements) {
        const entitlement = customerInfo.entitlements.active[entitlementName];
        if (entitlement?.isActive === true) {
          hasActiveSubscription = true;
          activeEntitlementName = entitlementName;
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
          console.log(`✅ Using first active entitlement: ${activeEntitlementName}`);
        }
      }

      console.log('📊 Subscription status determination:', {
        hasActiveSubscription,
        activeEntitlementName,
        willSetTier: hasActiveSubscription ? 'pro' : 'free'
      });
      
      // Update user profile
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: hasActiveSubscription ? 'pro' : 'free',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('❌ Failed to update user subscription status:', error);
        throw error;
      }

      console.log(`✅ User subscription status updated in Supabase to: ${hasActiveSubscription ? 'pro' : 'free'}`);
      
    } catch (error) {
      console.error('❌ Failed to update subscription status:', error);
      throw error;
    }
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

      const { customerInfo } = await Purchases.restorePurchases();
      
      // Update user's subscription status in Supabase
      await this.updateUserSubscriptionStatus(customerInfo);

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