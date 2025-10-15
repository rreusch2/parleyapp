import Constants from 'expo-constants';
import { Alert } from 'react-native';

// STRIPE DISABLED - Using RevenueCat for IAP instead
console.log('⚠️ Stripe service disabled - using RevenueCat for payments');

// Get configuration (disabled)
const stripePublishableKey = null;
const appleMerchantId = null;
const backendUrl = Constants.expoConfig?.extra?.apiUrl;

export interface StripeSubscriptionPlan {
  planId: string;
  tier: 'pro' | 'elite';
  amount: number;
  interval: string;
}

export interface PaymentIntentResponse {
  success: boolean;
  clientSecret: string;
  paymentIntentId: string;
  customerId: string;
  planDetails: StripeSubscriptionPlan;
}

export interface PaymentConfirmationResponse {
  success: boolean;
  message: string;
  subscription: {
    tier: string;
    planId: string;
    status: string;
    endsAt?: string;
  };
}

class StripeService {
  private initialized = false;

  async initialize(): Promise<boolean> {
    if (!stripePublishableKey) {
      console.error('❌ Stripe publishable key not configured');
      return false;
    }

    try {
      console.log('🔄 Initializing Stripe service...');
      this.initialized = true;
      console.log('✅ Stripe service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Stripe:', error);
      return false;
    }
  }

  async createPaymentIntent(planId: string, userId: string): Promise<PaymentIntentResponse | null> {
    if (!this.initialized) {
      console.error('❌ Stripe service not initialized');
      return null;
    }

    try {
      console.log('🔄 Creating Stripe Payment Intent for:', planId);

      const response = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      console.log('✅ Created Stripe Payment Intent:', data.paymentIntentId);
      return data;

    } catch (error: any) {
      console.error('❌ Error creating payment intent:', error);
      Alert.alert('Payment Error', error.message || 'Failed to initialize payment');
      return null;
    }
  }

  async confirmPayment(paymentIntentId: string, userId: string): Promise<PaymentConfirmationResponse | null> {
    try {
      console.log('🔄 Confirming Stripe payment:', paymentIntentId);

      const response = await fetch(`${backendUrl}/api/stripe/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId,
          userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to confirm payment');
      }

      console.log('✅ Stripe payment confirmed successfully');
      return data;

    } catch (error: any) {
      console.error('❌ Error confirming payment:', error);
      Alert.alert('Payment Error', error.message || 'Failed to confirm payment');
      return null;
    }
  }

  getConfiguration() {
    return {
      stripePublishableKey,
      appleMerchantId,
      backendUrl,
      isConfigured: !!stripePublishableKey
    };
  }
}

// Export singleton instance
export const stripeService = new StripeService();

// Export stub Stripe provider component (disabled)
export const StripeProvider = ({ children }: { children: React.ReactNode }) => children;

// Custom hook for using Stripe in components (disabled)
export const useStripePayment = () => {
  console.log('⚠️ Stripe disabled - use RevenueCat instead');

  const initializePaymentSheet = async (paymentIntentData: PaymentIntentResponse) => {
    console.warn('❌ Stripe payment disabled - use RevenueCat IAP');
    Alert.alert('Payment Unavailable', 'Please use in-app purchases instead');
    return false;
  };

  const presentPaymentSheetModal = async (): Promise<boolean> => {
    console.warn('❌ Stripe payment disabled - use RevenueCat IAP');
    Alert.alert('Payment Unavailable', 'Please use in-app purchases instead');
    return false;
  };

  const confirmPayment = async () => {
    console.warn('❌ Stripe payment disabled - use RevenueCat IAP');
    return null;
  };

  return {
    initializePaymentSheet,
    presentPaymentSheet: presentPaymentSheetModal,
    confirmPayment,
  };
};

export default stripeService;
