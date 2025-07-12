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
    console.log('🔥 DEBUG: Setting up purchase listeners...');
    
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: ProductPurchase) => {
        console.log('🔥 DEBUG: Purchase listener triggered!');
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
        console.log('🔥 DEBUG: Purchase error listener triggered!');
        console.error('❌ Purchase error:', error);
        this.onPurchaseError(new Error(error.message));
      }
    );
  }

  async purchaseSubscription(productId: string): Promise<void> {
    console.log('🔥 DEBUG: purchaseSubscription called with productId:', productId);
    
    if (!this.isInitialized) {
      console.log('❌ DEBUG: Service not initialized!');
      throw new Error('InAppPurchase service not initialized');
    }

    console.log('✅ DEBUG: Service is initialized');
    console.log('🛒 DEBUG: Available subscriptions:', this.subscriptions.map(s => s.productId));
    
    try {
      console.log('🛒 Requesting subscription:', productId);
      console.log('🔥 DEBUG: About to call requestSubscription...');
      
      const result = await requestSubscription({ sku: productId });
      console.log('✅ DEBUG: requestSubscription completed:', result);
      
    } catch (error) {
      console.error('❌ Failed to request subscription:', error);
      console.error('❌ DEBUG: Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  private async verifyPurchaseWithBackend(purchase: ProductPurchase): Promise<void> {
    console.log('🔍 DEBUG: Starting backend verification...');
    console.log('🔍 DEBUG: Purchase object:', JSON.stringify(purchase, null, 2));
    
    try {
      // Get Supabase auth token
      console.log('🔍 DEBUG: Getting Supabase session...');
      const { supabase } = await import('./api/supabaseClient');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('🔍 DEBUG: Session error:', sessionError);
        throw new Error('Session error: ' + sessionError.message);
      }
      
      if (!session?.access_token) {
        console.error('🔍 DEBUG: No session or access token');
        throw new Error('User not authenticated - no session');
      }
      
      console.log('🔍 DEBUG: Session OK, user ID:', session.user?.id);

      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      console.log('🔍 DEBUG: Backend URL:', backendUrl);
      
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }

      const requestBody = {
        platform: Platform.OS,
        purchaseToken: purchase.purchaseToken,
        receipt: purchase.transactionReceipt,
        productId: purchase.productId,
        transactionId: purchase.transactionId,
      };
      
      console.log('🔍 DEBUG: Request body:', JSON.stringify(requestBody, null, 2));
      
      const fullUrl = `${backendUrl}/api/purchases/verify`;
      console.log('🔍 DEBUG: Making request to:', fullUrl);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('🔍 DEBUG: Response status:', response.status);
      console.log('🔍 DEBUG: Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 DEBUG: Error response body:', errorText);
        throw new Error(`Backend verification failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Purchase verified with backend:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Backend verification error:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
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