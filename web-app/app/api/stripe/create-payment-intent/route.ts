import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

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

interface CreatePaymentIntentRequest {
  amount: number // Amount in cents
  currency?: string
  subscription_type?: string
  customer_data?: {
    email?: string
    name?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: CreatePaymentIntentRequest = await request.json()
    const { amount, currency = 'usd', subscription_type, customer_data } = body

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      )
    }

    // Get authenticated user from Supabase
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header is required' },
        { status: 401 }
      )
    }

    // Extract the token from the Authorization header
    const token = authHeader.replace('Bearer ', '')
    
    // Verify the user with Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Get or create Stripe customer
    let stripeCustomer: Stripe.Customer | null = null
    
    if (customer_data?.email) {
      // Search for existing customer by email
      const existingCustomers = await stripe.customers.list({
        email: customer_data.email,
        limit: 1
      })
      
      if (existingCustomers.data.length > 0) {
        stripeCustomer = existingCustomers.data[0]
      } else {
        // Create new customer
        stripeCustomer = await stripe.customers.create({
          email: customer_data.email,
          name: customer_data.name,
          metadata: {
            user_id: user.id
          }
        })
      }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: stripeCustomer?.id,
      metadata: {
        user_id: user.id,
        subscription_type: subscription_type || '',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    // Store payment record in Supabase
    const { error: dbError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: user.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount,
        currency,
        status: 'pending',
        subscription_type,
        customer_email: customer_data?.email,
        customer_name: customer_data?.name,
        stripe_customer_id: stripeCustomer?.id,
        metadata: {
          created_via: 'api',
          payment_intent_status: paymentIntent.status
        }
      })

    if (dbError) {
      console.error('Error storing payment in database:', dbError)
      // Don't fail the request if database insert fails
      // The webhook will handle this as backup
    }

    // Return client secret to frontend
    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    })

  } catch (error) {
    console.error('Error creating payment intent:', error)
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
