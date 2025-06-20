import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { supabaseAdmin } from '../services/supabase/client';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger('payments');

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Subscription plan configuration
const SUBSCRIPTION_PLANS = {
  weekly: { priceId: 'price_weekly_899', amount: 899, interval: 'week' },
  monthly: { priceId: 'price_monthly_2499', amount: 2499, interval: 'month' },
  yearly: { priceId: 'price_yearly_19999', amount: 19999, interval: 'year' },
  lifetime: { priceId: 'price_lifetime_34999', amount: 34999, interval: 'lifetime' },
};

/**
 * @route POST /api/payments/create-intent
 * @desc Create a payment intent for subscription
 */
router.post('/create-intent', async (req: Request, res: Response) => {
  try {
    const { planId, userId, platform } = req.body;

    if (!planId || !userId) {
      return res.status(400).json({ error: 'Plan ID and User ID are required' });
    }

    const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    logger.info(`Creating payment intent for user ${userId}, plan ${planId}, platform ${platform}`);

    // Create customer if doesn't exist
    let customer = await getOrCreateStripeCustomer(userId);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: plan.amount,
      currency: 'usd',
      customer: customer.id,
      metadata: {
        userId,
        planId,
        platform: platform || 'unknown',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    logger.info(`✅ Payment intent created: ${paymentIntent.id}`);

    res.json({
      paymentIntent: {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      },
    });
  } catch (error) {
    logger.error('❌ Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

/**
 * @route POST /api/payments/verify-apple-purchase
 * @desc Verify Apple In-App Purchase with App Store
 */
router.post('/verify-apple-purchase', async (req: Request, res: Response) => {
  try {
    const { transactionId, transactionReceipt, productId, platform } = req.body;

    logger.info(`🍎 Verifying Apple purchase: ${transactionId} for product: ${productId}`);

    if (platform !== 'ios') {
      return res.status(400).json({
        success: false,
        error: 'This endpoint is only for iOS purchases'
      });
    }

    // In a real app, you would verify the receipt with Apple's servers
    // For development, we'll simulate a successful verification
    const isValid = await verifyReceiptWithApple(transactionReceipt);

    if (isValid) {
      // Store the purchase in your database
      const { data: purchase, error } = await supabaseAdmin
        .from('user_purchases')
        .insert({
          transaction_id: transactionId,
          product_id: productId,
          platform: 'ios',
          purchase_date: new Date().toISOString(),
          receipt_data: transactionReceipt,
          status: 'verified'
        });

      if (error) {
        logger.error('❌ Failed to store purchase:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to store purchase'
        });
      }

      logger.info('✅ Apple purchase verified and stored');
      res.json({
        success: true,
        isValid: true,
        purchase
      });
    } else {
      logger.warn('❌ Apple purchase verification failed');
      res.status(400).json({
        success: false,
        isValid: false,
        error: 'Invalid receipt'
      });
    }
  } catch (error) {
    logger.error('❌ Apple purchase verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Purchase verification failed'
    });
  }
});

// Helper function to verify receipt with Apple
async function verifyReceiptWithApple(receiptData: string): Promise<boolean> {
  try {
    // For development, we'll return true
    // In production, you would verify with Apple's servers:
    /*
    const appleResponse = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': process.env.APPLE_SHARED_SECRET,
        'exclude-old-transactions': true
      })
    });

    const result = await appleResponse.json();
    return result.status === 0;
    */
    
    logger.info('🍎 Simulating successful Apple receipt verification for development');
    return true;
  } catch (error) {
    logger.error('❌ Apple receipt verification failed:', error);
    return false;
  }
}

/**
 * @route POST /api/payments/confirm-apple-pay
 * @desc Confirm Apple Pay payment
 */
router.post('/confirm-apple-pay', async (req: Request, res: Response) => {
  try {
    const { clientSecret, paymentToken } = req.body;

    if (!clientSecret || !paymentToken) {
      return res.status(400).json({ error: 'Client secret and payment token required' });
    }

    logger.info('Processing Apple Pay payment confirmation');

    // Confirm the payment intent with the Apple Pay token
    const paymentIntent = await stripe.paymentIntents.confirm(clientSecret, {
      payment_method_data: {
        type: 'card',
        card: {
          token: paymentToken,
        },
      },
    });

    if (paymentIntent.status === 'succeeded') {
      logger.info(`✅ Apple Pay payment succeeded: ${paymentIntent.id}`);
      
      // Create subscription record
      await createSubscriptionRecord(paymentIntent);

      res.json({
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
        },
      });
    } else {
      logger.warn(`⚠️ Apple Pay payment requires action: ${paymentIntent.status}`);
      res.json({
        success: false,
        error: 'Payment requires additional authentication',
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
        },
      });
    }
  } catch (error) {
    logger.error('❌ Apple Pay confirmation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment confirmation failed',
    });
  }
});

/**
 * @route POST /api/payments/confirm-card
 * @desc Confirm card payment
 */
