# 🚄 Railway Deployment Guide for ParleyApp

## 📋 Overview
This guide will help you deploy your ParleyApp backend services to Railway for production.

## 🎯 What We're Deploying
1. **Node.js Backend** (`backend/` folder) → API for app functionality
2. **Python Sports API** (`python-services/sports-betting-api/` folder) → Sports data and ML predictions

## 🚀 Step 1: Railway Account Setup

1. **Create Account**: Go to [railway.app](https://railway.app) and sign up with GitHub
2. **Install CLI**:
   ```bash
   npm install -g @railway/cli
   ```
3. **Login**:
   ```bash
   railway login
   ```

## 🔧 Step 2: Prepare Your Code

### Node.js Backend Preparation
```bash
# Make sure your backend has the right scripts
cd backend

# Check package.json has start script
# Should have: "start": "node dist/index.js" or similar
```

### Python API Preparation
```bash
cd python-services/sports-betting-api

# Make sure you have requirements.txt
# Should list all your Python dependencies
```

## 🚄 Step 3: Deploy Node.js Backend

```bash
# From project root
cd backend

# Initialize Railway project
railway init

# Select "Deploy from existing code"
# Choose your backend folder
# Select "Node.js" as the framework

# Deploy
railway up

# Get your deployment URL
railway status
```

Your backend will be available at: `https://[your-project-name].up.railway.app`

## 🐍 Step 4: Deploy Python API

```bash
# From project root  
cd python-services/sports-betting-api

# Initialize new Railway project
railway init

# Select "Deploy from existing code"
# Choose Python/Flask as framework

# Deploy
railway up

# Get your deployment URL
railway status
```

Your Python API will be available at: `https://[your-python-project].up.railway.app`

## ⚙️ Step 5: Configure Environment Variables

### For Node.js Backend:
In Railway dashboard → Your backend project → Variables:
```bash
SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
DEEPSEEK_API_KEY=sk-244f47dd68374084921d765e4f5de212
API_SPORTS_KEY=acb0d668d510a273b111589c95ac21bf
SPORTRADAR_API_KEY=P7wIO6KI8y8FC4yMoWZULb6DJpjqgFyLrlixNJRt
NODE_ENV=production
PORT=3000
```

### For Python API:
In Railway dashboard → Your Python project → Variables:
```bash
SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
PORT=8000
FLASK_ENV=production
```

## 📱 Step 6: Update Your App Environment

Update your `.env` file with the new production URLs:
```bash
# Your new production URLs from Railway
EXPO_PUBLIC_BACKEND_URL=https://your-backend-name.up.railway.app
EXPO_PUBLIC_PYTHON_API_URL=https://your-python-api-name.up.railway.app

# Set to production
NODE_ENV=production

# Keep your existing Supabase URLs (these are already production)
EXPO_PUBLIC_SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## 🧪 Step 7: Test Your Deployment

```bash
# Test your backend
curl https://your-backend-name.up.railway.app/api/health

# Test your Python API  
curl https://your-python-api-name.up.railway.app/api/health

# Run your app validation
npm run app-store-ready
```

## 🔄 Step 8: Continuous Deployment

Railway automatically redeploys when you push to GitHub:

1. **Connect GitHub**: In Railway dashboard, connect your repository
2. **Auto-deploy**: Every push to main branch will redeploy
3. **Branch deployments**: Create staging environments from other branches

## 💡 Pro Tips

### Custom Domains (Optional)
```bash
# Add custom domain in Railway dashboard
# Example: api.parleyapp.com → your backend
# Example: python-api.parleyapp.com → your Python API
```

### Monitoring
- Railway provides built-in metrics and logs
- Check deployment logs in the Railway dashboard
- Monitor API response times and errors

### Database Connection
Your Railway services will connect to your existing Supabase database using the environment variables.

## 🚨 Troubleshooting

### Common Issues:

**Build Fails**:
- Check your `package.json` scripts
- Ensure all dependencies are listed
- Check Railway build logs

**Environment Variables**:
- Make sure all required variables are set in Railway dashboard
- Check variable names match exactly (case-sensitive)

**API Not Responding**:
- Check Railway logs for errors
- Verify your app is listening on the correct PORT
- Test endpoints individually

### Useful Commands:
```bash
# View logs
railway logs

# Check deployment status
railway status

# Connect to your deployment
railway shell

# Redeploy
railway up --detach
```

## 💰 Cost Estimate

**Railway Pricing**:
- **Hobby Plan**: $5/month per service (perfect for your needs)
- **Node.js Backend**: ~$5/month
- **Python API**: ~$5/month
- **Total**: ~$10/month

**Free Tier**: Railway offers $5 credit monthly, which might cover your usage initially.

## ✅ Success Checklist

- [ ] Railway account created and CLI installed
- [ ] Node.js backend deployed successfully
- [ ] Python API deployed successfully  
- [ ] Environment variables configured in Railway
- [ ] Production URLs updated in your app's .env
- [ ] Both APIs responding to test requests
- [ ] App validation passes (`npm run app-store-ready`)
- [ ] GitHub connected for auto-deployment

## 🎯 Next Steps After Deployment

1. **Test thoroughly**: Make sure all app features work with production APIs
2. **Performance testing**: Check API response times under load
3. **Monitoring setup**: Monitor your services for any issues
4. **App Store build**: Create production build with new URLs
5. **Submit to App Store**: Follow the App Store preparation guide

## 🔗 Useful Links

- [Railway Documentation](https://docs.railway.app)
- [Railway CLI Reference](https://docs.railway.app/cli/commands)
- [Node.js Deployment Guide](https://docs.railway.app/guides/node)
- [Python Deployment Guide](https://docs.railway.app/guides/python) 