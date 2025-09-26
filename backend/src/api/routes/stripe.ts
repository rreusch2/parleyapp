import express from 'express';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../services/supabaseClient';

const router = express.Router();

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Subscription plan mappings
const SUBSCRIPTION_PLANS = {
  // Pro Tier
  'pro_weekly': { amount: 999, interval: 'week', tier: 'pro' }, // $9.99
  'pro_monthly': { amount: 2499, interval: 'month', tier: 'pro' }, // $24.99
  'pro_yearly': { amount: 14999, interval: 'year', tier: 'pro' }, // $149.99
  'pro_daypass': { amount: 499, interval: 'one_time', tier: 'pro' }, // $4.99
  'pro_lifetime': { amount: 49999, interval: 'one_time', tier: 'pro' }, // $499.99
  
  // Elite Tier
  'elite_weekly': { amount: 1499, interval: 'week', tier: 'elite' }, // $14.99
  'elite_monthly': { amount: 2999, interval: 'month', tier: 'elite' }, // $29.99
  'elite_yearly': { amount: 19999, interval: 'year', tier: 'elite' }, // $199.99
  'elite_daypass': { amount: 899, interval: 'one_time', tier: 'elite' }, // $8.99
};

interface AuthenticatedRequest extends express.Request {
  userId?: string;
}

/**
 * @route POST /api/stripe/create-payment-intent
 * @desc Create a Payment Intent for subscription
 * @access Private
 */
router.post('/create-payment-intent', async (req: AuthenticatedRequest, res) => {
  try {
    const { planId, userId } = req.body;

    if (!planId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: planId and userId'
      });
    }

    const planDetails = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
    if (!planDetails) {
      return res.status(400).json({
        error: 'Invalid subscription plan'
      });
    }

    // Get user details from Supabase
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('❌ Error fetching user:', userError);
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Create or retrieve Stripe customer
    let customerId: string;
    const { data: existingCustomer } = await supabaseAdmin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (existingCustomer?.stripe_customer_id) {
      customerId = existingCustomer.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        metadata: {
          userId: userId,
          tier: planDetails.tier
        }
      });

      customerId = customer.id;

      // Store customer ID in database
      await supabaseAdmin
        .from('stripe_customers')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          created_at: new Date().toISOString()
        });
    }

    let paymentIntent: Stripe.PaymentIntent;

    if (planDetails.interval === 'one_time') {
      // One-time payment for day pass or lifetime
      paymentIntent = await stripe.paymentIntents.create({
        amount: planDetails.amount,
        currency: 'usd',
        customer: customerId,
        payment_method_types: ['card'],
        metadata: {
          planId,
          userId,
          tier: planDetails.tier,
          type: 'one_time'
        },
        description: `${planDetails.tier.charAt(0).toUpperCase() + planDetails.tier.slice(1)} ${planId.includes('daypass') ? 'Day Pass' : 'Lifetime'} - Predictive Play`
      });
    } else {
      // Recurring subscription - create subscription with setup intent
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Predictive Play ${planDetails.tier.charAt(0).toUpperCase() + planDetails.tier.slice(1)}`,
            } as any,
            unit_amount: planDetails.amount,
            recurring: {
              interval: planDetails.interval as 'week' | 'month' | 'year'
            }
          } as any
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          planId,
          userId,
          tier: planDetails.tier,
          type: 'subscription'
        }
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
    }

    if (!paymentIntent) {
      throw new Error('Failed to create payment intent');
    }

    console.log('✅ Created Stripe Payment Intent:', paymentIntent.id, 'for plan:', planId);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId,
      planDetails: {
        planId,
        amount: planDetails.amount,
        tier: planDetails.tier,
        interval: planDetails.interval
      }
    });

  } catch (error: any) {
    console.error('❌ Stripe Payment Intent creation error:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error.message
    });
  }
});

/**
 * @route POST /api/stripe/confirm-payment
 * @desc Confirm payment and update user subscription
 * @access Private
 */
router.post('/confirm-payment', async (req: AuthenticatedRequest, res) => {
  try {
    const { paymentIntentId, userId } = req.body;

    if (!paymentIntentId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: paymentIntentId and userId'
      });
    }

    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment not completed',
        status: paymentIntent.status
      });
    }

    const { planId, tier, type } = paymentIntent.metadata;
    const planDetails = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];

    if (!planDetails) {
      return res.status(400).json({
        error: 'Invalid plan in payment metadata'
      });
    }

    // Calculate subscription end date
    let subscriptionEndsAt: string | null = null;
    if (type === 'subscription') {
      const now = new Date();
      let endDate: Date;
      switch (planDetails.interval) {
        case 'week':
          endDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
          break;
        case 'month':
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
          break;
        case 'year':
          endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
          break;
        default:
          endDate = now;
      }
      subscriptionEndsAt = endDate.toISOString();
    } else if (planId.includes('daypass')) {
      const endDate = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
      subscriptionEndsAt = endDate.toISOString();
    }
    // For lifetime, subscriptionEndsAt remains null

    // Update user profile
    const updateData: any = {
      subscription_tier: tier,
      subscription_status: 'active',
      subscription_plan_type: planId,
      payment_provider: 'stripe',
      updated_at: new Date().toISOString()
    };

    if (subscriptionEndsAt) {
      updateData.subscription_ends_at = subscriptionEndsAt;
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Error updating user subscription:', updateError);
      return res.status(500).json({
        error: 'Failed to update subscription status'
      });
    }

    // Log the purchase
    await supabaseAdmin
      .from('purchase_history')
      .insert({
        user_id: userId,
        payment_provider: 'stripe',
        payment_intent_id: paymentIntentId,
        plan_id: planId,
        tier: tier,
        amount: planDetails.amount,
        currency: 'usd',
        status: 'completed',
        created_at: new Date().toISOString()
      });

    console.log('✅ Stripe subscription activated for user:', userId, 'plan:', planId);

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: {
        tier,
        planId,
        status: 'active',
        endsAt: subscriptionEndsAt
      }
    });

  } catch (error: any) {
    console.error('❌ Stripe payment confirmation error:', error);
    res.status(500).json({
      error: 'Failed to confirm payment',
      message: error.message
    });
  }
});

/**
 * @route GET /api/stripe/payment-methods/:customerId
 * @desc Get saved payment methods for customer
 * @access Private
 */
router.get('/payment-methods/:customerId', async (req: AuthenticatedRequest, res) => {
  try {
    const { customerId } = req.params;

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    res.json({
      success: true,
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year
      }))
    });

  } catch (error: any) {
    console.error('❌ Error fetching payment methods:', error);
    res.status(500).json({
      error: 'Failed to fetch payment methods',
      message: error.message
    });
  }
});

export default router;
