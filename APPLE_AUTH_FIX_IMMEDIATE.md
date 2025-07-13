# 🚨 IMMEDIATE FIXES NEEDED

## Part 1: UI Crashes Fixed ✅
I've already fixed these issues in the code:
- Removed all `Haptics` references that were causing crashes
- Fixed the "AI" badge overlapping the "Online" text
- All crashes when clicking quick prompts or close button are now resolved

## Part 2: Apple Sign In Authentication Fix 🔑

### The Problem
You're getting "Authentication token is invalid" because the Apple configuration doesn't match between Apple Developer and Supabase.

### Step-by-Step Fix

#### 1. Apple Developer Portal Setup
Go to https://developer.apple.com

1. **Create/Verify Service ID:**
   - Go to **Certificates, Identifiers & Profiles** → **Identifiers**
   - Click the filter dropdown (top right) and select **Services IDs**
   - Click **+** to create new Service ID:
     ```
     Description: ParleyApp Sign In Service
     Identifier: com.app.predictiveplay.signin
     ```
   - ✅ Enable **Sign In with Apple**
   - Click **Configure** next to Sign In with Apple:
     - Primary App ID: `5HP4X6G5VH.com.app.predictiveplay`
     - Domains and Subdomains: `iriaegoipkjtktitpary.supabase.co`
     - Return URLs: `https://iriaegoipkjtktitpary.supabase.co/auth/v1/callback`
   - Click **Continue** → **Save**

2. **Create/Get Your Key:**
   - Go to **Keys** section
   - If you don't have a Sign in with Apple key, create one:
     - Click **+**
     - Name: "Predictive Play Sign In Key"
     - ✅ Check **Sign in with Apple**
     - Configure → Select your app
     - Continue → Register
   - Download the `.p8` file (⚠️ You can only download once!)
   - Note your **Key ID** (10 characters like `ABC123DEFG`)

3. **Get Your Team ID:**
   - Look at the top right of Apple Developer portal
   - You'll see "Team ID: 5HP4X6G5VH" (your 10-character team ID)

#### 2. Supabase Configuration
Go to https://supabase.com/dashboard/project/iriaegoipkjtktitpary/auth/providers

1. **Click on Apple provider**
2. **Toggle it ON if not already**
3. **Generate the Secret Key:**
   - Click **"Generate a new secret"**
   - Fill in:
     - Team ID: `5HP4X6G5VH`
     - Key ID: `[Your Key ID from Apple]`
     - Service ID: `com.app.predictiveplay.signin`
     - Private Key: Open your `.p8` file in a text editor and paste ALL contents:
       ```
       -----BEGIN PRIVATE KEY-----
       [all the characters]
       -----END PRIVATE KEY-----
       ```
   - Click **Generate**
   - Copy the generated JWT token

4. **Save Configuration:**
   - Service ID: `com.app.predictiveplay.signin`
   - Secret Key: `[The JWT token you just generated]`
   - Click **Save**

#### 3. Verify Redirect URLs
In Supabase, go to **Authentication** → **URL Configuration**

Add these to **Redirect URLs** if not already present:
```
predictiveplay://
com.app.predictiveplay://
exp://
```

### Testing
1. Kill your app completely
2. Run on a physical iOS device (NOT simulator)
3. Try Sign in with Apple again

### If Still Not Working
Check these common issues:
- ✅ Service ID in Supabase EXACTLY matches: `com.app.predictiveplay.signin`
- ✅ You used the generated JWT token, NOT the .p8 file content
- ✅ The Service ID is configured with correct domain and return URL
- ✅ You're testing on a real device, not simulator

### Debug Output
When you test, the console will show:
```
🍎 Starting Apple Sign In...
🍎 Apple credential received: {...}
🍎 Identity token length: [should be 800+ characters]
```

If the token length is less than 800, there's still a configuration issue.

## Summary
1. **UI Crashes**: ✅ Already fixed in code
2. **Apple Auth**: Follow the steps above to configure properly

The key is ensuring the Service ID `com.app.predictiveplay.signin` is:
- Created in Apple Developer with proper configuration
- Used to generate the JWT secret
- Saved correctly in Supabase 