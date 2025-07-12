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
} from 'react-native-iap';
import { Platform, Alert } from 'react-native';

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

class InAppPurchaseService {
  private isInitialized = false;
  private subscriptions: Subscription[] = [];
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await RNIap.initConnection();
      
      if (Platform.OS === 'ios') {
        await RNIap.clearTransactionIOS();
      }

      if (Platform.OS === 'android') {
        await flushFailedPurchasesCachedAsPendingAndroid();
      }

      // Load available subscriptions
      await this.loadSubscriptions();
      
      // Set up listeners
      this.setupPurchaseListeners();
      
      this.isInitialized = true;
      console.log('✅ InAppPurchase service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize InAppPurchase service. IAP will be disabled:', error);
      // Do not re-throw the error. This allows the app to run
      // without IAP functionality if initialization fails.
    }
  }

  private async loadSubscriptions(): Promise<void> {
    try {
      const subs = await getSubscriptions({ skus: subscriptionSkus });
      this.subscriptions = subs;
      console.log('📦 Loaded subscriptions:', subs.map(s => ({ 
        id: s.productId, 
        price: 'localizedPrice' in s ? s.localizedPrice : ('price' in s ? s.price : 'N/A') 
      })));
    } catch (error) {
      console.error('❌ Failed to load subscriptions:', error);
      throw error;
    }
  }

  private setupPurchaseListeners(): void {
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: ProductPurchase) => {
        console.log('✅ Purchase successful:', purchase);
        
        try {
          // Verify purchase with your backend
          await this.verifyPurchaseWithBackend(purchase);
          
          // Finish the transaction
          await finishTransaction({ purchase });
          
          // Notify success
          this.onPurchaseSuccess(purchase);
        } catch (error) {
          console.error('❌ Purchase verification failed:', error);
          this.onPurchaseError(error as Error);
        }
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('❌ Purchase error:', error);
        this.onPurchaseError(new Error(error.message));
      }
    );
  }

  async purchaseSubscription(productId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('InAppPurchase service not initialized');
    }

    try {
      console.log('🛒 Requesting subscription:', productId);
      await requestSubscription({ sku: productId });
    } catch (error) {
      console.error('❌ Failed to request subscription:', error);
      throw error;
    }
  }

  private async verifyPurchaseWithBackend(purchase: ProductPurchase): Promise<void> {
    try {
      // Get Supabase auth token
      const { supabase } = await import('./api/supabaseClient');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/purchases/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          platform: Platform.OS,
          purchaseToken: purchase.purchaseToken,
          receipt: purchase.transactionReceipt,
          productId: purchase.productId,
          transactionId: purchase.transactionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend verification failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Purchase verified with backend:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Backend verification error:', error);
      throw error;
    }
  }

  private onPurchaseSuccess = (purchase: ProductPurchase) => {
    console.log('🎉 Purchase completed successfully:', purchase.productId);
    
    // Show success alert
    Alert.alert(
      'Purchase Successful!',
      'Welcome to Parley Pro! Your subscription is now active.',
      [{ text: 'Great!', style: 'default' }]
    );
  };

  private onPurchaseError = (error: Error) => {
    console.error('💥 Purchase failed:', error);
    
    // Show error alert
    Alert.alert(
      'Purchase Failed',
      error.message || 'Something went wrong. Please try again.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  getSubscription(productId: string): Subscription | undefined {
    return this.subscriptions.find(sub => sub.productId === productId);
  }

  getAllSubscriptions(): Subscription[] {
    return this.subscriptions;
  }

  async restorePurchases(): Promise<void> {
    try {
      console.log('🔄 Restoring purchases...');
      
      // This will trigger purchaseUpdatedListener for any existing valid subscriptions
      if (Platform.OS === 'ios') {
        await RNIap.clearTransactionIOS();
      }
      
      Alert.alert(
        'Restore Complete',
        'Any existing subscriptions have been restored.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      Alert.alert(
        'Restore Failed',
        'Could not restore purchases. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }

  cleanup(): void {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }
    
    RNIap.endConnection();
    this.isInitialized = false;
    console.log('🧹 InAppPurchase service cleaned up');
  }
}

export const inAppPurchaseService = new InAppPurchaseService();
export default inAppPurchaseService;