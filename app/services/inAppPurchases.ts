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
      console.log('🔍 DEBUG: Access token preview:', session.access_token.substring(0, 20) + '...');

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
      
      console.log('🔍 DEBUG: Request body (sanitized):', {
        platform: requestBody.platform,
        productId: requestBody.productId,
        transactionId: requestBody.transactionId,
        hasReceipt: !!requestBody.receipt,
        hasPurchaseToken: !!requestBody.purchaseToken,
        receiptLength: requestBody.receipt?.length || 0
      });
      
      const fullUrl = `${backendUrl}/api/purchases/verify`;
      console.log('🔍 DEBUG: Making request to:', fullUrl);

      console.log('🔍 DEBUG: Request headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token.substring(0, 20)}...`,
      });

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('🔍 DEBUG: Response status:', response.status);
      console.log('🔍 DEBUG: Response ok:', response.ok);
      console.log('🔍 DEBUG: Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 DEBUG: Error response body:', errorText);
        
        // Special handling for common errors
        if (response.status === 401) {
          console.error('❌ Authentication failed - user session may be expired');
          throw new Error(`Authentication failed (401). Please log out and log back in.`);
        } else if (response.status === 404) {
          console.error('❌ Backend endpoint not found');
          throw new Error(`Backend endpoint not found (404). Check backend deployment.`);
        } else if (response.status >= 500) {
          console.error('❌ Backend server error');
          throw new Error(`Backend server error (${response.status}). Please try again later.`);
        }
        
        throw new Error(`Backend verification failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Purchase verified with backend:', result);
      
      // Additional success logging
      console.log('✅ Verification successful - subscription tier:', result.subscriptionTier);
      console.log('✅ Expires at:', result.expiresAt);
      
      return result;
    } catch (error) {
      console.error('❌ Backend verification error:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      
      // Show user-friendly error with more context
      Alert.alert(
        'Purchase Verification Failed',
        `We couldn't verify your purchase with our servers. ${error instanceof Error ? error.message : 'Please try again.'}\n\nIf this persists, contact support.`,
        [{ text: 'OK', style: 'default' }]
      );
      
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

  // TEST METHOD - Add this for debugging
  async testBackendConnection(): Promise<void> {
    try {
      console.log('🧪 Testing backend connection...');
      
      const { supabase } = await import('./api/supabaseClient');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        Alert.alert('Test Failed', 'No valid user session found');
        return;
      }

      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      console.log('🧪 Testing backend at:', backendUrl);

      // First test the debug endpoint
      console.log('🧪 Testing debug endpoint...');
      const debugResponse = await fetch(`${backendUrl}/api/purchases/debug-env`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (debugResponse.ok) {
        const debugResult = await debugResponse.json();
        console.log('✅ Debug endpoint response:', debugResult);
      }

      // Now test the actual purchase endpoint with auth
      console.log('🧪 Testing purchase endpoint with auth...');
      const response = await fetch(`${backendUrl}/api/purchases/test-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString()
        }),
      });

      console.log('🧪 Response status:', response.status);
      const responseText = await response.text();
      console.log('🧪 Response body:', responseText);

      if (response.ok) {
        const result = JSON.parse(responseText);
        console.log('✅ Backend test successful:', result);
        Alert.alert(
          'Backend Test SUCCESS!', 
          `✅ Backend is reachable\n✅ Auth working: User ${result.userId}\n✅ Apple secret configured: ${result.hasAppleSecret}\n✅ Environment: ${result.environment}`,
          [{ text: 'Great!', style: 'default' }]
        );
      } else {
        const errorResult = JSON.parse(responseText);
        throw new Error(`HTTP ${response.status}: ${errorResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Backend test failed:', error);
      Alert.alert(
        'Backend Test Failed',
        `❌ Could not reach backend: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check your internet connection and try again.`,
        [{ text: 'OK', style: 'default' }]
      );
    }
  }

  // DIAGNOSTIC METHOD - Test IAP product loading
  async runDiagnostics(): Promise<void> {
    try {
      console.log('🔍 Starting IAP Diagnostics...');
      
      // 1. Check initialization
      console.log('1️⃣ Checking initialization status:', this.isInitialized);
      
      if (!this.isInitialized) {
        console.log('   Initializing IAP...');
        await this.initialize();
      }

      // 2. Check if we can make payments
      const canMakePayments = await RNIap.canMakePayments();
      console.log('2️⃣ Can make payments:', canMakePayments);

      // 3. Get available products
      console.log('3️⃣ Fetching products...');
      const products = await RNIap.getProducts({ skus: subscriptionSkus });
      console.log('   Raw products response:', products);
      console.log('   Product count:', products.length);
      
      // 4. Display each product
      products.forEach((product, index) => {
        console.log(`   Product ${index + 1}:`, {
          identifier: product.identifier,
          localizedTitle: product.localizedTitle,
          price: product.price,
          localizedPrice: product.localizedPrice,
          currency: product.currency,
          type: product.type,
          localizedDescription: product.localizedDescription
        });
      });

      // 5. Check purchase history
      console.log('4️⃣ Checking purchase history...');
      const purchases = await RNIap.getAvailablePurchases();
      console.log('   Available purchases:', purchases.length);
      purchases.forEach((purchase, index) => {
        console.log(`   Purchase ${index + 1}:`, {
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          transactionDate: purchase.transactionDate
        });
      });

      // 6. Show results in alert
      Alert.alert(
        'IAP Diagnostics',
        `Initialized: ${this.isInitialized}\n` +
        `Can Make Payments: ${canMakePayments}\n` +
        `Products Found: ${products.length}\n` +
        `${products.map(p => `- ${p.localizedTitle}: ${p.localizedPrice}`).join('\n')}\n` +
        `Purchase History: ${purchases.length} items`,
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('❌ Diagnostics error:', error);
      Alert.alert(
        'Diagnostics Error',
        `${error.message}\nCode: ${error.code || 'N/A'}`,
        [{ text: 'OK' }]
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