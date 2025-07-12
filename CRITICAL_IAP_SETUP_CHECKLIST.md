# 🚨 CRITICAL IAP SETUP - ACTION REQUIRED

## ✅ **COMPLETED**
- ✅ Backend IAP verification endpoints created
- ✅ Frontend purchase service updated  
- ✅ Database schema SQL prepared
- ✅ Webhook handlers implemented
- ✅ Environment variables template added

## 🔴 **IMMEDIATE ACTION REQUIRED**

### 1. **Set Apple Shared Secret** (CRITICAL)
In your `backend/.env` file, replace:
```bash
APPLE_SHARED_SECRET=your_apple_shared_secret_here
```

**How to get it:**
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your ParleyApp
3. Go to **App Information** 
4. Scroll to **"App-Specific Shared Secret"**
5. Generate if needed, copy the value
6. Paste it in your `.env` file

**⚠️ WITHOUT THIS, ALL iOS PURCHASES WILL FAIL!**

### 2. **Update JWT Secret** (Recommended)
Replace this generic secret:
```bash
JWT_SECRET=your_super_secure_jwt_secret_key_change_this
```

### 3. **Run Database Setup SQL** (CRITICAL)
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Open your project: `iriaegoipkjtktitpary`
3. Go to **SQL Editor**
4. Paste the entire SQL from `IAP_COMPLETE_SETUP_GUIDE.md`
5. Click **Run**

### 4. **Create IAP Products in App Store Connect** (CRITICAL)
Create these exact products:

| Product ID | Type | Price |
|------------|------|-------|
| `com.parleyapp.premium_monthly` | Auto-Renewable | $24.99/month |
| `com.parleyapp.premiumyearly` | Auto-Renewable | $199.99/year |
| `com.parleyapp.premium_lifetime` | Non-Consumable | $349.99 |

---

## 🧪 **TESTING STEPS**

### Step 1: Validate Backend
```bash
cd /home/reid/Desktop/parleyapp
node scripts/test-iap-backend.js
```

### Step 2: Test Database
In Supabase SQL Editor:
```sql
-- Verify tables exist
SELECT COUNT(*) FROM user_purchases;
SELECT COUNT(*) FROM webhook_events;

-- Check profiles has subscription fields
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name LIKE '%subscription%';
```

### Step 3: Test iOS Purchase Flow
1. Build app for iOS simulator/device
2. Create Apple sandbox test account
3. Attempt subscription purchase
4. Verify in database that subscription activated

---

## 🚨 **DEPLOYMENT CHECKLIST**

### Before Railway Deployment:
- [ ] `APPLE_SHARED_SECRET` set in Railway environment variables
- [ ] `JWT_SECRET` updated 
- [ ] Database SQL executed in Supabase
- [ ] Backend redeployed to Railway

### Before App Store Submission:
- [ ] All development flags set to `false` in `app/config/development.ts`
- [ ] IAP products created and approved in App Store Connect
- [ ] Webhook URLs configured in App Store Connect
- [ ] TestFlight testing completed with real purchases

---

## 🔍 **VERIFICATION COMMANDS**

Check if environment variables are loaded:
```bash
# In your backend directory
node -e "require('dotenv').config(); console.log('Apple Secret:', process.env.APPLE_SHARED_SECRET ? 'SET ✅' : 'MISSING ❌');"
```

Test subscription status API:
```bash
# Get a user auth token first, then:
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://zooming-rebirth-production-a305.up.railway.app/api/purchases/status
```

---

## 🆘 **SUPPORT**

If you see errors:
1. **"APPLE_SHARED_SECRET not found"** → Complete step 1 above
2. **"User profile not found"** → Run database SQL setup  
3. **"Purchase verification failed"** → Check IAP products are created
4. **"Authentication failed"** → User needs to be logged in

**Your IAP system is 95% complete! Just need those environment variables! 🎉**
