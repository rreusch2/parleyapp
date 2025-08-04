import { loadStripe, Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null>

const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    
    if (!publishableKey) {
      throw new Error('Missing Stripe publishable key')
    }
    
    stripePromise = loadStripe(publishableKey)
  }
  
  return stripePromise
}

export default getStripe

// Subscription plans matching your actual Stripe products
export const SUBSCRIPTION_PLANS = {
  // Pro Tier
  PRO_WEEKLY: {
    id: 'pro_weekly',
    name: 'Weekly Pro',
    price: 9.99,
    interval: 'week',
    stripeProductId: 'prod_weekly_pro', // Replace with actual Stripe product ID
    stripePriceId: 'price_weekly_pro', // Replace with actual Stripe price ID
    tier: 'pro',
    features: [
      '20 Daily AI Picks',
      '8 Daily Insights',
      'Unlimited Chat',
      'Daily AI Predictions',
      'Professor Lock Chat'
    ]
  },
  PRO_MONTHLY: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    price: 19.99,
    interval: 'month',
    stripeProductId: 'prod_monthly_pro',
    stripePriceId: 'price_monthly_pro',
    tier: 'pro',
    savings: 'Save 17%',
    features: [
      '20 Daily AI Picks',
      '8 Daily Insights',
      'Unlimited Chat',
      'Daily AI Predictions',
      'Professor Lock Chat'
    ]
  },
  PRO_YEARLY: {
    id: 'pro_yearly',
    name: 'Yearly Pro',
    price: 149.99,
    interval: 'year',
    stripeProductId: 'prod_yearly_pro',
    stripePriceId: 'price_yearly_pro',
    tier: 'pro',
    savings: 'Save 50%',
    trial: '3-day free trial',
    features: [
      '20 Daily AI Picks',
      '8 Daily Insights',
      'Unlimited Chat',
      'Daily AI Predictions',
      'Professor Lock Chat',
      '3-Day FREE Trial'
    ]
  },
  PRO_LIFETIME: {
    id: 'pro_lifetime',
    name: 'Lifetime Pro',
    price: 349.99,
    interval: 'lifetime',
    stripeProductId: 'prod_lifetime_pro',
    stripePriceId: 'price_lifetime_pro',
    tier: 'pro',
    savings: 'Best Value',
    features: [
      '20 Daily AI Picks',
      '8 Daily Insights',
      'Unlimited Chat',
      'Daily AI Predictions',
      'Professor Lock Chat',
      'Lifetime Access'
    ]
  },
  PRO_DAYPASS: {
    id: 'pro_daypass',
    name: 'Day Pass Pro',
    price: 4.99,
    interval: 'day',
    stripeProductId: 'prod_daypass_pro',
    stripePriceId: 'price_daypass_pro',
    tier: 'pro',
    features: [
      '20 AI Picks (24h)',
      '8 Insights (24h)',
      'Unlimited Chat (24h)',
      'Daily AI Predictions',
      'Professor Lock Chat (24h)'
    ]
  },
  // Elite Tier
  ELITE_WEEKLY: {
    id: 'elite_weekly',
    name: 'Weekly Elite',
    price: 14.99,
    interval: 'week',
    stripeProductId: 'prod_weekly_elite',
    stripePriceId: 'price_weekly_elite',
    tier: 'elite',
    features: [
      '30 Daily AI Picks',
      '12 Daily Insights',
      'Advanced Professor Lock',
      'Premium Analytics',
      '🔒 Lock of the Day',
      'Elite Exclusive Features'
    ]
  },
  ELITE_MONTHLY: {
    id: 'elite_monthly',
    name: 'Monthly Elite',
    price: 29.99,
    interval: 'month',
    stripeProductId: 'prod_monthly_elite',
    stripePriceId: 'price_monthly_elite',
    tier: 'elite',
    savings: 'Save 17%',
    features: [
      '30 Daily AI Picks',
      '12 Daily Insights',
      'Advanced Professor Lock',
      'Premium Analytics',
      '🔒 Lock of the Day',
      'Elite Exclusive Features'
    ]
  },
  ELITE_YEARLY: {
    id: 'elite_yearly',
    name: 'Yearly Elite',
    price: 199.99,
    interval: 'year',
    stripeProductId: 'prod_yearly_elite',
    stripePriceId: 'price_yearly_elite',
    tier: 'elite',
    savings: 'Save 50%',
    trial: '3-day free trial',
    features: [
      '30 Daily AI Picks',
      '12 Daily Insights',
      'Advanced Professor Lock',
      'Premium Analytics',
      '🔒 Lock of the Day',
      'Elite Exclusive Features',
      '3-Day FREE Trial'
    ]
  }
}

// Helper function to create Stripe checkout session
export const createCheckoutSession = async (priceId: string, userId: string, mode?: 'subscription' | 'payment') => {
  try {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        userId,
        mode, // Pass mode to determine subscription vs one-time payment
        successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/pricing`,
      }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create checkout session')
    }

    return data.sessionId
  } catch (error) {
    console.error('Error creating checkout session:', error)
    throw error
  }
}

// Helper function to determine if a plan is a one-time payment
export const isOneTimePayment = (planId: string): boolean => {
  return planId.includes('LIFETIME') || planId.includes('DAYPASS')
}

// Helper function to get the correct checkout mode
export const getCheckoutMode = (planId: string): 'subscription' | 'payment' => {
  return isOneTimePayment(planId) ? 'payment' : 'subscription'
}

// Helper function to redirect to Stripe Checkout
export const redirectToCheckout = async (sessionId: string) => {
  const stripe = await getStripe()
  
  if (!stripe) {
    throw new Error('Stripe failed to load')
  }

  const { error } = await stripe.redirectToCheckout({
    sessionId,
  })

  if (error) {
    console.error('Stripe checkout error:', error)
    throw error
  }
}
