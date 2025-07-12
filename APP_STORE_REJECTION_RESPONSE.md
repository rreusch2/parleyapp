# App Store Rejection Response Guide
**Submission ID:** 3bbbc6fd-10ac-48d3-983f-10caf0dab3f6  
**Date:** July 10, 2025

## IMMEDIATE ACTIONS REQUIRED

### 1. RESPOND TO APPLE'S INQUIRY (CRITICAL - Do This First)

Reply to Apple's review message with this exact response:

```
Dear App Review Team,

RE: Submission ID 3bbbc6fd-10ac-48d3-983f-10caf0dab3f6

Thank you for your feedback regarding Guideline 2.1.

To clarify: Our app **DOES NOT** allow users to make real money gambling bets whatsoever. 

ParleyApp is purely an AI-powered sports prediction and analysis tool that:

• Provides AI-generated sports betting recommendations for ENTERTAINMENT PURPOSES ONLY  
• Offers statistical analysis and insights about MLB games  
• Includes educational content about sports betting strategies  
• Contains prominent disclaimers throughout the app that AI predictions are not guaranteed  
• Includes responsible gambling warnings and educational content  

**IMPORTANT:** Users CANNOT place any bets, make any payments to sportsbooks, or engage in any actual gambling transactions through our app. We are purely an informational/educational service similar to other sports analysis apps.

All our Terms of Service and disclaimers clearly state this is for entertainment and educational purposes only.

Best regards,
Reid Reusch
ParleyApp Developer
```

### 2. APPLE SUBSCRIPTION REQUIREMENTS FIXES ✅ COMPLETED

I have updated your SubscriptionModal.tsx with:

**✅ Added to App Binary:**
- Subscription title (Monthly Pro, Yearly Pro, Lifetime Pro)
- Subscription length (1 month, 1 year, one-time)  
- Subscription price ($24.99/month, $199.99/year, $399.99 lifetime)
- Functional links to Terms of Service and Privacy Policy

**✅ Functional Links Added:**
- Terms of Service: https://rreusch2.github.io/ppwebsite/terms.html
- Privacy Policy: https://rreusch2.github.io/ppwebsite/privacy.html

### 3. APP STORE CONNECT METADATA FIXES NEEDED

You need to update these in App Store Connect:

**A. Privacy Policy Field:**
- Go to App Store Connect → Your App → App Information  
- Find "Privacy Policy URL" field
- Enter: `https://rreusch2.github.io/ppwebsite/privacy.html`

**B. Terms of Service (EULA):**
Option 1 - Use Standard Apple EULA:
- In App Description, add: "By downloading this app, you agree to Apple's standard Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"

Option 2 - Use Custom EULA:
- Go to App Store Connect → Your App → App Information
- Scroll to "End User License Agreement" 
- Upload your custom terms: `https://rreusch2.github.io/ppwebsite/terms.html`

### 4. VERIFY WEBSITE LINKS ARE WORKING

Test these URLs work properly:
- ✅ https://rreusch2.github.io/ppwebsite/terms.html
- ✅ https://rreusch2.github.io/ppwebsite/privacy.html

### 5. ADDITIONAL SUBSCRIPTION INFO IN TERMS

Your terms.html already includes:
- ✅ Monthly Pro: $24.99/month, auto-renewable  
- ✅ Yearly Pro: $199.99/year, auto-renewable
- ✅ Lifetime Pro: $399.99 one-time payment
- ✅ Cancellation policies follow platform terms
- ✅ No refunds for partial periods

## NEXT STEPS CHECKLIST

- [ ] 1. Reply to Apple with gambling clarification (CRITICAL)
- [ ] 2. Update Privacy Policy URL in App Store Connect  
- [ ] 3. Add Terms of Service to App Store Connect (EULA field or App Description)
- [ ] 4. Test that both website links work properly
- [ ] 5. Resubmit app for review

## IMPORTANT NOTES

- The in-app subscription modal now has ALL Apple-required information
- Your website already has comprehensive terms with subscription details
- Make sure your IAP products in App Store Connect match these prices:
  - Monthly: $24.99 (com.parleyapp.premium_monthly)
  - Yearly: $199.99 (com.parleyapp.premiumyearly)  
  - Lifetime: $399.99 (com.parleyapp.premium_lifetime)

## CONTACT SUPPORT IF NEEDED

If Apple needs more clarification, emphasize:
1. No betting functionality whatsoever in the app
2. Pure entertainment/educational sports analysis
3. All required subscription info is now in app and metadata
4. Functional links to terms/privacy are working

The app should pass review once these metadata updates are made in App Store Connect.
