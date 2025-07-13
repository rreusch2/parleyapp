# 🍎 Apple Sign In Fix for React Native/Expo

## The Issue
You're using a **Service ID** configuration (for web OAuth) when you need an **App ID** configuration (for native apps).

## Quick Fix Steps

### 1. In Supabase Dashboard
Go to: https://supabase.com/dashboard/project/iriaegoipkjtktitpary/auth/providers

In the Apple provider settings:

**Client IDs** field should contain:
```
com.app.predictiveplay
```

NOT `com.app.predictiveplay.signin` (that's a Service ID for web)!

If you're testing with Expo Go, also add:
```
host.exp.Exponent
```

So your Client IDs field should look like:
```
com.app.predictiveplay, host.exp.Exponent
```

### 2. Leave OAuth Settings Empty
Since you're building a native app using `signInWithIdToken`, you should:
- **Leave the "Secret Key" field EMPTY**
- You don't need a Service ID at all
- You don't need to generate any JWT tokens

### 3. In Apple Developer Portal
Make sure your App ID has Sign in with Apple enabled:
1. Go to **Identifiers** → Select your App ID (`com.app.predictiveplay`)
2. Under **Capabilities**, ensure "Sign in with Apple" is checked
3. Save

### 4. Your Code is Already Correct! ✅
Your code in `login.tsx` and `signup.tsx` is using the right approach:
```typescript
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: credential.identityToken,
});
```

## Summary of Changes Needed

| Setting | Wrong (Web OAuth) | Correct (Native App) |
|---------|------------------|---------------------|
| Client IDs | com.app.predictiveplay.signin | com.app.predictiveplay |
| Secret Key | JWT token | Leave EMPTY |
| Service ID | Created one | Not needed |

## Testing
1. Update the Client IDs in Supabase to `com.app.predictiveplay`
2. Clear the Secret Key field (leave it empty)
3. Save the configuration
4. Test on a physical iOS device

## Why This Works
- Native apps use **App IDs** (bundle identifiers) not Service IDs
- Native apps use the identity token directly, no OAuth flow needed
- The Service ID and Secret Key are only for web-based OAuth flows

## If Testing with Expo Go
Add both to Client IDs:
```
com.app.predictiveplay, host.exp.Exponent
```

That's it! Much simpler than the OAuth configuration! 🎉 