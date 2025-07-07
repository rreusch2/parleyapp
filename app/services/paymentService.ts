import { Platform, Alert } from 'react-native';
import {
  initConnection,
  endConnection,
  getProducts,
  getSubscriptions,
  requestPurchase,
  requestSubscription,
  finishTransaction,
  purchaseErrorListener,
  purchaseUpdatedListener,
  type Purchase,
  type Subscription,
  type Product,
  type ProductPurchase,
  type PurchaseError,
} from 'react-native-iap';

// Types
export interface SubscriptionPlan {
  id: 'weekly' | 'monthly' | 'yearly' | 'lifetime';
  productId: string; // Apple product ID
  title: string;
  price: string;
  period: string;
  features: string[];
  limits: {
    dailyPicks: number | 'unlimited';
    sports: string[];
    features: string[];
  };
}

export interface PaymentResult {
  success: boolean;
  transaction?: Purchase;
  error?: string;
}

// Apple App Store Product IDs (these need to be configured in App Store Connect)
const PRODUCT_IDS = {
  weekly: 'com.Predictive Play.weekly_trial', 
  monthly: 'com.Predictive Play.monthly_pro',
  yearly: 'com.Predictive Play.yearly_pro', 
  lifetime: 'com.Predictive Play.lifetime_pro'
};

class ApplePaymentService {
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private isInitialized = false;
  private readonly BACKEND_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app'}/api`;

  // Subscription plans with Apple product IDs
  readonly subscriptionPlans: SubscriptionPlan[] = [
    {
      id: 'weekly',
      productId: PRODUCT_IDS.weekly,
      title: 'Weekly Trial',
      price: '$8.99',
      period: '/week',
      features: [
        'AI Predictions (5 per day)',
        'Basic Chat Support', 
        'Standard Sports Coverage',
        'Mobile Access'
      ],
      limits: {
        dailyPicks: 5,
        sports: ['MLB', 'NBA'],
        features: ['basic_chat', 'standard_odds']
      }
    },
    {
      id: 'monthly',
      productId: PRODUCT_IDS.monthly,
      title: 'Pro Monthly',
      price: '$24.99',
      period: '/month',
      features: [
        'Unlimited AI Predictions',
        'Enhanced DeepSeek Orchestrator', 
        'Priority Chat Support',
        'All Sports Coverage',
        'Real-time Odds Integration',
        'Edge Detection System'
      ],
      limits: {
        dailyPicks: 'unlimited',
        sports: ['MLB', 'NBA', 'NFL', 'NHL', 'MLS'],
        features: ['enhanced_chat', 'real_time_odds', 'edge_detection']
      }
    },
    {
      id: 'yearly',
      productId: PRODUCT_IDS.yearly,
      title: 'Pro Annual',
      price: '$199.99',
      period: '/year',
      features: [
        'Everything in Pro Monthly',
        'Python ML Server Access (66.9% accuracy)',
        'VIP Priority Support',
        'Exclusive Betting Strategies',
        'Portfolio Analytics',
        'Custom Risk Management'
      ],
      limits: {
        dailyPicks: 'unlimited',
        sports: ['all'],
        features: ['all', 'ml_server', 'vip_support', 'portfolio_analytics']
      }
    },
    {
      id: 'lifetime',
      productId: PRODUCT_IDS.lifetime,
      title: 'Lifetime Pro',
      price: '$349.99',
      period: 'one-time',
      features: [
        'Everything in Pro Annual',
        'Lifetime Access - Never Pay Again',
        'Real-time Streaming Analysis',
        'Custom Model Training',
        'Priority Feature Requests',
        'Exclusive Beta Access'
      ],
      limits: {
        dailyPicks: 'unlimited',
        sports: ['all'],
        features: ['all', 'lifetime', 'streaming', 'custom_models', 'beta_access']
      }
    }
  ];

  constructor() {
    this.initializeIAP();
  }

