#!/usr/bin/env python3
"""
Enhanced Sports Betting AI Orchestrator with Scrapy Integration
Coordinates enhanced agents with web scraping intelligence for superior betting analysis
Replaces main.py with enhanced data collection and processing capabilities
"""

import os
import sys
import json
import logging
import asyncio
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import our enhanced AI agents and services
try:
    from enhanced_props_agent import EnhancedPropsAgent
    from enhanced_teams_agent import EnhancedTeamsAgent
    from scrapy_integration_service import scrapy_service, ScrapedData
except ImportError as e:
    print(f"❌ Failed to import enhanced agents: {e}")
    print("Make sure enhanced_props_agent.py, enhanced_teams_agent.py, and scrapy_integration_service.py are available")
    sys.exit(1)

# Load environment variables
load_dotenv('backend/.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EnhancedSportsBettingOrchestrator:
    """Enhanced orchestrator with Scrapy integration for superior betting intelligence"""
    
    def __init__(self):
        logger.info("🚀 Initializing ENHANCED Sports Betting Orchestrator with Scrapy Integration")
        self.props_agent = None
        self.teams_agent = None
        self.scrapy_service = scrapy_service
        self.last_scrapy_refresh = None
        
        # Initialize enhanced agents
        try:
            self.props_agent = EnhancedPropsAgent()
            logger.info("✅ Enhanced Player Props Agent initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Enhanced Player Props Agent: {e}")
        
        try:
            self.teams_agent = EnhancedTeamsAgent()
            logger.info("✅ Enhanced Team Betting Agent initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Enhanced Team Betting Agent: {e}")
        
        logger.info("🕷️ Scrapy Integration Service ready")
    
    async def refresh_scrapy_data(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Refresh Scrapy data if needed"""
        
        # Check if refresh is needed
        if not force_refresh and self.last_scrapy_refresh:
            time_since_refresh = datetime.now() - self.last_scrapy_refresh
            if time_since_refresh < timedelta(hours=1):  # Refresh every hour
                logger.info(f"🕷️ Scrapy data is fresh (last refresh: {time_since_refresh} ago)")
                return {"status": "skipped", "reason": "data_fresh"}
        
        logger.info("🕷️ Refreshing Scrapy web scraping data...")
        
        try:
            refresh_result = await self.scrapy_service.refresh_all_data()
            self.last_scrapy_refresh = datetime.now()
            
            logger.info(f"✅ Scrapy refresh completed: {refresh_result['scraped_data_count']} datasets")
            logger.info(f"   News: {refresh_result.get('news_count', 0)}")
            logger.info(f"   Player Stats: {refresh_result.get('player_stats_count', 0)}")
            logger.info(f"   Team Performance: {refresh_result.get('team_performance_count', 0)}")
            
            return refresh_result
            
        except Exception as e:
            logger.error(f"❌ Scrapy refresh failed: {e}")
            return {"status": "failed", "error": str(e)}
    
    async def generate_enhanced_daily_picks(
        self, 
        props_count: int = 10, 
        teams_count: int = 10,
        test_mode: bool = False,
        force_scrapy_refresh: bool = False
    ) -> Dict[str, Any]:
        """Generate comprehensive daily picks with enhanced Scrapy intelligence"""
        
        logger.info("=" * 100)
        logger.info("🔥 ENHANCED DAILY PICKS GENERATION WITH SCRAPY INTELLIGENCE")
        logger.info("=" * 100)
        logger.info(f"📊 Target: {props_count} enhanced props + {teams_count} enhanced teams = {props_count + teams_count} total")
        logger.info(f"🧪 Test Mode: {'ON' if test_mode else 'OFF'}")
        logger.info(f"🕷️ Force Scrapy Refresh: {'ON' if force_scrapy_refresh else 'OFF'}")
        logger.info(f"⏰ Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("")
        
        results = {
            "enhanced_props_picks": [],
            "enhanced_team_picks": [],
            "total_picks": 0,
            "generation_time": datetime.now().isoformat(),
            "test_mode": test_mode,
            "scrapy_data_used": False,
            "scrapy_refresh_result": {},
            "success": False,
            "errors": [],
            "performance_metrics": {
                "scrapy_refresh_time": 0,
                "props_generation_time": 0,
                "teams_generation_time": 0,
                "total_time": 0
            }
        }
        
        start_time = datetime.now()
        
        # STAGE 0: Enhanced Data Collection with Scrapy
        logger.info("🕷️ STAGE 0: Enhanced Web Scraping Data Collection")
        logger.info("-" * 60)
        
        scrapy_start = datetime.now()
        scrapy_result = await self.refresh_scrapy_data(force_refresh=force_scrapy_refresh)
        scrapy_time = (datetime.now() - scrapy_start).total_seconds()
        
        results["scrapy_refresh_result"] = scrapy_result
        results["scrapy_data_used"] = scrapy_result.get("status") != "failed"
        results["performance_metrics"]["scrapy_refresh_time"] = scrapy_time
        
        if scrapy_result.get("status") == "failed":
            logger.warning("⚠️ Scrapy refresh failed, proceeding with cached data")
        else:
            logger.info(f"✅ Scrapy data ready ({scrapy_time:.1f}s)")
        
        logger.info("")
        
        # STAGE 1: Generate Enhanced Player Props Picks
        if self.props_agent:
            try:
                logger.info("🎲 STAGE 1: Generating ENHANCED Player Props Picks")
                logger.info("-" * 60)
                
                props_start = datetime.now()
                props_picks = await self.props_agent.generate_daily_picks(target_picks=props_count)
                props_time = (datetime.now() - props_start).total_seconds()
                
                results["enhanced_props_picks"] = props_picks
                results["performance_metrics"]["props_generation_time"] = props_time
                
                logger.info(f"✅ Generated {len(props_picks)} ENHANCED player props picks ({props_time:.1f}s)")
                
                # Enhanced analytics for props
                if props_picks:
                    scrapy_enhanced_count = sum(1 for pick in props_picks if pick.get('metadata', {}).get('scrapy_insights_used'))
                    confidence_avg = sum(pick['confidence'] for pick in props_picks) / len(props_picks)
                    logger.info(f"   📊 Scrapy-enhanced picks: {scrapy_enhanced_count}/{len(props_picks)}")
                    logger.info(f"   📈 Average confidence: {confidence_avg:.1f}%")
                
                logger.info("")
                
            except Exception as e:
                error_msg = f"Failed to generate enhanced player props picks: {e}"
                logger.error(f"❌ {error_msg}")
                results["errors"].append(error_msg)
        else:
            error_msg = "Enhanced Player Props Agent not available"
            logger.warning(f"⚠️ {error_msg}")
            results["errors"].append(error_msg)
        
        # STAGE 2: Generate Enhanced Team Betting Picks
        if self.teams_agent:
            try:
                logger.info("🏈 STAGE 2: Generating ENHANCED Team Betting Picks")
                logger.info("-" * 60)
                
                teams_start = datetime.now()
                team_picks = await self.teams_agent.generate_daily_picks(target_picks=teams_count)
                teams_time = (datetime.now() - teams_start).total_seconds()
                
                results["enhanced_team_picks"] = team_picks
                results["performance_metrics"]["teams_generation_time"] = teams_time
                
                logger.info(f"✅ Generated {len(team_picks)} ENHANCED team betting picks ({teams_time:.1f}s)")
                
                # Enhanced analytics for teams
                if team_picks:
                    scrapy_enhanced_count = sum(1 for pick in team_picks if pick.get('metadata', {}).get('scrapy_insights_used'))
                    confidence_avg = sum(pick['confidence'] for pick in team_picks) / len(team_picks)
                    logger.info(f"   📊 Scrapy-enhanced picks: {scrapy_enhanced_count}/{len(team_picks)}")
                    logger.info(f"   📈 Average confidence: {confidence_avg:.1f}%")
                
                logger.info("")
                
            except Exception as e:
                error_msg = f"Failed to generate enhanced team betting picks: {e}"
                logger.error(f"❌ {error_msg}")
                results["errors"].append(error_msg)
        else:
            error_msg = "Enhanced Team Betting Agent not available"
            logger.warning(f"⚠️ {error_msg}")
            results["errors"].append(error_msg)
        
        # STAGE 3: Enhanced Summary and Results
        total_picks = len(results["enhanced_props_picks"]) + len(results["enhanced_team_picks"])
        total_time = (datetime.now() - start_time).total_seconds()
        
        results["total_picks"] = total_picks
        results["success"] = total_picks > 0
        results["performance_metrics"]["total_time"] = total_time
        
        logger.info("=" * 100)
        logger.info("📊 ENHANCED GENERATION SUMMARY")
        logger.info("=" * 100)
        logger.info(f"🎯 Enhanced Props: {len(results['enhanced_props_picks'])}/{props_count}")
        logger.info(f"🏈 Enhanced Teams: {len(results['enhanced_team_picks'])}/{teams_count}")
        logger.info(f"📈 Total Generated: {total_picks}/{props_count + teams_count}")
        logger.info(f"🕷️ Scrapy Data Used: {'YES' if results['scrapy_data_used'] else 'NO'}")
        logger.info(f"⏱️ Performance:")
        logger.info(f"   Scrapy Refresh: {scrapy_time:.1f}s")
        logger.info(f"   Props Generation: {results['performance_metrics']['props_generation_time']:.1f}s")
        logger.info(f"   Teams Generation: {results['performance_metrics']['teams_generation_time']:.1f}s")
        logger.info(f"   Total Time: {total_time:.1f}s")
        
        if results["errors"]:
            logger.info(f"⚠️ Errors: {len(results['errors'])}")
            for error in results["errors"]:
                logger.info(f"   - {error}")
        
        if total_picks > 0:
            logger.info("✅ ENHANCED daily picks generation completed successfully!")
            
            # Calculate enhanced metrics
            all_picks = results["enhanced_props_picks"] + results["enhanced_team_picks"]
            scrapy_enhanced_total = sum(1 for pick in all_picks if pick.get('metadata', {}).get('scrapy_insights_used'))
            avg_confidence = sum(pick['confidence'] for pick in all_picks) / len(all_picks) if all_picks else 0
            
            logger.info(f"🔥 ENHANCED ADVANTAGE SUMMARY:")
            logger.info(f"   📊 Scrapy-Enhanced Picks: {scrapy_enhanced_total}/{total_picks} ({scrapy_enhanced_total/total_picks*100:.1f}%)")
            logger.info(f"   📈 Average Confidence: {avg_confidence:.1f}%")
            logger.info(f"   🎯 Data Sources: StatMuse + Web Search + Scrapy Intelligence")
        else:
            logger.warning("❌ No enhanced picks were generated")
        
        logger.info("")
        return results
    
    async def run_enhanced_props_only(self, count: int = 10, test_mode: bool = False, force_scrapy_refresh: bool = False) -> List[Dict[str, Any]]:
        """Run only enhanced player props generation"""
        logger.info(f"🎲 Running ENHANCED Player Props Only (Target: {count})")
        
        if not self.props_agent:
            logger.error("❌ Enhanced Player Props Agent not available")
            return []
        
        # Refresh Scrapy data first
        await self.refresh_scrapy_data(force_refresh=force_scrapy_refresh)
        
        try:
            picks = await self.props_agent.generate_daily_picks(target_picks=count)
            logger.info(f"✅ Generated {len(picks)} ENHANCED player props picks")
            return picks
        except Exception as e:
            logger.error(f"❌ Enhanced player props generation failed: {e}")
            return []
    
    async def run_enhanced_teams_only(self, count: int = 10, test_mode: bool = False, force_scrapy_refresh: bool = False) -> List[Dict[str, Any]]:
        """Run only enhanced team betting generation"""
        logger.info(f"🏈 Running ENHANCED Team Betting Only (Target: {count})")
        
        if not self.teams_agent:
            logger.error("❌ Enhanced Team Betting Agent not available")
            return []
        
        # Refresh Scrapy data first
        await self.refresh_scrapy_data(force_refresh=force_scrapy_refresh)
        
        try:
            picks = await self.teams_agent.generate_daily_picks(target_picks=count)
            logger.info(f"✅ Generated {len(picks)} ENHANCED team betting picks")
            return picks
        except Exception as e:
            logger.error(f"❌ Enhanced team betting generation failed: {e}")
            return []
    
    async def run_scrapy_data_collection_only(self) -> Dict[str, Any]:
        """Run only Scrapy data collection for testing/maintenance"""
        logger.info("🕷️ Running Scrapy Data Collection Only")
        
        try:
            result = await self.refresh_scrapy_data(force_refresh=True)
            logger.info("✅ Scrapy data collection completed")
            return result
        except Exception as e:
            logger.error(f"❌ Scrapy data collection failed: {e}")
            return {"status": "failed", "error": str(e)}
    
    def display_enhanced_picks_summary(self, results: Dict[str, Any]):
        """Display a formatted summary of all enhanced picks"""
        
        if not results.get("success"):
            logger.warning("No enhanced picks to display")
            return
        
        logger.info("")
        logger.info("=" * 100)
        logger.info("🔥 ENHANCED DAILY PICKS SUMMARY WITH SCRAPY INTELLIGENCE")
        logger.info("=" * 100)
        
        # Display Enhanced Player Props
        if results["enhanced_props_picks"]:
            logger.info("")
            logger.info("🎲 ENHANCED PLAYER PROPS PICKS:")
            for i, pick in enumerate(results["enhanced_props_picks"], 1):
                meta = pick.get('metadata', {})
                scrapy_edge = meta.get('scrapy_edge', 'No scrapy advantage listed')
                logger.info("")
                logger.info(f"  {i}. {pick['pick']}")
                logger.info(f"     Odds: {pick['odds']} | Confidence: {pick['confidence']}%")
                logger.info(f"     Game: {pick['match_teams']}")
                logger.info(f"     🕷️ Scrapy Edge: {scrapy_edge}")
                if meta.get('reasoning'):
                    reasoning = meta['reasoning'][:150] + "..." if len(meta['reasoning']) > 150 else meta['reasoning']
                    logger.info(f"     Reasoning: {reasoning}")
                if meta.get('key_factors'):
                    factors = ", ".join(meta['key_factors'][:3])
                    logger.info(f"     Key Factors: {factors}")
        
        # Display Enhanced Team Bets
        if results["enhanced_team_picks"]:
            logger.info("")
            logger.info("🏈 ENHANCED TEAM BETTING PICKS:")
            for i, pick in enumerate(results["enhanced_team_picks"], 1):
                meta = pick.get('metadata', {})
                scrapy_edge = meta.get('scrapy_edge', 'No scrapy advantage listed')
                logger.info("")
                logger.info(f"  {i}. {pick['pick']}")
                logger.info(f"     Odds: {pick['odds']} | Confidence: {pick['confidence']}%")
                logger.info(f"     Game: {pick['match_teams']}")
                logger.info(f"     🕷️ Scrapy Edge: {scrapy_edge}")
                if meta.get('reasoning'):
                    reasoning = meta['reasoning'][:150] + "..." if len(meta['reasoning']) > 150 else meta['reasoning']
                    logger.info(f"     Reasoning: {reasoning}")
                if meta.get('key_factors'):
                    factors = ", ".join(meta['key_factors'][:3])
                    logger.info(f"     Key Factors: {factors}")
        
        # Enhanced Summary Stats
        all_picks = results["enhanced_props_picks"] + results["enhanced_team_picks"]
        if all_picks:
            scrapy_enhanced_count = sum(1 for pick in all_picks if pick.get('metadata', {}).get('scrapy_insights_used'))
            high_confidence_count = sum(1 for pick in all_picks if pick['confidence'] >= 70)
            
            logger.info("")
            logger.info("🔥 ENHANCED ADVANTAGE METRICS:")
            logger.info(f"   📊 Total Picks: {len(all_picks)}")
            logger.info(f"   🕷️ Scrapy-Enhanced: {scrapy_enhanced_count} ({scrapy_enhanced_count/len(all_picks)*100:.1f}%)")
            logger.info(f"   📈 High Confidence (70%+): {high_confidence_count} ({high_confidence_count/len(all_picks)*100:.1f}%)")
            logger.info(f"   ⏱️ Generation Time: {results['performance_metrics']['total_time']:.1f}s")
        
        logger.info("")
        logger.info("=" * 100)

async def main():
    """Main execution function with enhanced command line arguments"""
    parser = argparse.ArgumentParser(description='Enhanced Sports Betting AI Orchestrator with Scrapy Integration')
    parser.add_argument('--mode', choices=['both', 'props', 'teams', 'scrapy'], default='both',
                       help='Which component to run (default: both)')
    parser.add_argument('--props-count', type=int, default=10,
                       help='Number of enhanced player props picks to generate (default: 10)')
    parser.add_argument('--teams-count', type=int, default=10,
                       help='Number of enhanced team betting picks to generate (default: 10)')
    parser.add_argument('--test', action='store_true',
                       help='Run in test mode (may not save to database)')
    parser.add_argument('--summary', action='store_true',
                       help='Display detailed enhanced picks summary')
    parser.add_argument('--force-scrapy-refresh', action='store_true',
                       help='Force refresh of Scrapy data regardless of cache')
    parser.add_argument('--scrapy-only', action='store_true',
                       help='Run only Scrapy data collection (same as --mode scrapy)')
    
    args = parser.parse_args()
    
    # Handle scrapy-only flag
    if args.scrapy_only:
        args.mode = 'scrapy'
    
    logger.info("🤖 Starting ENHANCED Sports Betting AI Orchestrator with Scrapy Integration")
    logger.info(f"📋 Mode: {args.mode}")
    logger.info(f"🎯 Targets: {args.props_count} enhanced props, {args.teams_count} enhanced teams")
    logger.info(f"🧪 Test Mode: {args.test}")
    logger.info(f"🕷️ Force Scrapy Refresh: {args.force_scrapy_refresh}")
    logger.info("")
    
    # Initialize enhanced orchestrator
    orchestrator = EnhancedSportsBettingOrchestrator()
    
    try:
        if args.mode == 'both':
            # Run both enhanced agents
            results = await orchestrator.generate_enhanced_daily_picks(
                props_count=args.props_count,
                teams_count=args.teams_count,
                test_mode=args.test,
                force_scrapy_refresh=args.force_scrapy_refresh
            )
            
            if args.summary:
                orchestrator.display_enhanced_picks_summary(results)
            
        elif args.mode == 'props':
            # Run only enhanced player props
            picks = await orchestrator.run_enhanced_props_only(
                count=args.props_count,
                test_mode=args.test,
                force_scrapy_refresh=args.force_scrapy_refresh
            )
            
        elif args.mode == 'teams':
            # Run only enhanced team betting
            picks = await orchestrator.run_enhanced_teams_only(
                count=args.teams_count,
                test_mode=args.test,
                force_scrapy_refresh=args.force_scrapy_refresh
            )
            
        elif args.mode == 'scrapy':
            # Run only Scrapy data collection
            result = await orchestrator.run_scrapy_data_collection_only()
            logger.info(f"🕷️ Scrapy collection result: {result}")
        
        logger.info("✅ Enhanced Orchestrator completed successfully!")
        
    except KeyboardInterrupt:
        logger.info("⏹️ Enhanced Orchestrator interrupted by user")
    except Exception as e:
        logger.error(f"❌ Enhanced Orchestrator failed: {e}")
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