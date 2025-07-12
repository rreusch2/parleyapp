import { Platform, Alert } from 'react-native';
import * as StoreKit from 'expo-store-kit';

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

export interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  receipt?: string;
  error?: string;
}

class ExpoInAppPurchaseService {
  private isInitialized = false;
  private availableProducts: any[] = [];

  async initialize(): Promise<void> {
    console.log('🔥 DEBUG: Initializing Expo IAP service...');
    
    if (this.isInitialized) {
      console.log('✅ Expo IAP already initialized');
      return;
    }

    try {
      // Check if StoreKit is available (iOS only)
      if (Platform.OS !== 'ios') {
        console.log('⚠️ Expo StoreKit only supports iOS currently');
        return;
      }

      // Initialize StoreKit
      await StoreKit.initialize();
      console.log('✅ StoreKit initialized successfully');

      // Load products
      await this.loadProducts();
      
      this.isInitialized = true;
      console.log('✅ Expo IAP service initialized successfully');
      console.log(`📱 IAP initialized, loaded subscriptions: ${this.availableProducts.length}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Expo IAP service:', error);
      throw new Error(`Failed to initialize IAP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadProducts(): Promise<void> {
    try {
      console.log('📦 Loading products:', subscriptionSkus);
      
      // Get product details from App Store
      const products = await StoreKit.getProductsAsync(subscriptionSkus);
      this.availableProducts = products;
      
      console.log('✅ Products loaded:', products.length);
      products.forEach((product: any) => {
        console.log(`📦 Product: ${product.productIdentifier} - ${product.localizedTitle} - ${product.price}`);
      });
      
    } catch (error) {
      console.error('❌ Failed to load products:', error);
      throw error;
    }
  }

  async purchaseSubscription(productId: string): Promise<PurchaseResult> {
    console.log('🔥 DEBUG: purchaseSubscription called with productId:', productId);
    
    if (!this.isInitialized) {
      console.log('❌ DEBUG: Service not initialized!');
      return {
        success: false,
        error: 'InAppPurchase service not initialized'
      };
    }

    if (Platform.OS !== 'ios') {
      return {
        success: false,
        error: 'IAP only supported on iOS with Expo StoreKit'
      };
    }

    try {
      console.log('🛒 Starting purchase for:', productId);
      
      // Find the product
      const product = this.availableProducts.find(p => p.productIdentifier === productId);
      if (!product) {
        throw new Error(`Product ${productId} not found in available products`);
      }

      console.log('💳 Initiating purchase...');
      
      // Purchase the product
      const result = await StoreKit.purchaseProductAsync(productId);
      
      if (result && result.transactionIdentifier) {
        console.log('✅ Purchase successful:', result.transactionIdentifier);
        
        return {
          success: true,
          productId: productId,
          transactionId: result.transactionIdentifier,
          receipt: result.transactionReceipt
        };
      } else {
        throw new Error('Purchase failed - no transaction returned');
      }
      
    } catch (error) {
      console.error('❌ Purchase failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown purchase error';
      
      // Show user-friendly error
      Alert.alert(
        'Purchase Failed',
        `Failed to process subscription: ${errorMessage}`,
        [{ text: 'OK' }]
      );
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getAvailableProducts() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.availableProducts;
  }

  async restorePurchases(): Promise<PurchaseResult[]> {
    console.log('🔄 Restoring purchases...');
    
    if (!this.isInitialized) {
      console.log('❌ Service not initialized for restore');
      return [];
    }

    if (Platform.OS !== 'ios') {
      return [];
    }

    try {
      const restoredTransactions = await StoreKit.restoreCompletedTransactionsAsync();
      
      const results: PurchaseResult[] = restoredTransactions.map(transaction => ({
        success: true,
        productId: transaction.productIdentifier,
        transactionId: transaction.transactionIdentifier,
        receipt: transaction.transactionReceipt
      }));
      
      console.log('✅ Restored purchases:', results.length);
      return results;
      
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      return [];
    }
  }

  async validateReceipt(receipt: string, isProduction: boolean = false): Promise<any> {
    console.log('📋 Validating receipt...');
    
    // This would typically send the receipt to your backend for validation
    // For now, we'll just return a placeholder
    return {
      valid: true,
      receipt: receipt
    };
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

export const expoInAppPurchaseService = new ExpoInAppPurchaseService();
export default expoInAppPurchaseService;
