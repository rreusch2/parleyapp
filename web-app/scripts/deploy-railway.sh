#!/bin/bash

# Railway deployment script for Stripe integration
echo "🚀 Preparing deployment to Railway..."

# Validate environment variables
echo "📋 Validating environment variables..."
node scripts/validate-env.js

if [ $? -ne 0 ]; then
  echo "❌ Environment validation failed. Please fix the issues above."
  exit 1
fi

# Check if Railway environment variables are set
echo "🔧 Setting Railway environment variables..."

# Set Stripe environment variables in Railway
if [ -n "$STRIPE_SECRET_KEY" ]; then
  railway variables set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
fi

if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
  railway variables set STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET"
fi

if [ -n "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" ]; then
  railway variables set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
fi

if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  railway variables set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
fi

# Commit and push changes
echo "📝 Committing changes..."
git add .
git commit -m "feat: Add Stripe payment processing with webhooks

- Add create-payment-intent API route with authentication
- Add webhook handler for payment events
- Create payments table with RLS policies
- Update user subscriptions on successful payments
- Configure Next.js for Railway deployment"

# Push to trigger Railway deployment
echo "🚀 Deploying to Railway..."
git push origin main

echo "✅ Deployment initiated! Check Railway dashboard for status."
echo "📝 Next steps:"
echo "   1. Configure your Stripe webhook endpoint in Stripe Dashboard"
echo "   2. Set webhook URL to: https://your-railway-domain.railway.app/api/stripe/webhook"
echo "   3. Select events: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled"
echo "   4. Test the payment flow with Stripe test cards"
