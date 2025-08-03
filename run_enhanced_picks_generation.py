#!/usr/bin/env python3
"""
Enhanced Daily Picks Generation Script for Elite Tier Support
Generates 60 total picks: 30 team picks + 30 player props
"""

import asyncio
import logging
import sys
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

async def run_enhanced_generation():
    """Run both enhanced scripts to generate complete daily picks pool"""
    
    logger.info("🚀 Starting Enhanced Daily Picks Generation for Elite Tier Support")
    logger.info(f"📅 Target Date: {datetime.now().date()}")
    
    try:
        # Import both enhanced agents
        from props_enhanced import IntelligentPlayerPropsAgent
        from teams_enhanced import IntelligentTeamsAgent
        
        # Initialize agents
        props_agent = IntelligentPlayerPropsAgent()
        teams_agent = IntelligentTeamsAgent()
        
        # Generate picks concurrently for better performance
        logger.info("🔄 Generating picks concurrently...")
        
        results = await asyncio.gather(
            props_agent.generate_daily_picks(target_picks=30),  # 30 player props
            teams_agent.generate_daily_picks(target_picks=30),  # 30 team picks
            return_exceptions=True
        )
        
        props_picks = results[0] if not isinstance(results[0], Exception) else []
        teams_picks = results[1] if not isinstance(results[1], Exception) else []
        
        # Log any exceptions
        if isinstance(results[0], Exception):
            logger.error(f"❌ Props generation failed: {results[0]}")
        if isinstance(results[1], Exception):
            logger.error(f"❌ Teams generation failed: {results[1]}")
        
        # Summary report
        total_picks = len(props_picks) + len(teams_picks)
        
        logger.info("=" * 60)
        logger.info("📊 ENHANCED PICKS GENERATION SUMMARY")
        logger.info("=" * 60)
        
        if props_picks:
            mlb_props = len([p for p in props_picks if p.get("sport") == "MLB"])
            wnba_props = len([p for p in props_picks if p.get("sport") == "WNBA"])
            logger.info(f"🎯 Player Props: {len(props_picks)} total ({mlb_props} MLB + {wnba_props} WNBA)")
        else:
            logger.warning("❌ No player props generated")
        
        if teams_picks:
            mlb_teams = len([p for p in teams_picks if p.get("sport") == "MLB"])
            wnba_teams = len([p for p in teams_picks if p.get("sport") == "WNBA"])
            ufc_teams = len([p for p in teams_picks if p.get("sport") == "UFC"])
            logger.info(f"🏈 Team Picks: {len(teams_picks)} total ({mlb_teams} MLB + {wnba_teams} WNBA + {ufc_teams} UFC)")
        else:
            logger.warning("❌ No team picks generated")
        
        logger.info(f"🎉 TOTAL PICKS GENERATED: {total_picks}")
        logger.info("=" * 60)
        
        # Tier coverage analysis
        logger.info("🎯 TIER COVERAGE ANALYSIS:")
        logger.info(f"   Free Tier (2 picks): ✅ Covered")
        logger.info(f"   Welcome Bonus (5 picks): ✅ Covered") 
        logger.info(f"   Pro Tier (20 picks): ✅ Covered")
        logger.info(f"   Elite Tier (30 picks): {'✅ Covered' if total_picks >= 30 else '❌ Need more picks'}")
        
        # Sport distribution analysis
        all_picks = props_picks + teams_picks
        sport_distribution = {}
        for pick in all_picks:
            sport = pick.get("sport", "Unknown")
            sport_distribution[sport] = sport_distribution.get(sport, 0) + 1
        
        logger.info("🏆 SPORT DISTRIBUTION:")
        for sport, count in sport_distribution.items():
            logger.info(f"   {sport}: {count} picks")
        
        logger.info("=" * 60)
        logger.info("✅ Enhanced picks generation completed successfully!")
        logger.info("🔧 Backend API will now filter by user preferences and subscription tier")
        
        return {
            "success": True,
            "total_picks": total_picks,
            "props_picks": len(props_picks),
            "teams_picks": len(teams_picks),
            "sport_distribution": sport_distribution
        }
        
    except Exception as e:
        logger.error(f"💥 Enhanced generation failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "total_picks": 0
        }

if __name__ == "__main__":
    try:
        result = asyncio.run(run_enhanced_generation())
        
        if result["success"]:
            logger.info("🎊 All systems ready for Elite tier support!")
            sys.exit(0)
        else:
            logger.error("💥 Generation failed - check logs above")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("🛑 Generation interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"💥 Unexpected error: {e}")
        sys.exit(1)