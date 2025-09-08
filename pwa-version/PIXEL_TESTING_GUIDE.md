# 🔍 Facebook Pixel Testing & Verification Guide

## Quick Verification Steps

### 1. Install Facebook Pixel Helper (REQUIRED)
1. Open Chrome browser
2. Go to [Chrome Web Store](https://chromewebstore.google.com/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc)
3. Click "Add to Chrome" for Facebook Pixel Helper
4. Pin the extension to your toolbar

### 2. Start Your PWA
```bash
cd /Users/rreusch2/parleyapp/pwa-version
npm run dev
```

### 3. Test Pixel Loading
1. Open `http://localhost:3000` in Chrome
2. Click the Facebook Pixel Helper extension (blue icon)
3. **✅ SUCCESS:** You should see your pixel ID with a green checkmark
4. **❌ PROBLEM:** If no pixel found, check your `.env.local` file

### 4. Test Key Events

**Homepage Events:**
- Navigate to homepage → Should fire `PageView` + `ViewContent`
- Click "Start Free Trial" → Should fire `Lead` event
- Click "Upgrade to Pro" → Should fire `InitiateCheckout`

**Dashboard Events:**
- Go to `/dashboard` → Should fire `PageView` + `ViewContent`
- Click "Generate Picks" → Should fire `ViewPredictions` custom event

### 5. Real-Time Event Testing
1. Open [Meta Events Manager](https://business.facebook.com/events_manager2)
2. Click on your pixel
3. Go to **Test Events** tab
4. Perform actions on your website
5. Events should appear within 10-20 seconds

## Event Parameters Reference

### Standard Events We're Tracking:
```javascript
// Page views (automatic)
fbq('track', 'PageView');

// User registration
fbq('track', 'CompleteRegistration', {
  content_name: 'PredictivePlay Account',
  method: 'email',
  currency: 'USD'
});

// Subscription purchase
fbq('track', 'Purchase', {
  value: 19.99,
  currency: 'USD',
  content_type: 'subscription',
  content_name: 'Pro Subscription'
});

// Lead generation
fbq('track', 'Lead', {
  content_name: 'email_signup',
  content_category: 'sports_predictions'
});
```

### Custom Events We're Tracking:
```javascript
// View predictions
fbq('trackCustom', 'ViewPredictions', {
  content_type: 'predictions'
});

// Click prediction
fbq('trackCustom', 'ClickPrediction', {
  sport: 'NBA',
  prediction_type: 'spread'
});

// Upgrade intent
fbq('trackCustom', 'UpgradeIntent', {
  from_plan: 'free',
  to_plan: 'pro'
});
```

## Troubleshooting Common Issues

### Issue: No Pixel Found
**Symptoms:** Pixel Helper shows "No pixels found"
**Solutions:**
1. Check `.env.local` exists with correct `NEXT_PUBLIC_FACEBOOK_PIXEL_ID`
2. Restart development server: `npm run dev`
3. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)

### Issue: Pixel Found But No Events
**Symptoms:** Pixel Helper shows pixel but no events firing
**Solutions:**
1. Check browser console for JavaScript errors
2. Verify pixel ID matches Events Manager
3. Clear browser cache and cookies

### Issue: Events Not Appearing in Events Manager
**Symptoms:** Events fire in Pixel Helper but not in Events Manager
**Solutions:**
1. Wait 10-15 minutes (events can be delayed)
2. Check system clock is correct
3. Verify you're looking at correct pixel in Events Manager

## Production Deployment Checklist

### Before Going Live:
- [ ] Set production domain in Facebook Pixel settings
- [ ] Update CORS settings if needed
- [ ] Test pixel on staging environment
- [ ] Verify all conversion events are set up in Events Manager
- [ ] Test purchase flow end-to-end

### After Going Live:
- [ ] Monitor Events Manager for incoming events
- [ ] Check Pixel Helper on live site
- [ ] Verify conversion attribution is working
- [ ] Set up custom audiences based on pixel events

## Advanced Testing Commands

### Test Pixel Programmatically:
```javascript
// Open browser console on your site and run:
console.log(window.fbq); // Should show function
fbq('track', 'Lead', {test: true}); // Manual test event
```

### Check Pixel Queue:
```javascript
// In browser console:
console.log(window.fbq.queue); // Shows queued events
```

## Event Verification URLs

Test these specific URLs to verify events:
- `http://localhost:3000/` → PageView, ViewContent
- `http://localhost:3000/dashboard` → PageView, ViewContent  
- Click "Start Free Trial" → Lead
- Click "Upgrade to Pro" → InitiateCheckout
- Click "Generate Picks" → ViewPredictions (custom)

Your implementation is complete and ready for testing! 🚀
