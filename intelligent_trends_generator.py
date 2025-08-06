#!/usr/bin/env python3
"""
Intelligent Trends Generator - Elite Version
Autonomously analyzes upcoming games and generates 15+ high-quality trends
"""

import os
import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import pandas as pd
import pybaseball as pb
from supabase import create_client, Client
from openai import AsyncOpenAI
import requests
from dataclasses import dataclass
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class GameAnalysis:
    """Represents an analyzed upcoming game"""
    game_id: str
    home_team: str
    away_team: str
    start_time: str
    sport: str
    key_players: List[str]
    betting_interest_score: float
    storylines: List[str]

@dataclass
class PlayerTrendCandidate:
    """Represents a player candidate for trend analysis"""
    player_name: str
    prop_type: str
    prop_line: float
    game_context: str
    interest_score: float
    reasoning: str

class IntelligentTrendsGenerator:
    def __init__(self):
        # Initialize clients
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
        
        self.grok_client = AsyncOpenAI(
            api_key=os.getenv("XAI_API_KEY"),
            base_url="https://api.x.ai/v1"
        )
        
        # StatMuse API for additional research
        self.statmuse_url = "https://feisty-nurturing-production-9c29.up.railway.app"
        
        logger.info("Intelligent Trends Generator initialized")

    async def analyze_upcoming_games(self) -> List[GameAnalysis]:
        """Analyze all upcoming games to identify betting opportunities"""
        try:
            # Get upcoming games (today and tomorrow)
            today = datetime.now()
            tomorrow = today + timedelta(days=1)
            
            response = self.supabase.table('sports_events')\
                .select('*')\
                .gte('start_time', today.isoformat())\
                .lte('start_time', tomorrow.isoformat())\
                .order('start_time')\
                .execute()
            
            games = response.data
            logger.info(f"Found {len(games)} upcoming games to analyze")
            
            # Use Grok to analyze games and identify most interesting ones
            games_analysis_prompt = f"""
            You are an elite sports betting analyst. Analyze these {len(games)} upcoming games and identify the most interesting betting opportunities.
            
            Games: {json.dumps(games, indent=2)}
            
            For each game, consider:
            1. Star players and their recent form
            2. Team matchup dynamics
            3. Historical trends and storylines
            4. Prop betting opportunities
            5. Public betting interest
            
            IMPORTANT: Return ONLY a valid JSON array with no other text. Use this exact structure:
            [
                {{
                    "game_id": "game_id",
                    "home_team": "team_name",
                    "away_team": "team_name", 
                    "start_time": "iso_time",
                    "sport": "sport_name",
                    "key_players": ["player1", "player2", "player3"],
                    "betting_interest_score": 8.5,
                    "storylines": ["reason1", "reason2", "reason3"]
                }}
            ]
            
            Focus on games with the most compelling player prop opportunities. Prioritize MLB games but include WNBA if interesting.
            """
            
            response = await self.grok_client.chat.completions.create(
                model="grok-2-latest",
                messages=[{"role": "user", "content": games_analysis_prompt}],
                temperature=0.3
            )
            
            try:
                content = response.choices[0].message.content.strip()
                logger.info(f"Raw Grok response: {content[:200]}...")
                
                # Try to extract JSON if wrapped in markdown
                if content.startswith('```json'):
                    content = content.replace('```json', '').replace('```', '').strip()
                elif content.startswith('```'):
                    content = content.replace('```', '').strip()
                
                analyzed_games = json.loads(content)
                game_analyses = []
                
                for game_data in analyzed_games:
                    game_analyses.append(GameAnalysis(
                        game_id=game_data.get('game_id', ''),
                        home_team=game_data.get('home_team', ''),
                        away_team=game_data.get('away_team', ''),
                        start_time=game_data.get('start_time', ''),
                        sport=game_data.get('sport', ''),
                        key_players=game_data.get('key_players', []),
                        betting_interest_score=game_data.get('betting_interest_score', 0),
                        storylines=game_data.get('storylines', [])
                    ))
                
                logger.info(f"Analyzed {len(game_analyses)} high-interest games")
                return game_analyses
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse game analysis: {e}")
                logger.error(f"Raw content: {response.choices[0].message.content}")
                # Fallback: create basic analysis from raw games data
                fallback_analyses = []
                for i, game in enumerate(games[:5]):  # Take first 5 games as fallback
                    fallback_analyses.append(GameAnalysis(
                        game_id=game.get('id', f'game_{i}'),
                        home_team=game.get('home_team', 'Home'),
                        away_team=game.get('away_team', 'Away'),
                        start_time=game.get('start_time', ''),
                        sport=game.get('sport', 'MLB'),
                        key_players=['Player 1', 'Player 2', 'Player 3'],
                        betting_interest_score=7.0,
                        storylines=['Interesting matchup', 'Key players to watch']
                    ))
                logger.info(f"Using fallback analysis with {len(fallback_analyses)} games")
                return fallback_analyses
                
        except Exception as e:
            logger.error(f"Error analyzing upcoming games: {e}")
            return []

    async def identify_trend_candidates(self, game_analyses: List[GameAnalysis]) -> List[PlayerTrendCandidate]:
        """Use AI to identify the 15+ most interesting players for trend analysis"""
        try:
            # Get available player props for context
            response = self.supabase.table('player_props_odds')\
                .select('*, players!inner(name, player_name), player_prop_types!inner(prop_key, prop_name)')\
                .order('created_at', desc=True)\
                .limit(200)\
                .execute()
            
            available_props = response.data
            logger.info(f"Found {len(available_props)} available player props")
            
            # Use Grok to intelligently select trend candidates
            candidate_selection_prompt = f"""
            You are an elite betting analyst tasked with selecting the 15 most interesting player trend opportunities.
            
            UPCOMING GAMES ANALYSIS:
            {json.dumps([{
                'home_team': g.home_team,
                'away_team': g.away_team,
                'sport': g.sport,
                'key_players': g.key_players,
                'betting_interest_score': g.betting_interest_score,
                'storylines': g.storylines
            } for g in game_analyses], indent=2)}
            
            AVAILABLE PLAYER PROPS:
            {json.dumps(available_props[:50], indent=2)}  # Limit for context
            
            Your task: Select exactly 15 players with the most compelling trend stories. Consider:
            
            1. **Star Power**: Big names that bettors follow
            2. **Recent Form**: Players with interesting recent performance patterns  
            3. **Matchup Context**: Favorable/unfavorable matchups
            4. **Prop Line Value**: Lines that seem off based on recent trends
            5. **Storylines**: Injury returns, hot streaks, cold streaks, revenge games
            6. **Betting Volume**: Props that will get heavy action
            
            IMPORTANT: Return ONLY a valid JSON array with no other text. Use exactly this format:
            [
                {{
                    "player_name": "Player Name",
                    "prop_type": "Batter Hits O/U", 
                    "prop_line": 1.5,
                    "game_context": "vs Red Sox - revenge game after trade",
                    "interest_score": 9.2,
                    "reasoning": "Coming off 3-game hitting streak, facing former team, line seems low given recent form"
                }}
            ]
            
            Prioritize MLB players but include 2-3 WNBA if compelling. Focus on props with clear betting angles.
            """
            
            response = await self.grok_client.chat.completions.create(
                model="grok-2-latest",
                messages=[{"role": "user", "content": candidate_selection_prompt}],
                temperature=0.4
            )
            
            try:
                content = response.choices[0].message.content.strip()
                logger.info(f"Raw candidate response: {content[:200]}...")
                
                # Try to extract JSON if wrapped in markdown
                if content.startswith('```json'):
                    content = content.replace('```json', '').replace('```', '').strip()
                elif content.startswith('```'):
                    content = content.replace('```', '').strip()
                
                candidates_data = json.loads(content)
                candidates = []
                
                for candidate in candidates_data:
                    candidates.append(PlayerTrendCandidate(
                        player_name=candidate.get('player_name', ''),
                        prop_type=candidate.get('prop_type', ''),
                        prop_line=float(candidate.get('prop_line', 0)),
                        game_context=candidate.get('game_context', ''),
                        interest_score=float(candidate.get('interest_score', 0)),
                        reasoning=candidate.get('reasoning', '')
                    ))
                
                logger.info(f"Selected {len(candidates)} trend candidates")
                return candidates
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse trend candidates: {e}")
                logger.error(f"Raw content: {response.choices[0].message.content}")
                # Create fallback candidates from available props
                fallback_candidates = []
                for i, prop in enumerate(available_props[:15]):
                    if prop.get('players') and prop.get('line'):
                        fallback_candidates.append(PlayerTrendCandidate(
                            player_name=prop['players'].get('name', f'Player {i+1}'),
                            prop_type=prop.get('player_prop_types', {}).get('prop_name', 'Hits'),
                            prop_line=float(prop.get('line', 1.5)),
                            game_context='Upcoming game analysis',
                            interest_score=7.0,
                            reasoning='Selected from available props'
                        ))
                logger.info(f"Using fallback candidates: {len(fallback_candidates)}")
                return fallback_candidates
                
        except Exception as e:
            logger.error(f"Error identifying trend candidates: {e}")
            return []

    def get_enhanced_prop_line(self, player_name: str, prop_type: str) -> Optional[float]:
        """Enhanced prop line matching with fuzzy logic"""
        try:
            # Normalize prop type
            prop_type_clean = prop_type.lower().replace(' o/u', '').replace('batter ', '').replace('_', ' ')
            
            # Enhanced prop key mapping
            prop_key_map = {
                'hits': 'batter_hits',
                'hit': 'batter_hits',
                'home runs': 'batter_home_runs',
                'home run': 'batter_home_runs',
                'hr': 'batter_home_runs',
                'rbis': 'batter_rbis',
                'rbi': 'batter_rbis',
                'runs scored': 'batter_runs_scored',
                'runs': 'batter_runs_scored',
                'run': 'batter_runs_scored',
                'total bases': 'batter_total_bases',
                'total base': 'batter_total_bases',
                'bases': 'batter_total_bases',
                'strikeouts': 'batter_strikeouts',
                'strikeout': 'batter_strikeouts',
                'so': 'batter_strikeouts',
                'points': 'points',
                'rebounds': 'rebounds',
                'assists': 'assists'
            }
            
            # Find best matching prop key
            prop_key = None
            for key_pattern, db_key in prop_key_map.items():
                if key_pattern in prop_type_clean:
                    prop_key = db_key
                    break
            
            if not prop_key:
                prop_key = 'batter_hits'  # default fallback
            
            # Enhanced player name matching
            response = self.supabase.table('player_props_odds')\
                .select('line, player_prop_types!inner(prop_key), players!inner(name, player_name)')\
                .eq('player_prop_types.prop_key', prop_key)\
                .order('created_at', desc=True)\
                .limit(50)\
                .execute()
            
            # Try multiple matching strategies
            for prop in response.data:
                player_names = [
                    prop['players']['name'],
                    prop['players']['player_name']
                ]
                
                # Exact match
                if any(name and name.lower() == player_name.lower() for name in player_names if name):
                    return float(prop['line'])
                
                # Fuzzy match (contains)
                if any(name and player_name.lower() in name.lower() for name in player_names if name):
                    return float(prop['line'])
                
                # Reverse fuzzy match
                if any(name and name.lower() in player_name.lower() for name in player_names if name):
                    return float(prop['line'])
            
            logger.warning(f"No prop line found for {player_name} {prop_type}")
            return None
            
        except Exception as e:
            logger.error(f"Error fetching enhanced prop line for {player_name}: {e}")
            return None

    def get_player_last_10_games(self, player_name: str, prop_type: str) -> List[Dict]:
        """Get real game data from pybaseball"""
        try:
            logger.info(f"Looking up MLB ID for {player_name}")
            
            # Look up player ID
            player_lookup = pb.playerid_lookup(player_name.split()[-1], player_name.split()[0])
            
            if player_lookup.empty:
                logger.warning(f"No MLB ID found for {player_name}")
                return []
            
            mlb_id = player_lookup.iloc[0]['key_mlbam']
            logger.info(f"Found MLB ID {mlb_id} for {player_name}")
            
            # Get recent game data (last 30 days to ensure we get 10 games)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            logger.info(f"Fetching Statcast data for {player_name} (ID: {mlb_id}) from {start_date.date()} to {end_date.date()}")
            
            # Get Statcast data
            statcast_data = pb.statcast_batter(
                start_dt=start_date.strftime('%Y-%m-%d'),
                end_dt=end_date.strftime('%Y-%m-%d'),
                player_id=mlb_id
            )
            
            if statcast_data.empty:
                logger.warning(f"No Statcast data found for {player_name}")
                return []
            
            # Group by game and calculate stats
            games_grouped = statcast_data.groupby('game_date').agg({
                'events': lambda x: (x == 'single').sum() + (x == 'double').sum() + (x == 'triple').sum() + (x == 'home_run').sum(),  # hits
                'home_team': 'first',
                'away_team': 'first',
                'game_date': 'first'
            }).reset_index()
            
            # Map prop type to stat
            if 'home run' in prop_type.lower():
                games_grouped['stat_value'] = statcast_data.groupby('game_date')['events'].apply(lambda x: (x == 'home_run').sum()).values
            elif 'total base' in prop_type.lower():
                games_grouped['stat_value'] = statcast_data.groupby('game_date').apply(
                    lambda x: ((x['events'] == 'single').sum() + 
                              (x['events'] == 'double').sum() * 2 + 
                              (x['events'] == 'triple').sum() * 3 + 
                              (x['events'] == 'home_run').sum() * 4)
                ).values
            else:  # Default to hits
                games_grouped['stat_value'] = games_grouped['events']
            
            # Get last 10 games
            games_grouped = games_grouped.sort_values('game_date', ascending=False).head(10)
            
            games_data = []
            for _, game in games_grouped.iterrows():
                # Determine opponent
                opponent = game['away_team'] if game['home_team'] else game['home_team']
                
                games_data.append({
                    'date': game['game_date'].strftime('%Y-%m-%d'),
                    'opponent': opponent,
                    'value': int(game['stat_value'])
                })
            
            logger.info(f"Found {len(games_data)} games for {player_name}")
            return games_data
            
        except Exception as e:
            logger.error(f"Error getting game data for {player_name}: {e}")
            return []

    async def conduct_statmuse_research(self, player_name: str, prop_type: str) -> str:
        """Conduct StatMuse research for additional context"""
        try:
            research_query = f"{player_name} {prop_type} last 10 games performance trends"
            
            response = requests.post(
                f"{self.statmuse_url}/query",
                json={"query": research_query},
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json().get('answer', '')
            else:
                return ""
                
        except Exception as e:
            logger.error(f"StatMuse research failed for {player_name}: {e}")
            return ""

    async def generate_elite_trend(self, candidate: PlayerTrendCandidate) -> Optional[Dict]:
        """Generate a single elite-quality trend"""
        try:
            logger.info(f"Generating elite trend for {candidate.player_name} - {candidate.prop_type}")
            
            # Get real game data
            games_data = self.get_player_last_10_games(candidate.player_name, candidate.prop_type)
            if not games_data:
                logger.warning(f"No game data found for {candidate.player_name}")
                return None
            
            # Get enhanced prop line
            prop_line = self.get_enhanced_prop_line(candidate.player_name, candidate.prop_type)
            if not prop_line:
                prop_line = candidate.prop_line  # Use AI-suggested line as fallback
            
            # Conduct additional research
            statmuse_research = await self.conduct_statmuse_research(candidate.player_name, candidate.prop_type)
            
            # Calculate advanced metrics
            values = [game['value'] for game in games_data]
            avg_value = sum(values) / len(values) if values else 0
            max_value = max(values) if values else 0
            min_value = min(values) if values else 0
            
            # Success rate vs prop line
            success_rate = 0
            if prop_line:
                successes = sum(1 for value in values if value >= prop_line)
                success_rate = (successes / len(values)) * 100 if values else 0
            
            # Trend analysis
            if len(values) >= 6:
                recent_3 = values[:3]
                previous_3 = values[3:6]
                recent_avg = sum(recent_3) / len(recent_3)
                previous_avg = sum(previous_3) / len(previous_3)
                
                if recent_avg > previous_avg * 1.15:
                    trend_direction = "up"
                elif recent_avg < previous_avg * 0.85:
                    trend_direction = "down"
                else:
                    trend_direction = "stable"
            else:
                trend_direction = "stable"
            
            # Generate elite analysis with Grok
            elite_analysis_prompt = f"""
            Generate an elite-level betting trend analysis for this player:
            
            PLAYER: {candidate.player_name}
            PROP: {candidate.prop_type}
            CURRENT LINE: {prop_line}
            GAME CONTEXT: {candidate.game_context}
            SELECTION REASONING: {candidate.reasoning}
            
            PERFORMANCE DATA:
            - Last 10 Games: {values}
            - Average: {avg_value:.2f}
            - Success Rate vs Line: {success_rate:.1f}%
            - Trend Direction: {trend_direction}
            - Min/Max: {min_value}/{max_value}
            
            ADDITIONAL RESEARCH:
            {statmuse_research}
            
            Create a professional betting trend analysis with:
            1. Compelling headline that captures the key angle
            2. 2-3 sentence description highlighting the betting opportunity
            3. Sharp insight that explains WHY this is a good bet
            4. Professional tone that builds confidence
            
            Return JSON:
            {{
                "title": "Compelling headline",
                "description": "Professional analysis",
                "insight": "Key betting insight",
                "headline": "Short punchy headline"
            }}
            
            Focus on what makes this trend actionable for elite bettors.
            """
            
            response = await self.grok_client.chat.completions.create(
                model="grok-2-latest",
                messages=[{"role": "user", "content": elite_analysis_prompt}],
                temperature=0.6
            )
            
            try:
                analysis = json.loads(response.choices[0].message.content)
            except:
                # Fallback analysis
                analysis = {
                    "title": f"{candidate.player_name}'s {candidate.prop_type} Elite Trend",
                    "description": f"{candidate.player_name} has shown {trend_direction} trend with {success_rate:.1f}% success rate vs current line of {prop_line}.",
                    "insight": f"Recent performance and {candidate.game_context} create compelling betting opportunity.",
                    "headline": f"{candidate.player_name} {trend_direction.title()} Trend"
                }
            
            # Create comprehensive chart data
            chart_data = {
                "recent_games": [
                    {
                        "date": game['date'],
                        "opponent": game.get('opponent', 'OPP'),
                        "value": game['value'],
                        candidate.prop_type.lower().replace(' o/u', ''): game['value'],
                        "game_number": i + 1
                    }
                    for i, game in enumerate(games_data)
                ],
                "success_rate": round(success_rate, 1),
                "trend_direction": trend_direction,
                "y_axis_max": max_value + 1,
                "y_axis_intervals": list(range(0, max_value + 2)),
                "prop_line": prop_line,  # This should now have a real value
                "average_value": round(avg_value, 2),
                "data_source": "pybaseball_statcast_elite"
            }
            
            # Create elite trend object
            trend = {
                "user_id": "00000000-0000-0000-0000-000000000000",
                "trend_text": analysis["description"],
                "trend_type": "player_prop",
                "sport": "MLB" if "batter" in candidate.prop_type.lower() else "WNBA",
                "confidence_score": round(min(95, max(65, success_rate + candidate.interest_score)), 1),
                "title": analysis["title"],
                "description": analysis["description"],
                "insight": analysis["insight"],
                "headline": analysis["headline"],
                "full_player_name": candidate.player_name,
                "chart_data": chart_data,
                "visual_data": {
                    "chart_type": "bar",
                    "trend_color": "#22C55E" if trend_direction == "up" else "#EF4444" if trend_direction == "down" else "#3B82F6"
                },
                "key_stats": {
                    "avg_last_10": round(avg_value, 2),
                    "success_rate": f"{success_rate:.1f}%",
                    "current_line": prop_line,
                    "max_value": max_value,
                    "min_value": min_value,
                    "trend_direction": trend_direction,
                    "game_context": candidate.game_context,
                    "interest_score": candidate.interest_score
                },
                "metadata": {
                    "source": "intelligent_trends_elite",
                    "selection_reasoning": candidate.reasoning,
                    "research_conducted": bool(statmuse_research),
                    "data_quality": "elite"
                }
            }
            
            return trend
            
        except Exception as e:
            logger.error(f"Error generating elite trend for {candidate.player_name}: {e}")
            return None

    async def generate_elite_trends(self) -> int:
        """Main method to generate 15+ elite trends"""
        try:
            logger.info("🚀 Starting Elite Trends Generation...")
            
            # Step 1: Analyze upcoming games
            logger.info("📊 Analyzing upcoming games...")
            game_analyses = await self.analyze_upcoming_games()
            
            if not game_analyses:
                logger.error("No games to analyze")
                return 0
            
            # Step 2: Identify trend candidates
            logger.info("🎯 Identifying elite trend candidates...")
            candidates = await self.identify_trend_candidates(game_analyses)
            
            if len(candidates) < 15:
                logger.warning(f"Only found {len(candidates)} candidates, expected 15+")
            
            # Step 3: Generate trends for each candidate
            logger.info(f"⚡ Generating {len(candidates)} elite trends...")
            trends_generated = 0
            
            for i, candidate in enumerate(candidates, 1):
                logger.info(f"Processing candidate {i}/{len(candidates)}: {candidate.player_name}")
                
                trend = await self.generate_elite_trend(candidate)
                if trend:
                    # Store in database
                    try:
                        self.supabase.table('ai_trends').insert(trend).execute()
                        trends_generated += 1
                        logger.info(f"✅ Generated elite trend {trends_generated}: {candidate.player_name} - {candidate.prop_type}")
                    except Exception as e:
                        logger.error(f"Failed to store trend for {candidate.player_name}: {e}")
                else:
                    logger.warning(f"❌ Failed to generate trend for {candidate.player_name}")
                
                # Small delay to avoid rate limits
                await asyncio.sleep(1)
            
            logger.info(f"🎉 Generated {trends_generated} elite trends successfully!")
            return trends_generated
            
        except Exception as e:
            logger.error(f"Error in elite trends generation: {e}")
            return 0

async def main():
    """Main execution function"""
    generator = IntelligentTrendsGenerator()
    trends_count = await generator.generate_elite_trends()
    
    if trends_count >= 15:
        print(f"✅ Successfully generated {trends_count} elite trends!")
    else:
        print(f"⚠️ Generated {trends_count} trends (target was 15+)")

if __name__ == "__main__":
    asyncio.run(main())
