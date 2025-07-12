// Import with fallback for development environments
let RNIap: any;
let purchaseErrorListener: any;
let purchaseUpdatedListener: any;
let requestPurchase: any;
let requestSubscription: any;
let finishTransaction: any;
let clearTransactionIOS: any;
let getProducts: any;
let getSubscriptions: any;
let flushFailedPurchasesCachedAsPendingAndroid: any;

try {
  const iapModule = require('react-native-iap');
  RNIap = iapModule.default || iapModule;
  purchaseErrorListener = iapModule.purchaseErrorListener;
  purchaseUpdatedListener = iapModule.purchaseUpdatedListener;
  requestPurchase = iapModule.requestPurchase;
  requestSubscription = iapModule.requestSubscription;
  finishTransaction = iapModule.finishTransaction;
  clearTransactionIOS = iapModule.clearTransactionIOS;
  getProducts = iapModule.getProducts;
  getSubscriptions = iapModule.getSubscriptions;
  flushFailedPurchasesCachedAsPendingAndroid = iapModule.flushFailedPurchasesCachedAsPendingAndroid;
  console.log('✅ react-native-iap module loaded successfully');
} catch (error) {
  console.warn('⚠️ react-native-iap not available:', error);
  // Create mock functions for development
  RNIap = {
    initConnection: () => Promise.resolve(),
    endConnection: () => Promise.resolve(),
    clearTransactionIOS: () => Promise.resolve(),
  };
  purchaseErrorListener = () => ({ remove: () => {} });
  purchaseUpdatedListener = () => ({ remove: () => {} });
  requestPurchase = () => Promise.reject(new Error('IAP not available'));
  requestSubscription = () => Promise.reject(new Error('IAP not available'));
  finishTransaction = () => Promise.resolve();
  clearTransactionIOS = () => Promise.resolve();
  getProducts = () => Promise.resolve([]);
  getSubscriptions = () => Promise.resolve([]);
  flushFailedPurchasesCachedAsPendingAndroid = () => Promise.resolve();
}

type ProductPurchase = any;
type PurchaseError = any;
type Subscription = any;
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
    console.log('🔥 DEBUG: Starting IAP initialization...');
    
    if (this.isInitialized) {
      console.log('✅ IAP already initialized');
      return;
    }

    // Check if RNIap is available
    if (!RNIap || !RNIap.initConnection) {
      throw new Error('react-native-iap module not available. Are you running in Expo Go? Use a dev build instead.');
    }

    try {
      console.log('🔥 DEBUG: Calling RNIap.initConnection()...');
      await RNIap.initConnection();
      console.log('✅ IAP connection initialized');
      
      if (Platform.OS === 'ios') {
        console.log('🔥 DEBUG: Clearing iOS transactions...');
        await RNIap.clearTransactionIOS();
        console.log('✅ iOS transactions cleared');
      }

      if (Platform.OS === 'android') {
        console.log('🔥 DEBUG: Flushing Android failed purchases...');
        await flushFailedPurchasesCachedAsPendingAndroid();
        console.log('✅ Android failed purchases flushed');
      }

      console.log('🔥 DEBUG: Loading subscriptions...');
      await this.loadSubscriptions();
      console.log('✅ Subscriptions loaded');
      
      // Set up listeners
      console.log('🔥 DEBUG: Setting up purchase listeners...');
      this.setupPurchaseListeners();
      console.log('✅ Purchase listeners set up');
      
      this.isInitialized = true;
      console.log('✅ InAppPurchase service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize InAppPurchase service. IAP will be disabled:', error);
      throw error; // Re-throw so caller knows initialization failed
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
    
    // Check if product exists in available subscriptions
    const subscription = this.subscriptions.find(sub => sub.productId === productId);
    if (!subscription) {
      console.error('❌ DEBUG: Product not found in available subscriptions:', productId);
      console.error('❌ DEBUG: Available products:', this.subscriptions.map(s => s.productId));
      throw new Error(`Product ${productId} not found in available subscriptions`);
    }
    
    try {
      console.log('🛒 Requesting subscription:', productId);
      console.log('🔥 DEBUG: About to call requestSubscription...');
      
      // requestSubscription triggers the purchase flow
      // The actual purchase handling happens in purchaseUpdatedListener
      await requestSubscription({ sku: productId });
      console.log('✅ DEBUG: requestSubscription call completed (purchase dialog should show)');
      
      // Note: The actual verification happens in purchaseUpdatedListener
      // This method just initiates the purchase flow
      
    } catch (error) {
      console.error('❌ Failed to request subscription:', error);
      console.error('❌ DEBUG: Error type:', typeof error);
      console.error('❌ DEBUG: Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ DEBUG: Full error object:', JSON.stringify(error, null, 2));
      
      // Show user-friendly error
      Alert.alert(
        'Purchase Failed',
        `Unable to start purchase process. ${error instanceof Error ? error.message : 'Please try again.'}`
      );
      
      throw error;
    }
  }

  private async verifyPurchaseWithBackend(purchase: ProductPurchase): Promise<any> {
    console.log('🔥 DEBUG: Starting backend verification...');
    console.log('🔥 DEBUG: Purchase object:', JSON.stringify(purchase, null, 2));
    
    console.log('🔍 DEBUG: Backend URL FROM PROCESS.ENV:', process.env.EXPO_PUBLIC_BACKEND_URL);
    console.log('🔍 DEBUG: All environment variables:', {
      EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      NODE_ENV: process.env.NODE_ENV
    });

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
        console.error('❌ EXPO_PUBLIC_BACKEND_URL is not set!');
        throw new Error('Backend URL not configured - check your .env file');
      }
      
      // Validate backend URL format
      if (backendUrl.includes('localhost') || backendUrl.includes('192.168') || backendUrl.includes('127.0.0.1')) {
        console.error('❌ Backend URL points to localhost:', backendUrl);
        console.error('❌ This will fail on device/TestFlight. Use production Railway URL!');
        throw new Error('Backend URL misconfigured - using localhost instead of production');
      }
      
      if (!backendUrl.startsWith('https://')) {
        console.error('❌ Backend URL must use HTTPS for production:', backendUrl);
        throw new Error('Backend URL must use HTTPS protocol');
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