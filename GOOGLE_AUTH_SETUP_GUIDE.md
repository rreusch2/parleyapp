# Google Authentication Setup Guide for ParleyApp

This guide provides complete step-by-step instructions for setting up Google Sign-In with Expo, Supabase, and React Native.

## Prerequisites

- Expo development build (EAS Build) - Google Sign-In requires native code
- Supabase project with authentication enabled
- Google Cloud Console account
- Android and iOS certificates for app signing

## Phase 1: Google Cloud Console Setup

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `parleyapp-auth`
4. Click "Create"

### 1.2 Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in required fields:
   - App name: `ParleyApp`
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes:
   - `email`
   - `profile`
   - `openid`
5. Save and continue through all steps

### 1.3 Create OAuth 2.0 Credentials

**Note:** No APIs need to be enabled for basic Google OAuth authentication. The OAuth consent screen and credentials are sufficient.

#### For Android:
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Application type: "Android"
4. Name: `ParleyApp Android`
5. Package name: `com.parleyapp.parley` (your bundle identifier)
6. SHA-1 certificate fingerprint: 
   ```bash
   # Get from EAS credentials or generate:
   expo credentials:manager --platform android
   ```
7. Click "Create"
8. **Save the Client ID** - you'll need this

#### For iOS:
1. Create another OAuth 2.0 Client ID
2. Application type: "iOS"  
3. Name: `ParleyApp iOS`
4. Bundle ID: `com.parleyapp.parley`
5. Click "Create"
6. **Save the Client ID** - you'll need this

#### For Web (Supabase):
1. Create a third OAuth 2.0 Client ID
2. Application type: "Web application"
3. Name: `ParleyApp Supabase`
4. Authorized redirect URIs:
   ```
   https://iriaegoipkjtktitpary.supabase.co/auth/v1/callback
   ```
5. Click "Create"
6. **Save both Client ID and Client Secret** - needed for Supabase

## Phase 2: Expo Configuration

### 2.1 Install Dependencies

```bash
# Install Google Sign-In package
npx expo install @react-native-google-signin/google-signin

# Install Expo dev build dependencies
npx expo install expo-dev-client
```

### 2.2 Configure app.json/app.config.js

Add Google Sign-In configuration to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.parleyapp.parley"
        }
      ]
    ],
    "android": {
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    }
  }
}
```

### 2.3 Download Configuration Files

#### Android - google-services.json:
1. In Google Cloud Console, go to "APIs & Services" → "Credentials"
2. Find your Android OAuth client
3. Download `google-services.json`
4. Place in your project root directory

#### iOS - GoogleService-Info.plist:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project or use existing
3. Add iOS app with bundle ID `com.parleyapp.parley`
4. Download `GoogleService-Info.plist`
5. Place in your project root directory

### 2.4 Configure Google Sign-In in App

Add initialization to your `_layout.tsx` or App entry point:

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // From Google Cloud Console
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com', // iOS Client ID
  offlineAccess: true,
  hostedDomain: '', // Optional
  forceCodeForRefreshToken: true,
});
```

## Phase 3: Supabase Configuration

### 3.1 Enable Google OAuth Provider

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to "Authentication" → "Providers"
3. Find "Google" and click "Enable"
4. Enter credentials from Google Cloud Console:
   - **Client ID**: Web application client ID
   - **Client Secret**: Web application client secret
5. Set redirect URL: `https://iriaegoipkjtktitpary.supabase.co/auth/v1/callback`
6. Click "Save"

### 3.2 Update Supabase Policies (if needed)

Ensure your `profiles` table has proper RLS policies for Google users:

```sql
-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

## Phase 4: EAS Build Configuration

### 4.1 Create EAS Build

Since Google Sign-In requires native code, you must use EAS Build:

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS Build
eas build:configure

# Build for development
eas build --platform android --profile development
eas build --platform ios --profile development
```

### 4.2 Update eas.json

Ensure your `eas.json` includes the Google configuration files:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

## Phase 5: Testing

### 5.1 Install Development Build

```bash
# Install on device/simulator
eas build:run --platform android
# or
eas build:run --platform ios
```

### 5.2 Test Google Sign-In Flow

1. Open the app on device/simulator
2. Go to login/signup page
3. Tap "Continue with Google"
4. Complete Google authentication
5. Verify user is created in Supabase `auth.users` and `profiles` tables

### 5.3 Debug Common Issues

#### "Google Play Services not available"
- Ensure testing on real device with Google Play Services
- Update Google Play Services on device

#### "Network error"
- Check internet connection
- Verify Google Cloud Console credentials
- Ensure Supabase URL is correct

#### "Invalid client ID"
- Verify client IDs in Google Cloud Console
- Check bundle ID matches exactly
- Ensure SHA-1 certificate is correct for Android

## Phase 6: Production Deployment

### 6.1 Update OAuth Consent Screen

1. In Google Cloud Console, go to "OAuth consent screen"
2. Change from "Testing" to "In production"
3. Submit for verification if required

### 6.2 Production Build

```bash
# Build for production
eas build --platform android --profile production
eas build --platform ios --profile production
```

### 6.3 App Store Configuration

#### Android (Google Play Console):
- Upload APK/AAB with correct SHA-1 certificate
- Ensure OAuth client matches signing certificate

#### iOS (App Store Connect):  
- Upload IPA with correct bundle ID
- Verify GoogleService-Info.plist is included

## Environment Variables

Create a `.env` file with your configuration:

```bash
GOOGLE_WEB_CLIENT_ID=your_web_client_id.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=your_ios_client_id.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=your_android_client_id.apps.googleusercontent.com
SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Security Notes

1. **Never commit** `google-services.json` or `GoogleService-Info.plist` to version control
2. Use EAS Secrets for sensitive configuration
3. Ensure Supabase RLS policies are properly configured
4. Regularly rotate OAuth client secrets
5. Monitor authentication logs for suspicious activity

## Troubleshooting

### Lint Errors about Missing Module
The lint errors about `@react-native-google-signin/google-signin` are expected during development. This package requires native code that's only available in EAS builds, not in Expo Go.

### Testing in Development
- Use physical devices when possible
- Ensure Google Play Services are updated
- Use development build, not Expo Go
- Check console logs for detailed error messages

### Production Issues
- Verify all client IDs match production certificates
- Ensure OAuth consent screen is approved
- Check Supabase logs for authentication errors
- Monitor app store reviews for user-reported issues

## Summary

This implementation provides:
- ✅ Google Sign-In on both login and signup pages
- ✅ Proper integration with Supabase authentication
- ✅ User profile creation with referral code support
- ✅ Onboarding flow for new Google users
- ✅ Error handling and user feedback
- ✅ Production-ready configuration

The Google authentication is now fully integrated and ready for testing with EAS development builds.
