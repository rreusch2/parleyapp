# AdMob Integration Guide

## 🎯 Overview

Your app now has Google AdMob integration using **test ads by default** - perfect for TestFlight and App Store review!

## 📱 Current Setup

### Test Mode (DEFAULT)
- ✅ Uses Google's test ad units
- ✅ Safe for App Store review
- ✅ Perfect for TestFlight testing
- ✅ Shows real ad experience without revenue

### Configuration
- **Config file**: `app.config.js` contains your real AdMob App IDs
- **Test mode**: Set in `app/services/admobService.ts`

## 🚀 How to Use

### 1. Basic Reward Ad Button
```tsx
import RewardAdButton from '../components/RewardAdButton';

<RewardAdButton
  title="Watch Ad for Reward"
  subtitle="Get bonus features"
  onRewardEarned={() => {
    // Handle reward logic here
    console.log('User earned reward!');
  }}
/>
```

### 2. Using the Hook Directly
```tsx
import { useAdMob } from '../hooks/useAdMob';

function MyComponent() {
  const { isAdReady, showRewardedAd, isTestMode } = useAdMob();

  const handleWatchAd = async () => {
    if (isAdReady) {
      await showRewardedAd();
      // Reward logic here
    }
  };

  return (
    <Button 
      title={`Watch Ad ${isTestMode ? '(Test)' : ''}`}
      onPress={handleWatchAd}
      disabled={!isAdReady}
    />
  );
}
```

## 🔄 Switching to Production Ads

**When you're ready to use real ads** (after App Store approval):

1. Open `app/services/admobService.ts`
2. Change this line:
   ```typescript
   USE_TEST_ADS: true,  // ← Change to false
   ```
   to:
   ```typescript
   USE_TEST_ADS: false,  // ← Now uses real ads
   ```

3. Rebuild your app:
   ```bash
   npx eas build --platform ios --profile production
   ```

## 📋 Current Implementation

### Files Created:
- `app/services/admobService.ts` - Core AdMob service
- `app/hooks/useAdMob.ts` - React hook for components
- `app/components/RewardAdButton.tsx` - Reusable ad button
- Home screen integration in `app/(tabs)/index.tsx`

### Ad Units:
- **Test Reward Ad**: `ca-app-pub-3940256099942544/5224354917`
- **Real Reward Ad**: `ca-app-pub-9584826565591456/9182858395`

### App IDs:
- **Test App ID**: `ca-app-pub-3940256099942544~1458002511`
- **Real App ID**: `ca-app-pub-9584826565591456~1910888945`

## 🎯 Benefits of This Setup

1. **TestFlight Ready**: Test ads work perfectly in TestFlight
2. **App Store Safe**: No risk of policy violations during review
3. **Easy Switch**: One line change to go live
4. **No Account Risk**: Test ads don't affect your AdMob account
5. **Real Experience**: Test ads look and behave like real ads

## 🔧 Customization

### Button Sizes
```tsx
<RewardAdButton size="small" />   // Compact button
<RewardAdButton size="medium" />  // Default size
<RewardAdButton size="large" />   // Big button
```

### Custom Styling
```tsx
<RewardAdButton
  style={{ marginVertical: 16 }}
  title="Custom Title"
  subtitle="Custom subtitle"
/>
```

## 📊 Testing

1. **Test ads will show immediately** in development builds
2. **Check console logs** for ad loading status
3. **Look for "(Test)" indicator** in UI when using test mode

## 🚀 Ready for Production!

Your AdMob integration is now:
- ✅ Configured with test ads
- ✅ Ready for TestFlight
- ✅ Safe for App Store submission
- ✅ Easy to switch to production when ready

Submit your build with confidence! 🎉 