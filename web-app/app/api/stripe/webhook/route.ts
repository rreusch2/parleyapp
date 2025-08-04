import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    console.log('Received Stripe webhook event:', event.type)

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  
  if (!userId) {
    console.error('No userId found in checkout session metadata')
    return
  }

  // Handle both subscription and one-time payments
  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    await updateUserSubscription(userId, subscription, 'active')
  } else if (session.mode === 'payment') {
    // Handle one-time purchases (Day Pass, Lifetime)
    await handleOneTimePurchase(userId, session)
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  
  if (!userId) {
    console.error('No userId found in subscription metadata')
    return
  }

  await updateUserSubscription(userId, subscription, subscription.status as any)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  
  if (!userId) {
    console.error('No userId found in subscription metadata')
    return
  }

  await updateUserSubscription(userId, subscription, subscription.status as any)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId
  
  if (!userId) {
    console.error('No userId found in subscription metadata')
    return
  }

  // Update user to free tier
  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_status: 'canceled',
      subscription_tier: 'free',
      subscription_id: null,
      subscription_current_period_end: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    console.error('Error updating user subscription on deletion:', error)
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscription = invoice.subscription
  
  if (subscription) {
    const sub = await stripe.subscriptions.retrieve(subscription as string)
    const userId = sub.metadata?.userId
    
    if (userId) {
      await updateUserSubscription(userId, sub, 'active')
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscription = invoice.subscription
  
  if (subscription) {
    const sub = await stripe.subscriptions.retrieve(subscription as string)
    const userId = sub.metadata?.userId
    
    if (userId) {
      await updateUserSubscription(userId, sub, 'past_due')
    }
  }
}

async function updateUserSubscription(
  userId: string, 
  subscription: Stripe.Subscription, 
  status: 'active' | 'past_due' | 'canceled' | 'incomplete'
) {
  const priceId = subscription.items.data[0]?.price.id
  
  // Determine tier based on price ID
  let tier = 'free'
  if (priceId?.includes('pro')) {
    tier = 'pro'
  } else if (priceId?.includes('elite')) {
    tier = 'elite'
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_status: status,
      subscription_tier: tier,
      subscription_id: subscription.id,
      subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      stripe_customer_id: subscription.customer as string,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    console.error('Error updating user subscription:', error)
  } else {
    console.log(`Updated user ${userId} subscription to ${tier} (${status})`)
  }
}

async function handleOneTimePurchase(userId: string, session: Stripe.Checkout.Session) {
  // Handle Day Pass or Lifetime purchases
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
  const priceId = lineItems.data[0]?.price?.id
  
  let tier = 'free'
  let expiresAt = null
  
  if (priceId?.includes('daypass')) {
    tier = 'pro'
    // Day pass expires after 24 hours
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  } else if (priceId?.includes('lifetime')) {
    tier = 'pro'
    // Lifetime access - no expiration
    expiresAt = null
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_status: 'active',
      subscription_tier: tier,
      subscription_id: session.id, // Use session ID for one-time purchases
      subscription_current_period_end: expiresAt,
      stripe_customer_id: session.customer as string,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    console.error('Error updating user one-time purchase:', error)
  } else {
    console.log(`Updated user ${userId} with one-time purchase: ${tier}`)
  }
}