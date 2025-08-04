# Predictive Play Web App 🚀

A modern React web application that shares your existing React Native backend and database, enabling users to access Predictive Play through the web with Stripe payments (bypassing Apple's 15% fee).

## ✨ Features

- **Shared Backend**: Uses your existing Supabase database and Node.js backend
- **Same User Experience**: Identical features to your mobile app
- **Stripe Payments**: Web payments without Apple fees
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern UI**: Built with Next.js, TypeScript, and Tailwind CSS
- **Authentication**: Integrated with your existing Supabase auth

## 🏗️ Architecture

```
Web App (Next.js) → Same Supabase DB ← React Native App
     ↓                                      ↓
Stripe Payments                    Apple/Google Pay
(No 15% fee!)                    (With store fees)
```

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
cd /home/reid/Desktop/parleyapp/web-app
npm install
```

### 2. Environment Variables
```bash
# Copy the example file
cp .env.example .env.local

# Edit with your actual values
nano .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `NEXT_PUBLIC_BACKEND_URL` - Your backend API URL
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key

### 3. Run Development Server
```bash
npm run dev
```

Visit http://localhost:3000 to see your web app!

## 💰 Stripe Setup

1. **Create Stripe Account**: Sign up at https://stripe.com
2. **Get API Keys**: Copy from your Stripe dashboard
3. **Set Up Products**: Create subscription products matching your app tiers:
   - Pro Monthly: $19.99/month
   - Pro Yearly: $199.99/year
   - Elite Monthly: $49.99/month
   - Elite Yearly: $499.99/year

## 🌐 Deployment Options

### Option 1: GitHub Pages (Free)
```bash
npm run build
npm run export
# Upload 'out' folder to GitHub Pages
```

### Option 2: Vercel (Recommended)
```bash
# Connect your GitHub repo to Vercel
# Auto-deploys on every push
```

### Option 3: Netlify
```bash
# Build command: npm run build && npm run export
# Publish directory: out
```

### Option 4: Custom Server
```bash
npm run build
npm start
```

## 🔧 Integration with Existing Website

To integrate with your current website at predictive-play.com:

1. **Replace your current index.html** with a redirect:
```html
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0; url=/app/" />
</head>
<body>
    <p>Redirecting to Predictive Play...</p>
</body>
</html>
```

2. **Deploy web app** to `/app/` subdirectory
3. **Update your domain** to point to the new setup

## 📱 Features Included

- ✅ **Landing Page**: Enhanced version of your current website
- ✅ **Authentication**: Login/Signup with same Supabase backend
- ✅ **Dashboard**: Home screen with today's picks
- ✅ **AI Predictions**: Same AI predictions as mobile app
- ✅ **Subscription Management**: Stripe-powered payments
- ✅ **User Profiles**: Same user data and preferences
- ✅ **Responsive Design**: Works on all devices
- ✅ **Dark Mode**: Modern UI with dark/light theme

## 🔄 Synced with Mobile App

All data syncs automatically:
- User accounts and profiles
- Subscription status
- AI predictions and history
- User preferences and settings
- Payment history

## 💡 Revenue Benefits

- **No App Store Fees**: Keep 97% instead of 85% (Stripe fees: ~3%)
- **Wider Reach**: Web users who prefer browser access
- **Easier Onboarding**: No app download required
- **Better SEO**: Google can index your content
- **Faster Updates**: Deploy instantly without app store approval

## 🎯 Next Steps

1. **Set up environment variables**
2. **Test with your existing backend**
3. **Configure Stripe payments**
4. **Deploy to your domain**
5. **Update your main website to link to the web app**

## 🆘 Support

Need help? Email: predictiveplay2025@gmail.com

---

**Built with ❤️ for Predictive Play**
