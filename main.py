#!/usr/bin/env python3
"""
Unified Sports Betting AI Orchestrator
Runs both player props (props.py) and team betting (teams.py) agents
Simplified single-service replacement for the complex TypeScript orchestrator
"""

import os
import sys
import json
import logging
import asyncio
import argparse
from datetime import datetime
from typing import List, Dict, Any
from dotenv import load_dotenv

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import our AI agents
try:
    from props import IntelligentPlayerPropsAgent
    from teams import IntelligentTeamBettingAgent
except ImportError as e:
    print(f"❌ Failed to import agents: {e}")
    print("Make sure props.py and teams.py are in the same directory")
    sys.exit(1)

# Load environment variables
load_dotenv('backend/.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class UnifiedSportsBettingOrchestrator:
    """Main orchestrator that runs both player props and team betting agents"""
    
    def __init__(self):
        logger.info("🚀 Initializing Unified Sports Betting Orchestrator")
        self.props_agent = None
        self.teams_agent = None
        
        # Initialize agents
        try:
            self.props_agent = IntelligentPlayerPropsAgent()
            logger.info("✅ Player Props Agent initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Player Props Agent: {e}")
        
        try:
            self.teams_agent = IntelligentTeamBettingAgent()
            logger.info("✅ Team Betting Agent initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Team Betting Agent: {e}")
    
    async def generate_daily_picks(
        self, 
        props_count: int = 10, 
        teams_count: int = 10,
        test_mode: bool = False
    ) -> Dict[str, Any]:
        """Generate comprehensive daily picks from both agents"""
        
        logger.info("=" * 80)
        logger.info("🎯 UNIFIED DAILY PICKS GENERATION")
        logger.info("=" * 80)
        logger.info(f"📊 Target: {props_count} player props + {teams_count} team picks = {props_count + teams_count} total")
        logger.info(f"🧪 Test Mode: {'ON' if test_mode else 'OFF'}")
        logger.info(f"⏰ Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("")
        
        results = {
            "props_picks": [],
            "team_picks": [],
            "total_picks": 0,
            "generation_time": datetime.now().isoformat(),
            "test_mode": test_mode,
            "success": False,
            "errors": []
        }
        
        # STAGE 1: Generate Player Props Picks
        if self.props_agent:
            try:
                logger.info("🎲 STAGE 1: Generating Player Props Picks")
                logger.info("-" * 50)
                props_picks = await self.props_agent.generate_daily_picks(target_picks=props_count)
                results["props_picks"] = props_picks
                logger.info(f"✅ Generated {len(props_picks)} player props picks")
                logger.info("")
            except Exception as e:
                error_msg = f"Failed to generate player props picks: {e}"
                logger.error(f"❌ {error_msg}")
                results["errors"].append(error_msg)
        else:
            error_msg = "Player Props Agent not available"
            logger.warning(f"⚠️ {error_msg}")
            results["errors"].append(error_msg)
        
        # STAGE 2: Generate Team Betting Picks
        if self.teams_agent:
            try:
                logger.info("🏈 STAGE 2: Generating Team Betting Picks")
                logger.info("-" * 50)
                team_picks = await self.teams_agent.generate_daily_picks(target_picks=teams_count)
                results["team_picks"] = team_picks
                logger.info(f"✅ Generated {len(team_picks)} team betting picks")
                logger.info("")
            except Exception as e:
                error_msg = f"Failed to generate team betting picks: {e}"
                logger.error(f"❌ {error_msg}")
                results["errors"].append(error_msg)
        else:
            error_msg = "Team Betting Agent not available"
            logger.warning(f"⚠️ {error_msg}")
            results["errors"].append(error_msg)
        
        # STAGE 3: Summary and Results
        total_picks = len(results["props_picks"]) + len(results["team_picks"])
        results["total_picks"] = total_picks
        results["success"] = total_picks > 0
        
        logger.info("=" * 80)
        logger.info("📊 GENERATION SUMMARY")
        logger.info("=" * 80)
        logger.info(f"🎯 Player Props: {len(results['props_picks'])}/{props_count}")
        logger.info(f"🏈 Team Bets: {len(results['team_picks'])}/{teams_count}")
        logger.info(f"📈 Total Generated: {total_picks}/{props_count + teams_count}")
        
        if results["errors"]:
            logger.info(f"⚠️ Errors: {len(results['errors'])}")
            for error in results["errors"]:
                logger.info(f"   - {error}")
        
        if total_picks > 0:
            logger.info("✅ Daily picks generation completed successfully!")
        else:
            logger.warning("❌ No picks were generated")
        
        logger.info("")
        return results
    
    async def run_props_only(self, count: int = 10, test_mode: bool = False) -> List[Dict[str, Any]]:
        """Run only player props generation"""
        logger.info(f"🎲 Running Player Props Only (Target: {count})")
        
        if not self.props_agent:
            logger.error("❌ Player Props Agent not available")
            return []
        
        try:
            picks = await self.props_agent.generate_daily_picks(target_picks=count)
            logger.info(f"✅ Generated {len(picks)} player props picks")
            return picks
        except Exception as e:
            logger.error(f"❌ Player props generation failed: {e}")
            return []
    
    async def run_teams_only(self, count: int = 10, test_mode: bool = False) -> List[Dict[str, Any]]:
        """Run only team betting generation"""
        logger.info(f"🏈 Running Team Betting Only (Target: {count})")
        
        if not self.teams_agent:
            logger.error("❌ Team Betting Agent not available")
            return []
        
        try:
            picks = await self.teams_agent.generate_daily_picks(target_picks=count)
            logger.info(f"✅ Generated {len(picks)} team betting picks")
            return picks
        except Exception as e:
            logger.error(f"❌ Team betting generation failed: {e}")
            return []
    
    def display_picks_summary(self, results: Dict[str, Any]):
        """Display a formatted summary of all generated picks"""
        
        if not results.get("success"):
            logger.warning("No picks to display")
            return
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("🎯 DAILY PICKS SUMMARY")
        logger.info("=" * 80)
        
        # Display Player Props
        if results["props_picks"]:
            logger.info("")
            logger.info("🎲 PLAYER PROPS PICKS:")
            for i, pick in enumerate(results["props_picks"], 1):
                meta = pick.get('metadata', {})
                logger.info("")
                logger.info(f"  {i}. {pick['pick']}")
                logger.info(f"     Odds: {pick['odds']} | Confidence: {pick['confidence']}%")
                logger.info(f"     Game: {pick['match_teams']}")
                if meta.get('reasoning'):
                    reasoning = meta['reasoning'][:100] + "..." if len(meta['reasoning']) > 100 else meta['reasoning']
                    logger.info(f"     Reasoning: {reasoning}")
        
        # Display Team Bets
        if results["team_picks"]:
            logger.info("")
            logger.info("🏈 TEAM BETTING PICKS:")
            for i, pick in enumerate(results["team_picks"], 1):
                meta = pick.get('metadata', {})
                logger.info("")
                logger.info(f"  {i}. {pick['pick']}")
                logger.info(f"     Odds: {pick['odds']} | Confidence: {pick['confidence']}%")
                logger.info(f"     Game: {pick['match_teams']}")
                if meta.get('reasoning'):
                    reasoning = meta['reasoning'][:100] + "..." if len(meta['reasoning']) > 100 else meta['reasoning']
                    logger.info(f"     Reasoning: {reasoning}")
        
        logger.info("")
        logger.info("=" * 80)

async def main():
    """Main execution function with command line arguments"""
    parser = argparse.ArgumentParser(description='Unified Sports Betting AI Orchestrator')
    parser.add_argument('--mode', choices=['both', 'props', 'teams'], default='both',
                       help='Which agent to run (default: both)')
    parser.add_argument('--props-count', type=int, default=10,
                       help='Number of player props picks to generate (default: 10)')
    parser.add_argument('--teams-count', type=int, default=10,
                       help='Number of team betting picks to generate (default: 10)')
    parser.add_argument('--test', action='store_true',
                       help='Run in test mode (may not save to database)')
    parser.add_argument('--summary', action='store_true',
                       help='Display detailed picks summary')
    
    args = parser.parse_args()
    
    logger.info("🤖 Starting Unified Sports Betting AI Orchestrator")
    logger.info(f"📋 Mode: {args.mode}")
    logger.info(f"🎯 Targets: {args.props_count} props, {args.teams_count} teams")
    logger.info(f"🧪 Test Mode: {args.test}")
    logger.info("")
    
    # Initialize orchestrator
    orchestrator = UnifiedSportsBettingOrchestrator()
    
    try:
        if args.mode == 'both':
            # Run both agents
            results = await orchestrator.generate_daily_picks(
                props_count=args.props_count,
                teams_count=args.teams_count,
                test_mode=args.test
            )
            
            if args.summary:
                orchestrator.display_picks_summary(results)
            
        elif args.mode == 'props':
            # Run only player props
            picks = await orchestrator.run_props_only(
                count=args.props_count,
                test_mode=args.test
            )
            
        elif args.mode == 'teams':
            # Run only team betting
            picks = await orchestrator.run_teams_only(
                count=args.teams_count,
                test_mode=args.test
            )
        
        logger.info("✅ Orchestrator completed successfully!")
        
    except KeyboardInterrupt:
        logger.info("⏹️ Orchestrator interrupted by user")
    except Exception as e:
        logger.error(f"❌ Orchestrator failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Handle asyncio event loop
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("⏹️ Interrupted by user")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)