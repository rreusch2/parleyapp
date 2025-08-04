# Stripe Configuration Template

After obtaining your Stripe keys, add these to your `.env.local` file:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

## Webhook Endpoint Configuration

Your webhook endpoint URL for Stripe:
```
https://zooming-rebirth-production-a305.up.railway.app/api/stripe/webhook
```

## Required Webhook Events
- payment_intent.succeeded
- payment_intent.payment_failed

## Next Steps
1. Go to https://stripe.com and sign in/create account
2. Navigate to Developers → API Keys (ensure Test mode is enabled)
3. Copy the Publishable key (pk_test_...)
4. Copy the Secret key (sk_test_...)
5. Go to Developers → Webhooks
6. Add endpoint with the URL above and the specified events
7. Copy the webhook signing secret (whsec_...)
8. Create .env.local file with the keys above
