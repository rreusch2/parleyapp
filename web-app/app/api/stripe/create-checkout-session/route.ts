import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export async function POST(request: NextRequest) {
  try {
    const { priceId, userId, mode = 'subscription', successUrl, cancelUrl } = await request.json()

    if (!priceId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Determine if this is a one-time payment or subscription
    const checkoutMode = mode === 'payment' ? 'payment' : 'subscription'
    
    // Base session configuration
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: checkoutMode,
      customer_email: undefined, // Let customer enter email
      metadata: {
        userId,
        type: checkoutMode,
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_method_collection: 'always',
      automatic_tax: {
        enabled: true,
      },
      customer_creation: 'always',
      invoice_creation: {
        enabled: true,
        invoice_data: {
          metadata: {
            userId,
            type: checkoutMode,
          },
        },
      },
    }

    // Add subscription-specific configuration
    if (checkoutMode === 'subscription') {
      sessionConfig.subscription_data = {
        metadata: {
          userId,
        },
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return NextResponse.json({ sessionId: session.id })
  } catch (error: any) {
    console.error('Stripe checkout session creation error:', error)
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle one-time payments (like Day Pass and Lifetime)
export async function createOneTimeCheckout(priceId: string, userId: string, successUrl?: string, cancelUrl?: string) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment', // One-time payment instead of subscription
    customer_email: undefined,
    metadata: {
      userId,
      type: 'one_time_purchase',
    },
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    payment_method_collection: 'always',
    automatic_tax: {
      enabled: true,
    },
    customer_creation: 'always',
    invoice_creation: {
      enabled: true,
      invoice_data: {
        metadata: {
          userId,
          type: 'one_time_purchase',
        },
      },
    },
  })

  return session
}