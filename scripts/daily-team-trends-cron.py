#!/usr/bin/env python3
"""
Daily Team Trends Cron Job
Runs daily to accumulate team performance data using TheOdds API
This builds up historical team trends over time (last 10 games per team)
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timedelta
from theodds_team_trends_collector import TeamTrendsCollector

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/daily-team-trends-cron.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

async def daily_team_trends_update():
    """Daily team trends update - collects yesterday's completed games"""
    try:
        logger.info("🗓️ Starting daily team trends update...")
        
        async with TeamTrendsCollector() as collector:
            # Only collect yesterday's games (1 day back)
            # This runs daily to accumulate data over time
            await collector.collect_team_trends(days_back=1)
            
        logger.info("✅ Daily team trends update completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Daily team trends update failed: {e}")
        raise

async def weekly_backfill():
    """Weekly backfill to catch any missed games"""
    try:
        logger.info("📅 Starting weekly team trends backfill...")
        
        async with TeamTrendsCollector() as collector:
            # Collect last 3 days to catch any missed games
            await collector.collect_team_trends(days_back=3)
            
        logger.info("✅ Weekly team trends backfill completed!")
        
    except Exception as e:
        logger.error(f"❌ Weekly backfill failed: {e}")
        raise

def main():
    """Main execution based on command line argument"""
    import sys
    
    mode = sys.argv[1] if len(sys.argv) > 1 else 'daily'
    
    if mode == 'daily':
        asyncio.run(daily_team_trends_update())
    elif mode == 'weekly':
        asyncio.run(weekly_backfill())
    elif mode == 'initial':
        # Initial setup - collect last 3 days
        asyncio.run(TeamTrendsCollector().collect_team_trends(days_back=3))
    else:
        logger.error(f"Unknown mode: {mode}. Use 'daily', 'weekly', or 'initial'")
        sys.exit(1)

if __name__ == "__main__":
    main()
