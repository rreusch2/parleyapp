# AppsFlyer + TikTok Ads Integration Guide

## ✅ What We've Implemented

### 1. AppsFlyer SDK Integration
- **Package**: `react-native-appsflyer` installed
- **Configuration**: Added to `app.config.js` with your credentials
- **Service**: Created `AppsFlyerService` singleton for easy usage

### 2. Your AppsFlyer Credentials
```
Dev Key: NgBrVqoMhaRVeeaekgT9xX
App ID: id6748275790 (iOS)
Package: com.parleyapp.mobile (Android)
```

### 3. Event Tracking Implemented
- ✅ **App Initialization**: AppsFlyer starts when app launches
- ✅ **User Signup**: Tracks when users register (`af_complete_registration`)
- ✅ **Subscription Purchase**: Tracks Pro subscriptions (`af_purchase`)
- ✅ **Prediction Views**: Tracks when users view predictions (`af_content_view`)
- ✅ **Custom Events**: Framework for any additional tracking

### 4. TikTok Attribution Ready
- ✅ **Install Attribution**: Automatically detects TikTok installs
- ✅ **Campaign Data**: Captures campaign, adgroup, creative data
- ✅ **Deep Linking**: Ready for TikTok deep link campaigns
- ✅ **Conversion Tracking**: Tracks valuable user actions for optimization

## 🚀 Next Steps for You

### Step 1: Build and Test Your App
```bash
# Create development build with AppsFlyer
npx expo run:ios
# or
npx expo run:android
```

### Step 2: Test AppsFlyer Integration
1. **Add Test Component** to your app (optional):
   ```typescript
   // In any screen, add:
   import AppsFlyerTestPanel from '../components/AppsFlyerTestPanel';
   
   // Then render:
   <AppsFlyerTestPanel />
   ```

2. **Check Console Logs** for AppsFlyer events:
   - Look for "🚀 Initializing AppsFlyer"
   - Look for "📊 AppsFlyer signup event tracked"
   - Look for "📈 Tracking AppsFlyer event"

### Step 3: Verify in AppsFlyer Dashboard
1. Go to your AppsFlyer dashboard
2. Navigate to **Live Events** or **Events**
3. You should see events coming in:
   - `af_complete_registration` (signups)
   - `af_purchase` (subscriptions)
   - `af_content_view` (prediction views)

### Step 4: Set Up TikTok Ads Campaign
1. **In TikTok Ads Manager**:
   - Create new campaign
   - Choose "App Install" or "App Event Optimization"
   - Add your App Store/Google Play URLs

2. **Attribution Setup**:
   - TikTok will automatically send attribution data to AppsFlyer
   - AppsFlyer will show you which TikTok campaigns drive installs
   - You can optimize based on which campaigns drive subscriptions

### Step 5: Advanced Tracking (Optional)
Add more specific events for better optimization:

```typescript
// Track when users view specific prediction types
await appsFlyerService.trackEvent('prediction_type_view', {
  prediction_type: 'player_props',
  sport: 'MLB'
});

// Track when users engage with AI chat
await appsFlyerService.trackEvent('ai_chat_engagement', {
  message_count: 5
});

// Track subscription plan preferences
await appsFlyerService.trackEvent('subscription_plan_viewed', {
  plan: 'yearly',
  price: 199.99
});
```

## 🔧 Troubleshooting

### If AppsFlyer Events Aren't Showing
1. **Check Console**: Look for AppsFlyer initialization logs
2. **Check Network**: Ensure device has internet connection
3. **Check Credentials**: Verify Dev Key and App ID are correct
4. **Wait Time**: Events can take 5-10 minutes to appear in dashboard

### If TikTok Attribution Isn't Working
1. **Check Deep Links**: Ensure your app handles deep links properly
2. **Check App Store URLs**: Make sure TikTok has correct app URLs
3. **Check Attribution Window**: AppsFlyer has attribution windows (default 24h for installs)

### Debug Mode
For development, AppsFlyer runs in debug mode automatically (`isDebug: __DEV__`).

## 📊 Expected Results

### Attribution Data You'll See:
- **Media Source**: `tiktokforbusiness_int`
- **Campaign**: Your TikTok campaign name
- **Adgroup**: Your TikTok adgroup name
- **Creative**: Your TikTok creative name
- **Install Time**: When user installed
- **First Launch**: When user first opened app

### Optimization Opportunities:
- **High-Value Users**: See which TikTok campaigns drive Pro subscribers
- **User Journey**: Track signup → subscription conversion rates
- **Creative Performance**: See which TikTok creatives perform best
- **Audience Insights**: Understand your most valuable user segments

## 🎯 TikTok Campaign Tips

### Best Practices:
1. **Target Sports Fans**: Use TikTok's interest targeting for sports
2. **Video Creatives**: Show your app's predictions in action
3. **Call-to-Action**: "Get AI sports predictions" or "Beat the bookies"
4. **Landing Page**: Deep link to your signup or subscription flow
5. **Bidding**: Start with "Lowest Cost" then optimize for "Value"

### Campaign Structure:
```
Campaign: ParleyApp - Sports Betting Predictions
├── Adgroup 1: MLB Fans (Interest: Baseball)
├── Adgroup 2: Sports Bettors (Interest: Sports Betting)
├── Adgroup 3: Fantasy Sports (Interest: Fantasy Sports)
└── Adgroup 4: Lookalike (Based on your Pro subscribers)
```

## 🔐 Security Notes

- Your Dev Key is configured in the app config (safe for client-side)
- API Token V2 is optional and should be kept server-side if used
- AppsFlyer automatically handles user privacy (GDPR, CCPA compliant)

## 📞 Support

If you need help:
1. **AppsFlyer Support**: Check their documentation and support portal
2. **TikTok Ads Support**: Use TikTok Ads Manager help center
3. **Integration Issues**: Check the console logs and AppsFlyer dashboard

---

**You're all set!** 🎉 Your app now has full AppsFlyer + TikTok ads integration. Build your app, test the events, and start your TikTok campaigns!
