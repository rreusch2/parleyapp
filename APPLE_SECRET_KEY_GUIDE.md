# 🔑 How to Get Your Apple Secret Key for Supabase

## Overview
Apple doesn't provide a secret key directly. Instead, you:
1. Create a private key (.p8 file) in Apple Developer
2. Use that to generate a JWT secret
3. Put the JWT secret in Supabase

## Step 1: Create/Download Your Apple Private Key

### Go to Apple Developer Console:
1. Visit https://developer.apple.com
2. Sign in with your Apple Developer account
3. Navigate to **Certificates, Identifiers & Profiles**
4. Click **Keys** in the left sidebar

### Create a New Key:
1. Click the **"+"** button to create a new key
2. Give it a name: `Predictive Play Sign In Key`
3. Check the box for **"Sign in with Apple"**
4. Click **Configure** next to Sign in with Apple
5. Select your Primary App ID: `com.app.predictiveplay`
6. Click **Save**
7. Click **Continue**
8. Click **Register**

### Download the Key:
⚠️ **IMPORTANT**: You can only download this file ONCE!
1. Click **Download** to get your `.p8` file
2. Save it somewhere safe (e.g., `AuthKey_XXXXXXXXXX.p8`)
3. Note the **Key ID** shown on this page (10 characters like `ABC123DEFG`)

## Step 2: Get Your Team ID

Your Team ID is in the top right of Apple Developer Console:
- Look for something like `ABCDEF1234` (10 characters)
- It's shown as "Team ID: XXXXXXXXXX"

## Step 3: Generate the JWT Secret

### Option A: Use Supabase's Built-in Tool (Easiest)
1. Go to your Supabase dashboard
2. Navigate to Authentication → Providers → Apple
3. Click **"Generate a new secret"**
4. Fill in these fields:
   - **Team ID**: Your 10-character Team ID from Step 2
   - **Key ID**: The Key ID from when you created the key
   - **Service ID**: `com.app.predictiveplay.services` (or whatever you created)
   - **Private Key**: Open your `.p8` file in a text editor and paste THE ENTIRE CONTENTS including:
     ```
     -----BEGIN PRIVATE KEY-----
     [lots of characters]
     -----END PRIVATE KEY-----
     ```
5. Click **Generate**
6. Copy the generated JWT token (it will be very long)

### Option B: Use Apple's Tool
Visit: https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens

## Step 4: Add to Supabase

1. Go back to Supabase Authentication → Providers → Apple
2. Make sure **Enabled** is ON
3. Fill in:
   - **Client ID**: Your Services ID (e.g., `com.app.predictiveplay.services`)
   - **Secret**: Paste the JWT you generated in Step 3
4. Click **Save**

## Example of What Each Field Looks Like:

**Team ID**: `A1B2C3D4E5` (10 characters)

**Key ID**: `X9Y8Z7W6V5` (10 characters)

**Services ID**: `com.app.predictiveplay.services`

**Private Key** (.p8 file contents):
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg[...]
[multiple lines of base64 encoded data]
[...]Cw5IMmYvHpVRRQvCrL
-----END PRIVATE KEY-----
```

**Generated JWT Secret** (what goes in Supabase):
```
eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlhZWjEyMyJ9.eyJpc3MiOiJBQkNERUYxMjM0Iiwi[...]
```
(This will be VERY long - 500+ characters)

## Common Issues:

❌ **"Invalid client_id or web domain"**
- Your Services ID doesn't match what's in Apple Developer

❌ **"Invalid grant"**
- The JWT secret is expired (regenerate it)
- The private key was revoked

❌ **"Invalid authentication token"**
- Wrong Services ID in Supabase
- JWT wasn't generated correctly
- Missing or wrong Team ID/Key ID

## Need to Find an Existing Key?

If you already created a key:
1. Go to Apple Developer → Keys
2. Find your Sign in with Apple key
3. Click on it to see the Key ID
4. You'll need to generate a new key if you lost the .p8 file 