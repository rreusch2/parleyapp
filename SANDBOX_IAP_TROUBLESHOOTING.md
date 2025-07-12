# Sandbox IAP Testing Troubleshooting Guide

## Quick Diagnosis Checklist

### 1. Device Configuration
- [ ] **Signed out of production App Store** (Settings → [Your Name] → Media & Purchases → Sign Out)
- [ ] **Signed into Sandbox account** (Settings → App Store → Sandbox Account)
- [ ] **NOT signed into production App Store with sandbox account** (this will break the sandbox account!)
- [ ] **Device has active internet connection**
- [ ] **Date/time are set to automatic**

### 2. App Store Connect Configuration
- [ ] **Products are in "Ready to Submit" state** (not "Missing Metadata")
- [ ] **Bundle ID matches exactly** (com.appname.parleyapp)
- [ ] **App has In-App Purchase capability enabled**
- [ ] **Products created at least 24 hours ago** (sometimes takes time to propagate)
- [ ] **Shared secret generated** (for receipt validation)

### 3. Xcode Configuration
- [ ] **In-App Purchase capability added** (Project → Signing & Capabilities)
- [ ] **Correct provisioning profile** (with IAP enabled)
- [ ] **Building with correct bundle identifier**

## Common Error Solutions

### Error: "Purchase System Unavailable"
**Root Causes:**
1. Not signed into sandbox account
2. Products not loaded from App Store
3. Network connectivity issues
4. Bundle ID mismatch

**Solution Steps:**
```bash
# 1. Check your product IDs in code match App Store Connect exactly
# In your code:
com.parleyapp.premium_monthly
com.parleyapp.premiumyearly
com.parleyapp.premium_lifetime

# 2. Verify sandbox account setup
Settings → App Store → Sandbox Account → Sign in

# 3. Force refresh products in app
# Add this debug button to your subscription screen:
<Button onPress={async () => {
  await inAppPurchaseService.cleanup();
  await inAppPurchaseService.initialize();
  Alert.alert('IAP Refreshed', 'Try purchasing again');
}} title="Refresh IAP" />
```

### Error: "Unknown Error" or Generic Failures
**Solution:**
1. Delete app from device
2. Sign out of all App Store accounts
3. Restart device
4. Reinstall app from Xcode
5. Sign into sandbox account when prompted

### No IAP Modal Appears
**This is often the iOS 18.2 bug!**

**Solution:**
The fix is already in your code now. Make sure you're using:
```javascript
andDangerouslyFinishTransactionAutomaticallyIOS: false
```

### Receipt Validation Error 21007
**This means sandbox receipt sent to production server.**

**Backend Fix Required:**
```javascript
// Your backend must do this:
async function verifyReceipt(receipt, isRetry = false) {
  const url = isRetry 
    ? 'https://sandbox.itunes.apple.com/verifyReceipt'
    : 'https://buy.itunes.apple.com/verifyReceipt';
    
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'receipt-data': receipt,
      'password': 'YOUR_SHARED_SECRET'
    })
  });
  
  const data = await response.json();
  
  // CRITICAL: Handle 21007 status
  if (data.status === 21007 && !isRetry) {
    return verifyReceipt(receipt, true); // Retry with sandbox URL
  }
  
  return data;
}
```

## Debug Mode for IAP

Add this to your subscription screen for testing:

```javascript
// Debug IAP Status Component
const IAPDebugInfo = () => {
  const [debugInfo, setDebugInfo] = useState({});
  
  useEffect(() => {
    const getDebugInfo = async () => {
      const info = {
        initialized: inAppPurchaseService.isInitialized,
        products: inAppPurchaseService.subscriptions.length,
        productIds: inAppPurchaseService.subscriptions.map(s => s.productId),
        platform: Platform.OS,
        version: Platform.Version
      };
      setDebugInfo(info);
    };
    getDebugInfo();
  }, []);
  
  return (
    <View style={{ padding: 20, backgroundColor: '#f0f0f0' }}>
      <Text style={{ fontWeight: 'bold' }}>IAP Debug Info:</Text>
      <Text>{JSON.stringify(debugInfo, null, 2)}</Text>
      <Button 
        title="Run Diagnostics" 
        onPress={() => inAppPurchaseService.runDiagnostics()} 
      />
    </View>
  );
};
```

## Step-by-Step Testing Process

### 1. Fresh Start
```bash
# Clean everything
cd ios
rm -rf build/
pod deintegrate
pod install
cd ..

# In Xcode
Product → Clean Build Folder (Shift+Cmd+K)
```

### 2. Configure Test Device
1. Settings → [Your Name] → Media & Purchases → Sign Out
2. Settings → App Store → Scroll to bottom → Sandbox Account → Sign In
3. Use credentials: testuser+001@yourdomain.com (your sandbox account)

### 3. Build and Run
1. Select physical device (NOT simulator)
2. Build and run from Xcode
3. Set breakpoints in IAP code to debug

### 4. Test Purchase Flow
1. Open app
2. Navigate to subscription screen
3. Check console logs for:
   - "IAP service initialized"
   - "Loaded X subscriptions"
   - Product IDs being loaded
4. Tap purchase button
5. Should see Apple's native modal with:
   - [Environment: Sandbox] banner
   - Your sandbox email
   - Password field

### 5. Monitor Logs
Look for these key log messages:
```
🔄 Initializing IAP service...
📱 IAP connection result: true
✅ Loaded 3 subscriptions:
  - com.parleyapp.premium_monthly: $24.99 (Pro Monthly)
  - com.parleyapp.premiumyearly: $199.99 (Pro Annual)
  - com.parleyapp.premium_lifetime: $349.99 (Lifetime Pro)
🛒 Starting purchase for product: com.parleyapp.premium_monthly
```

## Nuclear Option (When Nothing Works)

1. **Delete everything:**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData
   rm -rf ios/build
   rm -rf ios/Pods
   rm -rf node_modules
   ```

2. **Reset sandbox tester:**
   - Delete sandbox account in App Store Connect
   - Create new one with different email
   - Wait 30 minutes

3. **Rebuild everything:**
   ```bash
   npm install
   cd ios && pod install
   # Open in Xcode and build
   ```

4. **Test on different device** (sometimes device-specific issues occur)

## Contact Points for Help

1. **Apple Developer Forums**: Post with your specific error logs
2. **Technical Support Incidents**: Use one if you have them
3. **App Store Connect Contact**: For product configuration issues

## Your Specific Next Steps

Based on your errors, do this in order:

1. ✅ Build error fixed (appTransactionID issue)
2. ⬜ Clean build in Xcode with updated code
3. ⬜ Test on iPad Air with iOS 18.5 (same as rejection device)
4. ⬜ Verify receipt validation handles 21007 status
5. ⬜ Test full purchase flow with new sandbox account
6. ⬜ Document successful flow with screenshots
7. ⬜ Submit with detailed notes about fixes

Remember: The sandbox environment can be flaky. If something doesn't work, wait 5 minutes and try again! 