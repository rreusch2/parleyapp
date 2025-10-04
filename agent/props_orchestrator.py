"""
Props Orchestrator - Coordinates all sport-specific agents
"""
import os
import sys
import asyncio
import argparse
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add paths
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sports_agents.nfl_props_agent import NFLPropsAgent
from sports_agents.mlb_props_agent import MLBPropsAgent
from sports_agents.cfb_props_agent import CFBPropsAgent
from sports_agents.wnba_props_agent import WNBAPropsAgent
from app.tool.supabase_betting import SupabaseBettingTool

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


class PropsOrchestrator:
    """Master orchestrator for all sport-specific props agents"""
    
    def __init__(self, target_date: Optional[str] = None):
        """Initialize orchestrator with all sport agents"""
        self.target_date = target_date or (datetime.now().date() + timedelta(days=1)).isoformat()
        
        # Initialize all sport agents
        self.agents = {
            'NFL': NFLPropsAgent(self.target_date),
            'MLB': MLBPropsAgent(self.target_date),
            'CFB': CFBPropsAgent(self.target_date),
            'WNBA': WNBAPropsAgent(self.target_date)
        }
        
        # Supabase tool for checking available games
        self.supabase_tool = SupabaseBettingTool()
        
        logger.info(f"🎯 Props Orchestrator initialized for {self.target_date}")
        logger.info(f"📊 Managing {len(self.agents)} specialized agents: {list(self.agents.keys())}")
    
    async def check_available_sports(self) -> Dict[str, int]:
        """Check which sports have games/props available for the target date"""
        logger.info(f"🔍 Checking available sports for {self.target_date}...")
        
        try:
            # Get all props for the date
            result = await self.supabase_tool.execute(
                action="get_all_props_for_date",
                date=self.target_date
            )
            
            # Check if result has error
            if result.error:
                logger.warning(f"Failed to fetch props: {result.error}")
                return {}
            
            # Parse the output JSON
            import json
            data = json.loads(result.output) if isinstance(result.output, str) else result.output
            props = data.get('player_props', [])  # Note: key is 'player_props' not 'props'
            
            # Count props by sport
            sport_counts = {}
            
            for prop in props:
                sport = prop.get('sport', 'Unknown')
                # Map sport names to our agent keys
                if 'NFL' in sport or 'National Football League' in sport:
                    sport_key = 'NFL'
                elif 'MLB' in sport or 'Major League Baseball' in sport:
                    sport_key = 'MLB'
                elif 'CFB' in sport or 'College Football' in sport:
                    sport_key = 'CFB'
                elif 'WNBA' in sport or "Women's National Basketball" in sport:
                    sport_key = 'WNBA'
                else:
                    continue
                    
                sport_counts[sport_key] = sport_counts.get(sport_key, 0) + 1
            
            logger.info(f"📈 Available props by sport: {sport_counts}")
            return sport_counts
            
        except Exception as e:
            logger.error(f"Error checking available sports: {e}")
            return {}
    
    def calculate_pick_allocation(self, total_picks: int, available_sports: Dict[str, int], 
                                  sport_filter: Optional[str] = None) -> Dict[str, int]:
        """Calculate how many picks each sport agent should generate"""
        
        if sport_filter and sport_filter != 'all':
            # Single sport mode
            if sport_filter in available_sports and available_sports[sport_filter] > 0:
                return {sport_filter: total_picks}
            else:
                logger.warning(f"Sport {sport_filter} has no available props")
                return {}
        
        # Multi-sport mode - distribute based on availability
        total_props = sum(available_sports.values())
        if total_props == 0:
            return {}
        
        allocation = {}
        remaining_picks = total_picks
        
        # Sort sports by prop count (prioritize sports with more games)
        sorted_sports = sorted(available_sports.items(), key=lambda x: x[1], reverse=True)
        
        for i, (sport, prop_count) in enumerate(sorted_sports):
            if remaining_picks <= 0:
                break
                
            # Calculate proportion-based allocation
            if i == len(sorted_sports) - 1:
                # Last sport gets all remaining picks
                sport_picks = remaining_picks
            else:
                # Proportional allocation with minimum of 2 picks per sport
                proportion = prop_count / total_props
                sport_picks = max(2, int(total_picks * proportion))
                sport_picks = min(sport_picks, remaining_picks)
            
            allocation[sport] = sport_picks
            remaining_picks -= sport_picks
        
        logger.info(f"📊 Pick allocation: {allocation}")
        return allocation
    
    async def generate_picks(self, total_picks: int = 15, sport_filter: Optional[str] = None,
                            parallel: bool = True) -> Dict[str, Any]:
        """
        Generate picks using specialized agents
        
        Args:
            total_picks: Total number of picks to generate
            sport_filter: Specific sport or 'all' for multi-sport
            parallel: Run agents in parallel (faster) or sequential (easier to debug)
        """
        start_time = datetime.now()
        logger.info(f"🚀 Starting pick generation: {total_picks} picks for {sport_filter or 'all sports'}")
        
        # Check what's available
        available_sports = await self.check_available_sports()
        
        if not available_sports:
            logger.error("No sports have available props for the target date")
            return {'success': False, 'error': 'No props available', 'predictions': []}
        
        # Calculate allocation
        allocation = self.calculate_pick_allocation(total_picks, available_sports, sport_filter)
        
        if not allocation:
            logger.error("No valid allocation possible")
            return {'success': False, 'error': 'No valid sports for allocation', 'predictions': []}
        
        # Initialize agents that will be used
        init_tasks = []
        for sport in allocation.keys():
            init_tasks.append(self.agents[sport].initialize())
        
        if init_tasks:
            logger.info(f"⚙️ Initializing {len(init_tasks)} sport agents...")
            await asyncio.gather(*init_tasks)
        
        # Generate picks
        all_results = []
        
        if parallel:
            # Run all agents in parallel (faster)
            logger.info("⚡ Running agents in parallel mode...")
            tasks = []
            for sport, pick_count in allocation.items():
                if pick_count > 0:
                    logger.info(f"{self.agents[sport].get_sport_emoji()} Dispatching {sport} agent for {pick_count} picks")
                    tasks.append(self._run_agent_with_logging(sport, pick_count))
            
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for result in results:
                    if isinstance(result, Exception):
                        logger.error(f"Agent failed: {result}")
                    else:
                        all_results.append(result)
        else:
            # Run agents sequentially (easier to debug)
            logger.info("📝 Running agents in sequential mode...")
            for sport, pick_count in allocation.items():
                if pick_count > 0:
                    logger.info(f"{self.agents[sport].get_sport_emoji()} Running {sport} agent for {pick_count} picks")
                    try:
                        result = await self._run_agent_with_logging(sport, pick_count)
                        all_results.append(result)
                    except Exception as e:
                        logger.error(f"{sport} agent failed: {e}")
        
        # Compile final results
        total_stored = sum(r.get('predictions_stored', 0) for r in all_results)
        successful_agents = sum(1 for r in all_results if r.get('success', False))
        
        elapsed_time = (datetime.now() - start_time).total_seconds()
        
        final_result = {
            'success': total_stored > 0,
            'total_predictions_requested': total_picks,
            'total_predictions_stored': total_stored,
            'sports_covered': [r['sport'] for r in all_results if r.get('success')],
            'agents_used': f"{successful_agents}/{len(allocation)}",
            'execution_time': f"{elapsed_time:.1f}s",
            'allocation': allocation,
            'individual_results': all_results
        }
        
        logger.info(f"✅ Orchestration complete: {total_stored}/{total_picks} picks in {elapsed_time:.1f}s")
        return final_result
    
    async def _run_agent_with_logging(self, sport: str, pick_count: int) -> Dict[str, Any]:
        """Run a single agent with error handling"""
        try:
            agent = self.agents[sport]
            result = await agent.generate_picks(pick_count)
            
            if result.get('success'):
                logger.info(f"✅ {sport} agent completed: {result.get('predictions_stored', 0)} picks stored")
            else:
                logger.warning(f"⚠️ {sport} agent had issues: {result.get('error', 'Unknown error')}")
                
            return result
            
        except Exception as e:
            logger.error(f"❌ {sport} agent crashed: {e}")
            return {
                'success': False,
                'sport': sport,
                'predictions_stored': 0,
                'error': str(e)
            }


