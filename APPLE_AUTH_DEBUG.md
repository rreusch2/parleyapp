# Apple Authentication Debugging Guide

## Current Issue: "Invalid authentication token"

This error typically means one of the following:
1. Apple provider is not properly configured in Supabase
2. Bundle ID mismatch
3. Service ID mismatch
4. Missing or incorrect configuration

## Step-by-Step Debugging

### 1. Check Console Logs

Run your app and check the console for these debug messages:
- `🍎 Starting Apple Sign In...`
- `🍎 Apple credential received:`
- `🍎 Identity token length:`

**What to look for:**
- Is the identityToken present?
- What's the token length? (Should be 800+ characters)
- Any specific error details?

### 2. Verify Your Bundle ID

Your app bundle ID: `com.app.predictiveplay`

**In Apple Developer:**
1. Go to Identifiers
2. Find your app identifier
3. Confirm it's exactly: `com.app.predictiveplay`

### 3. Check Supabase Apple Provider Configuration

Go to your Supabase dashboard:
1. Navigate to Authentication → Providers → Apple
2. Verify these fields:

**Required Configuration:**
- **Enabled**: Toggle should be ON
- **Service ID**: Should match what you created in Apple Developer
- **Team ID**: Your 10-character Apple Team ID
- **Key ID**: The ID of your Sign in with Apple key
- **Private Key**: The contents of your .p8 file

### 4. Common Configuration Issues

#### Issue: "Invalid authentication token"
**Possible causes:**
1. **Service ID doesn't match**
   - In Apple Developer, the Service ID should be something like `com.app.predictiveplay.signin`
   - This MUST match exactly what's in Supabase

2. **Bundle ID mismatch**
   - Your app uses: `com.app.predictiveplay`
   - This must be the primary App ID associated with your Service ID

3. **Private Key issues**
   - Make sure you included the ENTIRE .p8 file content
   - Include the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines

### 5. Quick Fix Checklist

1. **In Supabase Dashboard:**
   ```
   Service ID: [Your Service ID from Apple]
   Team ID: [Your 10-character Team ID]
   Key ID: [Your Sign in with Apple Key ID]
   Private Key: [Full .p8 file content including BEGIN/END]
   ```

2. **In Apple Developer - Service ID Configuration:**
   - Primary App ID: `com.app.predictiveplay`
   - Domains: `[your-project-ref].supabase.co`
   - Return URLs: `https://[your-project-ref].supabase.co/auth/v1/callback`

3. **Your Supabase project reference:**
   - Based on your URL, it should be: `iriaegoipkjtktitpary`
   - So your callback URL is: `https://iriaegoipkjtktitpary.supabase.co/auth/v1/callback`

### 6. Testing Steps

1. **Clear app data/cache**
2. **Run the app on a physical iOS device**
3. **Tap Sign in with Apple**
4. **Check console logs for debug output**
5. **Note the exact error message and details**

### 7. If Still Not Working

Check these in order:

1. **Verify Redirect URLs in Supabase:**
   - Go to Authentication → URL Configuration
   - Add: `predictiveplay://` 
   - Add: `com.app.predictiveplay://`

2. **Check if Apple Provider is saving:**
   - After entering all details in Supabase
   - Click Save
   - Refresh the page
   - Verify all fields still have values

3. **Token Format Check:**
   - The identityToken from Apple should be a JWT
   - It should have 3 parts separated by dots
   - Example format: `xxxxx.yyyyy.zzzzz`

### 8. Alternative Solution

If the above doesn't work, try using the authorization code instead:

```typescript
// In your auth files, you could try:
if (credential.authorizationCode && !data) {
  // Try with authorization code as fallback
  const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.authorizationCode,
  });
}
```

## Need More Help?

Please run the app and share:
1. The complete console output when you tap Apple Sign In
2. Screenshot of your Supabase Apple provider configuration (hide sensitive keys)
3. Your Apple Developer Service ID configuration screenshot 