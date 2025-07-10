# 🧪 In-App Purchase Testing Guide for ParleyApp

## ✅ CRITICAL: Product ID Verification

**FIXED**: Your product IDs now match App Store Connect:
- ✅ `com.parleyapp.premium_monthly` (Monthly Pro)
- ✅ `com.parleyapp.premiumyearly` (Yearly Pro) 
- ✅ `com.parleyapp.premium_lifetime` (Lifetime Pro)

## 🔄 How App Store Review Process Works

### Current Status (Per Your App Store Connect):
1. **Lifetime Pro**: `In Review` ✅
2. **Monthly Pro**: `Waiting for Review` ⏳
3. **Yearly Pro**: `Waiting for Review` ⏳

### What This Means:
- **You CANNOT test real purchases until Apple approves them**
- **TestFlight users can't make real purchases during review**
- **Use Sandbox testing only until approved**

---

## 🏖️ Sandbox Testing Setup

### Step 1: Create Sandbox Test Accounts
1. Go to **App Store Connect** → **Users and Access** → **Sandbox Testers**
2. Create 2-3 test accounts with different email addresses
3. **IMPORTANT**: Don't use your real Apple ID!

### Step 2: Configure Device for Sandbox
```bash
# On your test device:
# 1. Settings → App Store → Sign Out (of real Apple ID)
# 2. Install your app via TestFlight or Xcode
# 3. Try to make purchase → Sign in with SANDBOX account when prompted
```

### Step 3: Test Each Purchase Flow
```typescript
// Test all three subscription types:
1. Monthly Pro ($24.99/month) - 50% off launch price
2. Yearly Pro ($199.99/year) - 50% off launch price
3. Lifetime Pro ($349.99 one-time) - 50% off launch price
```

---

## 🧪 Testing Workflow

### Pre-Testing Checklist:
- [ ] App uploaded to TestFlight
- [ ] IAP products submitted for review
- [ ] Sandbox test accounts created
- [ ] Test device configured for sandbox

### Test Scenarios:

#### ✅ Happy Path Testing:
1. **Fresh Install**: 
   - Open app → Should show free tier (2 picks)
   - Tap upgrade → Subscription modal appears
   - Select plan → Apple payment sheet appears
   - Complete purchase → User becomes Pro (20 picks)

2. **Subscription Verification**:
   - Kill app → Reopen → Should stay Pro
   - Check backend database → `subscription_tier` = 'pro'
   - Test all Pro features unlock

3. **Restore Purchases**:
   - Delete app → Reinstall
   - Login → Tap "Restore Purchases"
   - Pro status should restore

#### ❌ Error Path Testing:
1. **Payment Declined**: Test with sandbox card that declines
2. **Network Failure**: Turn off internet during purchase
3. **App Crash**: Kill app during purchase flow

---

## 🔧 Backend Purchase Verification

Your app sends purchase receipts to:
```typescript
POST /api/purchases/verify
{
  "platform": "ios",
  "purchaseToken": "...",
  "receipt": "...",
  "productId": "com.parleyapp.premium_monthly",
  "userId": "user-uuid"
}
```

**Make sure this endpoint**:
- ✅ Validates receipt with Apple
- ✅ Updates `profiles.subscription_tier` to 'pro'
- ✅ Sets `subscription_expires_at` (for monthly/yearly)
- ✅ Returns success/error response

---

## 📱 Testing Commands

### Enable Test Mode (Development):
```typescript
// In app/config/development.ts
export const DEV_CONFIG = {
  FORCE_PRO_STATUS: false,           // ❌ Turn OFF for IAP testing
  ENABLE_TEST_PRO_SUBSCRIPTION: true // ✅ Allow test purchases
}
```

### Check Subscription Status:
```typescript
// Add debug logs in subscriptionContext.tsx
console.log('🔍 Checking subscription status:', {
  userId: user.id,
  profileTier: profile?.subscription_tier,
  isPro,
  subscriptionExpiry: profile?.subscription_expires_at
});
```

---

## ⚠️ Common Issues & Solutions

### Issue: "No products found"
**Solution**: 
- Verify product IDs match App Store Connect exactly
- Wait 2-4 hours after creating products
- Check agreements are signed in App Store Connect

### Issue: "Purchase failed" 
**Solution**:
- Check sandbox account has payment method
- Verify receipt validation endpoint works
- Check backend database permissions

### Issue: "Already purchased"
**Solution**:
- Use different sandbox account
- Clear purchase history in Sandbox settings

### Issue: Pro features not unlocking
**Solution**:
- Check database `subscription_tier` field updated
- Verify `checkSubscriptionStatus()` function logic
- Check AsyncStorage cache clearing

---

## 🚀 Production Readiness Checklist

### Before App Store Submission:
- [ ] **Set `DEV_CONFIG.FORCE_PRO_STATUS = false`**
- [ ] **Set `DEV_CONFIG.ENABLE_TEST_PRO_SUBSCRIPTION = false`**
- [ ] Test all IAP flows in sandbox
- [ ] Verify backend receipt validation works
- [ ] Test restore purchases functionality
- [ ] Test subscription expiration handling
- [ ] Add privacy policy and terms of service

### App Store Connect Configuration:
- [ ] All IAP products created and submitted
- [ ] Tax and banking info completed
- [ ] App metadata includes IAP disclosure
- [ ] Screenshots show subscription pricing
- [ ] Age rating set to 17+ (for gambling content)

---

## 🔍 Debug Tools

### View IAP Logs:
```bash
# In Xcode console during testing:
# Look for these log messages:
🛒 Requesting subscription: com.parleyapp.premium_monthly
✅ Purchase successful: [transaction details]
❌ Purchase error: [error details]
🔍 Checking subscription status: [user status]
```

### Database Verification:
```sql
-- Check user subscription status
SELECT id, email, subscription_tier, subscription_expires_at 
FROM profiles 
WHERE id = 'user-uuid';

-- Check purchase records
SELECT * FROM purchases 
WHERE user_id = 'user-uuid' 
ORDER BY created_at DESC;
```

---

## 📞 Testing Support

When testing, focus on these critical flows:
1. **Purchase → Pro Upgrade**: User should immediately see 20 picks instead of 2
2. **App Restart → Status Persistence**: Pro status should survive app restarts  
3. **Restore Purchases**: Should work after app reinstall
4. **Subscription Expiry**: Monthly/yearly should expire properly
5. **Lifetime Purchase**: Should never expire

**Remember**: Real money transactions ONLY work after Apple approves your IAP products. Until then, use Sandbox testing exclusively!
