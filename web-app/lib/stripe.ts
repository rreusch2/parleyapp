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

// Subscription plans matching your app tiers
export const SUBSCRIPTION_PLANS = {
  PRO_MONTHLY: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    price: 19.99,
    interval: 'month',
    features: [
      'Unlimited AI Predictions',
      'Advanced Analytics',
      'AI Chat Assistant',
      'Live Game Updates',
      'Priority Support'
    ]
  },
  PRO_YEARLY: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    price: 199.99,
    interval: 'year',
    savings: '17% OFF',
    features: [
      'Unlimited AI Predictions',
      'Advanced Analytics', 
      'AI Chat Assistant',
      'Live Game Updates',
      'Priority Support',
      '2 Months FREE'
    ]
  },
  ELITE_MONTHLY: {
    id: 'elite_monthly',
    name: 'Elite Monthly',
    price: 49.99,
    interval: 'month',
    features: [
      'Everything in Pro',
      'Elite Lock of the Day',
      'Professor Insights',
      'Advanced Parlays',
      'Injury Reports',
      'VIP Support',
      'Early Access Features'
    ]
  },
  ELITE_YEARLY: {
    id: 'elite_yearly',
    name: 'Elite Yearly',
    price: 499.99,
    interval: 'year',
    savings: '17% OFF',
    features: [
      'Everything in Pro',
      'Elite Lock of the Day',
      'Professor Insights',
      'Advanced Parlays',
      'Injury Reports',
      'VIP Support',
      'Early Access Features',
      '2 Months FREE'
    ]
  }
}

// Helper function to create Stripe checkout session
export const createCheckoutSession = async (
  priceId: string, 
  userId: string, 
  successUrl?: string, 
  cancelUrl?: string
) => {
  try {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        userId,
        successUrl: successUrl || `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: cancelUrl || `${window.location.origin}/dashboard`,
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
