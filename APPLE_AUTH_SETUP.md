# Apple Sign In Setup Guide for ParleyApp

## Issues Fixed

### 1. ✅ **Apple Sign In/Sign Up Error Fixed**
- Removed incorrect `nonce` parameter that was causing authentication failures
- Added detailed error logging to help diagnose issues
- Improved error messages for users

### 2. ✅ **UI Layout Issue Fixed**
- Added proper padding to prevent "Create Your Account" text from being cut off
- Reduced title font size slightly for better fit
- Added platform-specific padding for iOS and Android

## Required Supabase Configuration

For Apple Sign In to work properly, you need to configure Apple as an authentication provider in your Supabase dashboard:

### Step 1: Access Supabase Dashboard
1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project: `iriaegoipkjtktitpary`
3. Navigate to **Authentication** → **Providers**

### Step 2: Enable Apple Provider
1. Find **Apple** in the list of providers
2. Toggle it **ON**
3. You'll need to provide:
   - **Service ID** (from Apple Developer)
   - **Team ID** (from Apple Developer)
   - **Key ID** (from Apple Developer)
   - **Private Key** (from Apple Developer)

### Step 3: Apple Developer Configuration

#### Create Service ID:
1. Go to [developer.apple.com](https://developer.apple.com)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** → **Services IDs**
4. Description: "Predictive Play Sign In"
5. Identifier: `com.app.predictiveplay.signin`
6. Enable **Sign In with Apple**
7. Configure:
   - Primary App ID: `com.app.predictiveplay`
   - Domains: Your Supabase project URL (without https://)
   - Return URLs: `https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback`

#### Create Sign In Key:
1. Go to **Keys** → **+**
2. Name: "Predictive Play Sign In Key"
3. Enable **Sign In with Apple**
4. Configure → Select your app
5. Download the `.p8` key file (SAVE THIS - you can't download it again!)

### Step 4: Configure in Supabase
Back in Supabase dashboard:
1. **Service ID**: `com.app.predictiveplay.signin`
2. **Team ID**: Found in Apple Developer account (10 characters)
3. **Key ID**: From the key you created (10 characters)
4. **Private Key**: Contents of the `.p8` file (include BEGIN/END lines)

### Step 5: Update Redirect URLs
In Supabase:
1. Go to **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `predictiveplay://` (for mobile app)
   - `com.app.predictiveplay://` (alternative scheme)

## Testing Apple Sign In

### Development Testing:
1. Run your app on a physical iOS device (Apple Sign In doesn't work in simulator)
2. Tap "Sign in with Apple" or "Sign up with Apple"
3. You should see Apple's native authentication dialog
4. Complete the flow with your Apple ID

### Common Issues:

**"Apple Sign In is not properly configured"**
- Apple provider is not enabled in Supabase
- Service ID, Team ID, Key ID, or Private Key is incorrect

**"Invalid authentication token"**
- The app bundle ID doesn't match what's configured
- The Service ID is incorrect

**Silent failures (no error, nothing happens)**
- Check Xcode console for detailed logs
- Ensure you're testing on a real device, not simulator

## Code Changes Made

### 1. Fixed Authentication Code:
```typescript
// Before (incorrect):
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: credential.identityToken,
  nonce: credential.authorizationCode ? 'nonce' : undefined, // ❌ Wrong
});

// After (fixed):
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: credential.identityToken,
  // Removed nonce - let Supabase handle it ✅
});
```

### 2. Fixed UI Layout:
```typescript
// Added padding to prevent title cutoff:
scrollContent: {
  flexGrow: 1,
  justifyContent: 'center',
  paddingTop: Platform.OS === 'ios' ? 60 : 40, // Safe padding
  paddingBottom: 20,
}
```

## Next Steps

1. **Configure Apple Provider in Supabase** (required for it to work)
2. **Test on physical iOS device** (not simulator)
3. **Monitor console logs** for any remaining issues

Once Apple is properly configured in Supabase, your Sign In/Sign Up with Apple buttons should work correctly! 