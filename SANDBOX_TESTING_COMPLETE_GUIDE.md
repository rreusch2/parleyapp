# 🧪 Complete Sandbox Testing Guide for ParleyApp IAP

## 📋 **STEP 1: Create Sandbox Test Accounts**

### **Go to App Store Connect:**
1. Login to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Go to **Users and Access** → **Sandbox**
3. Click **"+" (Create Sandbox Tester)**

### **Create Test Account Details:**
```
First Name: Test
Last Name: User
Email: testuser.parleyapp@gmail.com (READ BELOW about emails)
Password: TestPass123!
Date of Birth: 01/01/1990 (must be 18+)
App Store Territory: United States
```

### **🚨 EMAIL RULES:**
- **Use FAKE emails** (Apple doesn't verify them)
- **DON'T use your real email** (will conflict with your real Apple ID)
- **Suggested pattern:** `testuser.parleyapp@gmail.com`, `testuser2.parleyapp@gmail.com`
- **Apple doesn't send emails** to sandbox accounts

### **Create Multiple Test Accounts:**
Create 2-3 accounts for different test scenarios:
```
Account 1: testuser.parleyapp@gmail.com (for basic testing)
Account 2: testuser2.parleyapp@gmail.com (for edge cases)
Account 3: testuser3.parleyapp@gmail.com (for subscription changes)
```

---

## 📋 **STEP 2: Create Missing IAP Products**

You need to create the monthly and lifetime products in App Store Connect:

### **Monthly Subscription:**
1. Go to your app → **In-App Purchases**
2. Click **"+" → Auto-Renewable Subscriptions**
3. **Product ID:** `com.parleyapp.premium_monthly`
4. **Price:** $24.99/month
5. **Subscription Group:** Create "Pro Subscriptions" if needed

### **Lifetime Purchase:**
1. Click **"+" → Non-Consumables**
2. **Product ID:** `com.parleyapp.premium_lifetime`  
3. **Price:** $349.99
4. **Display Name:** "Lifetime Pro"

---

## 📋 **STEP 3: Upload TestFlight Build**

### **Build for TestFlight:**
```bash
# In your project directory
cd ios
xcodebuild archive -workspace ParleyApp.xcworkspace -scheme ParleyApp -archivePath build/ParleyApp.xcarchive
xcodebuild -exportArchive -archivePath build/ParleyApp.xcarchive -exportPath build/ -exportOptionsPlist exportOptions.plist
```

### **Upload to App Store Connect:**
1. Open **Xcode** → **Window** → **Organizer**
2. Select your archive → **Distribute App**
3. Choose **App Store Connect** → **Upload**
4. Wait for processing (5-30 minutes)

---

## 📋 **STEP 4: Device Setup for Sandbox Testing**

### **Sign Out of Your Real Apple ID:**
1. On your iOS device: **Settings** → **App Store**
2. **Tap your Apple ID** → **Sign Out**
3. **DON'T sign in with sandbox account yet!**

### **Install TestFlight App:**
1. Download **TestFlight** from App Store (use your real Apple ID temporarily)
2. Install your app via TestFlight invitation

---

## 📋 **STEP 5: Testing Process**

### **Start IAP Testing:**
1. **Open your app** (installed via TestFlight)
2. **Navigate to subscription modal**
3. **Tap "Subscribe"** 
4. **iOS will prompt for App Store login**
5. **Enter your sandbox account credentials:**
   - Email: `testuser.parleyapp@gmail.com`
   - Password: `TestPass123!`

### **What Happens Next:**
- ✅ Purchase will complete (no real money charged)
- ✅ Your backend should receive receipt for verification
- ✅ Your webhook endpoint should get notified
- ✅ User should be upgraded to Pro in your app

---

## 📋 **STEP 6: Testing Scenarios**

### **Test These Flows:**
1. **New Subscription:**
   - Purchase monthly → Verify Pro access
   - Purchase yearly → Verify Pro access
   - Purchase lifetime → Verify Pro access

2. **Receipt Verification:**
   - Check backend logs for receipt verification
   - Verify user profile updated in Supabase

3. **Subscription Management:**
   - Go to iOS Settings → Apple ID → Subscriptions
   - Cancel subscription → Test expiration handling

4. **Webhook Testing:**
   - Subscribe → Check webhook received
   - Cancel → Check cancellation webhook

---

## 🚨 **COMMON ISSUES & SOLUTIONS**

### **"Cannot connect to iTunes Store"**
- **Solution:** Sign out of all Apple IDs, restart device, try again

### **"This Apple ID is not valid"**
- **Solution:** Make sure you're using the exact sandbox email you created

### **Purchase gets stuck**
- **Solution:** Force close app, sign out of App Store, sign back in

### **Backend not receiving receipts**
- **Solution:** Check your `/api/purchases/verify` endpoint is accessible

---

## 📊 **VERIFICATION CHECKLIST**

After successful purchase, verify:
- ✅ iOS shows purchase confirmation
- ✅ Your app shows Pro features unlocked
- ✅ Backend logs show receipt verification success
- ✅ Supabase profile updated with Pro tier
- ✅ Webhook received (if configured)

---

## 🎯 **NEXT STEPS AFTER TESTING**

Once sandbox testing works:
1. **Switch to production mode** (set development flags to false)
2. **Submit for App Store review**  
3. **Test with real purchases** (small amounts first)

---

**🚨 REMEMBER:** Always sign out of sandbox accounts before switching back to your real Apple ID!