async def main():
    """Main entry point for the orchestrator"""
    parser = argparse.ArgumentParser(
        description="AI Sports Props Orchestrator - Coordinates specialized agents"
    )
    parser.add_argument(
        "--date",
        type=str,
        help="Target date (YYYY-MM-DD). Default: tomorrow",
        default=None
    )
    parser.add_argument(
        "--picks",
        type=int,
        help="Total picks to generate. Default: 15",
        default=15
    )
    parser.add_argument(
        "--sport",
        type=str,
        choices=["NFL", "MLB", "CFB", "WNBA", "all"],
        default="all",
        help="Focus on specific sport or all. Default: all"
    )
    parser.add_argument(
        "--sequential",
        action="store_true",
        help="Run agents sequentially instead of parallel (easier to debug)"
    )
    parser.add_argument(
        "--tomorrow",
        action="store_true",
        help="Generate picks for tomorrow"
    )
    
    args = parser.parse_args()
    
    # Determine target date
    if args.tomorrow or not args.date:
        target_date = (datetime.now().date() + timedelta(days=1)).isoformat()
    else:
        target_date = args.date
    
    # Print header
    print("\n" + "="*80)
    print("🎯 PROPS ORCHESTRATOR - MULTI-AGENT SYSTEM")
    print("="*80)
    print(f"📅 Date: {target_date}")
    print(f"🎲 Picks: {args.picks}")
    print(f"🏆 Sport: {args.sport}")
    print(f"⚡ Mode: {'Sequential' if args.sequential else 'Parallel'}")
    print("="*80 + "\n")
    
    # Create orchestrator
    orchestrator = PropsOrchestrator(target_date=target_date)
    
    # Generate picks
    try:
        results = await orchestrator.generate_picks(
            total_picks=args.picks,
            sport_filter=args.sport if args.sport != 'all' else None,
            parallel=not args.sequential
        )
        
        # Print results
        print("\n" + "="*80)
        print("📊 ORCHESTRATION RESULTS")
        print("="*80)
        print(f"✅ Success: {results.get('success', False)}")
        print(f"📈 Predictions Stored: {results.get('total_predictions_stored', 0)}/{results.get('total_predictions_requested', 0)}")
        print(f"🏅 Sports Covered: {', '.join(results.get('sports_covered', []))}")
        print(f"🤖 Agents Used: {results.get('agents_used', 'N/A')}")
        print(f"⏱️ Execution Time: {results.get('execution_time', 'N/A')}")
        print(f"📊 Allocation: {results.get('allocation', {})}")
        print("="*80)
        
        if results.get('success', False):
            print("🎉 SUCCESS! Picks generated by specialized agents!")
        else:
            print("❌ Failed to generate picks")
            
    except Exception as e:
        logger.error(f"Orchestration failed: {e}")
        print(f"\n❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    asyncio.run(main())
