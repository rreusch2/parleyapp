# RevenueCat Setup Guide

## Overview
RevenueCat is now configured to replace the problematic react-native-iap implementation. This provides a much more reliable and easier-to-manage solution for in-app purchases.

## Configuration Steps

### 1. RevenueCat Dashboard Setup
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Create a new project or use existing one
3. Set up your iOS app:
   - Bundle ID: `com.parleyapp` (or your actual bundle ID)
   - App Store Connect API Key
4. Set up your Android app (if needed)

### 2. Product Configuration
Configure these products in RevenueCat (use EXACT product IDs from App Store Connect):
- **Monthly Pro**: `com.parleyapp.premium_monthly`
- **Yearly Pro**: `com.parleyapp.premiumyearly`
- **Lifetime Pro**: `com.parleyapp.premium_lifetime`

### 3. Environment Variables
Add these to your environment configuration:

```bash
# RevenueCat API Keys
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=your_ios_key_here
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=your_android_key_here
```

### 4. iOS Configuration (for EAS Build)
Add to your `app.config.js`:

```javascript
export default {
  expo: {
    // ... other config
    plugins: [
      // ... other plugins
      ["react-native-purchases", {
        "apiKey": process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      }]
    ]
  }
};
```

### 5. Testing
- Use RevenueCat's sandbox environment
- Test with sandbox Apple ID
- Verify purchases appear in RevenueCat dashboard

## Implementation Benefits

### ✅ What's Fixed
- **Native Apple Purchase Dialog**: RevenueCat properly triggers the native iOS purchase popup
- **Reliable Purchase Flow**: No more complex state management
- **Automatic Receipt Validation**: RevenueCat handles all receipt verification
- **Better Error Handling**: Clear error messages and proper cancellation handling
- **Subscription Management**: Easy subscription status checking
- **Restore Purchases**: Simple restore functionality

### 🔄 Migration Changes
- Removed `react-native-iap` dependency
- Added `react-native-purchases` (RevenueCat SDK)
- Simplified purchase flow in both subscription modals
- Updated subscription context to use RevenueCat
- Cleaner error handling and user feedback

## Key Features

### Purchase Flow
1. User taps subscription button
2. RevenueCat initializes (if not already done)
3. Native Apple purchase dialog appears
4. Purchase is processed by Apple
5. RevenueCat validates receipt
6. User subscription status is updated in Supabase
7. Success message shown to user

### Error Handling
- User cancellation: No error message shown
- Network errors: Clear message with retry suggestion
- Product unavailable: Helpful error message
- Invalid purchase: Clear error message

## Testing Checklist

- [ ] Monthly subscription purchase works
- [ ] Yearly subscription purchase works  
- [ ] Lifetime subscription purchase works
- [ ] User cancellation handled properly
- [ ] Error states display correctly
- [ ] Purchase success updates user status
- [ ] Restore purchases works
- [ ] Multiple purchase attempts handled

## Next Steps
1. Get RevenueCat API keys from dashboard
2. Add environment variables
3. Test with sandbox Apple ID
4. Verify EAS build configuration
5. Test on physical device 