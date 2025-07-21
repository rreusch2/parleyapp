# 🧪 Review System Testing Guide

## Quick Test Setup

### 1. Add Debug Panel to Settings (Temporary)

Add this to your settings screen for easy testing:

```typescript
// In app/(tabs)/settings.tsx - add this import at the top:
import ReviewDebugPanel from '../components/ReviewDebugPanel';

// Add this component in your settings screen JSX (only for testing):
{__DEV__ && <ReviewDebugPanel />}
```

### 2. Test the Review Triggers

**Method 1: Using Debug Panel**
1. Open Settings tab
2. Scroll to find "Review System Debug" panel
3. Click different test buttons to simulate events
4. Watch for native iOS review dialog

**Method 2: Natural User Flow**
1. **Fresh Install Test**: 
   - Delete app, reinstall
   - Sign up new account
   - Spin welcome wheel (should track positive interaction)
   - Use app for 3+ days, then subscribe to Pro
   - Should show review prompt after subscription

2. **Subscription Test**:
   - Go to subscription modal
   - Complete a purchase (use sandbox/test account)
   - Review prompt should appear after successful purchase

3. **Daily Usage Test**:
   - View picks on home screen multiple times
   - Use Professor Lock chat
   - After 3+ positive interactions over 3+ days, should prompt

### 3. Verify Review Dialog

The native iOS review dialog should:
- ✅ Show Apple's standard review popup
- ✅ Have 1-5 star rating
- ✅ "Write a Review" button
- ✅ "Not Now" option
- ✅ Only appear once (unless app is updated)

### 4. Check Review State

Use debug panel to view:
- Total app opens
- Positive interactions count
- Whether review was already requested
- Days since app install

## Expected Behavior

### ✅ Should Show Review When:
- User subscribes to Pro (immediate trigger)
- User wins 3+ picks on welcome wheel
- User has 3+ positive interactions AND 3+ days since install
- User has winning streak of 3+
- User views 10+ picks AND has 7+ app opens

### ❌ Should NOT Show Review When:
- Less than 3 days since app install
- Less than 3 positive interactions
- Already requested review in past 90 days
- User is on unsupported platform

## Debugging Tips

### If Review Doesn't Show:
1. Check debug panel stats
2. Verify you're on iOS device/simulator
3. Reset review state using debug panel
4. Force show review to test dialog works

### If Review Shows Too Often:
1. Check that `hasRequestedReview` is being saved
2. Verify 90-day cooldown logic
3. Reset state and test again

### Console Logs to Watch:
```
📱 Review Service initialized
✨ Positive interaction tracked: successful_subscription
🌟 Showing App Store review prompt for event: successful_subscription
✅ App Store review prompt shown successfully
```

## Production Checklist

Before releasing:
- [ ] Remove debug panel from settings
- [ ] Test on real iOS device
- [ ] Verify review prompts don't spam users
- [ ] Test with TestFlight build
- [ ] Monitor App Store Connect for review trends

## Troubleshooting

**"Store review not available"**
- Running on Android or web
- Missing expo-store-review dependency
- Simulator restrictions

**Review never shows**
- Check all conditions are met
- Use debug panel to force show
- Verify AsyncStorage is working

**Review shows immediately**
- Conditions too lenient
- Missing timing checks
- Debug mode bypassing restrictions

---

## 🎯 Success Metrics

After release, monitor:
- **Review Rate**: % of users who see prompt vs. leave review
- **Rating Improvement**: Average star rating increase
- **Timing Effectiveness**: Which events generate most reviews
- **User Feedback**: Any complaints about review timing

The system is designed to be respectful and only prompt genuinely happy users at peak satisfaction moments!
