# 🚀 Comprehensive Subscription Management System

## **OVERVIEW**

This system replaces manual subscription tracking with RevenueCat webhooks as the single source of truth for renewable subscriptions, while handling non-renewable day passes through custom logic.

## **ARCHITECTURE**

### **Subscription Tier Priority**
1. **Day Pass** (24 hours) → Highest priority
2. **Welcome Bonus** (24 hours) → Second priority  
3. **RevenueCat Subscription** → Third priority
4. **Free Tier** → Default

### **Database Schema Changes**

```sql
-- New columns added to profiles table:
ALTER TABLE profiles 
ADD COLUMN day_pass_tier VARCHAR,              -- 'pro' or 'elite' 
ADD COLUMN day_pass_expires_at TIMESTAMPTZ,    -- 24 hours from grant
ADD COLUMN day_pass_granted_at TIMESTAMPTZ;    -- When granted

-- Existing RevenueCat columns (keep these):
revenuecat_customer_id        -- RC customer ID
subscription_product_id       -- Product purchased  
subscription_plan_type        -- weekly/monthly/yearly
subscription_tier             -- Updated via webhooks

-- DEPRECATED columns (remove after migration):
subscription_expires_at       -- RevenueCat handles this
subscription_status          -- RevenueCat provides this
```

## **IMPLEMENTATION COMPONENTS**

### **1. RevenueCat Webhook Handler**
- **File:** `backend/src/services/revenueCatWebhookHandler.ts`
- **Purpose:** Processes all RevenueCat events and updates `subscription_tier`
- **Events Handled:** 
  - INITIAL_PURCHASE → Grant subscription
  - RENEWAL → Maintain subscription
  - CANCELLATION → Keep active until expiration
  - EXPIRATION → Downgrade to free
  - BILLING_ISSUE → Flag but keep active

### **2. Subscription Tier Service**
- **File:** `backend/src/services/subscriptionTierService.ts`
- **Purpose:** Calculate effective tier with priority logic
- **Key Method:** `getEffectiveTier(userId)` returns highest priority active tier

### **3. Webhook Endpoint**
- **File:** `backend/src/api/routes/revenuecat-webhook.ts`
- **URL:** `POST /api/revenuecat/webhook`
- **Security:** HMAC signature verification
- **Features:** Event logging, error handling

### **4. Subscription Status API**
- **File:** `backend/src/api/routes/subscription-status.ts`
- **Endpoints:**
  - `GET /api/subscription/status` → Full subscription info
  - `GET /api/subscription/tier` → Simple tier check
  - `POST /api/subscription/day-pass/grant` → Grant day pass

### **5. Cleanup Service**
- **File:** `backend/src/scripts/cleanupExpiredSubscriptions.ts`
- **Schedule:** Daily at midnight (cron: `0 0 * * *`)
- **Purpose:** Clean expired day passes and welcome bonuses

## **SETUP INSTRUCTIONS**

### **Step 1: Database Migration**
```bash
# Apply database migration
psql -d your_database -f database/migrations/add_day_pass_tracking.sql
```

### **Step 2: Environment Variables**
```bash
# Add to .env
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_from_revenuecat
```

### **Step 3: Update App Routes**
Add to `backend/src/app.ts`:
```typescript
import revenueCatWebhookRoutes from './api/routes/revenuecat-webhook';
import subscriptionStatusRoutes from './api/routes/subscription-status';

app.use('/api/revenuecat', revenueCatWebhookRoutes);
app.use('/api/subscription', subscriptionStatusRoutes);
```

### **Step 4: Configure RevenueCat Webhook**
1. Go to RevenueCat Dashboard → Project Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/revenuecat/webhook`
3. Enable events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
4. Set webhook secret in environment variables

### **Step 5: Setup Cron Job**
```bash
# Add to crontab
0 0 * * * cd /path/to/backend && npm run cleanup-subscriptions
```

Add to `package.json`:
```json
{
  "scripts": {
    "cleanup-subscriptions": "ts-node src/scripts/cleanupExpiredSubscriptions.ts"
  }
}
```

## **USAGE EXAMPLES**

### **Check User's Effective Tier**
```typescript
import { SubscriptionTierService } from './services/subscriptionTierService';

