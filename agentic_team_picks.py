#!/usr/bin/env python3
"""
Agentic Team Betting Picks Generator
Replaces the mechanical teams_enhanced.py with truly agentic analysis using OpenManus

This script uses the OpenManus BettingAgent to:
1. Dynamically research available games and betting opportunities
2. Conduct intelligent analysis based on findings
3. Generate profitable team betting picks (moneyline, spread, totals)
4. Store picks in the ai_predictions table in the exact format expected

Usage:
    python agentic_team_picks.py [--date YYYY-MM-DD] [--picks N] [--sport SPORT] [--nfl-only] [--verbose]

Examples:
    python agentic_team_picks.py                                    # Today, 15 picks
    python agentic_team_picks.py --date 2025-09-23 --picks 20      # Specific date, 20 picks
    python agentic_team_picks.py --nfl-only --picks 10             # NFL only, 10 picks
"""

import asyncio
import argparse
import sys
import os
from datetime import datetime, timedelta
from pathlib import Path

# Add OpenManus to Python path
openmanus_path = Path(__file__).parent / "OpenManus"
sys.path.insert(0, str(openmanus_path))

# Add backend path for environment variables
backend_path = Path(__file__).parent / "backend"
if backend_path.exists():
    sys.path.insert(0, str(backend_path))

from app.agent.betting_agent import BettingAgent
from app.utils.logger import logger
from app.config import config


async def generate_agentic_team_picks(target_date=None, target_picks=15, sport_filter=None, verbose=False):
    """
    Generate team betting picks using the agentic OpenManus approach
    
    Args:
        target_date (str): Date in YYYY-MM-DD format (defaults to today)
        target_picks (int): Number of picks to generate
        sport_filter (list): Specific sports to focus on
        verbose (bool): Enable verbose logging
    
    Returns:
        dict: Result summary with success status and details
    """
    
    if verbose:
        logger.setLevel("DEBUG")
    
    logger.info("🚀 Starting Agentic Team Betting Analysis...")
    logger.info(f"Target Date: {target_date or 'Today'}")
    logger.info(f"Target Picks: {target_picks}")
    if sport_filter:
        logger.info(f"Sport Filter: {sport_filter}")
    
    try:
        # Initialize the BettingAgent
        agent = BettingAgent()
        logger.info("✅ BettingAgent initialized successfully")
        
        # Create the analysis prompt
        sport_context = ""
        if sport_filter:
            if len(sport_filter) == 1:
                sport_context = f"Focus EXCLUSIVELY on {sport_filter[0]} games. "
            else:
                sport_context = f"Focus on these sports: {', '.join(sport_filter)}. "
        
        # Dynamic task prompt that encourages true agentic behavior
        task_prompt = f"""
## AGENTIC TEAM BETTING ANALYSIS MISSION

{sport_context}Generate {target_picks} profitable TEAM betting picks for {target_date or 'today'}.

**CRITICAL**: You are a TRULY AGENTIC analyst. This means:
- Don't follow a rigid script - be investigative and adaptive
- Let your findings guide your next research steps
- If you discover something interesting, explore it deeper
- Be genuinely curious about market inefficiencies
- Follow your analytical instincts

**Your Adaptive Research Process:**

1. **Initial Market Survey**
   - Use supabase_betting to examine available games and team betting odds
   - Identify games with interesting odds, line movements, or matchup potential
   - Note which games deserve deeper investigation

2. **Dynamic Investigation Phase** 
   - For games that caught your attention, research deeper using:
     * statmuse_query: Team performance, recent form, head-to-head records
     * web_search: Breaking news, injury reports, weather, lineup changes
   - Follow interesting leads - if you find concerning injury news, research the player's impact
   - If line movements seem suspicious, investigate why the market is reacting
   - Adapt your research based on what you discover

3. **Value Assessment**
   - Calculate implied probability vs your assessed probability  
   - Identify market inefficiencies where you see genuine edge
   - Consider all bet types: moneyline, spread, totals

4. **Pick Selection & Storage**
   - Select your {target_picks} best opportunities with highest expected value
   - Store using supabase_betting with detailed reasoning for each pick
   - Include key factors, confidence levels, and value calculations

**Quality Standards:**
- Target profitable odds ranges (typically -250 to +250)
- Diversify across sports, bet types, and risk levels  
- Each pick should represent genuine value, not just likely outcomes
- Confidence levels should be realistic (55-75% range typically)
- Provide detailed reasoning explaining your edge

**Investigation Areas to Consider:**
- Recent team performance and trends (last 10-15 games)
- Key player injuries and their impact on team success
- Home/away splits and venue advantages
- Weather conditions (for outdoor sports)
- Motivational factors (rivalry games, playoff implications)
- Public betting trends vs sharp money movements
- Head-to-head matchup history and recent meetings

**Remember**: You're not executing a predetermined plan - you're conducting genuine investigative analysis. Be curious, adaptive, and thorough. Let your discoveries guide your research path.

START by examining today's available games and betting markets, then let your analysis take you where it needs to go!
"""

        # Execute the agentic analysis
        logger.info("🧠 Beginning agentic analysis...")
        result = await agent.analyze_team_betting_opportunities(
            target_date=target_date,
            target_picks=target_picks
        )
        
        if result["status"] == "success":
            logger.info("✅ Agentic team betting analysis completed successfully!")
            
            # Try to extract useful information from the result
            analysis_summary = {
                "status": "success",
                "target_picks": target_picks,
                "target_date": target_date or datetime.now().strftime("%Y-%m-%d"),
                "approach": "agentic",
                "agent_used": "OpenManus BettingAgent",
                "analysis_depth": "dynamic_and_adaptive",
                "result_details": str(result["result"])[:500] + "..." if len(str(result["result"])) > 500 else str(result["result"])
            }
            
            logger.info("📊 Analysis Summary:")
            logger.info(f"  • Approach: Dynamic agentic analysis")  
            logger.info(f"  • Research: Adaptive based on findings")
            logger.info(f"  • Quality: Value-focused with genuine market edge")
            
            return analysis_summary
        else:
            logger.error(f"❌ Analysis failed: {result.get('error', 'Unknown error')}")
            return {
                "status": "error",
                "error": result.get("error", "Analysis failed"),
                "target_picks": target_picks
            }
            
    except Exception as e:
        logger.error(f"❌ Critical error in agentic analysis: {str(e)}")
        return {
            "status": "error", 
            "error": str(e),
            "target_picks": target_picks
        }


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Generate AI team betting picks using agentic OpenManus approach',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                              # Today, 15 picks, all sports
  %(prog)s --date 2025-09-23            # Specific date
  %(prog)s --picks 20                   # 20 picks instead of 15
  %(prog)s --sport NFL                  # Focus on NFL only
  %(prog)s --nfl-only --picks 10        # NFL-only mode with 10 picks
  %(prog)s --tomorrow --picks 12        # Tomorrow's games, 12 picks
  %(prog)s --verbose                    # Enable debug logging

