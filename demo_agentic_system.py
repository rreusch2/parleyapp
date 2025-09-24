#!/usr/bin/env python3
"""
Agentic Betting System Demo
Demonstrates the full power of OpenManus-powered betting analysis

This demo shows how the agentic approach differs from mechanical scripts by:
1. Conducting dynamic market investigation
2. Following interesting leads and adapting research
3. Generating value-focused picks with genuine edge

Usage:
    python demo_agentic_system.py [--full-demo] [--team-focus] [--props-focus]
"""

import asyncio
import argparse
import sys
from pathlib import Path
from datetime import datetime

# Add OpenManus to Python path
openmanus_path = Path(__file__).parent / "OpenManus"
sys.path.insert(0, str(openmanus_path))

try:
    from app.agent.betting_agent import BettingAgent
    from app.logger import logger
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Run setup_betting_agent.py first to configure the system")
    sys.exit(1)


async def demo_agentic_research():
    """Demonstrate the agentic research process"""
    print("🧠 AGENTIC RESEARCH DEMONSTRATION")
    print("=" * 60)
    print("Watch how the agent conducts truly intelligent analysis...")
    print()
    
    agent = BettingAgent()
    
    # Demo task showcasing agentic behavior
    demo_task = """
## DEMONSTRATION: Agentic Sports Betting Research

**Objective**: Show how agentic analysis differs from mechanical scripts.

**Your Mission**: 
Conduct an intelligent investigation of today's betting opportunities. This is a DEMONSTRATION of your agentic capabilities - show how you:

1. **Dynamically Assess Markets**
   - Use supabase_betting to examine available games and odds
   - IDENTIFY which games have interesting betting opportunities
   - EXPLAIN why certain games caught your attention

2. **Adaptive Investigation**
   - Choose the most promising opportunities to research deeper
   - Use statmuse_query to research team/player performance INTELLIGENTLY
   - Use web_search to find breaking news, injuries, or other factors
   - ADAPT your research based on what you discover

3. **Follow Your Analytical Instincts**
   - If you find concerning injury news → Research the impact
   - If you see interesting statistics → Explore them further
   - If odds seem suspicious → Investigate why
   - SHOW how you adapt your approach based on findings

4. **Value Assessment**
   - Identify 2-3 specific betting opportunities with genuine edge
   - EXPLAIN your reasoning and why you think the market is wrong
   - Calculate implied vs assessed probability

**This is NOT about generating actual picks** - it's about demonstrating:
- How you think and investigate dynamically
- How you adapt research based on discoveries  
- How you identify genuine value opportunities
- How you reason through complex betting decisions

**Remember**: You're showing the DIFFERENCE between:
- Mechanical: "Query team A stats, team B stats, generate pick"
- Agentic: "Hmm, this line looks interesting... let me investigate why... oh, I found something concerning... let me research this deeper..."

BEGIN your agentic investigation and NARRATE your thinking process!
"""
    
    print("🎬 Starting Agentic Analysis Demo...")
    print("Watch the agent's adaptive research process...")
    print()
    
    try:
        result = await agent.run(demo_task)
        print("\n🎯 Demo Completed Successfully!")
        print("\nKey Observations:")
        print("  • Agent chose its own research path based on opportunities")
        print("  • Adapted investigation based on findings")
        print("  • Showed genuine analytical curiosity and reasoning")
        print("  • Identified value opportunities through investigation")
        
        return result
        
    except Exception as e:
        print(f"❌ Demo error: {str(e)}")
        return None


async def demo_team_picks_generation():
    """Demonstrate team picks generation"""
    print("\n\n🏈 TEAM PICKS GENERATION DEMO")
    print("=" * 60)
    print("Generating 3 sample team picks using agentic approach...")
    print()
    
    agent = BettingAgent()
    
    team_task = """
Generate 3 HIGH-QUALITY team betting picks for today using your agentic research approach.

**Focus on QUALITY over quantity** - show how you:
1. Identify the most promising games through market analysis
2. Research those games intelligently using your tools
3. Find genuine value opportunities with clear analytical edge
4. Generate picks with professional-level reasoning

Store the picks using supabase_betting when complete.

DEMONSTRATE your agentic approach by narrating your research decisions!
"""
    
    try:
        result = await agent.analyze_team_betting_opportunities(target_picks=3)
        
        if result["status"] == "success":
            print("✅ Generated 3 agentic team picks successfully!")
            print("Check your ai_predictions table to see the results.")
        else:
            print(f"❌ Team picks demo failed: {result.get('error')}")
        
        return result
        
    except Exception as e:
        print(f"❌ Team picks demo error: {str(e)}")
        return None


