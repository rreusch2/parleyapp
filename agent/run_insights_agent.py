import asyncio
import argparse
from datetime import datetime

from app.logger import logger
from daily_insights_agent import DailyInsightsAgent


def parse_args():
    parser = argparse.ArgumentParser(description="Run Daily Insights Agent")
    date_group = parser.add_mutually_exclusive_group()
    date_group.add_argument("--date", type=str, help="Target date YYYY-MM-DD")
    date_group.add_argument("--tomorrow", action="store_true", help="Use tomorrow's date")
    return parser.parse_args()


async def main():
    args = parse_args()
    if args.date:
        target_date = args.date
    elif args.tomorrow:
        target_date = (datetime.utcnow().date()).strftime("%Y-%m-%d")
        # tomorrow in UTC calendar terms
        from datetime import timedelta
        target_date = (datetime.utcnow().date() + timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        target_date = datetime.utcnow().date().strftime("%Y-%m-%d")

    logger.info("=" * 80)
    logger.info("🎯 DAILY INSIGHTS AGENT")
    logger.info("=" * 80)

    agent = DailyInsightsAgent()
    result = await agent.generate(target_date)

    if result.get("success"):
        logger.info("✅ Completed: stored insights + greeting")
    else:
        logger.error(f"❌ Failed: {result.get('error', 'Unknown error')}")


if __name__ == "__main__":
    asyncio.run(main())


