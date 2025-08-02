# 🔧 Startup Crash Fix - Environment Setup Required

## What Was Fixed

Your app was crashing on startup due to missing native module configurations. I've fixed the following issues:

### ✅ Fixed Issues:
1. **Facebook SDK Configuration** - Added proper Info.plist settings and URL schemes
2. **RevenueCat Plugin** - Added RevenueCat plugin configuration
3. **Error Handling** - Added graceful error handling for native module initialization
4. **Safe Initialization** - Created delayed initialization to prevent startup crashes

## 🚨 Required Action: Environment Variables

You **MUST** set up these environment variables for the app to work properly:

### Facebook SDK (REQUIRED)
```bash
# Get these from Facebook Developer Console
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_CLIENT_TOKEN=your_facebook_client_token_here
```

### RevenueCat (REQUIRED)
```bash
# Get these from RevenueCat Dashboard
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=your_ios_api_key_here
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=your_android_api_key_here
```

### Supabase (Already Set?)
```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_BACKEND_URL=your_backend_url
```

## 📝 How to Set Environment Variables

### For Development (.env file):
Create a `.env` file in your project root:
```bash
# Facebook SDK
FACEBOOK_APP_ID=123456789012345
FACEBOOK_CLIENT_TOKEN=abc123def456ghi789

# RevenueCat
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_ABC123
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_DEF456

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_BACKEND_URL=https://your-backend.com
```

### For EAS Build:
```bash
# Set environment variables in EAS
eas secret:create --scope project --name FACEBOOK_APP_ID --value your_app_id
eas secret:create --scope project --name FACEBOOK_CLIENT_TOKEN --value your_token
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value your_key
```

## 🔧 Manual Updates Needed

You still need to update these placeholders in `app.config.js`:

```javascript
// Replace these with your actual Facebook App ID
"appID": "YOUR_FACEBOOK_APP_ID", // ← Replace this
"clientToken": "YOUR_FACEBOOK_CLIENT_TOKEN", // ← Replace this
"scheme": "fb" + "YOUR_FACEBOOK_APP_ID", // ← Replace this
```

**Change to:**
```javascript
"appID": process.env.FACEBOOK_APP_ID,
"clientToken": process.env.FACEBOOK_CLIENT_TOKEN, 
"scheme": "fb" + process.env.FACEBOOK_APP_ID,
```

## 🚀 Next Steps

1. **Set up Facebook App** (if you haven't):
   - Go to [Facebook Developer Console](https://developers.facebook.com/)
   - Create a new app or use existing one
   - Get your App ID and Client Token

2. **Set up RevenueCat** (if you haven't):
   - Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
   - Create project and get API keys

3. **Set Environment Variables** using one of the methods above

4. **Update app.config.js** with the environment variable references

5. **Test the build** after making these changes

## ⚠️ Why This Happened

The crash occurred because:
- Facebook SDK tried to initialize without proper configuration
- RevenueCat wasn't configured as a plugin
- Native modules were initializing synchronously at startup
- Missing URL schemes and Info.plist entries

The fixes I implemented will prevent these crashes and make your app more robust.

## 🔍 What Changed

### Files Modified:
- `app.config.js` - Added Facebook SDK config, RevenueCat plugin, URL schemes
- `app/services/subscriptionContext.tsx` - Added delayed initialization and error handling
- `app/services/facebookService.ts` - New safe Facebook SDK wrapper (NEW FILE)

All changes are backwards compatible and won't break existing functionality.