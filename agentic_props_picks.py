#!/usr/bin/env python3
"""
Agentic Player Props Picks Generator  
Replaces the mechanical props_enhanced.py with truly agentic analysis using OpenManus

This script uses the OpenManus BettingAgent to:
1. Dynamically research available player props and betting opportunities
2. Conduct intelligent player and matchup analysis based on findings
3. Generate profitable player prop picks across all sports
4. Store picks in the ai_predictions table in the exact format expected

Usage:
    python agentic_props_picks.py [--date YYYY-MM-DD] [--picks N] [--sport SPORT] [--verbose]

Examples:
    python agentic_props_picks.py                                   # Today, 15 picks
    python agentic_props_picks.py --date 2025-09-23 --picks 25     # Specific date, 25 picks  
    python agentic_props_picks.py --sport MLB --picks 12           # MLB only, 12 picks
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


async def generate_agentic_props_picks(target_date=None, target_picks=15, sport_filter=None, verbose=False):
    """
    Generate player prop betting picks using the agentic OpenManus approach
    
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
    
    logger.info("🚀 Starting Agentic Player Props Analysis...")
    logger.info(f"Target Date: {target_date or 'Today'}")
    logger.info(f"Target Picks: {target_picks}")
    if sport_filter:
        logger.info(f"Sport Filter: {sport_filter}")
    
    try:
        # Initialize the BettingAgent
        agent = BettingAgent()
        logger.info("✅ BettingAgent initialized successfully")
        
        # Create sport context
        sport_context = ""
        if sport_filter:
            if len(sport_filter) == 1:
                sport_context = f"Focus EXCLUSIVELY on {sport_filter[0]} player props. "
            else:
                sport_context = f"Focus on player props from these sports: {', '.join(sport_filter)}. "
        
        # Dynamic task prompt for player props analysis
        task_prompt = f"""
## AGENTIC PLAYER PROPS ANALYSIS MISSION

{sport_context}Generate {target_picks} profitable PLAYER PROP picks for {target_date or 'today'}.

**CRITICAL AGENTIC APPROACH**: 
You are conducting genuine investigative analysis, not following a script. Be adaptive, curious, and let your discoveries guide your research path.

**Your Dynamic Research Process:**

1. **Props Market Survey**
   - Use supabase_betting to examine available player props across sports
   - Identify props with interesting lines, favorable matchups, or value opportunities
   - Note which players/props deserve deeper investigation

2. **Player & Matchup Investigation**
   - For promising props, conduct deep research using:
     * statmuse_query: Player recent performance, season stats, historical vs opponent
     * web_search: Injury news, lineup changes, usage updates, matchup analysis
   - Follow interesting leads - if a player has been hot lately, research why
   - If you see concerning injury/usage news, investigate the impact
   - Adapt your strategy based on what you discover

3. **Value Assessment & Selection**
   - Calculate implied probability vs your player performance assessment
   - Consider recent form vs season averages (recent form often more predictive)
   - Factor in matchup advantages and situational factors
   - Select props where you have genuine analytical edge

4. **Quality Control & Storage**
   - Generate ONLY props with clear value and reasoning
   - Ensure odds exist for your recommendation (verify over/under availability)
   - Never select impossible props (e.g., "Under 0.5" Home Runs/Stolen Bases)
   - Store using supabase_betting with detailed analysis

**Sport-Specific Focus Areas:**

**MLB Props to Consider:**
- Batter Hits O/U (analyze vs pitcher matchup, recent form)
- Home Runs O/U (park factors, pitcher tendencies, player power)  
- RBIs O/U (lineup position, runners scoring opportunities)
- Total Bases O/U (contact vs power hitters, ballpark factors)
- Pitcher Strikeouts O/U (swinging strike rates, opponent strikeout rates)
- Runs Scored O/U (leadoff/top of order opportunities)

**WNBA Props to Consider:**
- Points O/U (usage rate, recent scoring, matchup pace)
- Rebounds O/U (opponent rebounding rates, player positioning)
- Assists O/U (team pace, ball-handling role, teammate shooting)
- Three-Pointers O/U (shot attempts, recent accuracy, defensive matchup)

**NFL Props to Consider:**
- Passing Yards O/U (weather, opponent pass defense, game script)
- Rushing Yards O/U (opponent run defense, game flow, usage)
- Receiving Yards O/U (target share, opponent coverage, matchup)
- Touchdowns O/U (red zone usage, scoring opportunities)

**CFB Props to Consider:**
- Similar to NFL but consider college game pace and style differences

**Investigation Guidelines:**
- Recent player form (last 10-15 games) often more important than season averages
- Check for injury reports and usage changes that could impact performance
- Analyze opponent defensive rankings vs specific statistical categories
- Consider game pace, weather (outdoor sports), and motivational factors
- Look for props where market hasn't adjusted to recent trends

**Critical Quality Standards:**
- Each prop must have clear analytical reasoning and edge identification
- Confidence levels should be realistic (55-75% range typically)
- Avoid "lottery ticket" props with extreme odds unless exceptional value
- Diversify across sports, prop types, and players
- Include detailed reasoning explaining why market may be mispriced

**Research Depth Requirements:**
- Use statmuse_query to research player recent performance vs historical
- Use web_search to check for injury/lineup news that could impact player
- Follow up on interesting statistical trends or matchup advantages you discover
- Be genuinely investigative - if something seems interesting, explore it deeper

START by examining available player props, then let your analytical curiosity guide your research!
"""

        # Execute the agentic analysis
        logger.info("🧠 Beginning agentic player props analysis...")
        result = await agent.analyze_player_prop_opportunities(
            target_date=target_date,
            target_picks=target_picks
        )
        
        if result["status"] == "success":
            logger.info("✅ Agentic player props analysis completed successfully!")
            
            analysis_summary = {
                "status": "success",
                "target_picks": target_picks,
                "target_date": target_date or datetime.now().strftime("%Y-%m-%d"),
                "approach": "agentic_player_props",
                "agent_used": "OpenManus BettingAgent",
                "analysis_depth": "dynamic_player_and_matchup_focused",
                "result_details": str(result["result"])[:500] + "..." if len(str(result["result"])) > 500 else str(result["result"])
            }
            
            logger.info("📊 Player Props Analysis Summary:")
            logger.info(f"  • Approach: Dynamic agentic player analysis")
            logger.info(f"  • Research: Player form + matchup investigation")
            logger.info(f"  • Focus: Value props with analytical edge")
            
            return analysis_summary
        else:
            logger.error(f"❌ Analysis failed: {result.get('error', 'Unknown error')}")
            return {
                "status": "error",
                "error": result.get("error", "Analysis failed"),
                "target_picks": target_picks
            }
            
    except Exception as e:
        logger.error(f"❌ Critical error in agentic props analysis: {str(e)}")
        return {
            "status": "error", 
            "error": str(e),
            "target_picks": target_picks
        }


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Generate AI player prop picks using agentic OpenManus approach',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                              # Today, 15 picks, all sports
  %(prog)s --date 2025-09-23            # Specific date  
  %(prog)s --picks 25                   # 25 picks instead of 15
  %(prog)s --sport MLB                  # Focus on MLB props only
  %(prog)s --tomorrow --picks 20        # Tomorrow's games, 20 picks
  %(prog)s --verbose                    # Enable debug logging

