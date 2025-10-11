"""
Simple Runner for Enhanced Betting Agent - Player Props Analysis

This replaces the mechanical props_intelligent_v3.py with a truly agentic approach.
The agent autonomously decides how to research, which tools to use, and when.

Usage:
    python run_props_agent.py                    # Today's props, 25 picks, all sports
    python run_props_agent.py --tomorrow         # Tomorrow's props
    python run_props_agent.py --picks 15         # Target 15 picks
    python run_props_agent.py --sport NHL        # NHL props only
    python run_props_agent.py --date 2025-01-15  # Specific date
    python run_props_agent.py --team-bets        # Team betting instead of props
"""

import asyncio
import argparse
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Add agent directory to path
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from enhanced_betting_agent import EnhancedBettingAgent
from app.logger import logger

# Load environment variables
load_dotenv("../backend/.env")


def parse_args():
    parser = argparse.ArgumentParser(
        description='Run Enhanced Betting Agent for autonomous sports betting analysis'
    )
    
    # Date options
    date_group = parser.add_mutually_exclusive_group()
    date_group.add_argument(
        '--tomorrow',
        action='store_true',
        help='Analyze tomorrow\'s games instead of today'
    )
    date_group.add_argument(
        '--date',
        type=str,
        help='Specific date to analyze (YYYY-MM-DD format)'
    )
    
    # Analysis options
    parser.add_argument(
        '--picks',
        type=int,
        default=25,
        help='Target number of picks to generate (default: 25)'
    )
    
    parser.add_argument(
        '--sport',
        type=str,
        choices=['MLB', 'NHL', 'NBA', 'NFL', 'WNBA', 'CFB'],
        help='Filter analysis to specific sport only'
    )
    
    # Bet type
    parser.add_argument(
        '--team-bets',
        action='store_true',
        help='Generate team betting picks (moneyline/spread/totals) instead of player props'
    )
    
    # Investigation mode
    parser.add_argument(
        '--investigate',
        type=str,
        help='Conduct deep investigation into specific opportunity (e.g., "Jose Altuve hits prop")'
    )
    
    return parser.parse_args()


async def main():
    args = parse_args()
    
    # Determine target date
    if args.date:
        try:
            target_date = datetime.strptime(args.date, '%Y-%m-%d').strftime('%Y-%m-%d')
        except ValueError:
            logger.error("Invalid date format. Use YYYY-MM-DD")
            return
    elif args.tomorrow:
        target_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    else:
        target_date = datetime.now().strftime('%Y-%m-%d')
    
    # Initialize the enhanced betting agent
    logger.info("=" * 80)
    logger.info("🚀 ENHANCED BETTING AGENT - Autonomous Analysis System")
    logger.info("=" * 80)
    
    try:
        agent = EnhancedBettingAgent()
        
        # Run the appropriate analysis based on mode
        if args.investigate:
            # Deep investigation mode
            logger.info("📊 MODE: Deep Investigation")
            logger.info(f"🔍 TARGET: {args.investigate}")
            logger.info("=" * 80)
            
            result = await agent.investigate_specific_opportunity(args.investigate)
            
        elif args.team_bets:
            # Team betting analysis
            logger.info("📊 MODE: Team Betting Analysis")
            logger.info(f"📅 DATE: {target_date}")
            logger.info(f"🎯 TARGET: {args.picks} picks")
            if args.sport:
                logger.info(f"🏆 SPORT: {args.sport}")
            logger.info("=" * 80)
            
            result = await agent.generate_team_betting_picks(
                target_date=target_date,
                target_picks=args.picks,
                sport_filter=args.sport
            )
            
        else:
            # Player props analysis (default)
            logger.info("📊 MODE: Player Props Analysis")
            logger.info(f"📅 DATE: {target_date}")
            logger.info(f"🎯 TARGET: {args.picks} picks")
            if args.sport:
                logger.info(f"🏆 SPORT: {args.sport}")
            logger.info("=" * 80)
            
            result = await agent.generate_player_props_picks(
                target_date=target_date,
                target_picks=args.picks,
                sport_filter=args.sport
            )
        
        # Display results
        logger.info("=" * 80)
        if result['status'] == 'success':
            logger.info("✅ ANALYSIS COMPLETED SUCCESSFULLY")
            logger.info("=" * 80)
            logger.info("\n📋 AGENT SUMMARY:\n")
            logger.info(result.get('result', 'No detailed result available'))
            
        else:
            logger.error("❌ ANALYSIS FAILED")
            logger.error(f"Error: {result.get('error', 'Unknown error')}")
        
        logger.info("=" * 80)
        
    except KeyboardInterrupt:
        logger.info("\n⏸️  Analysis interrupted by user")
    except Exception as e:
        logger.error(f"❌ Fatal error: {str(e)}", exc_info=True)
    finally:
        # Cleanup
        if 'agent' in locals():
            await agent.cleanup()


if __name__ == '__main__':
    # Run the async main function
    asyncio.run(main())

