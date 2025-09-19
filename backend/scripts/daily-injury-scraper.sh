#!/bin/bash

# Daily injury scraper script for cron
# Add to crontab with: 0 8 * * * /path/to/your/backend/scripts/daily-injury-scraper.sh

# Set working directory
cd "$(dirname "$0")/.."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Run the injury update yuhhhh
echo "$(date): Starting injury scraper..."
npx ts-node src/scripts/dailyInjuryUpdate.ts

echo "$(date): Injury scraper completed." 