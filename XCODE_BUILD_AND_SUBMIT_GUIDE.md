# Complete Xcode Build and App Store Submission Guide

## Part 1: Open and Configure in Xcode

### 1.1 Open the Project
```bash
cd /Users/rreusch2/parleyapp/ios
open PredictivePlay.xcworkspace
```
**Important**: Always open the `.xcworkspace` file, NOT the `.xcodeproj` file!

### 1.2 Configure Signing & Capabilities
1. In Xcode, select your project (PredictivePlay) in the navigator
2. Select the PredictivePlay target
3. Go to "Signing & Capabilities" tab
4. Ensure:
   - "Automatically manage signing" is checked
   - Team is selected (your Apple Developer account)
   - Bundle Identifier matches App Store Connect
   - In-App Purchase capability is added (if not, click "+ Capability" and add it)

### 1.3 Configure Build Settings
1. Select your project → Build Settings
2. Search for "Swift Language Version" → Set to 5.0 or higher
3. Search for "iOS Deployment Target" → Should be 13.4 or higher
4. For simulator builds: Search "Excluded Architectures" → Add "arm64" for Debug configuration

## Part 2: Fix IAP Code for iOS 18.2+

Since you're using Xcode 16.2, update your IAP purchase code to handle iOS 18.2 properly:

```javascript
// In your purchase function, add this iOS 18.2 fix:
const purchase = async (productId) => {
  try {
    const product = await RNIap.getProducts([productId]);
    if (product.length > 0) {
      // For iOS 18.2+, the purchase API changed slightly
      const purchase = await RNIap.requestPurchase({
        sku: productId,
        // Add these for iOS 18.2 compatibility
        andDangerouslyFinishTransactionAutomaticallyIOS: false,
      });
      
      // Always finish the transaction
      await RNIap.finishTransaction({
        purchase,
        isConsumable: false
      });
      
      return purchase;
    }
  } catch (err) {
    console.error('Purchase error:', err);
    throw err;
  }
};
```

## Part 3: Testing IAP in Sandbox

### 3.1 Create Sandbox Tester Account
1. Go to App Store Connect → Users and Access → Sandbox → Testers
2. Click "+" to add new tester
3. Use a fake email (e.g., testuser+001@yourdomain.com)
4. Fill in all required fields
5. Save the credentials securely

### 3.2 Configure Device for Sandbox Testing
1. On your test device: Settings → Sign out of App Store (NOT iCloud!)
2. Settings → App Store → Sandbox Account → Sign in with sandbox tester
3. **Important**: Do NOT sign into production App Store with sandbox account!

### 3.3 Build and Test on Device
1. In Xcode: Select your physical device (NOT simulator for IAP testing)
2. Product → Clean Build Folder (Shift+Cmd+K)
3. Product → Build (Cmd+B)
4. Product → Run (Cmd+R)

### 3.4 Testing Purchase Flow
1. Launch app on device
2. Navigate to subscription screen
3. Tap purchase button
4. You should see:
   - Native Apple IAP modal
   - Sandbox environment banner at top
   - Your sandbox email pre-filled
5. Enter sandbox password
6. Complete purchase

## Part 4: Fix Receipt Validation

### 4.1 Server-Side Receipt Validation
Your server needs to handle both production and sandbox receipts:

```javascript
// Backend pseudo-code for receipt validation
async function verifyReceipt(receipt) {
  // Always try production first
  let response = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
    method: 'POST',
    body: JSON.stringify({
      'receipt-data': receipt,
      'password': 'YOUR_SHARED_SECRET', // From App Store Connect
      'exclude-old-transactions': true
    })
  });
  
  let data = await response.json();
  
  // If status is 21007, retry with sandbox
  if (data.status === 21007) {
    response = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
      method: 'POST',
      body: JSON.stringify({
        'receipt-data': receipt,
        'password': 'YOUR_SHARED_SECRET',
        'exclude-old-transactions': true
      })
    });
    data = await response.json();
  }
  
  return data;
}
```

### 4.2 Get Shared Secret
1. App Store Connect → Your App → In-App Purchases
2. Click "App-Specific Shared Secret" or "View Shared Secret"
3. Generate if needed, copy to your server config

## Part 5: Archive and Upload to App Store Connect

### 5.1 Prepare for Archive
1. Select "Any iOS Device (arm64)" as build target
2. Update version/build number if needed:
   - Project → Target → General → Version (e.g., 1.0.1)
   - Build (e.g., 2)

### 5.2 Create Archive
1. Product → Archive (this takes 5-10 minutes)
2. Organizer window opens automatically when done
3. Select your archive → Validate App
4. Fix any validation errors

### 5.3 Upload to App Store Connect
1. In Organizer → Select archive → Distribute App
2. Choose "App Store Connect" → Next
3. Choose "Upload" → Next
4. Select options:
   - Include bitcode: Yes (recommended)
   - Upload symbols: Yes
5. Automatically manage signing → Next
6. Review → Upload

### 5.4 Submit for Review
1. Wait 5-10 minutes for processing
2. App Store Connect → Your App → TestFlight tab
3. Your build appears (may show "Processing")
4. Once processed → App Store tab → Prepare for Submission
5. Select the build
6. Fill in:
   - What's New (version notes)
   - App Review Information
   - **Important**: In notes, mention "Fixed IAP bugs on iPadOS 18.5"
7. Add IAP for review if not already reviewed
8. Submit for Review

## Part 6: Common Issues and Solutions

### Issue: "Purchase system unavailable"
**Solutions**:
1. Ensure signed out of production App Store
2. Check sandbox account is active
3. Verify Bundle ID matches exactly
4. Check IAP products are in "Ready to Submit" state
5. Try different sandbox account
6. Reset network settings on device

### Issue: No IAP modal appears
**Solutions**:
1. Check In-App Purchase capability is added
2. Verify products exist in App Store Connect
3. Wait 24 hours after creating products
4. Check product IDs match exactly (case-sensitive)

### Issue: Receipt validation fails
**Solutions**:
1. Implement 21007 status handling (sandbox receipt in production)
2. Verify shared secret is correct
3. Check receipt is base64 encoded
4. Ensure server handles both environments

### Issue: Build errors in Xcode
**Solutions**:
1. Clean build folder (Shift+Cmd+K)
2. Delete DerivedData: `rm -rf ~/Library/Developer/Xcode/DerivedData`
3. Pod deintegrate && pod install
4. Close Xcode, delete .xcworkspace, run pod install

## Part 7: Testing Checklist Before Submission

- [ ] Test purchase flow on real device
- [ ] Test restore purchases
- [ ] Test subscription cancellation
- [ ] Test receipt validation (both sandbox and production paths)
- [ ] Test on iPad (since rejection was on iPad)
- [ ] Test on iOS 18.5 specifically
- [ ] Test with poor network connection
- [ ] Test purchase interruption scenarios
- [ ] Verify subscription status persists after app restart
- [ ] Test with different sandbox accounts

## Notes for Your Specific Situation

1. **Your rejection issue**: The error about sandbox receipts in production means your server MUST handle status code 21007 and retry with sandbox URL.

2. **iPad testing**: Since rejection was on iPad Air 5th gen with iPadOS 18.5, prioritize testing on iPad with that OS version.

3. **Sandbox email modal**: Yes, you should see the native Apple IAP modal where sandbox testers can enter their credentials. This is normal and expected behavior.

4. **EAS vs Xcode**: For IAP issues, Xcode gives you more control and better debugging. You can return to EAS after fixing these issues.

Remember: After submission, monitor the Resolution Center for any feedback from Apple reviewers! 