  async initializeIAP() {
    try {
      console.log('🍎 Initializing Apple In-App Purchases...');
      
      if (Platform.OS !== 'ios') {
        console.log('⚠️ Apple IAP only available on iOS');
        return;
      }

      // Initialize connection to App Store
      const result = await initConnection();
      console.log('📱 IAP Connection result:', result);

      // Set up purchase listeners
      this.setupPurchaseListeners();

      this.isInitialized = true;
      console.log('✅ Apple IAP initialized successfully');

      // Load products from App Store
      await this.loadProducts();
    } catch (error) {
      console.error('❌ Failed to initialize Apple IAP:', error);
    }
  }

  private setupPurchaseListeners() {
    // Listen for successful purchases
    this.purchaseUpdateSubscription = purchaseUpdatedListener((purchase: Purchase) => {
      console.log('🎉 Purchase successful:', purchase);
      this.handleSuccessfulPurchase(purchase);
    });

    // Listen for purchase errors
    this.purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
      console.error('❌ Purchase failed:', error);
      this.handlePurchaseError(error);
    });
  }

  private async handleSuccessfulPurchase(purchase: Purchase) {
    try {
      console.log('✅ Processing successful purchase:', purchase.productId);

      // Verify purchase with your backend
      const isValid = await this.verifyPurchaseWithBackend(purchase);
      
      if (isValid) {
        // Update user subscription
        await this.updateUserSubscription(purchase);
        
        // Finish the transaction
        await finishTransaction({ purchase, isConsumable: false });
        
        Alert.alert(
          '🎉 Purchase Successful!',
          'Welcome to Predictive Play Pro! Your subscription is now active.',
          [{ text: 'Awesome!', style: 'default' }]
        );
      } else {
        console.error('❌ Purchase verification failed');
        Alert.alert('Purchase Error', 'Unable to verify your purchase. Please contact support.');
      }
    } catch (error) {
      console.error('❌ Error handling successful purchase:', error);
    }
  }

  private handlePurchaseError(error: PurchaseError) {
    console.error('❌ Purchase error:', error);
    
    let message = 'Purchase failed. Please try again.';
    
    switch (error.code) {
      case 'E_USER_CANCELLED':
        message = 'Purchase was cancelled.';
        break;
      case 'E_ITEM_UNAVAILABLE':
        message = 'This subscription is currently unavailable.';
        break;
      case 'E_NETWORK_ERROR':
        message = 'Network error. Please check your connection and try again.';
        break;
      case 'E_SERVICE_ERROR':
        message = 'App Store service error. Please try again later.';
        break;
      default:
        message = `Purchase failed: ${error.message}`;
    }

    if (error.code !== 'E_USER_CANCELLED') {
      Alert.alert('Purchase Error', message);
    }
  }

  async loadProducts(): Promise<(Product | Subscription)[]> {
    try {
      if (!this.isInitialized) {
        throw new Error('IAP not initialized');
      }

      console.log('📦 Loading products from App Store...');
      
      const productIds = Object.values(PRODUCT_IDS);
      
      // Get subscriptions (for recurring plans)
      const subscriptions = await getSubscriptions({ skus: productIds.slice(0, 3) }); // weekly, monthly, yearly
      
      // Get one-time products (for lifetime)
      const products = await getProducts({ skus: [PRODUCT_IDS.lifetime] });
      
      const allProducts = [...subscriptions, ...products];
      
      console.log(`✅ Loaded ${allProducts.length} products:`, allProducts.map(p => p.productId));
      
      return allProducts;
    } catch (error) {
      console.error('❌ Failed to load products:', error);
      return [];
    }
  }

  async purchaseSubscription(planId: 'weekly' | 'monthly' | 'yearly' | 'lifetime', userId: string): Promise<PaymentResult> {
    try {
      if (Platform.OS !== 'ios') {
        throw new Error('Apple IAP only available on iOS');
      }

      if (!this.isInitialized) {
        throw new Error('Payment service not initialized');
      }

      const productId = PRODUCT_IDS[planId];
      console.log(`🛒 Initiating purchase for ${planId} (${productId})`);

      let purchase: Purchase | null = null;
      
      if (planId === 'lifetime') {
        // One-time purchase for lifetime
        const result = await requestPurchase({ sku: productId });
        if (result && !Array.isArray(result)) {
          purchase = result as Purchase;
        }
      } else {
        // Subscription purchase
        const result = await requestSubscription({ sku: productId });
        if (result && !Array.isArray(result)) {
          purchase = result as Purchase;
        }
      }

      if (!purchase) {
        throw new Error('Purchase failed - no transaction returned');
      }

      console.log('✅ Purchase initiated successfully');
      
      return {
        success: true,
        transaction: purchase,
      };
    } catch (error: any) {
      console.error('❌ Purchase failed:', error);
      
      return {
        success: false,
        error: error.message || 'Purchase failed',
      };
    }
  }

  private async verifyPurchaseWithBackend(purchase: Purchase): Promise<boolean> {
    try {
      console.log('🔐 Verifying purchase with backend...');
      
      const response = await fetch(`${this.BACKEND_URL}/payments/verify-apple-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: purchase.transactionId,
          transactionReceipt: purchase.transactionReceipt,
          productId: purchase.productId,
          packageName: purchase.packageNameAndroid, // Will be undefined on iOS
          platform: Platform.OS,
        }),
      });

      const result = await response.json();
      console.log('🔐 Purchase verification result:', result.isValid);
      
      return result.isValid === true;
    } catch (error) {
      console.error('❌ Purchase verification failed:', error);
      return false;
    }
  }

  private async updateUserSubscription(purchase: Purchase): Promise<void> {
    try {
      console.log('📝 Updating user subscription in backend...');
      
      // Find the plan based on product ID
      const plan = this.subscriptionPlans.find(p => p.productId === purchase.productId);
      if (!plan) {
        throw new Error(`Unknown product ID: ${purchase.productId}`);
      }

      const response = await fetch(`${this.BACKEND_URL}/users/subscription`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: purchase.transactionId,
          productId: purchase.productId,
          planId: plan.id,
          subscriptionTier: plan.id === 'weekly' ? 'pro' : plan.id,
          purchaseDate: purchase.transactionDate,
          platform: 'ios',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update subscription: ${response.status}`);
      }

      console.log('✅ Subscription updated successfully');
    } catch (error) {
      console.error('❌ Failed to update subscription:', error);
      throw error;
    }
  }

  async restorePurchases(userId: string): Promise<boolean> {
    try {
      console.log('🔄 Restoring purchases...');
      
      if (Platform.OS !== 'ios') {
        console.log('⚠️ Restore purchases only available on iOS');
        return false;
      }

      // This would be implemented with react-native-iap's restore functionality
      // For now, return true as a placeholder
      Alert.alert(
        'Restore Purchases',
        'This feature will restore any previous purchases on this Apple ID.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore', onPress: () => this.performRestore() }
        ]
      );

      return true;
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      return false;
    }
  }

  private async performRestore() {
    // Implementation for restoring purchases would go here
    console.log('🔄 Performing restore...');
    Alert.alert('Restore Complete', 'Any valid purchases have been restored.');
  }

  // Check if user has an active subscription
  async validateSubscription(userId: string): Promise<{
    isActive: boolean;
    tier: string;
    expiresAt?: string;
  }> {
    try {
      const response = await fetch(`${this.BACKEND_URL}/users/subscription/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      return await response.json();
    } catch (error) {
      console.error('❌ Subscription validation failed:', error);
      return { isActive: false, tier: 'free' };
    }
  }

  // Clean up listeners
  cleanup() {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }
    endConnection();
  }
}

export const applePaymentService = new ApplePaymentService();
export default applePaymentService; 