#!/usr/bin/env python3
"""
Daily Professor Lock Insights Generator with StatMuse MCP Client
Demonstrates integration with the StatMuse MCP Server
"""

import requests
import json
import os
from datetime import datetime, date, timedelta
from supabase import create_client, Client
import logging
from dotenv import load_dotenv
import asyncio

# Import our StatMuse MCP Client
from statmuse_mcp_client import StatMuseMCPClient, StatMuseResponse

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MCPEnhancedInsightsGenerator:
    """Enhanced Daily Insights using StatMuse MCP Server"""
    
    def __init__(self):
        # Initialize Supabase client
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables")
        
        logger.info(f"Connecting to Supabase...")
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Backend API settings
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:3001')
        self.user_id = "admin_insights_generator"
    
    def fetch_upcoming_games_with_odds(self):
        """Fetch upcoming games with odds from database"""
        try:
            logger.info("📊 Fetching upcoming games with odds...")
            
            result = self.supabase.table('sports_events').select(
                'id, home_team, away_team, start_time, sport, metadata'
            ).gte(
                'start_time', datetime.now().isoformat()
            ).lte(
                'start_time', (datetime.now() + timedelta(days=2)).isoformat()
            ).eq(
                'status', 'scheduled'
            ).order('start_time').limit(10).execute()
            
            if not result.data:
                logger.warning("No upcoming games found")
                return []
            
            games_with_odds = []
            for game in result.data:
                if (game.get('metadata') and 
                    game['metadata'].get('full_data') and 
                    game['metadata']['full_data'].get('bookmakers')):
                    
                    bookmakers = game['metadata']['full_data']['bookmakers']
                    
                    games_with_odds.append({
                        'id': game['id'],
                        'home_team': game['home_team'],
                        'away_team': game['away_team'],
                        'start_time': game['start_time'],
                        'sport': game['sport'],
                        'bookmaker_count': len(bookmakers)
                    })
            
            logger.info(f"✅ Found {len(games_with_odds)} upcoming games with odds")
            return games_with_odds
            
        except Exception as e:
            logger.error(f"Error fetching upcoming games: {e}")
            return []
    
    async def gather_mcp_statmuse_data(self, games):
        """Gather StatMuse data using MCP client"""
        try:
            logger.info("📊 Gathering StatMuse data via MCP client...")
            
            statmuse_data = {
                'head_to_head': [],
                'recent_performance': [],
                'home_away_splits': [],
                'team_records': []
            }
            
            # Use StatMuse MCP Client
            async with StatMuseMCPClient() as client:
                # Generate intelligent queries for first 3 games
                for game in games[:3]:
                    home_team = game['home_team']
                    away_team = game['away_team']
                    
                    # Head-to-head data
                    h2h_result = await client.get_head_to_head(away_team, home_team, 5)
                    if h2h_result.success:
                        statmuse_data['head_to_head'].append({
                            'query': f"{away_team} vs {home_team} last 5 meetings",
                            'answer': h2h_result.data,
                            'cached': h2h_result.cached
                        })
                    
                    # Recent performance
                    away_perf = await client.get_recent_performance(away_team, 10)
                    if away_perf.success:
                        statmuse_data['recent_performance'].append({
                            'query': f"{away_team} last 10 games",
                            'answer': away_perf.data,
                            'cached': away_perf.cached
                        })
                    
                    # Home/away splits
                    home_record = await client.get_team_record(home_team, "home")
                    if home_record.success:
                        statmuse_data['home_away_splits'].append({
                            'query': f"{home_team} home record",
                            'answer': home_record.data,
                            'cached': home_record.cached
                        })
                    
                    away_record = await client.get_team_record(away_team, "away")
                    if away_record.success:
                        statmuse_data['home_away_splits'].append({
                            'query': f"{away_team} away record",
                            'answer': away_record.data,
                            'cached': away_record.cached
                        })
            
            total_results = sum(len(category) for category in statmuse_data.values())
            logger.info(f"✅ Gathered {total_results} StatMuse results via MCP")
            
            return statmuse_data
            
        except Exception as e:
            logger.error(f"Error gathering MCP StatMuse data: {e}")
            return {
                'head_to_head': [],
                'recent_performance': [],
                'home_away_splits': [],
                'team_records': []
            }
    
    def format_games_data(self, games):
        """Format games data for AI"""
        formatted_games = "📊 **UPCOMING GAMES WITH ODDS:**\n\n"
        
        for i, game in enumerate(games[:6], 1):
            start_time = datetime.fromisoformat(game['start_time'].replace('Z', '+00:00'))
            game_time = start_time.strftime('%I:%M %p ET')
            
            formatted_games += f"{i}. **{game['away_team']} @ {game['home_team']}** - {game_time}\n"
            formatted_games += f"   📚 {game['bookmaker_count']} sportsbooks\n\n"
        
        return formatted_games
    
    async def generate_mcp_enhanced_insights(self, games, statmuse_data):
        """Generate insights using MCP-gathered StatMuse data"""
        try:
            logger.info("🧠 Generating MCP-enhanced insights...")
            
            games_data = self.format_games_data(games)
            
            # Format StatMuse data
            statmuse_summary = "🎯 **REAL STATMUSE DATA (via MCP Server):**\n\n"
            
            if statmuse_data['head_to_head']:
                statmuse_summary += "**HEAD-TO-HEAD HISTORY:**\n"
                for h2h in statmuse_data['head_to_head'][:3]:
                    cached_indicator = " (cached)" if h2h.get('cached') else ""
                    statmuse_summary += f"• {h2h['answer']}{cached_indicator}\n"
                statmuse_summary += "\n"
            
            if statmuse_data['recent_performance']:
                statmuse_summary += "**RECENT TEAM PERFORMANCE:**\n"
                for perf in statmuse_data['recent_performance'][:3]:
                    cached_indicator = " (cached)" if perf.get('cached') else ""
                    statmuse_summary += f"• {perf['answer']}{cached_indicator}\n"
                statmuse_summary += "\n"
            
            if statmuse_data['home_away_splits']:
                statmuse_summary += "**HOME/AWAY SPLITS:**\n"
                for split in statmuse_data['home_away_splits'][:4]:
                    cached_indicator = " (cached)" if split.get('cached') else ""
                    statmuse_summary += f"• {split['answer']}{cached_indicator}\n"
                statmuse_summary += "\n"
            
            # Create AI prompt
            prompt = f"""Professor Lock, analyze today's MLB slate using real StatMuse data from our MCP server:

{games_data}

{statmuse_summary}

🎯 **GENERATE ANALYTICAL INSIGHTS:**

**REQUIREMENTS:**
- Use the REAL StatMuse data above (note which data is cached for performance)
- Generate 6-8 analytical insights
- Present data and trends, let users draw conclusions
- Use "StatMuse shows..." when referencing the data
- NO betting picks or recommendations - just analysis
- Professional, informational tone

**FORBIDDEN:**
- NO specific betting advice ("take the over", "back the ML")
- NO promotional language ("easy money", "lock", "juice")
- NO questions or calls to action
- NO conclusion statements

Generate insights that present the data and analysis clearly."""

            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "mcp_enhanced_insights",
                    "userTier": "pro"
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=90)
            
            if response.status_code == 200:
                result = response.json()
                insights = result.get('response', '')
                logger.info("✅ Generated MCP-enhanced insights")
                return insights
            else:
                logger.error(f"Insights generation failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating MCP-enhanced insights: {e}")
            return None
    
    def parse_insights(self, insights_text):
        """Parse insights with improved filtering"""
        if not insights_text:
            return []
        
        logger.info("📋 Parsing MCP-enhanced insights...")
        
        insights = []
        lines = insights_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Remove numbering and formatting
            if line and line[0].isdigit() and '.' in line[:3]:
                line = line.split('.', 1)[1].strip()
            line = line.replace('**', '').replace('*', '').replace('- ', '')
            
            # Enhanced filtering
            if (len(line) > 30 and
                not line.lower().startswith(('here are', 'here\'s', 'let me', 'i\'ll', 'there it is')) and
                not any(meta in line.lower() for meta in ['research', 'analysis', 'insights', 'generate']) and
                not any(pick in line.lower() for pick in ['take the', 'back the', 'pound the', 'hammer', 'fade', 'smash', 'solid play', 'easy money', 'strong pick']) and
                not any(conclusion in line.lower() for conclusion in ['which game you', 'let\'s roll', 'cash roll', 'want me to', 'ready to parlay']) and
                not any(promo in line.lower() for promo in ['bankroll builder', 'watch the cash', 'safe bet to pad'])):
                
                insights.append(line)
                logger.info(f"✅ Parsed insight: {line[:80]}...")
        
        logger.info(f"📊 Extracted {len(insights)} clean insights")
        return insights[:8]  # Max 8 insights
    
    def store_insights(self, insights, intro_message=None):
        """Store insights in database"""
        try:
            logger.info("💾 Storing MCP-enhanced insights...")
            
            # Clear existing insights for today
            today = date.today().isoformat()
            self.supabase.table('daily_professor_insights').delete().gte('created_at', today).execute()
            
            # Store intro if provided
            if intro_message:
                intro_record = {
                    'insight_text': intro_message,
                    'insight_order': 1,
                    'title': 'Professor Lock Daily Greeting',
                    'description': intro_message,
                    'category': 'intro',
                    'confidence': 90,
                    'impact': 'high',
                    'research_sources': ['Professor Lock AI', 'StatMuse MCP Server'],
                    'created_at': datetime.now().isoformat()
                }
                self.supabase.table('daily_professor_insights').insert(intro_record).execute()
                logger.info("💾 Stored intro message")
            
            # Store insights
            start_order = 2 if intro_message else 1
            
            for i, insight in enumerate(insights):
                # Basic categorization
                category = 'trends'
                if 'statmuse' in insight.lower():
                    category = 'trends'
                elif 'pitcher' in insight.lower() or 'pitching' in insight.lower():
                    category = 'pitcher'
                elif 'bullpen' in insight.lower():
                    category = 'bullpen'
                
                # Extract teams mentioned
                teams = []
                team_names = ['yankees', 'red sox', 'dodgers', 'padres', 'astros', 'braves', 'rays', 'twins', 'cubs', 'cardinals']
                for team in team_names:
                    if team in insight.lower():
                        teams.append(team.title())
                
                title = f"StatMuse Analysis #{i+1}"
                if len(teams) >= 2:
                    title = f"{teams[0]} vs {teams[1]} Analysis"
                elif len(teams) == 1:
                    title = f"{teams[0]} Statistical Analysis"
                
                record = {
                    'insight_text': insight,
                    'insight_order': start_order + i,
                    'title': title[:100],
                    'description': insight,
                    'category': category,
                    'confidence': 90,  # High confidence for MCP StatMuse data
                    'impact': 'high',
                    'research_sources': ['Professor Lock AI', 'StatMuse MCP Server'],
                    'created_at': datetime.now().isoformat(),
                    'teams': teams[:2]
                }
                
                self.supabase.table('daily_professor_insights').insert(record).execute()
            
            total_stored = len(insights) + (1 if intro_message else 0)
            logger.info(f"💾 Stored {total_stored} MCP-enhanced insights")
            
        except Exception as e:
            logger.error(f"Error storing insights: {e}")
    
    async def run_mcp_enhanced_generation(self):
        """Main function using StatMuse MCP Server"""
        logger.info("🚀 Starting MCP-Enhanced Insights Generation")
        logger.info("📡 Using StatMuse MCP Server for real-time data")
        
        try:
            # Step 1: Get upcoming games
            games = self.fetch_upcoming_games_with_odds()
            if not games:
                logger.error("No upcoming games found")
                return False
            
            # Step 2: Gather StatMuse data via MCP
            statmuse_data = await self.gather_mcp_statmuse_data(games)
            
            # Step 3: Generate AI insights with MCP data
            ai_insights = await self.generate_mcp_enhanced_insights(games, statmuse_data)
            if not ai_insights:
                logger.error("Failed to generate insights")
                return False
            
            # Step 4: Parse insights
            insights = self.parse_insights(ai_insights)
            if not insights:
                logger.error("No valid insights parsed")
                return False
            
            # Step 5: Generate intro message
            intro_message = "Hey team! Just completed my analysis using our StatMuse MCP server and found some compelling data points worth reviewing."
            
            # Step 6: Store insights
            self.store_insights(insights, intro_message)
            
            logger.info("✅ MCP-enhanced insights generation completed!")
            logger.info(f"🎯 Generated {len(insights)} insights using StatMuse MCP Server")
            logger.info("📡 All data sourced from real-time StatMuse via MCP")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ MCP-enhanced generation failed: {e}")
            return False

if __name__ == "__main__":
    async def main():
        try:
            generator = MCPEnhancedInsightsGenerator()
            success = await generator.run_mcp_enhanced_generation()
            if success:
                print("🎯 MCP-enhanced insights generation completed successfully!")
            else:
                print("❌ MCP-enhanced insights generation failed!")
        except Exception as e:
            logger.error(f"Script failed: {e}")
            print(f"❌ Script failed: {e}")
    
    asyncio.run(main()) 