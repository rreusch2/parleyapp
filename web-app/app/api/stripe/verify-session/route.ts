import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price.product']
    })

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      )
    }

    // Extract plan information
    let planInfo = {
      tier: 'free',
      planName: 'Unknown Plan',
      trialEnd: null
    }

    if (session.mode === 'subscription' && session.subscription) {
      const subscription = session.subscription as Stripe.Subscription
      const price = subscription.items.data[0]?.price
      const product = price?.product as Stripe.Product

      // Determine tier from product name or price ID
      if (product?.name?.toLowerCase().includes('elite') || price?.id?.includes('elite')) {
        planInfo.tier = 'elite'
        planInfo.planName = product?.name || 'Elite Plan'
      } else if (product?.name?.toLowerCase().includes('pro') || price?.id?.includes('pro')) {
        planInfo.tier = 'pro'
        planInfo.planName = product?.name || 'Pro Plan'
      }

      // Check for trial
      if (subscription.trial_end) {
        planInfo.trialEnd = subscription.trial_end * 1000 // Convert to JS timestamp
      }
    } else if (session.mode === 'payment') {
      // Handle one-time purchases
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId)
      const price = lineItems.data[0]?.price
      
      if (price?.id?.includes('lifetime') || price?.id?.includes('pro')) {
        planInfo.tier = 'pro'
        planInfo.planName = 'Lifetime Pro'
      } else if (price?.id?.includes('daypass')) {
        planInfo.tier = 'pro'
        planInfo.planName = 'Day Pass Pro'
      }
    }

    return NextResponse.json({
      sessionId: session.id,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      ...planInfo
    })
  } catch (error: any) {
    console.error('Session verification error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify session' },
      { status: 500 }
    )
  }
}