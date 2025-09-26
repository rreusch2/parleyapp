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

    // Get user details from Supabase profiles; if missing, fetch from Auth and auto-create
    let user: { id: string; email: string | null; username: string | null } | null = null;
    const { data: profileRow, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, username')
      .eq('id', userId)
      .single();

    if (profileRow) {
      user = profileRow as any;
    } else {
      console.warn('⚠️ Profile not found for user, attempting to load from Auth and create profile:', userId, profileErr);
      const { data: authRes, error: authErr } = await (supabaseAdmin as any).auth.admin.getUserById(userId);
      if (authErr || !authRes?.user) {
        console.error('❌ Error fetching user from Supabase Auth:', authErr);
        return res.status(404).json({ error: 'User not found' });
      }

      const authUser = authRes.user;
      const email = authUser.email ?? null;
      const usernameFromMeta = (authUser.user_metadata?.full_name as string | undefined)
        || (authUser.user_metadata?.name as string | undefined)
        || null;

      const { data: upserted, error: upsertErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email,
          username: usernameFromMeta,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id, email, username')
        .single();

      if (upsertErr || !upserted) {
        console.error('❌ Failed to create profile for user:', upsertErr);
        return res.status(500).json({ error: 'Failed to create user profile' });
      }

      user = upserted as any;
      console.log('✅ Created missing profile for user:', userId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create or retrieve Stripe customer
    let customerId: string;
    const { data: existingCustomer, error: scErr } = await supabaseAdmin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();
    const canPersistStripeCustomer = !scErr;

    if (existingCustomer?.stripe_customer_id) {
      customerId = existingCustomer.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const params: Stripe.CustomerCreateParams = {
        metadata: {
          userId: String(userId),
          tier: String(planDetails.tier),
        },
      };
      if (user.email) params.email = String(user.email);
      if (user.username) params.name = String(user.username);

      const customer = await stripe.customers.create(params);
      customerId = customer.id;

      if (canPersistStripeCustomer) {
        // Store customer ID in database if table exists
        const { error: persistErr } = await supabaseAdmin
          .from('stripe_customers')
          .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            created_at: new Date().toISOString()
          });
        if (persistErr) {
          console.warn('⚠️ Could not persist stripe customer id:', persistErr);
        }
      } else {
        console.warn('⚠️ stripe_customers table not found; skipping persistence.');
      }
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

    if (paymentIntent.status !== 'succeeded' && paymentIntent.status !== 'processing') {
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
      subscription_source: 'stripe',
      updated_at: new Date().toISOString()
    };

    if (type === 'subscription' && subscriptionEndsAt) {
      updateData.subscription_expires_at = subscriptionEndsAt;
    }

    if (planId.includes('daypass') && subscriptionEndsAt) {
      updateData.day_pass_tier = tier;
      updateData.day_pass_expires_at = subscriptionEndsAt;
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

    // Log the purchase (best-effort; table may not exist in this schema)
    const { error: purchaseLogErr } = await supabaseAdmin
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
      } as any);
    if (purchaseLogErr) {
      console.warn('⚠️ Skipping purchase_history log (table missing or error):', purchaseLogErr);
    }

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