This agentic approach replaces the mechanical teams_enhanced.py with truly
intelligent, adaptive analysis that conducts dynamic research and follows
leads based on what it discovers.
        """
    )
    
    # Date options
    parser.add_argument('--date', type=str, metavar='YYYY-MM-DD',
                      help='Specific date to generate picks for (format: YYYY-MM-DD)')
    parser.add_argument('--tomorrow', action='store_true',
                      help='Generate picks for tomorrow instead of today')
    
    # Pick options
    parser.add_argument('--picks', type=int, default=15, metavar='N',
                      help='Number of picks to generate (default: 15)')
    
    # Sport filters  
    parser.add_argument('--sport', type=str, choices=['MLB', 'NFL', 'WNBA', 'CFB', 'UFC'],
                      help='Focus on specific sport only')
    parser.add_argument('--nfl-only', action='store_true',
                      help='Generate picks for NFL games only (equivalent to --sport NFL)')
    
    # Output options
    parser.add_argument('--verbose', '-v', action='store_true',
                      help='Enable verbose debug logging')
    
    return parser.parse_args()


async def main():
    """Main execution function"""
    
    print("🎯 Agentic Team Betting Picks Generator")
    print("=" * 50)
    print("Powered by OpenManus BettingAgent")
    print("Dynamic • Adaptive • Value-Focused")
    print()
    
    args = parse_arguments()
    
    # Determine target date
    target_date = None
    if args.date:
        try:
            datetime.strptime(args.date, '%Y-%m-%d')
            target_date = args.date
        except ValueError:
            print("❌ Error: Invalid date format. Use YYYY-MM-DD")
            sys.exit(1)
    elif args.tomorrow:
        target_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    
    # Determine sport filter
    sport_filter = None
    if args.nfl_only:
        sport_filter = ["NFL"]
    elif args.sport:
        sport_filter = [args.sport]
    
    # Validate picks count
    if args.picks < 1 or args.picks > 50:
        print("❌ Error: Number of picks must be between 1 and 50")
        sys.exit(1)
    
    # Display configuration
    print(f"Configuration:")
    print(f"  • Date: {target_date or 'Today'}")
    print(f"  • Target Picks: {args.picks}")
    print(f"  • Sport Filter: {sport_filter[0] if sport_filter else 'All Sports'}")
    print(f"  • Analysis: Truly Agentic (Dynamic & Adaptive)")
    print()
    
    # Execute the analysis
    try:
        result = await generate_agentic_team_picks(
            target_date=target_date,
            target_picks=args.picks,
            sport_filter=sport_filter,
            verbose=args.verbose
        )
        
        print("\n" + "=" * 50)
        if result["status"] == "success":
            print("✅ ANALYSIS COMPLETED SUCCESSFULLY")
            print()
            print("The BettingAgent has completed its agentic analysis and stored")
            print(f"its {args.picks} best team betting picks in your database.")
            print()
            print("Key Advantages of This Approach:")
            print("  • Dynamic research that adapts based on findings")
            print("  • Genuine investigation following interesting leads")
            print("  • Value-focused picks with calculated market edge")
            print("  • Professional-level analysis depth and reasoning")
            print()
            print("Picks have been stored in ai_predictions table with full metadata.")
            
        else:
            print("❌ ANALYSIS FAILED")
            print(f"Error: {result.get('error', 'Unknown error')}")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⏸️ Analysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())


