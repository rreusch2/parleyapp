#!/bin/bash

# Daily ParleyApp Picks Generation Script
# Run this via cron job daily at 8 AM

LOG_FILE="/home/reid/Desktop/parleyapp/backend/logs/daily-picks-$(date +%Y-%m-%d).log"
API_URL="http://localhost:3001/api/ai/generate-picks-all-users"

echo "$(date): Starting MULTI-USER daily picks generation..." >> "$LOG_FILE"

# Generate picks for all users
response=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"automated": true, "source": "daily_cron"}')

http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
response_body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$http_status" -eq 200 ]; then
    echo "$(date): ✅ Daily picks generated successfully" >> "$LOG_FILE"
    echo "$response_body" >> "$LOG_FILE"
else
    echo "$(date): ❌ Failed to generate daily picks (HTTP $http_status)" >> "$LOG_FILE"
    echo "$response_body" >> "$LOG_FILE"
    
    # Send notification (optional - could add email/slack notification here)
    echo "Daily picks generation failed" | logger -t parleyapp-cron
fi

echo "$(date): Daily picks generation completed" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE" 