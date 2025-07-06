# 🚀 ParleyApp Automation Deployment Guide

## The Deployment Confusion - Explained!

Reid, you're absolutely right to be confused! The **local cron job won't work on Railway**. Here's how automation works in different deployment scenarios:

## 🏠 **Current Setup (Local Development)**
- ✅ **Works**: Cron job on your Pop OS machine
- ✅ **Good for**: Development and testing
- ❌ **Problem**: Only runs when your machine is on

## ☁️ **Railway Deployment Options**

### **Option 1: Railway Cron Jobs (Recommended)**
Railway has built-in cron job support that can trigger your automation:

```yaml
# railway.toml
[build]
  builder = "dockerfile"

[deploy]
  healthcheckPath = "/api/health"

# Add cron jobs
[[crons]]
  command = "npm run daily-automation"
  schedule = "0 2 * * *"  # 2 AM daily
```

**Setup Steps:**
1. Add cron job to your Railway project
2. Create npm script in backend/package.json
3. Deploy and Railway handles the scheduling

### **Option 2: External Cron Services (GitHub Actions)**
Use GitHub Actions to trigger your Railway deployment:

```yaml
# .github/workflows/daily-automation.yml
name: Daily ParleyApp Automation
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  
jobs:
  trigger-automation:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Railway Webhook
        run: |
          curl -X POST "${{ secrets.RAILWAY_WEBHOOK_URL }}" \
            -H "Authorization: Bearer ${{ secrets.RAILWAY_TOKEN }}" \
            -d '{"action": "daily_automation"}'
```

### **Option 3: Docker Production Stack (What I Built)**
The `docker-compose.production.yml` I created includes a dedicated automation container:

```yaml
# From docker-compose.production.yml
daily-workflow:
  build:
    context: .
    dockerfile: Dockerfile.workflow
  # Has internal cron that runs your automation
  command: /app/scripts/start-cron.sh
```

**This runs cron INSIDE the Docker container**, so it works anywhere!

## 🧪 **Perfect Testing Solution - MOCK MODE!**

I just added a `--mock` mode that lets you test the workflow without consuming APIs or changing data:

```bash
# Test the complete workflow with mock commands (30 seconds total)
./scripts/daily-automated-workflow.sh --mock --skip-delays
```

This will:
- ✅ Test all the timing and logic
- ✅ Show you exactly what would happen
- ✅ Skip the 15-minute delays (uses 5 seconds instead)
- ❌ **Won't consume any APIs**
- ❌ **Won't change any database data**
- ❌ **Won't actually run the real commands**

## 🎯 **Recommended Deployment Strategy**

### **Phase 1: Now (Development)**
- ✅ Keep local cron for testing
- ✅ Use `--mock` mode to test workflow

### **Phase 2: Railway Deployment**
- ✅ Use Railway's built-in cron jobs
- ✅ Add webhook endpoint to trigger automation
- ✅ Keep Docker option as backup

### **Phase 3: Production Scale**
- ✅ Move to Docker production stack
- ✅ Add monitoring and alerting
- ✅ Use external services for redundancy

## 🔧 **Setting Up Railway Cron**

### **Step 1: Add npm script to backend/package.json**
```json
{
  "scripts": {
    "daily-automation": "node -e \"require('./dist/scripts/runDailyAutomation.js')()\""
  }
}
```

### **Step 2: Create Railway automation endpoint**
```typescript
// backend/src/routes/automation.ts
app.post('/api/automation/daily', async (req, res) => {
  try {
    // Run your three commands here
    await runOddsIntegration();
    await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000)); // 15 min
    await runOrchestratorTest();
    await new Promise(resolve => setTimeout(resolve, 60 * 1000)); // 1 min
    await runInjuryUpdate();
    
    res.json({ success: true, message: 'Daily automation completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### **Step 3: Configure Railway cron**
In Railway dashboard:
1. Go to your project settings
2. Add cron job: `0 2 * * * curl -X POST https://your-app.railway.app/api/automation/daily`

## 🤔 **Which Option Should You Choose?**

### **For Now (Development)**
- Use local cron + mock mode for testing

### **For Railway Deployment**
- **Simple**: Railway built-in cron jobs
- **Flexible**: GitHub Actions + webhooks
- **Robust**: Docker production stack

### **For App Store Launch**
- **Recommended**: Docker production stack with monitoring

## 🧪 **Test Your New Mock Mode Right Now!**

```bash
# Test the complete workflow safely (takes ~30 seconds)
./scripts/daily-automated-workflow.sh --mock --skip-delays
```

This will show you exactly how the automation works without touching your APIs or database!

## 📊 **Environment Variables for Railway**

Make sure to set these in Railway:
```bash
THEODDS_API_KEY=your_key
SUPABASE_URL=your_url  
SUPABASE_SERVICE_KEY=your_key
DEEPSEEK_API_KEY=your_key
XAI_API_KEY=your_key
NODE_ENV=production
```

## 🎯 **Next Steps**

1. **Test mock mode now**: `./scripts/daily-automated-workflow.sh --mock --skip-delays`
2. **Keep local cron for development**
3. **When deploying to Railway**: Choose Railway cron jobs
4. **For production scale**: Use Docker stack

The beauty is you have options! Start simple with Railway cron, then upgrade to Docker for maximum reliability when you scale.

---

**TL;DR**: Your local cron works for now. When you deploy to Railway, use Railway's cron jobs or the Docker stack I built. Test everything safely with `--mock` mode! 🚀 