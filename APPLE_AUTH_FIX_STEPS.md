# 🚨 IMMEDIATE APPLE AUTH FIX STEPS

## The Problem
You're getting "Invalid authentication token" because Supabase can't validate the Apple token. This is a configuration issue.

## Step 1: Check Your Supabase Apple Provider Settings

Go to: https://supabase.com/dashboard/project/iriaegoipkjtktitpary/auth/providers

Click on **Apple** and verify:

### ✅ Required Fields:
1. **Enabled**: Toggle must be ON
2. **Client ID (Services ID)**: Should be something like `com.app.predictiveplay.services` 
   - ⚠️ NOT your bundle ID (`com.app.predictiveplay`)
   - This is a SEPARATE identifier for web services
3. **Secret (Secret Key)**: The JWT token you generate from your .p8 file

## Step 2: Create/Verify Services ID in Apple Developer

1. Go to https://developer.apple.com
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → Filter by **Services IDs** (top right dropdown)
4. Create new Services ID:
   ```
   Identifier: com.app.predictiveplay.services
   Description: Predictive Play Sign In
   ```
5. Enable **Sign in with Apple**
6. Click **Configure** next to Sign in with Apple:
   - Primary App ID: `com.app.predictiveplay`
   - Domains and Subdomains: `iriaegoipkjtktitpary.supabase.co`
   - Return URLs: `https://iriaegoipkjtktitpary.supabase.co/auth/v1/callback`
7. Save everything

## Step 3: Generate Fresh Secret Key

1. Go to Apple Developer → **Keys**
2. Create new key or use existing:
   - Name: "Predictive Play Sign In Key"
   - Enable: Sign in with Apple
   - Configure → Select your app
3. Download the `.p8` file
4. Go to: https://supabase.com/dashboard/project/iriaegoipkjtktitpary/auth/providers
5. In the Apple section, click "Generate a new secret"
6. Fill in:
   - Team ID: Your 10-character team ID (top right in Apple Developer)
   - Key ID: The ID of the key you just created/downloaded
   - Services ID: `com.app.predictiveplay.services` (from Step 2)
   - Private Key: Paste entire contents of .p8 file
7. Click Generate
8. Copy the generated JWT secret
9. Paste it in the **Secret** field in Supabase
10. Click **Save**

## Step 4: Add Redirect URLs

In Supabase dashboard:
1. Go to **Authentication** → **URL Configuration**
2. Add these to **Redirect URLs**:
   ```
   predictiveplay://
   com.app.predictiveplay://
   exp://
   ```
3. Save

## Step 5: Test It

1. Clear your app cache/data
2. Run on physical iOS device (not simulator)
3. Check console for debug output
4. The debug alert will show you the Apple ID and email if token fails

## If It Still Doesn't Work

Run the app and share:
1. The console output (all the 🍎 logs)
2. Screenshot of your Supabase Apple provider settings
3. The debug alert contents

## Common Mistakes to Avoid

❌ Using bundle ID (`com.app.predictiveplay`) as Services ID
❌ Not including BEGIN/END lines in private key
❌ Using expired secret (regenerate every 6 months)
❌ Testing on simulator (must use real device)
✅ Services ID should be DIFFERENT from bundle ID
✅ Secret key is a JWT, not the .p8 file content directly 