# Daily ParleyApp Picks Automation Setup

## 🚀 Quick Setup

### 1. Make the script executable
```bash
chmod +x backend/scripts/daily-picks-cron.sh
```

### 2. Add to your crontab
```bash
crontab -e
```

Add this line to run daily at 8 AM:
```bash
0 8 * * * /home/reid/Desktop/parleyapp/backend/scripts/daily-picks-cron.sh
```

### 3. Ensure your backend is running
The script assumes your backend is running on `localhost:3001`. Consider:
- Running backend as a service (systemd)
- Adding auto-restart logic
- Or running backend startup in the cron job

## 🔧 Advanced Options

### Run at multiple times (morning + evening)
```bash
# 8 AM and 6 PM daily
0 8,18 * * * /home/reid/Desktop/parleyapp/backend/scripts/daily-picks-cron.sh
```

### Check logs
```bash
# View today's log
tail -f backend/logs/daily-picks-$(date +%Y-%m-%d).log

# View all cron logs
grep parleyapp-cron /var/log/syslog
```

### Multi-user support (future)
Currently hardcoded to one user ID. To support multiple users, update:
- `ai.ts` route to accept user arrays
- Add user management
- Loop through active users in cron script

## 🎯 What Happens Daily

1. **8 AM**: Cron triggers script
2. **Script calls**: `POST /api/ai/generate-picks`
3. **Backend generates**: Fresh AI picks for today's games
4. **AI Market Intelligence**: Auto-updates with real processing data
5. **Users see**: Fresh picks when they open the app

## 🐛 Troubleshooting

- **Cron not running**: Check `sudo systemctl status cron`
- **Backend not available**: Ensure it's running on port 3001
- **No games today**: Script will still run but generate empty picks
- **Logs**: Check `/home/reid/Desktop/parleyapp/backend/logs/` 