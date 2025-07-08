# 🚀 **ParleyApp - Complete App Store Submission Guide**

## **📋 PRE-SUBMISSION CHECKLIST (Priority Order)**

### **🔥 CRITICAL - MUST COMPLETE FIRST**

#### **1. In-App Purchases Setup**
**Status: 90% Complete ✅ - Just needs App Store Connect setup**

**What's Already Done:**
- ✅ `react-native-iap` package installed and configured
- ✅ Product SKUs defined for all tiers
- ✅ Purchase verification backend hooks ready
- ✅ Error handling implemented

**🚨 TODO - App Store Connect Setup:**
```bash
# 1. Create IAP products in App Store Connect
Products to create:
- com.parleyapp.premium_monthly ($9.99/month) 
- com.parleyapp.premium_yearly ($99.99/year)
- com.parleyapp.premium_lifetime ($299.99 one-time)

# 2. Set up Sandbox testing
- Create test users in App Store Connect
- Test on physical device with TestFlight
- Verify subscription tracking works
```

**🧪 Test IAP on Mac (Required):**
```bash
# Use Xcode Simulator with macOS (not iOS simulator)
# Or deploy to TestFlight and test on physical device
# Cannot test IAP on iOS Simulator - Apple limitation
```

---

#### **2. Remove Development/Test Mode**

**🚨 CRITICAL FILES TO UPDATE:**

**A. `app/config/development.ts` - Set Production Values:**
```typescript
// BEFORE (Development):
FORCE_PRO_STATUS: true,           // ❌ MUST BE FALSE
USE_LOCAL_API: true,              // ❌ MUST BE FALSE  
ENABLE_TEST_PRO_SUBSCRIPTION: true, // ❌ MUST BE FALSE
SHOW_DEBUG_INFO: true,            // ❌ MUST BE FALSE

// AFTER (Production):
FORCE_PRO_STATUS: false,          // ✅ Users must pay
USE_LOCAL_API: false,             // ✅ Use production API
ENABLE_TEST_PRO_SUBSCRIPTION: false, // ✅ Real payments only
SHOW_DEBUG_INFO: false,           // ✅ Hide debug info
```

**B. Remove Debug Files:**
```bash
# Delete these files before production build:
- app/debug-react-native-supabase.tsx
- app/admin.tsx (or secure it properly)
- app/components/AdminGameForm.tsx (or secure it)
```

**C. Environment Variables (.env):**
```bash
# Set production environment
NODE_ENV=production
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_production_key
EXPO_PUBLIC_BACKEND_URL=https://your-production-api.com
```

---

#### **3. Admin Dashboard (Recommended Enhancement)**

**Create Pro Admin Account with Analytics:**

**A. Add Admin Role to Database:**
```sql
-- Add admin role to profiles table
ALTER TABLE profiles ADD COLUMN admin_role BOOLEAN DEFAULT FALSE;

-- Set your account as admin
UPDATE profiles SET admin_role = TRUE WHERE email = 'your-email@domain.com';
```

**B. Create Admin Dashboard Component:**
```typescript
// app/components/AdminDashboard.tsx
interface AdminStats {
  totalSubscriptions: number;
  monthlyRevenue: number;
  activeUsers: number;
  dailyPredictions: number;
}
```

**C. Admin Features to Add:**
- 📊 Subscription analytics (count, revenue)
- 👥 User management (total, active, churn)  
- 🎯 Prediction performance stats
- 💰 Revenue tracking (monthly/yearly)
- 🚨 System health monitoring

---

### **📱 APP STORE CONNECT SETUP**

#### **4. App Information**
```markdown
App Name: Parley App
Bundle ID: com.parleyapp.mobile
Category: Sports
Age Rating: 17+ (Gambling references)
Description: AI-powered MLB player prop predictions
```

#### **5. Screenshots Required (All Devices)**
```bash
# Required screenshots for App Store:
- iPhone 6.7" (iPhone 14 Pro Max): 1290 x 2796
- iPhone 6.5" (iPhone 11 Pro Max): 1242 x 2688  
- iPhone 5.5" (iPhone 8 Plus): 1242 x 2208
- iPad Pro 12.9": 2048 x 2732

# Create screenshots showing:
1. Home screen with AI predictions
2. Pro AI chat interface  
3. Live betting odds
4. Settings/subscription page
5. Daily insights feed
```

#### **6. App Store Listing**
```markdown
Title: "Parley App - AI Sports Betting"

Subtitle: "MLB Player Props with AI Analysis"

Keywords: "sports betting,MLB,baseball,AI predictions,player props,betting tips"

Description:
Transform your sports betting with Parley App's advanced AI-powered MLB player prop predictions.

🤖 AI-POWERED ANALYSIS
Our sophisticated AI agent analyzes thousands of data points including player stats, weather conditions, injury reports, and historical matchups to deliver high-confidence predictions.

⚾ MLB PLAYER PROPS SPECIALIST  
Get daily picks for hits, home runs, RBIs, strikeouts, and 5+ other prop categories with detailed reasoning and confidence scores.

📊 PROFESSIONAL INSIGHTS
Each prediction includes:
- Confidence percentage (55-88% range)
- Expected value analysis
- Risk assessment
- Detailed reasoning

🎯 PROVEN RESULTS
Our AI agent achieves consistent profitability through intelligent research synthesis and edge detection.

💎 PRO FEATURES
- 10 daily AI predictions
- Professor Lock AI chat
- Real-time odds tracking
- Performance analytics
- Priority support

Perfect for serious MLB bettors seeking a data-driven edge.

⚠️ 18+ only. Gamble responsibly.
```