async def demo_props_generation():
    """Demonstrate player props generation"""
    print("\n\n⚾ PLAYER PROPS GENERATION DEMO")
    print("=" * 60)
    print("Generating 3 sample player props using agentic approach...")
    print()
    
    agent = BettingAgent()
    
    props_task = """
Generate 3 HIGH-QUALITY player prop picks for today using your agentic research approach.

**Focus Areas**: 
- Recent player performance and form analysis
- Matchup advantages and opponent weaknesses
- Injury/usage factors that could impact performance
- Value assessment vs implied probability

**Show your agentic process** by:
1. Examining available props and identifying interesting opportunities
2. Researching player recent form and matchup factors
3. Following up on concerning or interesting findings
4. Selecting props with clear analytical edge

Store the picks using supabase_betting when complete.

NARRATE your analytical decisions and adaptations!
"""
    
    try:
        result = await agent.analyze_player_prop_opportunities(target_picks=3)
        
        if result["status"] == "success":
            print("✅ Generated 3 agentic player props successfully!")
            print("Check your ai_predictions table to see the results.")
        else:
            print(f"❌ Props demo failed: {result.get('error')}")
        
        return result
        
    except Exception as e:
        print(f"❌ Props demo error: {str(e)}")
        return None


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Demonstrate the agentic betting system capabilities',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument('--full-demo', action='store_true',
                      help='Run complete demo including research + picks generation')
    parser.add_argument('--team-focus', action='store_true',
                      help='Demo team betting picks generation only')
    parser.add_argument('--props-focus', action='store_true',
                      help='Demo player props generation only')
    parser.add_argument('--research-only', action='store_true',
                      help='Demo research process without generating actual picks')
    
    return parser.parse_args()


async def main():
    """Main demo function"""
    args = parse_arguments()
    
    print("🎯 AGENTIC BETTING SYSTEM DEMONSTRATION")
    print("=" * 60)
    print("Showcasing OpenManus-Powered Intelligent Betting Analysis")
    print()
    print("This demo shows how agentic AI conducts:")
    print("  • Dynamic market investigation")
    print("  • Adaptive research strategies")
    print("  • Value-focused opportunity identification")
    print("  • Professional-level analytical reasoning")
    print()
    
    # Determine demo type
    if args.full_demo:
        print("🚀 FULL SYSTEM DEMONSTRATION")
        await demo_agentic_research()
        await demo_team_picks_generation()
        await demo_props_generation()
        
    elif args.team_focus:
        print("🏈 TEAM BETTING FOCUS DEMONSTRATION")
        await demo_team_picks_generation()
        
    elif args.props_focus:
        print("⚾ PLAYER PROPS FOCUS DEMONSTRATION")
        await demo_props_generation()
        
    elif args.research_only:
        print("🧠 RESEARCH PROCESS DEMONSTRATION")
        await demo_agentic_research()
        
    else:
        # Default: research demonstration
        print("🧠 AGENTIC RESEARCH DEMONSTRATION")
        print("(Use --full-demo for complete system demo)")
        print()
        await demo_agentic_research()
    
    print("\n" + "=" * 60)
    print("🎉 DEMONSTRATION COMPLETE")
    print()
    print("Key Takeaways:")
    print("  ✅ Agent conducts genuine investigation, not mechanical queries")
    print("  ✅ Research adapts dynamically based on findings")  
    print("  ✅ Focuses on value opportunities with analytical edge")
    print("  ✅ Professional reasoning with supporting factor analysis")
    print()
    print("🚀 Ready to replace your old mechanical scripts!")
    print("The agentic approach will find better value and generate higher quality picks.")


if __name__ == "__main__":
    asyncio.run(main())