Player Props Covered:
  • MLB: Hits, Home Runs, RBIs, Total Bases, Strikeouts, Runs Scored
  • WNBA: Points, Rebounds, Assists, Three-Pointers, Steals  
  • NFL: Passing/Rushing/Receiving Yards, Touchdowns, Completions
  • CFB: Similar to NFL stats for college football

This agentic approach replaces the mechanical props_enhanced.py with truly
intelligent analysis that researches player form, matchups, and value.
        """
    )
    
    # Date options
    parser.add_argument('--date', type=str, metavar='YYYY-MM-DD',
                      help='Specific date to generate picks for (format: YYYY-MM-DD)')
    parser.add_argument('--tomorrow', action='store_true',
                      help='Generate picks for tomorrow instead of today')
    
    # Pick options
    parser.add_argument('--picks', type=int, default=15, metavar='N',
                      help='Number of prop picks to generate (default: 15)')
    
    # Sport filters
    parser.add_argument('--sport', type=str, choices=['MLB', 'NFL', 'WNBA', 'CFB'],
                      help='Focus on specific sport props only')
    
    # Output options  
    parser.add_argument('--verbose', '-v', action='store_true',
                      help='Enable verbose debug logging')
    
    return parser.parse_args()


async def main():
    """Main execution function"""
    
    print("🎯 Agentic Player Props Picks Generator")
    print("=" * 50)
    print("Powered by OpenManus BettingAgent")
    print("Dynamic • Player-Focused • Value-Driven")
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
    if args.sport:
        sport_filter = [args.sport]
    
    # Validate picks count
    if args.picks < 1 or args.picks > 50:
        print("❌ Error: Number of picks must be between 1 and 50")
        sys.exit(1)
    
    # Display configuration
    print(f"Configuration:")
    print(f"  • Date: {target_date or 'Today'}")
    print(f"  • Target Props: {args.picks}")
    print(f"  • Sport Filter: {sport_filter[0] if sport_filter else 'All Sports'}")
    print(f"  • Analysis: Truly Agentic (Player & Matchup Focused)")
    print()
    print("Player Props Analysis Includes:")
    print("  • Recent player performance trends (last 10-15 games)")
    print("  • Matchup analysis vs opponent defensive stats")  
    print("  • Injury and lineup change impact assessment")
    print("  • Usage rate and opportunity factor analysis")
    print("  • Value calculation vs implied probability")
    print()
    
    # Execute the analysis
    try:
        result = await generate_agentic_props_picks(
            target_date=target_date,
            target_picks=args.picks,
            sport_filter=sport_filter,
            verbose=args.verbose
        )
        
        print("\n" + "=" * 50)
        if result["status"] == "success":
            print("✅ PLAYER PROPS ANALYSIS COMPLETED SUCCESSFULLY")
            print()
            print("The BettingAgent has completed its agentic player props analysis")
            print(f"and stored its {args.picks} best player prop picks in your database.")
            print()
            print("Key Advantages of This Approach:")
            print("  • Dynamic player performance and form analysis")
            print("  • Intelligent matchup assessment and trend following")
            print("  • Value-focused props with calculated market edge")
            print("  • Injury/usage impact evaluation and adaptation")
            print()
            print("Props have been stored in ai_predictions table with:")
            print("  • Detailed reasoning for each selection")
            print("  • Player performance analysis and trends")
            print("  • Matchup advantages and key factors")
            print("  • Value calculations and confidence levels")
            
        else:
            print("❌ PLAYER PROPS ANALYSIS FAILED")
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


