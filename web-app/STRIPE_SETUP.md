# Stripe Payment Integration Setup

This guide explains how to set up Stripe payment processing for the PredictivePlay web app.

## 📝 Overview

The implementation includes:
- **Payment Intent API**: Creates secure payment intents for subscriptions
- **Webhook Handler**: Processes Stripe events and updates user subscriptions
- **Database Integration**: Tracks payments and updates user profiles in Supabase
- **Authentication**: Secured API routes with Supabase authentication

## 🔧 Setup Instructions

### 1. Environment Variables

Add these to your `.env.local` file and Railway environment:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here

# Supabase (if not already set)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

### 2. Stripe Dashboard Configuration

1. **Create Products & Prices**:
   - Pro Monthly: $19.99/month
   - Pro Yearly: $199.99/year (17% savings)
   - Elite Monthly: $49.99/month
   - Elite Yearly: $499.99/year (17% savings)

2. **Set up Webhook Endpoint**:
   - URL: `https://your-railway-domain.railway.app/api/stripe/webhook`
   - Events to select:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
   - Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 3. Database Setup

The `payments` table is automatically created via migration. It includes:
- Payment tracking with RLS policies
- User subscription updates
- Stripe payment intent integration

### 4. Deploy to Railway

Run the deployment script:

```bash
npm run deploy:railway
```

Or manually:

```bash
# Set environment variables in Railway
railway variables set STRIPE_SECRET_KEY="sk_test_..."
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."
railway variables set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
railway variables set SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Deploy
git add .
git commit -m "Add Stripe payment integration"
git push origin main
```

## 📚 API Endpoints

### POST `/api/stripe/create-payment-intent`

Creates a payment intent for a subscription.

**Headers:**
```
Authorization: Bearer [supabase_access_token]
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 1999,
  "currency": "usd",
  "subscription_type": "pro_monthly",
  "customer_data": {
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Response:**
```json
{
  "client_secret": "pi_xxx_secret_xxx",
  "payment_intent_id": "pi_xxx"
}
```

### POST `/api/stripe/webhook`

Handles Stripe webhook events (signature verified).

## 🧪 Testing

### Test Cards

Use Stripe's test cards:
- **Success**: `4242424242424242`
- **Decline**: `4000000000000002`
- **3D Secure**: `4000002500003155`

### Testing Flow

1. Create a payment intent via API
2. Use Stripe Elements on frontend to collect payment
3. Confirm payment with test card
4. Verify webhook processes the event
5. Check user subscription is updated in Supabase

## 🔍 Monitoring

- **Railway Logs**: Check deployment and runtime logs
- **Stripe Dashboard**: Monitor payments and webhook deliveries
- **Supabase**: Verify database updates in `payments` and `profiles` tables

## 🛠️ Troubleshooting

### Common Issues

1. **Webhook signature verification fails**:
   - Ensure `STRIPE_WEBHOOK_SECRET` matches your webhook endpoint
   - Check that raw body is being passed to webhook handler

2. **Authentication errors**:
   - Verify Supabase tokens are valid
   - Check `SUPABASE_SERVICE_ROLE_KEY` is set correctly

3. **Database errors**:
   - Ensure `payments` table exists with proper RLS policies
   - Check Supabase service role has necessary permissions

### Debug Commands

```bash
# Validate environment variables
npm run validate-env

# Check Railway deployment status
railway status

# View Railway logs
railway logs
```

## 🔒 Security

- All API routes are authenticated with Supabase
- Webhook signatures are verified with Stripe
- Row Level Security (RLS) is enabled on payments table
- Sensitive operations use service role key
- Environment variables are properly secured

## 🚀 Production Checklist

- [ ] Replace test keys with live Stripe keys
- [ ] Update webhook endpoint to production URL
- [ ] Test payment flow end-to-end
- [ ] Monitor webhook delivery success rate
- [ ] Set up proper error alerting
- [ ] Configure backup webhook endpoint
