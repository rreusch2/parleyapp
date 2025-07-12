import RNIap, {
  purchaseErrorListener,
  purchaseUpdatedListener,
  type ProductPurchase,
  type PurchaseError,
  type Subscription,
  requestPurchase,
  requestSubscription,
  finishTransaction,
  clearTransactionIOS,
  getProducts,
  getSubscriptions,
  flushFailedPurchasesCachedAsPendingAndroid,
  validateReceiptIos,
  validateReceiptAndroid,
  getAvailablePurchases,
  getPurchaseHistory,
} from 'react-native-iap';
import { Platform, Alert } from 'react-native';
import { supabase } from './api/supabaseClient';

// Your subscription product IDs from App Store Connect
const subscriptionSkus = Platform.select({
  ios: [
    'com.parleyapp.premium_monthly',
    'com.parleyapp.premiumyearly',
    'com.parleyapp.premium_lifetime',
  ],
  android: [
    'premium_monthly',
    'premium_yearly', 
    'premium_lifetime',
  ],
}) as string[];

// Apple shared secret for receipt verification
const APPLE_SHARED_SECRET = '4ec3c5802f414f928e515bc70f16005c';

class InAppPurchaseService {
  private isInitialized = false;
  private subscriptions: Subscription[] = [];
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;
  private purchaseSuccessCallback: ((purchase: ProductPurchase) => void) | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ IAP service already initialized');
      return;
    }

    try {
      console.log('🔄 Initializing IAP service...');
      
      // Initialize connection
      const result = await RNIap.initConnection();
      console.log('📱 IAP connection result:', result);
      
      if (Platform.OS === 'ios') {
        await RNIap.clearTransactionIOS();
        console.log('✅ iOS transactions cleared');
      }

      if (Platform.OS === 'android') {
        await flushFailedPurchasesCachedAsPendingAndroid();
        console.log('✅ Android failed purchases flushed');
      }

      // Load available subscriptions
      await this.loadSubscriptions();
      
      // Set up listeners
      this.setupPurchaseListeners();
      
      this.isInitialized = true;
      console.log('✅ InAppPurchase service initialized successfully');
      console.log('📦 Available subscriptions:', this.subscriptions.length);
      
    } catch (error) {
      console.error('❌ Failed to initialize InAppPurchase service:', error);
      
      // Show user-friendly error
      Alert.alert(
        'Purchase System Unavailable',
        'In-app purchases are not available right now. Please try again later.',
        [{ text: 'OK' }]
      );
      
      throw error;
    }
  }

  private setupPurchaseListeners(): void {
    console.log('🔄 Setting up purchase listeners...');
    
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: ProductPurchase) => {
        console.log('✅ Purchase successful:', {
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          purchaseToken: purchase.purchaseToken,
          platform: Platform.OS
        });
        
        try {
          // Verify purchase with backend
          await this.verifyPurchaseWithBackend(purchase);
          
          // Finish the transaction
          await finishTransaction({ purchase });
          console.log('✅ Transaction finished successfully');
          
          // Notify success
          this.onPurchaseSuccess(purchase);
          
        } catch (error) {
          console.error('❌ Purchase verification failed:', error);
          Alert.alert(
            'Purchase Verification Failed',
            'Your purchase was processed but could not be verified. Please contact support.',
            [{ text: 'OK' }]
          );
          
          // Still finish the transaction to avoid duplicate charges
          await finishTransaction({ purchase });
        }
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('❌ Purchase error:', error);
        
        // Handle different error types
        let errorMessage = 'Purchase failed. Please try again.';
        
        if (error.code === 'E_USER_CANCELLED') {
          errorMessage = 'Purchase was cancelled.';
        } else if (error.code === 'E_NETWORK_ERROR') {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.code === 'E_SERVICE_ERROR') {
          errorMessage = 'App Store service error. Please try again later.';
        }
        
        Alert.alert('Purchase Error', errorMessage, [{ text: 'OK' }]);
      }
    );
  }

  async purchaseSubscription(productId: string, onSuccess?: (purchase: ProductPurchase) => void): Promise<void> {
    console.log('🛒 Starting purchase for product:', productId);
    
    if (!this.isInitialized) {
      console.error('❌ IAP service not initialized');
      throw new Error('InAppPurchase service not initialized');
    }

    // Check if product exists in available subscriptions
    const subscription = this.subscriptions.find(sub => sub.productId === productId);
    if (!subscription) {
      console.error('❌ Product not found:', productId);
      console.error('Available products:', this.subscriptions.map(s => s.productId));
      throw new Error(`Product ${productId} not found in available subscriptions`);
    }
    
    // Set the success callback if provided
    if (onSuccess) {
      this.purchaseSuccessCallback = onSuccess;
    }
    
    try {
      console.log('🔄 Requesting subscription purchase...');
      
      // Check if this is a lifetime product (non-renewable)
      if (productId.includes('lifetime')) {
        // Use requestPurchase for one-time purchases
        await requestPurchase({ sku: productId });
      } else {
        // Use requestSubscription for recurring subscriptions
        await requestSubscription({ sku: productId });
      }
      
      console.log('✅ Purchase request sent to App Store');
      
    } catch (error) {
      console.error('❌ Purchase request failed:', error);
      
      // Clear the callback on error
      this.purchaseSuccessCallback = null;
      
      let errorMessage = 'Failed to start purchase process.';
      
      if (error instanceof Error) {
        if (error.message.includes('User cancelled')) {
          errorMessage = 'Purchase was cancelled.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection.';
        } else if (error.message.includes('Not available')) {
          errorMessage = 'This product is not available for purchase.';
        }
      }
      
      Alert.alert('Purchase Error', errorMessage, [{ text: 'OK' }]);
      throw error;
    }
  }

  private async verifyPurchaseWithBackend(purchase: ProductPurchase): Promise<void> {
    try {
      console.log('🔄 Verifying purchase with backend...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Prepare verification payload
      const verificationPayload = {
        platform: Platform.OS,
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        ...(Platform.OS === 'ios' ? {
          receipt: purchase.transactionReceipt
        } : {
          purchaseToken: purchase.purchaseToken
        })
      };

      // Call backend verification endpoint
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/purchases/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(verificationPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Backend verification failed');
      }

      const result = await response.json();
      console.log('✅ Purchase verified by backend:', result);
      
    } catch (error) {
      console.error('❌ Backend verification error:', error);
      throw error;
    }
  }

  private onPurchaseSuccess(purchase: ProductPurchase): void {
    console.log('🎉 Purchase completed successfully!');
    
    Alert.alert(
      'Purchase Successful!',
      'Thank you for your purchase. You now have access to all Pro features.',
      [{ text: 'Great!' }]
    );
    
    // Call the success callback if one is set
    if (this.purchaseSuccessCallback) {
      this.purchaseSuccessCallback(purchase);
      this.purchaseSuccessCallback = null; // Clear the callback after use
    }
  }

  async loadSubscriptions(): Promise<void> {
    try {
      console.log('📦 Loading subscriptions from App Store...');
      
      const subscriptions = await getSubscriptions({ skus: subscriptionSkus });
      this.subscriptions = subscriptions;
      
      console.log(`✅ Loaded ${subscriptions.length} subscriptions:`);
      subscriptions.forEach(sub => {
        console.log(`  - ${sub.productId}: ${sub.localizedPrice} (${sub.localizedTitle})`);
      });
      
    } catch (error) {
      console.error('❌ Failed to load subscriptions:', error);
      throw error;
    }
  }

  getAllSubscriptions(): Subscription[] {
    return this.subscriptions;
  }

  getSubscriptionByProductId(productId: string): Subscription | undefined {
    return this.subscriptions.find(sub => sub.productId === productId);
  }

  async restorePurchases(): Promise<void> {
    try {
      console.log('🔄 Restoring purchases...');
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Get purchase history
      const purchases = await getAvailablePurchases();
      console.log(`📋 Found ${purchases.length} available purchases`);
      
      if (purchases.length === 0) {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases were found on this Apple ID.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Verify each purchase with backend
      for (const purchase of purchases) {
        try {
          await this.verifyPurchaseWithBackend(purchase);
        } catch (error) {
          console.warn('Failed to verify restored purchase:', purchase.productId);
        }
      }
      
      Alert.alert(
        'Restore Complete',
        'Your previous purchases have been restored.',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      Alert.alert(
        'Restore Failed',
        'Could not restore purchases. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }

  async checkSubscriptionStatus(): Promise<any> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/purchases/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to check subscription status');
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return null;
    }
  }

  async testBackendConnection(): Promise<void> {
    try {
      console.log('🧪 Testing backend connection...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in first');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'No active session');
        return;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/purchases/test-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          test: true,
          userId: user.id
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        Alert.alert(
          'Backend Test Successful ✅',
          `Connection working!\n\nEnvironment: ${result.environment}\nApple Secret: ${result.hasAppleSecret ? 'Configured' : 'Missing'}\nTimestamp: ${result.timestamp}`,
          [{ text: 'Great!' }]
        );
      } else {
        Alert.alert(
          'Backend Test Failed ❌',
          `Error: ${result.error}\nDebug: ${result.debug}`,
          [{ text: 'OK' }]
        );
      }
      
    } catch (error) {
      console.error('❌ Backend test error:', error);
      Alert.alert(
        'Backend Test Failed ❌',
        `Could not connect to backend: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
  }

  async runDiagnostics(): Promise<void> {
    try {
      console.log('🔍 Running IAP diagnostics...');
      
      const diagnostics = {
        initialized: this.isInitialized,
        platform: Platform.OS,
        subscriptionsLoaded: this.subscriptions.length,
        productIds: subscriptionSkus,
        availableProducts: this.subscriptions.map(s => ({
          id: s.productId,
          title: s.localizedTitle,
          price: s.localizedPrice
        }))
      };

      console.log('📊 IAP Diagnostics:', diagnostics);
      
      Alert.alert(
        'IAP Diagnostics',
        `Initialized: ${diagnostics.initialized}\nPlatform: ${diagnostics.platform}\nProducts: ${diagnostics.subscriptionsLoaded}\nExpected: ${diagnostics.productIds.length}`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Diagnostics error:', error);
      Alert.alert('Diagnostics Failed', error.message, [{ text: 'OK' }]);
    }
  }

  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up IAP service...');
      
      if (this.purchaseUpdateSubscription) {
        this.purchaseUpdateSubscription.remove();
      }
      
      if (this.purchaseErrorSubscription) {
        this.purchaseErrorSubscription.remove();
      }
      
      await RNIap.endConnection();
      
      this.isInitialized = false;
      this.subscriptions = [];
      
      console.log('✅ IAP service cleaned up');
      
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}

// Export singleton instance
const inAppPurchaseService = new InAppPurchaseService();
export default inAppPurchaseService;