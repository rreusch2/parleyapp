# Stripe Integration Setup Guide

## 🎉 Your Enhanced Web Subscription Modal is Ready!

I've created a beautiful, web-optimized tiered subscription modal that matches your actual Stripe pricing structure and enhances the design from your mobile app.

## 📁 Files Created/Updated

### ✅ Core Components
- `components/TieredSubscriptionModal.tsx` - Enhanced subscription modal
- `lib/stripe.ts` - Updated with your actual pricing structure
- `app/pricing/page.tsx` - Demo pricing page

### ✅ API Routes
- `app/api/stripe/create-checkout-session/route.ts` - Checkout session creation
- `app/api/stripe/webhook/route.ts` - Webhook handling for payments
- `app/api/stripe/verify-session/route.ts` - Session verification

### ✅ Success Flow
- `app/checkout/success/page.tsx` - Post-checkout success page

## 🔧 Required Setup Steps

### 1. Environment Variables
Add these to your `.env.local`:

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook endpoint secret

# App Configuration  
NEXT_PUBLIC_APP_URL=http://localhost:3000 # Your app URL

# Supabase (for webhook database updates)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Update Stripe Product IDs

In `lib/stripe.ts`, replace the placeholder IDs with your actual Stripe product/price IDs:

```typescript
PRO_WEEKLY: {
  // ...
  stripeProductId: 'prod_YOUR_ACTUAL_PRODUCT_ID',
  stripePriceId: 'price_YOUR_ACTUAL_PRICE_ID',
  // ...
}
```

**Your Stripe Products (from dashboard):**
- Lifetime Pro: $349.99 → Update `PRO_LIFETIME`
- Yearly Elite: $199.99/year → Update `ELITE_YEARLY`  
- Monthly Elite: $29.99/month → Update `ELITE_MONTHLY`
- Weekly Elite: $14.99/week → Update `ELITE_WEEKLY`
- Day Pass Pro: $4.99 → Update `PRO_DAYPASS`
- Yearly Pro: $149.99/year → Update `PRO_YEARLY`
- Weekly Pro: $9.99/week → Update `PRO_WEEKLY`
- Pro Monthly: $19.99/month → Update `PRO_MONTHLY`

### 3. Stripe Webhook Configuration

1. Go to your Stripe Dashboard → Webhooks
2. Create a new endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 4. Database Schema (Supabase)

Ensure your `user_profiles` table has these columns:
```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
```

## 🚀 Usage Examples

### Basic Usage
```tsx
import TieredSubscriptionModal from '../components/TieredSubscriptionModal'

function MyComponent() {
  const [showModal, setShowModal] = useState(false)
  
  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Upgrade to Premium
      </button>
      
      <TieredSubscriptionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        userId={user?.id}
        defaultTier="pro"
        isSignup={false}
      />
    </>
  )
}
```

### Signup Flow
```tsx
<TieredSubscriptionModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  userId={user?.id}
  defaultTier="pro"
  isSignup={true} // Shows "Continue Free" option
/>
```

## 🎨 Design Features

### ✨ What's Enhanced for Web
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Smooth Animations**: Framer Motion for polished interactions
- **Modern UI**: Tailwind CSS with gradients and glassmorphism effects
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Performance**: Optimized for fast loading and smooth scrolling

### 🎯 Key Features
- **Two-Tier System**: Pro and Elite with feature comparison
- **Multiple Billing Cycles**: Weekly, Monthly, Yearly, Lifetime, Day Pass
- **50% Off Promotion**: Built-in promotional pricing display
- **Trial Support**: 3-day free trial badges for yearly plans
- **Stripe Checkout**: Secure, PCI-compliant payment processing
- **Success Flow**: Beautiful post-checkout experience

## 🔗 Integration Points

### With Your Auth System
```tsx
// Get user ID from your auth context
const { user } = useAuth()

<TieredSubscriptionModal
  userId={user?.id}
  // ... other props
/>
```

### With Your Backend
The webhook automatically updates user subscription status in your Supabase database.

## 🐛 Testing

### Test Mode Setup
1. Use Stripe test keys
2. Test with Stripe's test card numbers:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`

### Local Testing
```bash
# Install Stripe CLI for webhook testing
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Test the pricing page
npm run dev
# Visit: http://localhost:3000/pricing
```

## 🚨 Important Notes

1. **Replace Demo User ID**: The pricing page uses `"demo-user-id"` - replace with real auth
2. **Update Product IDs**: Replace all placeholder Stripe IDs with your actual ones
3. **Test Webhooks**: Ensure webhooks are working before going live
4. **SSL Required**: Stripe requires HTTPS for webhooks in production

## 🎉 Ready to Launch!

Your subscription modal is now ready! The design is inspired by your mobile app but optimized for web with:
- Better typography and spacing
- Enhanced animations and interactions
- Responsive layout for all screen sizes
- Modern web UI patterns
- Seamless Stripe integration

Test it thoroughly and let me know if you need any adjustments!