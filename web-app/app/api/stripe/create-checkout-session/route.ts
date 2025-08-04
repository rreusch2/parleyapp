import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(req: NextRequest) {
  try {
    const { priceId, userId, successUrl, cancelUrl } = await req.json()

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Determine if this is a one-time or recurring purchase
    // One-time products (like Lifetime Pro) should use 'payment' mode
    // Recurring subscriptions should use 'subscription' mode
    const isOneTimeProduct = priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_LIFETIME || 
                             priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_DAYPASS;
    
    // Create Stripe checkout session with appropriate mode
    const session = await stripe.checkout.sessions.create({
      mode: isOneTimeProduct ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      metadata: {
        userId,
        productType: isOneTimeProduct ? 'one_time' : 'subscription'
      },
      customer_email: undefined, // You can add user email here if available
      allow_promotion_codes: true,
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error: any) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}