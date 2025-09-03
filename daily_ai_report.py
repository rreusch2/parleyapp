#!/usr/bin/env python3
"""
Daily AI Report Generator
Intelligently analyzes sports data, trends, and betting patterns to generate insightful reports
Uses advanced prompt engineering with xAI Grok for autonomous analysis
"""

import os
import sys
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import httpx
from supabase import create_client, Client

# Load environment variables
load_dotenv()

class DailyAIReportGenerator:
    def __init__(self):
        """Initialize the AI Report Generator with database and API connections"""
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        self.xai_api_key = os.getenv('XAI_API_KEY')
        
        if not all([self.supabase_url, self.supabase_key, self.xai_api_key]):
            raise ValueError("Missing required environment variables")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.xai_client = httpx.AsyncClient(timeout=120.0)  # Increased timeout for Grok-4 reasoning
        
    async def get_current_date_context(self) -> Dict[str, Any]:
        """Get current date and determine which sports are in season"""
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        
        # Check for games today and tomorrow
        today_games = self.supabase.table('sports_events').select('*').gte(
            'start_time', now.replace(hour=0, minute=0).isoformat()
        ).lt(
            'start_time', tomorrow.replace(hour=0, minute=0).isoformat()
        ).execute()
        
        tomorrow_games = self.supabase.table('sports_events').select('*').gte(
            'start_time', tomorrow.replace(hour=0, minute=0).isoformat()
        ).lt(
            'start_time', (tomorrow + timedelta(days=1)).replace(hour=0, minute=0).isoformat()
        ).execute()
        
        # Get unique sports
        active_sports = set()
        if today_games.data:
            active_sports.update([game['sport'] for game in today_games.data])
        if tomorrow_games.data:
            active_sports.update([game['sport'] for game in tomorrow_games.data])
        
        return {
            'current_date': now.strftime('%Y-%m-%d'),
            'current_time': now.strftime('%H:%M:%S'),
            'tomorrow_date': tomorrow.strftime('%Y-%m-%d'),
            'active_sports': list(active_sports),
            'today_game_count': len(today_games.data) if today_games.data else 0,
            'tomorrow_game_count': len(tomorrow_games.data) if tomorrow_games.data else 0
        }
    
    async def fetch_trending_data(self, sports: List[str]) -> Dict[str, Any]:
        """Fetch trending player props, team performance, and betting patterns using real schema"""
        data = {
            'player_props_with_names': [],
            'player_trends': [],
            'recent_predictions': [],
            'upcoming_games': [],
            'odds_movements': []
        }
        
        # Get player trends data (already has player names)
        trends = self.supabase.table('player_trends_data').select(
            'player_name, team_name, sport_key, avg_hits, avg_home_runs, avg_strikeouts, batting_average, form_trend, confidence_score, last_updated'
        ).order('last_updated', desc=True).limit(20).execute()
        
        if trends.data:
            data['player_trends'] = trends.data
        
        # Get upcoming games 
        games = self.supabase.table('sports_events').select(
            'home_team, away_team, sport, league, start_time, venue'
        ).gte('start_time', datetime.now().isoformat()).order('start_time').limit(15).execute()
        
        if games.data:
            data['upcoming_games'] = games.data
        
        # Get recent AI predictions
        recent_preds = self.supabase.table('ai_predictions').select(
            'match_teams, pick, odds, confidence, sport, reasoning, created_at, status, bet_type'
        ).order('created_at', desc=True).limit(15).execute()
        
        if recent_preds.data:
            data['recent_predictions'] = recent_preds.data
        
        # Get recent player props with player info
        props = self.supabase.table('player_props_odds').select('*').order(
            'created_at', desc=True
        ).limit(10).execute()
        
        if props.data:
            enhanced_props = []
            for prop in props.data[:5]:  # Only process first 5 to avoid too many queries
                try:
                    player = self.supabase.table('players').select('name, team, position, sport').eq(
                        'id', prop['player_id']
                    ).single().execute()
                    
                    if player.data:
                        enhanced_prop = {
                            'player_name': player.data.get('name', 'Unknown'),
                            'team_name': player.data.get('team', 'Unknown'),
                            'position': player.data.get('position', ''),
                            'sport': player.data.get('sport', ''),
                            'line': prop.get('line'),
                            'over_odds': prop.get('over_odds'),
                            'under_odds': prop.get('under_odds'),
                            'created_at': prop.get('created_at')
                        }
                        enhanced_props.append(enhanced_prop)
                except Exception:
                    pass  # Skip if player lookup fails
            
            data['player_props_with_names'] = enhanced_props
        
        # Get recent odds movements
        odds = self.supabase.table('odds_data').select(
            'outcome_name, outcome_price, outcome_point, created_at'
        ).order('created_at', desc=True).limit(10).execute()
        
        if odds.data:
            data['odds_movements'] = odds.data
        
        return data
    
    async def analyze_with_ai(self, context: Dict[str, Any], data: Dict[str, Any]) -> str:
        """Use xAI Grok to intelligently analyze data and generate report"""
        
        # Advanced prompt engineering with chain-of-thought and role-playing
        system_prompt = """You are an elite sports analytics AI with deep expertise in:
- Statistical trend analysis and pattern recognition
- Sports betting market dynamics and line movements
- Player performance analytics and predictive modeling
- Team matchup analysis and situational factors

Your task is to generate a comprehensive daily sports report that provides ACTIONABLE insights.

CRITICAL RULES:
1. ONLY use REAL data provided - NEVER generate placeholder information
2. Focus on identifying genuine statistical edges and trends
3. Highlight unusual patterns or significant deviations from norms
4. Provide specific, quantifiable insights (not generic observations)
5. Format output in clean, readable Markdown optimized for mobile display

ANALYSIS FRAMEWORK:
1. Start with executive summary of key findings
2. Analyze player prop trends with statistical backing
3. Identify team performance patterns and matchup edges
4. Highlight value opportunities based on line movements
5. Provide risk assessment and confidence levels

Remember: Quality over quantity. Focus on the most impactful insights."""

        analysis_prompt = f"""
Current Context:
- Date: {context['current_date']} at {context['current_time']}
- Active Sports: {', '.join(context['active_sports'])}
- Games Today: {context['today_game_count']}
- Games Tomorrow: {context['tomorrow_game_count']}

Available Data:
- Player Props: {len(data['player_props_with_names'])} recent props with names
- Player Trends: {len(data['player_trends'])} player performance trends  
- Recent Predictions: {len(data['recent_predictions'])} AI predictions
- Upcoming Games: {len(data['upcoming_games'])} scheduled games
- Odds Movements: {len(data['odds_movements'])} recent line changes

Raw Data for Analysis:
{json.dumps(data, indent=2)[:8000]}  # Truncate to avoid token limits

TASK: Generate a comprehensive daily report analyzing this data. Focus on:

1. 🔥 **Hot Trends** - Players or teams on significant streaks
2. 📊 **Statistical Edges** - Props or bets with value based on recent performance
3. 🎯 **High Confidence Plays** - Best opportunities based on multiple factors
4. ⚠️ **Risk Alerts** - Notable concerns or volatile situations
5. 💡 **Expert Insights** - Advanced analysis combining multiple data points

Use clear headers, bullet points, and emojis for visual appeal. Include specific numbers and percentages.
Format for optimal mobile display with short paragraphs and clear sections.

Generate the report now:"""

        try:
            response = await self.xai_client.post(
                'https://api.x.ai/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {self.xai_api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'grok-3-latest',
                    'messages': [
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': analysis_prompt}
                    ],
                    'max_tokens': 3000
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                return result['choices'][0]['message']['content']
            else:
                error_text = response.text if hasattr(response, 'text') else 'Unknown error'
                return f"Error generating report: {response.status_code} - {error_text}"
                
        except Exception as e:
            print(f"Full exception: {e}")
            import traceback
            traceback.print_exc()
            return f"Error: {str(e)}"
    
    async def generate_report(self) -> Dict[str, Any]:
        """Main method to generate the complete AI report"""
        try:
            # Get current context
            context = await self.get_current_date_context()
            
            if not context['active_sports']:
                return {
                    'success': False,
                    'error': 'No active sports found for today or tomorrow',
                    'generated_at': datetime.now().isoformat()
                }
            
            # Fetch all relevant data
            data = await self.fetch_trending_data(context['active_sports'])
            
            # Generate AI analysis
            report_content = await self.analyze_with_ai(context, data)
            
            # Store report in database
            report_record = {
                'report_type': 'daily_ai_analysis',
                'content': report_content,
                'metadata': {
                    'active_sports': context['active_sports'],
                    'data_points_analyzed': {
                        'player_props': len(data['player_props_with_names']),
                        'player_trends': len(data['player_trends']),
                        'predictions': len(data['recent_predictions']),
                        'odds_movements': len(data['odds_movements'])
                    }
                },
                'generated_at': datetime.now().isoformat()
            }
            
            # Store in a new ai_reports table (you may need to create this)
            stored = self.supabase.table('ai_reports').insert(report_record).execute()
            
            return {
                'success': True,
                'report': report_content,
                'metadata': report_record['metadata'],
                'generated_at': report_record['generated_at'],
                'report_id': stored.data[0]['id'] if stored.data else None
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'generated_at': datetime.now().isoformat()
            }
    
    async def close(self):
        """Clean up connections"""
        await self.xai_client.aclose()

async def main():
    """Main execution function"""
    generator = DailyAIReportGenerator()
    
    try:
        print("🚀 Generating Daily AI Report...")
        result = await generator.generate_report()
        
        if result['success']:
            print("✅ Report generated successfully!")
            print("\n📊 Report Content:")
            print(result['report'])
            
            # Output JSON for backend consumption
            output = {
                'success': True,
                'report': result['report'],
                'metadata': result['metadata'],
                'generated_at': result['generated_at']
            }
            print("\n📄 JSON Output:")
            print(json.dumps(output, indent=2))
        else:
            print(f"❌ Error: {result['error']}")
            sys.exit(1)
            
    finally:
        await generator.close()

if __name__ == "__main__":
    asyncio.run(main())
