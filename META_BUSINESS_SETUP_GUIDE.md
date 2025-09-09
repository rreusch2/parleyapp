# 🎯 Facebook Pixel & Meta Business Manager Setup Guide for PredictivePlay

## PHASE 1: Facebook Pixel Creation & Setup

### Step 1: Access Meta Business Manager
1. Go to [business.facebook.com](https://business.facebook.com)
2. Log in with your Facebook account
3. If you don't have a Business Manager account, click "Create Account"
4. Fill in your business details for PredictivePlay

### Step 2: Create Facebook Pixel
1. In Business Manager, go to **Events Manager** (left sidebar)
2. Click **Connect Data Sources** → **Web**
3. Choose **Facebook Pixel** → Click **Connect**
4. Name your pixel: `PredictivePlay Pixel`
5. Enter your website URL: `https://your-domain.com`
6. Click **Create Pixel**

### Step 3: Get Your Pixel ID
1. In Events Manager, click on your newly created pixel
2. Copy the **Pixel ID** (16-digit number)
3. **CRITICAL:** Save this ID - you'll need it next

### Step 4: Configure Your PWA Environment
1. Create `.env.local` file in `/pwa-version/`:
```bash
NEXT_PUBLIC_FACEBOOK_PIXEL_ID=YOUR_16_DIGIT_PIXEL_ID_HERE
```

2. Replace `YOUR_16_DIGIT_PIXEL_ID_HERE` with your actual Pixel ID
3. **Never commit this file to git** - add it to `.gitignore`

---

## PHASE 2: Meta Ads Manager Campaign Setup

### Step 5: Create Your Ad Account
1. In Business Manager → **Ad Accounts** → **Add**
2. Choose **Create a new ad account**
3. Name: `PredictivePlay Ads`
4. Time zone: Your business timezone
5. Currency: USD
6. Add payment method

### Step 6: Set Up Custom Conversions (CRITICAL!)
1. Go to **Events Manager** → **Custom Conversions**
2. Click **Create Custom Conversion**

**Conversion 1: Pro Subscription Sign-up**
- Name: `Pro Subscription Purchase`
- Description: `User upgrades to Pro subscription`
- Event Source: Select your pixel
- Event: `Purchase`
- URL contains: `/success` or `/checkout/complete`
- Value: `19.99` (or your price)
- Category: `Subscribe`

**Conversion 2: User Registration**
- Name: `User Registration`
- Description: `New user signs up`
- Event Source: Select your pixel
- Event: `CompleteRegistration`
- URL contains: `/signup/success` or `/welcome`

**Conversion 3: Lead Generation**
- Name: `Email Lead`
- Description: `Email signup or trial start`
- Event Source: Select your pixel
- Event: `Lead`

### Step 7: Create Your Sales Campaign
1. In Ads Manager, click **Create Campaign**
2. Choose objective: **Sales** (for conversions)
3. Campaign name: `PredictivePlay - Pro Subscriptions`

**Campaign Settings:**
- Buying type: Auction
- Budget optimization: On
- Daily budget: Start with $20/day
- Campaign objective: Conversions

---

## PHASE 3: Ad Set Configuration

### Step 8: Configure Your Ad Set
**Performance Goal:**
- Choose: `Maximize conversions`
- Or: `Cost per result goal` → Set to $5.00 (as you mentioned)

**Conversion Event:**
- Select your custom conversion: `Pro Subscription Purchase`

**Budget & Schedule:**
- Daily budget: $20
- Schedule: Continuous (or set end date)

**Audience Settings:**
- Location: United States (as you have set)
- Age: 21-65 (sports betting age requirements)
- Gender: All
- Languages: English

**Detailed Targeting (Interests):**
- Sports betting
- Fantasy sports
- ESPN
- Sports analytics
- Gambling
- Professional sports leagues (NFL, NBA, MLB)

**Custom Audiences (Advanced):**
- Lookalike audience based on existing users
- Website visitors (retargeting)

**Placements:**
- Automatic placements (recommended)
- Or manually select: Facebook Feed, Instagram Feed, Stories

---

## PHASE 4: Pixel Event Implementation

### Step 9: Verify Pixel Events (CRITICAL!)

Your PWA already has these events implemented:

**✅ Automatic Events:**
- `PageView` - Tracked on every page load
- `ViewContent` - Dashboard views

**✅ Custom Events for PredictivePlay:**
- `ViewPredictions` - When user views predictions
- `ClickPrediction` - When user clicks on a prediction  
- `CompleteRegistration` - User signup
- `Lead` - Email capture/trial start
- `Purchase` - Pro subscription purchase
- `InitiateCheckout` - Subscription flow start

### Step 10: Test Your Pixel (MANDATORY!)

1. **Install Facebook Pixel Helper Chrome Extension**
   - Go to Chrome Web Store
   - Search "Facebook Pixel Helper"
   - Install the extension

2. **Test Your Website:**
   - Start your PWA: `npm run dev` in `/pwa-version`
   - Open your site in Chrome
   - Click the Pixel Helper extension icon
   - You should see your pixel firing events

3. **Test Events:**
   - Navigate to dashboard → Should see `PageView` + `ViewContent`
   - Click "Generate Picks" → Should see `ViewPredictions`
   - Go through signup flow → Should see `CompleteRegistration`

### Step 11: Verify in Events Manager
1. Go to Meta Events Manager
2. Click on your pixel
3. Go to **Test Events** tab
4. You should see real-time events from your website
5. Check that events have proper parameters

---

## PHASE 5: Campaign Optimization

### Step 12: Launch Your Campaign
1. Review all settings
2. Upload your ad creative (images/videos)
3. Write compelling ad copy focused on:
   - AI-powered predictions
   - High win rates
   - Professional sports insights
4. Submit for review (takes 24-48 hours)

### Step 13: Monitor & Optimize
**Week 1:**
- Monitor cost per conversion
- Check pixel events are firing correctly
- Adjust budget if performance is good

**Week 2+:**
- Create lookalike audiences from converters
- Test different ad creatives
- Expand to high-performing interests
- Set up retargeting campaigns

---

## PHASE 6: Advanced Setup (Optional)

### Step 14: Conversions API (Server-Side Tracking)
For better tracking accuracy, implement server-side events:

1. Create an access token in Business Manager
2. Implement server-side tracking in your backend
3. Send duplicate events from server and client

### Step 15: iOS 14.5+ Setup
1. Configure Aggregated Event Measurement
2. Prioritize your 8 most important conversion events
3. Verify domain ownership

---

## TROUBLESHOOTING GUIDE

### Common Issues:

**❌ "No events available across selected sources"**
- Solution: Your pixel isn't firing events yet
- Check: Environment variable set correctly
- Check: Website is running and accessible
- Test: Use Facebook Pixel Helper extension

**❌ Pixel Helper shows "No Pixel Found"**
- Solution: Pixel code not loading
- Check: `.env.local` file has correct Pixel ID
- Check: No typos in environment variable name
- Restart: Your development server after .env changes

**❌ Events firing but not showing in Events Manager**
- Solution: Wait 10-15 minutes for events to appear
- Check: Clock on your computer is correct
- Check: Events have valid parameters

**❌ High cost per conversion**
- Solution: Narrow your audience
- Test: Different ad creatives
- Optimize: For lower-funnel events first

### Quick Verification Checklist:
- [ ] Pixel ID copied correctly to `.env.local`
- [ ] Facebook Pixel Helper shows active pixel
- [ ] Events appear in Events Manager Test Events
- [ ] Custom conversions created and active
- [ ] Campaign uses correct conversion event
- [ ] Ad account payment method added
- [ ] Campaign submitted and approved

---

## IMMEDIATE ACTION ITEMS:

1. **RIGHT NOW:** Get your Facebook Pixel ID from Events Manager
2. **RIGHT NOW:** Add it to `/pwa-version/.env.local`
3. **RIGHT NOW:** Test with Pixel Helper extension
4. **TODAY:** Create custom conversions in Events Manager  
5. **TODAY:** Set up your first campaign
6. **THIS WEEK:** Launch and monitor performance

Your pixel implementation is ready - you just need to configure the Meta side! 🚀