const tierInfo = await SubscriptionTierService.getEffectiveTier(userId);
console.log(tierInfo);
// {
//   effectiveTier: 'pro',
//   source: 'day_pass',
//   expiresAt: '2024-01-02T12:00:00Z',
//   isDayPass: true,
//   isWelcomeBonus: false
// }
```

### **Grant Day Pass**
```typescript
await SubscriptionTierService.grantDayPass(userId, 'elite');
// Grants elite access for 24 hours
```

### **Update Existing APIs**
Replace old subscription checks:
```typescript
// OLD WAY ❌
const { data: profile } = await supabase
  .from('profiles')
  .select('subscription_tier')
  .eq('id', userId)
  .single();

// NEW WAY ✅
const { effectiveTier } = await SubscriptionTierService.getEffectiveTier(userId);
const limits = SubscriptionTierService.getDailyPickLimits(effectiveTier);
```

## **SUBSCRIPTION TIERS & LIMITS**

| Tier | Daily Picks | Team Picks | Player Props | Insights | Chat Messages |
|------|-------------|------------|--------------|----------|---------------|
| Free | 2 | 1 | 1 | 2 | 3 |
| Pro | 20 | 10 | 10 | 8 | Unlimited |
| Elite | 30 | 15 | 15 | 12 | Unlimited |

## **DAY PASS LOGIC**

### **Purchase Flow**
1. User purchases day pass (Pro $5 or Elite $8)
2. Payment processor calls `/api/subscription/day-pass/grant`
3. `day_pass_tier` set to 'pro' or 'elite'
4. `day_pass_expires_at` set to NOW() + 24 hours
5. User immediately gets tier access

### **Expiration Flow**
1. Daily cron job runs at midnight
2. `cleanupExpiredSubscriptions.ts` finds expired day passes
3. `day_pass_tier` reset to NULL
4. User reverts to their base subscription tier

## **TESTING**

### **Test Webhook Endpoint**
```bash
curl https://your-domain.com/api/revenuecat/webhook/test
```

### **Test Day Pass Grant**
```bash
curl -X POST https://your-domain.com/api/subscription/day-pass/grant \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "tier": "pro"}'
```

### **Test Tier Calculation**
```bash
curl "https://your-domain.com/api/subscription/tier?userId=user-123"
```

## **MONITORING & DEBUGGING**

### **Webhook Logs**
Check `revenuecat_webhook_events` table for:
- Failed webhook processing
- Signature verification issues
- User tier updates

### **System Logs**  
Check `system_logs` table for:
- Daily cleanup results
- Error tracking
- Performance metrics

## **MIGRATION STRATEGY**

### **Phase 1: Deploy New System**
- Deploy webhook handler and tier service
- Configure RevenueCat webhooks
- Test with new users only

### **Phase 2: Migrate Existing Users**
- Run migration script to populate RevenueCat customer IDs
- Update existing subscription_tier values
- Verify all users have correct tiers

### **Phase 3: Deprecate Old System**
- Remove `subscription_expires_at` checks from APIs
- Delete deprecated columns
- Update all subscription-checking code

## **BENEFITS**

✅ **RevenueCat Single Source of Truth**: No more manual expiration tracking
✅ **Handles Complex Scenarios**: Cancellations, renewals, billing issues
✅ **Day Pass Support**: Non-renewable subscriptions work seamlessly  
✅ **Audit Trail**: Complete webhook and cleanup logging
✅ **Scalable**: Handles batch operations and high user volumes
✅ **Flexible**: Easy to add new tiers or modify limits

This system provides bulletproof subscription management that scales with your business and eliminates the complexity of manual subscription tracking.