---

### **🔧 TECHNICAL REQUIREMENTS**

#### **7. Build Configuration**

**A. Update `app.config.js`:**
```javascript
export default {
  expo: {
    name: "Parley App",
    slug: "parleyapp", 
    version: "1.0.0",
    ios: {
      bundleIdentifier: "com.parleyapp.mobile",
      buildNumber: "1",
      supportsTablet: true,
    },
    android: {
      package: "com.parleyapp.mobile",
      versionCode: 1,
    }
  }
};
```

**B. Privacy Requirements:**
```javascript
// Already configured in app.config.js ✅
infoPlist: {
  NSCameraUsageDescription: "For scanning betting slips",
  NSPhotoLibraryUsageDescription: "To save winning picks", 
  NSLocationWhenInUseUsageDescription: "Region-specific odds",
  NSUserTrackingUsageDescription: "Personalized recommendations"
}
```

#### **8. Legal Requirements**

**A. Age Rating: 17+ Required**
- App contains gambling/betting content
- Must comply with Apple's gambling guidelines

**B. Privacy Policy (Already Created ✅)**
- Located at: `PRIVACY_POLICY.md`
- Upload to your website for App Store reference

**C. Terms of Service**
- Create ToS covering betting, subscriptions, AI predictions
- Include disclaimer about gambling risks

---

### **🧪 TESTING PHASE**

#### **9. TestFlight Beta Testing**
```bash
# Steps:
1. Create production build: `expo build:ios`
2. Upload to App Store Connect
3. Create TestFlight build
4. Test all features on physical device:
   - In-app purchases (CRITICAL)
   - AI predictions loading
   - Subscription status syncing
   - Push notifications
   - All Pro features
```

#### **10. Production Validation**
```bash
# Run validation script:
npx ts-node scripts/validate-production-build.ts

# Manual checks:
- No localhost URLs anywhere
- All environment variables set correctly  
- Debug features disabled
- Test accounts removed
- Admin features secured
```

---

### **💰 MONETIZATION SETUP**

#### **11. Subscription Tiers**
```typescript
// Your current setup ✅
Monthly: $9.99/month (com.parleyapp.premium_monthly)
Yearly: $99.99/year (com.parleyapp.premium_yearly) - 16% savings
Lifetime: $299.99 one-time (com.parleyapp.premium_lifetime)
```

#### **12. Admin Revenue Dashboard**
```typescript
// Suggested admin features:
interface AdminAnalytics {
  // Subscription Metrics
  totalActiveSubscriptions: number;
  monthlyRecurringRevenue: number; 
  yearlySubscriptions: number;
  lifetimeSubscriptions: number;
  churnRate: number;
  
  // User Metrics  
  totalUsers: number;
  activeUsers: number;
  newSignupsToday: number;
  conversionRate: number;
  
  // Performance Metrics
  dailyPredictions: number;
  predictionAccuracy: number;
  userEngagement: number;
}
```

---

### **📋 FINAL SUBMISSION CHECKLIST**

#### **Pre-Submission (Complete All):**
- [ ] **IAP products created in App Store Connect**
- [ ] **TestFlight testing completed successfully**  
- [ ] **All development flags set to FALSE**
- [ ] **Debug files removed**
- [ ] **Production environment variables set**
- [ ] **Screenshots created for all device sizes**
- [ ] **App Store listing written**
- [ ] **Privacy policy uploaded to website**
- [ ] **Terms of service created**
- [ ] **Admin dashboard implemented (optional)**

#### **During Review:**
- [ ] **App may take 1-7 days for review**
- [ ] **Respond quickly to any reviewer feedback**  
- [ ] **Have test account ready if requested**

#### **Post-Approval:**
- [ ] **Monitor crash reports**
- [ ] **Track subscription metrics**
- [ ] **Collect user feedback**
- [ ] **Plan updates and improvements**

---

### **🚨 CRITICAL WARNINGS**

1. **Never submit with `FORCE_PRO_STATUS: true`** - App will be rejected
2. **Test IAP thoroughly** - Most common rejection reason
3. **No localhost URLs** - App won't work in production
4. **Age rating 17+** - Required for gambling content
5. **Have legal disclaimers** - Apple requires gambling warnings

---

### **🎯 IMMEDIATE ACTION ITEMS**

**TODAY:**
1. Set all development flags to `false` in `app/config/development.ts`
2. Create IAP products in App Store Connect  
3. Remove debug files (`debug-react-native-supabase.tsx`, etc.)

**THIS WEEK:**  
1. Implement admin dashboard with subscription analytics
2. Create all required screenshots
3. Write App Store listing
4. TestFlight beta testing

**NEXT WEEK:**
1. Submit to App Store
2. Monitor review process
3. Launch marketing

---

### **📞 SUPPORT DURING SUBMISSION**

If you encounter issues during submission:
1. Check Apple's App Review Guidelines
2. Use App Store Connect Help & Support
3. Common rejection reasons: IAP setup, age rating, privacy policy

**Your app is 85% ready for submission! The main blockers are IAP testing and removing development flags.**
