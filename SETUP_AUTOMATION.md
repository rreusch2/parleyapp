# 🚀 ParleyApp Daily Automation Setup Guide

This guide will help you set up the automated daily workflow for your sports betting app, including optimal timing recommendations and Docker deployment options.

## 📋 Overview

The daily workflow consists of three main steps:
1. **Odds Integration Setup** - Fetches odds and player props from TheOdds API
2. **Orchestrator Integration Test** - Runs ML predictions and generates AI picks  
3. **Daily Injury Update** - Updates player injury reports

## ⏰ Recommended Timing

**Best time to run: 2:00 AM EST/EDT**

Why this timing works:
- Most sports events have concluded
- Fresh odds for next day's games are available
- Low API traffic = better reliability
- Gives time for any manual intervention before peak usage

## 🛠️ Setup Options

### Option 1: Simple Cron Job (Recommended for Development)

1. **Make the script executable:**
```bash
chmod +x /home/reid/Desktop/parleyapp/scripts/daily-automated-workflow.sh
```

2. **Test the script first:**
```bash
# Dry run to see what would execute
./scripts/daily-automated-workflow.sh --dry-run

# Test run with reduced delays
./scripts/daily-automated-workflow.sh --skip-delays
```

3. **Add to crontab:**
```bash
crontab -e
```

Add this line:
```
# ParleyApp Daily Workflow - Runs at 2:00 AM daily
0 2 * * * /home/reid/Desktop/parleyapp/scripts/daily-automated-workflow.sh
```

### Option 2: Systemd Service (Recommended for Production)

1. **Copy service files:**
```bash
sudo cp scripts/parleyapp-daily.service /etc/systemd/system/
sudo cp scripts/parleyapp-daily.timer /etc/systemd/system/
```

2. **Enable and start the service:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable parleyapp-daily.timer
sudo systemctl start parleyapp-daily.timer
```

3. **Check status:**
```bash
# Check timer status
sudo systemctl status parleyapp-daily.timer

# Check service logs
sudo journalctl -u parleyapp-daily.service -f
```

### Option 3: Docker Production Setup (Recommended for Deployment)

1. **Use the production Docker Compose:**
```bash
# Copy environment variables
cp .env.example .env.production
# Edit with your production values

# Start production stack
docker compose -f docker-compose.production.yml up -d
```

The production setup includes:
- ✅ Automated workflow container with built-in cron
- ✅ Production-optimized backend and ML server
- ✅ Redis caching for improved performance
- ✅ Monitoring with Prometheus and Grafana
- ✅ Log aggregation with Loki
- ✅ Health checks and restart policies

## 📊 Monitoring & Logs

### Log Locations

**Local Setup:**
- Workflow logs: `logs/daily-workflow/workflow-YYYY-MM-DD.log`
- Individual service logs: Check respective service directories

**Docker Setup:**
- Container logs: `docker compose logs -f daily-workflow`
- Grafana dashboard: `http://localhost:3001`
- Prometheus metrics: `http://localhost:9090`

### Key Metrics to Monitor

1. **Workflow Success Rate** - Daily completion percentage
2. **API Rate Limits** - TheOdds API usage vs limits  
3. **Processing Time** - How long each step takes
4. **Error Rates** - Failed predictions or data fetches

## 🔧 Configuration Options

### Environment Variables

Create `.env` file in project root:
```bash
# API Keys
THEODDS_API_KEY=your_theodds_api_key
DEEPSEEK_API_KEY=your_deepseek_key  
XAI_API_KEY=your_grok_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Timing (optional - defaults shown)
ORCHESTRATOR_DELAY=900  # 15 minutes
INJURY_DELAY=60         # 1 minute

# Notification webhooks (optional)
SLACK_WEBHOOK_URL=your_slack_webhook
DISCORD_WEBHOOK_URL=your_discord_webhook
```

### Customizing Timing

Edit the script variables:
```bash
# In daily-automated-workflow.sh
ORCHESTRATOR_DELAY=1800  # 30 minutes instead of 15
INJURY_DELAY=120         # 2 minutes instead of 1
```

## 🚨 Troubleshooting

### Common Issues

1. **"Another instance is already running"**
   - Remove lock file: `rm /tmp/parleyapp-daily-workflow.lock`
   - Check for stuck processes: `ps aux | grep daily-automated-workflow`

2. **"ML Server not responding"**
   - Check if ML server is running: `curl http://localhost:8001/health`
   - Restart ML server: `cd python-services/sports-betting-api && python3 ml_prediction_server.py`

3. **"Odds API rate limit exceeded"**
   - Check API usage in logs
   - Consider adjusting timing to spread load
   - Upgrade API plan if needed

4. **Node.js out of memory**
   - Increase memory limit: `NODE_OPTIONS="--max_old_space_size=4096"`
   - Check for memory leaks in recent changes

### Debugging Commands

```bash
# Check cron status
systemctl status cron

# View recent cron logs  
grep CRON /var/log/syslog | tail -20

# Test workflow manually
./scripts/daily-automated-workflow.sh --skip-delays

# Check service health
curl http://localhost:3000/api/health
curl http://localhost:8001/health
```

## 🔒 Security Considerations

### For Production Deployment

1. **Use Docker secrets for API keys:**
```yaml
secrets:
  theodds_api_key:
    external: true
```

2. **Limit container permissions:**
- Non-root users in containers
- Read-only file systems where possible
- Network isolation between services

3. **Monitor for suspicious activity:**
- Failed authentication attempts
- Unusual API usage patterns
- Unexpected data access

## 📈 Performance Optimization

### Recommended Improvements

1. **Enable Redis Caching:**
   - Cache odds data for 5 minutes
   - Cache player stats for 1 hour
   - Cache predictions for 30 minutes

2. **Database Connection Pooling:**
   - Use connection pools in backend
   - Implement query optimization
   - Add proper indexes

3. **API Rate Limiting:**
   - Implement exponential backoff
   - Queue requests during high traffic
   - Monitor and alert on rate limits

## 🧪 Testing

### Before Production Deployment

1. **Run dry tests:**
```bash
./scripts/daily-automated-workflow.sh --dry-run
```

2. **Test with reduced delays:**
```bash
./scripts/daily-automated-workflow.sh --skip-delays
```

3. **Verify data integrity:**
```bash
# Check that new data was added
cd backend
npx ts-node src/scripts/checkDuplicates.ts
```

4. **Load testing:**
```bash
# Test API endpoints under load
ab -n 100 -c 10 http://localhost:3000/api/health
```

## 📞 Support

If you encounter issues:

1. Check logs first: `tail -f logs/daily-workflow/workflow-$(date +%Y-%m-%d).log`
2. Verify all services are running
3. Test individual components manually
4. Check API key validity and rate limits

## 🎯 Next Steps After Setup

1. **Set up monitoring alerts** for failed workflows
2. **Configure backup strategies** for critical data
3. **Plan scaling** for increased user load
4. **Implement A/B testing** for prediction algorithms

---

*For additional help, check the troubleshooting section or review the detailed logs in the workflow output.* 