router.post('/confirm-card', async (req: Request, res: Response) => {
  try {
    const { paymentIntentId, paymentMethodId, userId } = req.body;

    if (!paymentIntentId || !paymentMethodId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    logger.info(`Confirming card payment for user ${userId}`);

    // Confirm the payment intent
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    if (paymentIntent.status === 'succeeded') {
      logger.info(`✅ Card payment succeeded: ${paymentIntent.id}`);
      
      // Create subscription record
      await createSubscriptionRecord(paymentIntent);

      res.json({
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
        },
      });
    } else {
      res.json({
        success: false,
        error: 'Payment failed or requires additional authentication',
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
        },
      });
    }
  } catch (error) {
    logger.error('❌ Card payment confirmation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment confirmation failed',
    });
  }
});

/**
 * @route PUT /api/users/subscription
 * @desc Update user subscription
 */
router.put('/users/subscription', async (req: Request, res: Response) => {
  try {
    const { userId, subscriptionTier, planId, subscribedAt, transactionId, productId, purchaseDate, platform } = req.body;

    if (!userId || !subscriptionTier || !planId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    logger.info(`Updating subscription for user ${userId} to ${subscriptionTier}`);

    // Calculate expiration date based on plan
    let expiresAt: string;
    
    if (planId === 'lifetime') {
      // Lifetime subscriptions don't expire
      expiresAt = new Date('2099-12-31').toISOString();
    } else {
      const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
      expiresAt = calculateExpirationDate(plan?.interval || 'month');
    }

    // Update user profile in Supabase
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_tier: subscriptionTier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      logger.error('Failed to update user profile:', error);
      return res.status(500).json({ error: 'Failed to update subscription' });
    }

    // Create subscription record
    const subscriptionData: any = {
      user_id: userId,
      plan_id: planId,
      status: 'active',
      current_period_start: subscribedAt || purchaseDate || new Date().toISOString(),
      current_period_end: expiresAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add Apple-specific fields if this is an Apple purchase
    if (platform === 'ios' && transactionId) {
      subscriptionData.apple_transaction_id = transactionId;
      subscriptionData.apple_product_id = productId;
      subscriptionData.purchase_platform = 'ios';
    }

    const { error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .upsert(subscriptionData);

    if (subError) {
      logger.error('Failed to create subscription record:', subError);
    }

    logger.info(`✅ Subscription updated successfully for user ${userId}`);

    res.json({
      success: true,
      subscription: {
        tier: subscriptionTier,
        planId,
        expiresAt,
      },
    });
  } catch (error) {
    logger.error('❌ Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

/**
 * @route POST /api/users/subscription/validate
 * @desc Validate user subscription status
 */
router.post('/users/subscription/validate', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    logger.info(`Validating subscription for user ${userId}`);

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (profileError) {
      logger.error('Failed to fetch user profile:', profileError);
      return res.json({ isActive: false, tier: 'free' });
    }

    // Get subscription details
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    const isActive = subscription && new Date(subscription.current_period_end) > new Date();

    res.json({
      isActive: isActive || false,
      tier: profile?.subscription_tier || 'free',
      expiresAt: subscription?.current_period_end,
    });
  } catch (error) {
    logger.error('❌ Error validating subscription:', error);
    res.json({ isActive: false, tier: 'free' });
  }
});

// Helper functions

async function getOrCreateStripeCustomer(userId: string) {
  try {
    // Check if customer exists in database
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profile?.stripe_customer_id) {
      // Return existing customer
      return await stripe.customers.retrieve(profile.stripe_customer_id);
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: profile?.email,
      metadata: { userId },
    });

    // Save customer ID to database
    await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', userId);

    return customer;
  } catch (error) {
    logger.error('Error creating Stripe customer:', error);
    throw error;
  }
}

async function createSubscriptionRecord(paymentIntent: Stripe.PaymentIntent) {
  try {
    const userId = paymentIntent.metadata.userId;
    const planId = paymentIntent.metadata.planId;
    
    if (!userId || !planId) return;

    const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
    const expiresAt = calculateExpirationDate(plan.interval);

    await supabaseAdmin
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        stripe_payment_intent_id: paymentIntent.id,
        plan_id: planId,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: expiresAt,
        amount_paid: paymentIntent.amount,
        currency: paymentIntent.currency,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    logger.info(`✅ Subscription record created for user ${userId}`);
  } catch (error) {
    logger.error('Failed to create subscription record:', error);
  }
}

function calculateExpirationDate(interval: string): string {
  const now = new Date();
  
  switch (interval) {
    case 'week':
      now.setDate(now.getDate() + 7);
      break;
    case 'month':
      now.setMonth(now.getMonth() + 1);
      break;
    case 'year':
      now.setFullYear(now.getFullYear() + 1);
      break;
    default:
      now.setMonth(now.getMonth() + 1); // Default to monthly
  }
  
  return now.toISOString();
}

export default router; 