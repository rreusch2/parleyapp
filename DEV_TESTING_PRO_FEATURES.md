# Testing Pro Features During Development

This guide explains how to test Pro features in ParleyApp without making actual payments.

## Quick Start

Pro features are **automatically enabled** in development mode. Just run the app and you'll have full Pro access!

## Configuration

The Pro status in development is controlled by the configuration file:

```typescript
// app/config/development.ts
export const DEV_CONFIG = {
  FORCE_PRO_STATUS: true,  // Set to true to enable Pro features
  // ... other settings
};
```

## How It Works

1. **Development Mode Detection**: The app automatically detects when running in development (`__DEV__`)
2. **Force Pro Status**: When `FORCE_PRO_STATUS` is true, the subscription context bypasses payment checks
3. **Visual Indicators**: You'll see the PRO badge and gold crown icons throughout the app

## Testing Different States

### Test as Pro User (Default)
```typescript
// app/config/development.ts
FORCE_PRO_STATUS: true
```
- All features unlocked
- No payment prompts
- Pro badges visible

### Test as Free User
```typescript
// app/config/development.ts
FORCE_PRO_STATUS: false
```
- Limited to 2 AI picks per day
- Locked features show upgrade prompts
- Basic experience

## Features to Test

### Pro Features:
- ✅ Unlimited AI picks (vs 2/day)
- ✅ AI chat on every screen
- ✅ Multi-book odds comparison
- ✅ Line movement tracking
- ✅ Public betting percentages
- ✅ Unlimited insights
- ✅ Advanced filtering
- ✅ Complete betting history
- ✅ Bankroll management
- ✅ Priority alerts

### Free Limitations:
- ❌ Only 2 AI picks per day
- ❌ No AI chat access
- ❌ Single book odds only
- ❌ Limited to 3-5 insights
- ❌ Basic stats only
- ❌ Locked advanced features

## Console Logging

Enable subscription logging to debug:
```typescript
// app/config/development.ts
LOG_SUBSCRIPTION_STATUS: true
```

You'll see messages like:
```
🔧 Development Mode: Forcing Pro status
📱 Subscription Status: Pro
```

## Important Notes

⚠️ **NEVER deploy to production with `FORCE_PRO_STATUS: true`**

Before building for production:
1. Set `FORCE_PRO_STATUS: false`
2. Test actual payment flow
3. Verify subscription checks work

## Troubleshooting

### Pro features not showing?
1. Check `DEV_CONFIG.FORCE_PRO_STATUS` is true
2. Restart the Metro bundler
3. Clear app cache/data

### Want to test upgrade flows?
1. Set `FORCE_PRO_STATUS: false`
2. Interact with locked features
3. Test upgrade prompts

### Testing payment integration?
1. Use Apple's sandbox environment
2. Set `FORCE_PRO_STATUS: false`
3. Follow Apple's testing guide

## Code Examples

### Check Pro Status in Components
```typescript
import { useSubscription } from '@/app/services/subscriptionContext';

export default function MyComponent() {
  const { isPro } = useSubscription();
  
  return (
    <View>
      {isPro ? <ProFeature /> : <FreeFeature />}
    </View>
  );
}
```

### Conditional Rendering
```typescript
{isPro && <FloatingAIChatButton />}
{!isPro && <UpgradePrompt />}
```

### Feature Limits
```typescript
const displayPicks = isPro ? allPicks : allPicks.slice(0, 2);
const maxInsights = isPro ? 999 : 5;
```

## Next Steps

1. Test all Pro features thoroughly
2. Verify upgrade prompts work correctly
3. Test actual payment flow in sandbox
4. Document any issues found

Happy testing! 🚀 