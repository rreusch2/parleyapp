import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { Alert } from 'react-native';

// Get Stripe configuration from app.config.js
const stripePublishableKey = Constants.expoConfig?.extra?.stripePublishableKey;
const appleMerchantId = Constants.expoConfig?.extra?.appleMerchantId;
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

// Export Stripe provider component for app initialization
export { StripeProvider };

// Custom hook for using Stripe in components
export const useStripePayment = () => {
  const { initPaymentSheet, presentPaymentSheet, confirmPayment } = useStripe();

  const initializePaymentSheet = async (paymentIntentData: PaymentIntentResponse) => {
    try {
      console.log('🔄 Initializing Stripe Payment Sheet...');

      // Build PaymentSheet init options.
      // IMPORTANT: Do not pass customerId unless you also provide an ephemeral key.
      // Passing customerId without an ephemeral key can cause Payment Sheet to fail in production.
      const initOptions: any = {
        merchantDisplayName: 'Predictive Play',
        paymentIntentClientSecret: paymentIntentData.clientSecret,
        allowsDelayedPaymentMethods: true,
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: __DEV__,
        },
        returnURL: 'predictiveplay://stripe-redirect',
      };

      if (appleMerchantId) {
        initOptions.applePay = { merchantId: appleMerchantId } as any;
      }

      const { error } = await initPaymentSheet(initOptions);

      if (error) {
        console.error('❌ Error initializing payment sheet:', error);
        Alert.alert('Setup Error', error.message);
        return false;
      }

      console.log('✅ Payment sheet initialized successfully');
      return true;

    } catch (error: any) {
      console.error('❌ Payment sheet initialization error:', error);
      Alert.alert('Setup Error', 'Failed to initialize payment');
      return false;
    }
  };

  const presentPaymentSheetModal = async (): Promise<boolean> => {
    try {
      console.log('🔄 Presenting Stripe Payment Sheet...');

      const { error } = await presentPaymentSheet();

      if (error) {
        if (error.code === 'Canceled') {
          console.log('ℹ️ User cancelled payment');
          return false;
        }
        
        console.error('❌ Payment sheet error:', error);
        Alert.alert('Payment Error', error.message);
        return false;
      }

      console.log('✅ Payment completed successfully');
      return true;

    } catch (error: any) {
      console.error('❌ Payment sheet presentation error:', error);
      Alert.alert('Payment Error', 'Something went wrong with the payment');
      return false;
    }
  };

  return {
    initializePaymentSheet,
    presentPaymentSheet: presentPaymentSheetModal,
    confirmPayment,
  };
};

export default stripeService;
