# Meta/Facebook Tracking Complete Fix for ParleyApp

## 🚨 CRITICAL ISSUES IDENTIFIED

Based on your setup analysis, here are the 5 major problems causing tracking failures:

### 1. **DUPLICATE DATA SOURCES CONFLICT**
- You have 2 app data sources: `3707455102725081` and `1019527860059930`
- You have 2 pixels: `801467162338511` and `803279525712896`
- This creates massive confusion in Meta's attribution system

### 2. **OUTDATED FACEBOOK SDK**
- Currently using old SDK version
- Meta requires Facebook SDK 8.0.0+ for iOS 14+ tracking
- Missing critical iOS 14.5+ privacy features

### 3. **APP ID MISMATCH**
- app.config.js uses App ID: `1019527860059930`
- Primary dataset shows: `3707455102725081`
- Mismatch prevents proper event attribution

### 4. **MISSING iOS TRACKING PERMISSIONS**
- App Tracking Transparency (ATT) not properly implemented
- iOS 14.5+ users can't be tracked without explicit permission
- Required for IDFA access and conversion tracking

### 5. **GRAPH API PERMISSION ERRORS**
- Error 100: Object with ID '3707455102725081' cannot be accessed
- Missing required permissions for dataset access
- Business Manager access not properly configured

---

## ✅ STEP-BY-STEP SOLUTION

### **STEP 1: CLEAN UP DATA SOURCES**

1. **Choose ONE Primary App Data Source:**
   - Use: `1019527860059930` (matches your app.config.js)
   - Delete/disable: `3707455102725081`

2. **Choose ONE Pixel:**
   - Keep the newer/more active pixel
   - Delete/disable the duplicate

3. **In Events Manager:**
   - Go to Data Sources
   - Archive the unused data sources
   - Keep only one app data source and one pixel

### **STEP 2: UPDATE FACEBOOK SDK**

Update your package.json Facebook SDK version:

```json
{
  "dependencies": {
    "react-native-fbsdk-next": "^13.4.1" // ✅ Already latest
  }
}
```

**For iOS Cocoapods (if using):**
Add to ios/Podfile:
```ruby
pod 'FBSDKCoreKit', '~> 17.0.0'
pod 'FBSDKLoginKit', '~> 17.0.0'
```

### **STEP 3: FIX APP CONFIGURATION**

Update app.config.js to match your chosen data source:

```javascript
// app.config.js
{
  facebookAppId: "1019527860059930", // ✅ Already correct
  facebookAutoLogAppEventsEnabled: true, // ✅ Already correct
  facebookAdvertiserIDCollectionEnabled: true, // ✅ Already correct
}
```

### **STEP 4: IMPLEMENT iOS 14.5+ TRACKING**

Add App Tracking Transparency to your app startup:

```typescript
// Add to App.tsx or _layout.tsx
import { Platform } from 'react-native';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

useEffect(() => {
  if (Platform.OS === 'ios') {
    requestTrackingPermissionsAsync();
  }
}, []);
```

### **STEP 5: FIX BUSINESS MANAGER PERMISSIONS**

1. **In Business Manager Settings:**
   - Go to Data Sources
   - Find your app data source: `1019527860059930`
   - Add your ad account with "Advertise" permissions
   - Add your Business Manager with "Manage" permissions

2. **Update Graph API Access:**
   - Generate new access token in Graph API Explorer
   - Include these permissions:
     - `ads_management`
     - `business_management`
     - `events_management`

### **STEP 6: CONFIGURE SKAdNetwork PROPERLY**

Update iOS SKAdNetwork identifiers in app.config.js:

```javascript
"SKAdNetworkItems": [
  { "SKAdNetworkIdentifier": "v9wttpbfk9.skadnetwork" }, // Meta
  { "SKAdNetworkIdentifier": "n38lu8286q.skadnetwork" }, // Meta
  { "SKAdNetworkIdentifier": "cstr6suwn9.skadnetwork" }, // Meta Additional
  { "SKAdNetworkIdentifier": "424m5254lk.skadnetwork" }, // Meta Additional
]
```

### **STEP 7: INITIALIZE FACEBOOK ANALYTICS PROPERLY**

Update your Facebook service to ensure proper initialization:

```typescript
// In app startup (_layout.tsx)
import FacebookAnalyticsService from './services/facebookAnalyticsService';

useEffect(() => {
  FacebookAnalyticsService.initialize();
  
  // Track app install on first launch
  FacebookAnalyticsService.trackAppInstall();
}, []);
```

### **STEP 8: TEST EVENT VERIFICATION**

1. **Clear Events Manager Cache:**
   - Go to Events Manager > Test Events
   - Clear all previous test data

2. **Generate Test Events:**
   ```typescript
   // Test in your app
   FacebookAnalyticsService.trackCompleteRegistration();
   FacebookAnalyticsService.trackViewContent('Daily Picks');
   FacebookAnalyticsService.trackPurchase(24.99, 'USD');
   ```

3. **Verify in Real-Time:**
   - Keep Test Events page open
   - Perform actions in app
   - Events should appear within 30 seconds

### **STEP 9: REBUILD AND REDEPLOY**

1. **Clean Build:**
   ```bash
   expo prebuild --clear
   eas build --platform ios --clear-cache
   ```

2. **Update App Store/TestFlight:**
   - Submit new build with updated SDK
   - Update version number to force app store refresh

### **STEP 10: CAMPAIGN CONFIGURATION**

1. **Create New Campaign:**
   - Use "App Installs" objective
   - Select your corrected data source: `1019527860059930`
   - Enable "Optimize for App Events" 

2. **Conversion Events Setup:**
   - Primary: `App Install` (automatic)
   - Secondary: `CompleteRegistration`
   - Tertiary: `Purchase`

---

## 🧪 TESTING CHECKLIST

### **Before Going Live:**

- [ ] Only one app data source active: `1019527860059930`
- [ ] Only one pixel active
- [ ] Facebook SDK updated to latest version
- [ ] iOS tracking permission implemented
- [ ] Business Manager permissions configured
- [ ] Test events showing in Events Manager
- [ ] New app build submitted to App Store
- [ ] Campaign created with correct data source

### **Expected Results After Fix:**

- [ ] Test events appear in Events Manager within 30 seconds
- [ ] Graph API calls return success (not error 100)
- [ ] App Install campaigns start spending
- [ ] Attribution data flows to Events Manager
- [ ] Conversion tracking works for purchases

---

## 🚨 CRITICAL NEXT STEPS

1. **IMMEDIATELY:**
   - Clean up duplicate data sources in Events Manager
   - Update Business Manager permissions

2. **THIS WEEK:**
   - Implement iOS tracking permission
   - Rebuild and submit new app version

3. **AFTER APP REVIEW:**
   - Test event tracking thoroughly
   - Launch new campaigns with corrected setup

---

## 🔧 DEBUGGING COMMANDS

**Test Graph API Access:**
```bash
curl -G "https://graph.facebook.com/v18.0/1019527860059930" \
  -d "access_token=YOUR_ACCESS_TOKEN"
```

**Test Event Logging:**
```bash
curl -X POST "https://graph.facebook.com/v18.0/1019527860059930/activities" \
  -d "event=MOBILE_APP_INSTALL" \
  -d "access_token=YOUR_ACCESS_TOKEN"
```

This comprehensive fix addresses all the root causes. The main issue is data source conflicts and outdated SDK - fix these and your campaigns will start working.
