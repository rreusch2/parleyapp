import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// Create Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    // Get the raw body as text for signature verification
    const body = await request.text()
    const headersList = headers()
    const sig = headersList.get('stripe-signature')

    if (!sig) {
      console.error('No Stripe signature found')
      return NextResponse.json(
        { error: 'No signature found' },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      // Verify the webhook signature
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err}` },
        { status: 400 }
      )
    }

    console.log('Received Stripe webhook event:', event.type)

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
        break
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent)
        break
      
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent)
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

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id)
  
  try {
    // Update payment status in database
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'succeeded',
        metadata: {
          ...paymentIntent.metadata,
          stripe_payment_method: paymentIntent.payment_method,
          payment_succeeded_at: new Date().toISOString()
        }
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    if (paymentError) {
      console.error('Error updating payment status:', paymentError)
      return
    }

    // Get user_id from payment intent metadata
    const userId = paymentIntent.metadata.user_id
    const subscriptionType = paymentIntent.metadata.subscription_type

    if (userId && subscriptionType) {
      // Update user's subscription in profiles table
      const subscriptionData = getSubscriptionData(subscriptionType)
      
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_tier: subscriptionData.tier,
          subscription_status: 'active',
          subscription_plan_type: subscriptionData.planType,
          subscription_started_at: new Date().toISOString(),
          subscription_expires_at: subscriptionData.expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (profileError) {
        console.error('Error updating user profile:', profileError)
      } else {
        console.log(`Updated subscription for user ${userId} to ${subscriptionType}`)
      }
    }

  } catch (error) {
    console.error('Error handling payment success:', error)
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id)
  
  try {
    const { error } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'failed',
        metadata: {
          ...paymentIntent.metadata,
          failure_reason: paymentIntent.last_payment_error?.message || 'Unknown error',
          payment_failed_at: new Date().toISOString()
        }
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    if (error) {
      console.error('Error updating failed payment status:', error)
    }
  } catch (error) {
    console.error('Error handling payment failure:', error)
  }
}

async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment canceled:', paymentIntent.id)
  
  try {
    const { error } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'canceled',
        metadata: {
          ...paymentIntent.metadata,
          payment_canceled_at: new Date().toISOString()
        }
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    if (error) {
      console.error('Error updating canceled payment status:', error)
    }
  } catch (error) {
    console.error('Error handling payment cancellation:', error)
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Subscription created:', subscription.id)
  // Handle subscription creation logic here
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id)
  // Handle subscription update logic here
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id)
  // Handle subscription deletion logic here
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Invoice payment succeeded:', invoice.id)
  // Handle successful invoice payment here
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Invoice payment failed:', invoice.id)
  // Handle failed invoice payment here
}

function getSubscriptionData(subscriptionType: string) {
  const now = new Date()
  let expiresAt: Date
  let tier: string
  let planType: string

  switch (subscriptionType) {
    case 'pro_monthly':
      tier = 'pro'
      planType = 'monthly'
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
      break
    case 'pro_yearly':
      tier = 'pro'
      planType = 'yearly'
      expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 365 days
      break
    case 'elite_monthly':
      tier = 'elite'
      planType = 'monthly'
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
      break
    case 'elite_yearly':
      tier = 'elite'
      planType = 'yearly'
      expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 365 days
      break
    default:
      tier = 'free'
      planType = 'monthly'
      expiresAt = now
  }

  return {
    tier,
    planType,
    expiresAt: expiresAt.toISOString()
  }
}
