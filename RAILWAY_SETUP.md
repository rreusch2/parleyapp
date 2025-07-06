# 🚀 Railway Deployment Setup for ParleyApp Automation

## Quick Railway Setup

### **Step 1: Deploy Your Backend**
1. Connect your GitHub repo to Railway
2. Set the build source to your backend directory
3. Railway will auto-detect the Dockerfile

### **Step 2: Set Environment Variables**
In Railway dashboard, add these environment variables:
```bash
# API Keys
THEODDS_API_KEY=your_theodds_api_key
SUPABASE_URL=your_supabase_url  
SUPABASE_SERVICE_KEY=your_supabase_service_key
DEEPSEEK_API_KEY=your_deepseek_key
XAI_API_KEY=your_grok_key

# Automation Security
AUTOMATION_SECRET=your_secure_random_token_here

# Environment
NODE_ENV=production
```

### **Step 3: Set Up Cron Job**
Railway will automatically detect the `railway.toml` file and create the cron job that runs daily at 2:00 AM.

### **Step 4: Test the Automation**
Once deployed, test the endpoint:

```bash
# Test endpoint (mock mode)
curl -X POST https://your-app.railway.app/api/automation/test \
  -H "Authorization: Bearer your_automation_secret" \
  -H "Content-Type: application/json"

# Production endpoint (real automation)
curl -X POST https://your-app.railway.app/api/automation/daily \
  -H "Authorization: Bearer your_automation_secret" \
  -H "Content-Type: application/json"
```

## 🔐 **Security Notes**

1. **Generate a secure automation secret:**
```bash
# Generate a random token
openssl rand -hex 32
```

2. **The automation endpoints are protected by:**
   - Bearer token authentication
   - Rate limiting (10 requests per hour)
   - Request logging

## 📊 **Monitoring**

Check automation status:
```bash
curl https://your-app.railway.app/api/automation/status
```

View cron job logs in Railway dashboard under "Deployments" → "Logs"

## 🔧 **Troubleshooting**

If automation fails:
1. Check Railway logs for errors
2. Verify environment variables are set
3. Test the `/test` endpoint first
4. Ensure your scripts directory is included in deployment

---

**Your automation will run automatically every day at 2:00 AM once deployed!** 🎯 