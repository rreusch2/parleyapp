# RevenueCat Webhook "User Not Found" Fix

## 🚨 Problem Summary

You had **2 unprocessed RevenueCat webhooks** for user `49ded44d-4291-4afb-98b3-c7cc548c8b06` who **does not exist** in your `profiles` table. This causes subscription status updates to fail, preventing proper Pro/Elite tier upgrades and downgrades.

### The Specific Case:
- **RevenueCat Customer ID**: `49ded44d-4291-4afb-98b3-c7cc548c8b06`
- **Event Types**: CANCELLATION + EXPIRATION
- **Subscription**: Elite Weekly (`com.parleyapp.allstarweekly`)
- **Aliases**: `["49ded44d-4291-4afb-98b3-c7cc548c8b06", "$RCAnonymousID:fcfc5e5959074d77b4f6615d91c9a52d"]`
- **Problem**: User doesn't exist anywhere in `profiles` table

## 🔧 Root Causes

1. **User never completed signup** - Subscribed via Apple but never opened the app
2. **Account deleted** - User deleted their account but subscription remained active
3. **Missing attributes** - Webhooks don't include email/username yet (old app version)
4. **Limited lookup strategies** - Only searching by RevenueCat ID, UUID, and Stripe ID

## ✅ Solution Implemented

### Enhanced Webhook Handler (`revenuecat-webhook.ts`)

Added **7 lookup strategies** (was 4):

1. ✅ **Direct RevenueCat Customer ID** (existing)
2. 🆕 **Email lookup** - Uses `subscriber_attributes.$email` from webhook
3. 🆕 **Username lookup** - Uses `subscriber_attributes.$displayName` from webhook
4. 🆕 **Alias array search** - Loops through all aliases to find matches
5. ✅ **Stripe Customer ID** (existing)
6. ✅ **UUID match** (existing)
7. ✅ **Anonymous ID + Stripe linkage** (existing)

### Auto-linking Feature
When a user is found via email, username, or alias, the webhook handler automatically updates their `revenuecat_customer_id` field for future webhooks.

## 📋 New App Version Requirements

For the enhanced email/username lookup to work, your new app version must set these RevenueCat subscriber attributes:

```typescript
// In your app signup/login flow:
await Purchases.setAttributes({
  "$email": user.email,
  "$displayName": user.username
});
```

**Current Status**: Your recent webhooks show these attributes are **NOT YET** being sent. Once the new app version is approved and deployed, future webhooks will include this data.

## 🛠️ Manual Retry Script

Created `/backend/src/scripts/retryUnprocessedWebhooks.ts` to manually process stuck webhooks:

```bash
cd /home/reid/Desktop/parleyapp/backend
npx ts-node src/scripts/retryUnprocessedWebhooks.ts
```

This script:
- ✅ Fetches all unprocessed webhooks
- ✅ Tries all 7 lookup strategies
- ✅ Shows detailed diagnostics for each webhook
- ✅ Auto-links found users
- ✅ Marks successfully processed webhooks
- ✅ Reports orphaned webhooks (truly not found)

## 🔍 What to Do About Orphaned Webhooks

For user `49ded44d-4291-4afb-98b3-c7cc548c8b06`:

### Option 1: Wait (Recommended)
- User might create account later
- New app version with email/username will help identify them
- RevenueCat will send future events if they renew

### Option 2: Contact RevenueCat Support
- Provide customer ID: `49ded44d-4291-4afb-98b3-c7cc548c8b06`
- Ask for subscriber email/information
- Manually create profile if they're a paying customer

### Option 3: Ignore
- If it's a test purchase or cancelled subscription
- Mark webhooks as processed manually:

```sql
UPDATE revenuecat_webhook_events
SET processed_at = NOW(),
    processing_error = 'Orphaned subscription - user never created account'
WHERE revenuecat_customer_id = '49ded44d-4291-4afb-98b3-c7cc548c8b06';
```

## 📊 Impact Analysis

### Before Fix:
- ❌ Only 4 lookup strategies
- ❌ No email/username matching
- ❌ No alias array searching
- ❌ Webhooks stuck forever if initial lookup fails

### After Fix:
- ✅ 7 comprehensive lookup strategies
- ✅ Email/username matching (when new app deploys)
- ✅ Smart alias searching with auto-linking
- ✅ Better error messages for truly orphaned webhooks
- ✅ Manual retry script for bulk processing

## 🚀 Deployment Steps

1. **Deploy backend changes**:
   ```bash
   cd /home/reid/Desktop/parleyapp/backend
   git add .
   git commit -m "fix: Enhanced RevenueCat webhook user lookup with 7 strategies"
   git push
   ```

2. **Run retry script** (optional - to process existing stuck webhooks):
   ```bash
   npx ts-node src/scripts/retryUnprocessedWebhooks.ts
   ```

3. **Monitor logs** after new app version deploys:
   - Look for: `📧 Webhook contains email: ...`
   - Confirms email/username attributes are working

4. **Check unprocessed webhooks weekly**:
   ```sql
   SELECT COUNT(*) as unprocessed
   FROM revenuecat_webhook_events
   WHERE processed_at IS NULL;
   ```

## 🎯 Expected Results

### Immediate (After Backend Deploy):
- ✅ Better alias matching for existing webhooks
- ✅ More detailed error logging
- ✅ Ability to manually retry stuck webhooks

### After New App Version:
- ✅ Email-based user matching for new subscriptions
- ✅ Username-based user matching as fallback
- ✅ Near-zero "User not found" errors
- ✅ Automatic tier upgrades/downgrades working correctly

## 📝 Monitoring Queries

Check webhook processing health:

```sql
-- Unprocessed webhooks
SELECT 
  event_type,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM revenuecat_webhook_events
WHERE processed_at IS NULL
GROUP BY event_type;

-- Recent processing errors
SELECT 
  event_type,
  revenuecat_customer_id,
  processing_error,
  retries,
  created_at
FROM revenuecat_webhook_events
WHERE processing_error IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Successfully processed webhooks (last 24 hours)
SELECT 
  event_type,
  COUNT(*) as count
FROM revenuecat_webhook_events
WHERE processed_at IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

## 🔗 Files Modified

1. `/backend/src/api/routes/revenuecat-webhook.ts` - Enhanced user lookup logic
2. `/backend/src/scripts/retryUnprocessedWebhooks.ts` - Manual retry script (NEW)

## ⚠️ Important Notes

- **Email/username lookup won't work immediately** - Requires new app version deployment
- **Existing webhooks** without email/username can use retry script with alias searching
- **Orphaned webhooks** may still occur if user truly never created an account
- **Auto-linking** prevents future webhook failures for the same user
