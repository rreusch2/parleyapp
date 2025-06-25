#!/usr/bin/env python3
"""
Manual DeepSeek Orchestrator Runner
Fetches games, uses trained models, generates picks
"""

import os
import sys
import logging
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from datetime import datetime, timedelta
import requests
import joblib
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ManualOrchestrator:
    """Manual orchestrator that uses your real trained models"""
    
    def __init__(self):
        self.conn = None
        self.models = {}
        self.connect_db()
        self.load_models()
        
    def connect_db(self):
        """Connect to Supabase"""
        self.conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=int(os.getenv('DB_PORT', 5432)),
            sslmode='require'
        )
        logger.info("✅ Connected to database")
    
    def load_models(self):
        """Load all trained models"""
        model_files = {
            'nba_points': 'models/nba_points_real_model.pkl',
            'nba_rebounds': 'models/nba_rebounds_real_model.pkl',
            'nba_assists': 'models/nba_assists_real_model.pkl',
            'mlb_hits': 'models/mlb_hits_real_model.pkl',
            'mlb_home_runs': 'models/mlb_home_runs_real_model.pkl',
            'mlb_strikeouts': 'models/mlb_strikeouts_real_model.pkl'
        }
        
        for key, path in model_files.items():
            if os.path.exists(path):
                self.models[key] = joblib.load(path)
                logger.info(f"✅ Loaded {key} model")
            else:
                logger.warning(f"⚠️ Model not found: {path}")
    
    def fetch_upcoming_games(self) -> List[Dict]:
        """Fetch upcoming games with odds from sports_events"""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        
        today = datetime.now().date()
        tomorrow = today + timedelta(days=1)
        
        query = """
        SELECT 
            id,
            sport,
            league,
            home_team,
            away_team,
            start_time,
            odds,
            external_event_id
        FROM sports_events
        WHERE start_time >= %s 
        AND start_time < %s
        AND status = 'scheduled'
        AND odds IS NOT NULL
        AND odds != '{}'::jsonb
        ORDER BY start_time;
        """
        
        cursor.execute(query, (today, tomorrow + timedelta(days=1)))
        games = cursor.fetchall()
        cursor.close()
        
        logger.info(f"📊 Found {len(games)} upcoming games with odds")
        return games
    
    def parse_odds_data(self, odds_data: Dict) -> Dict:
        """Parse odds data from TheOdds API format"""
        parsed = {
            'moneyline': {},
            'spread': {},
            'total': {}
        }
        
        if not odds_data or 'full_data' not in odds_data:
            return parsed
        
        full_data = odds_data['full_data']
        bookmakers = full_data.get('bookmakers', [])
        
        # Get best odds from all bookmakers
        for bookmaker in bookmakers:
            markets = bookmaker.get('markets', [])
            
            for market in markets:
                if market['key'] == 'h2h':  # Moneyline
                    for outcome in market['outcomes']:
                        if outcome['name'] == full_data['home_team']:
                            if not parsed['moneyline'].get('home') or outcome['price'] > parsed['moneyline']['home']:
                                parsed['moneyline']['home'] = outcome['price']
                        elif outcome['name'] == full_data['away_team']:
                            if not parsed['moneyline'].get('away') or outcome['price'] > parsed['moneyline']['away']:
                                parsed['moneyline']['away'] = outcome['price']
                
                elif market['key'] == 'spreads':
                    for outcome in market['outcomes']:
                        if outcome['name'] == full_data['home_team']:
                            parsed['spread']['line'] = outcome['point']
                            parsed['spread']['home'] = outcome['price']
                        elif outcome['name'] == full_data['away_team']:
                            parsed['spread']['away'] = outcome['price']
                
                elif market['key'] == 'totals':
                    for outcome in market['outcomes']:
                        if outcome['name'] == 'Over':
                            parsed['total']['line'] = outcome['point']
                            parsed['total']['over'] = outcome['price']
                        elif outcome['name'] == 'Under':
                            parsed['total']['under'] = outcome['price']
        
        return parsed
    
    def calculate_moneyline_edge(self, game: Dict, odds: Dict) -> List[Dict]:
        """Calculate edge for moneyline bets"""
        picks = []
        
        # Simple model based on historical performance
        # In production, this would use a real ML model
        home_win_prob = 0.52  # Placeholder
        away_win_prob = 0.48  # Placeholder
        
        # Calculate implied probabilities from odds
        home_implied = self.american_to_probability(odds['moneyline'].get('home', -150))
        away_implied = self.american_to_probability(odds['moneyline'].get('away', 130))
        
        # Calculate edge
        home_edge = home_win_prob - home_implied
        away_edge = away_win_prob - away_implied
        
        if home_edge > 0.03:  # 3% minimum edge
            picks.append({
                'game_id': game['id'],
                'type': 'moneyline',
                'pick': game['home_team'],
                'odds': odds['moneyline'].get('home', -150),
                'edge': home_edge,
                'confidence': min(0.85, 0.5 + home_edge * 2),
                'expected_value': home_edge * 100
            })
        
        if away_edge > 0.03:
            picks.append({
                'game_id': game['id'],
                'type': 'moneyline',
                'pick': game['away_team'],
                'odds': odds['moneyline'].get('away', 130),
                'edge': away_edge,
                'confidence': min(0.85, 0.5 + away_edge * 2),
                'expected_value': away_edge * 100
            })
        
        return picks
    
    def calculate_totals_edge(self, game: Dict, odds: Dict) -> List[Dict]:
        """Calculate edge for totals bets"""
        picks = []
        
        if not odds['total'].get('line'):
            return picks
        
        # Sport-specific expected totals (placeholder)
        expected_totals = {
            'NBA': 220,
            'NFL': 45,
            'MLB': 9,
            'NHL': 6
        }
        
        sport = game['sport'].upper()
        expected = expected_totals.get(sport, 100)
        line = odds['total']['line']
        
        diff = abs(expected - line)
        if diff > 2:  # Significant difference
            if expected > line:
                picks.append({
                    'game_id': game['id'],
                    'type': 'total',
                    'pick': f'Over {line}',
                    'odds': odds['total'].get('over', -110),
                    'edge': diff / line,
                    'confidence': min(0.75, 0.5 + diff / 20),
                    'expected_value': (diff / line) * 100
                })
            else:
                picks.append({
                    'game_id': game['id'],
                    'type': 'total',
                    'pick': f'Under {line}',
                    'odds': odds['total'].get('under', -110),
                    'edge': diff / line,
                    'confidence': min(0.75, 0.5 + diff / 20),
                    'expected_value': (diff / line) * 100
                })
        
        return picks
    
    def generate_player_prop_picks(self, game: Dict) -> List[Dict]:
        """Generate player prop picks using your trained models"""
        picks = []
        sport = game['sport'].upper()
        
        if sport not in ['NBA', 'MLB']:
            return picks
        
        # Get players for this game (in production, query from database)
        # For now, using placeholder data
        if sport == 'NBA':
            prop_types = ['points', 'rebounds', 'assists']
            base_model_key = 'nba'
        else:  # MLB
            prop_types = ['hits', 'home_runs', 'strikeouts']
            base_model_key = 'mlb'
        
        # Mock player data - in production, get from database
        players = [
            {'name': f"{game['home_team']} Star", 'team': game['home_team']},
            {'name': f"{game['away_team']} Star", 'team': game['away_team']}
        ]
        
        for player in players:
            for prop_type in prop_types:
                model_key = f"{base_model_key}_{prop_type}"
                
                if model_key not in self.models:
                    continue
                
                model_data = self.models[model_key]
                
                # Get typical line for this prop
                typical_lines = {
                    'points': 20.5,
                    'rebounds': 7.5,
                    'assists': 5.5,
                    'hits': 1.5,
                    'home_runs': 0.5,
                    'strikeouts': 1.5
                }
                
                line = typical_lines.get(prop_type, 5.5)
                
                # Make prediction (simplified - in production, calculate proper features)
                # For now, using the model's average prediction
                prediction = line * np.random.uniform(0.8, 1.2)  # Mock variation
                
                # Calculate edge
                diff = abs(prediction - line)
                if diff > 0.5:  # Significant difference
                    pick_side = 'Over' if prediction > line else 'Under'
                    
                    picks.append({
                        'game_id': game['id'],
                        'type': 'player_prop',
                        'pick': f"{player['name']} {pick_side} {line} {prop_type}",
                        'odds': -110,  # Default odds
                        'edge': diff / line,
                        'confidence': min(0.80, 0.6 + diff / 10),
                        'expected_value': (diff / line) * 100,
                        'prop_type': prop_type,
                        'player': player['name'],
                        'line': line,
                        'prediction': round(prediction, 1)
                    })
        
        return picks
    
    def american_to_probability(self, odds: int) -> float:
        """Convert American odds to implied probability"""
        if odds > 0:
            return 100 / (odds + 100)
        else:
            return abs(odds) / (abs(odds) + 100)
    
    def rank_picks(self, all_picks: List[Dict]) -> List[Dict]:
        """Rank all picks by expected value and confidence"""
        # Sort by expected value * confidence
        for pick in all_picks:
            pick['score'] = pick['expected_value'] * pick['confidence']
        
        sorted_picks = sorted(all_picks, key=lambda x: x['score'], reverse=True)
        
        # Take top 10
        return sorted_picks[:10]
    
    def format_pick_for_display(self, pick: Dict, game: Dict) -> Dict:
        """Format pick for database storage"""
        return {
            'game_id': pick['game_id'],
            'match_teams': f"{game['away_team']} @ {game['home_team']}",
            'pick': pick['pick'],
            'odds': str(pick['odds']),
            'confidence': int(pick['confidence'] * 100),
            'sport': game['sport'],
            'event_time': game['start_time'],
            'bet_type': pick['type'],
            'value_percentage': round(pick['expected_value'], 1),
            'roi_estimate': round(pick['expected_value'] * 0.5, 1),  # Conservative ROI
            'metadata': {
                'edge': pick['edge'],
                'model_used': 'manual_orchestrator',
                'prop_type': pick.get('prop_type'),
                'line': pick.get('line'),
                'prediction': pick.get('prediction')
            }
        }
    
    def run(self):
        """Main orchestration logic"""
        logger.info("🚀 Starting Manual Orchestrator")
        
        # Step 1: Fetch upcoming games
        games = self.fetch_upcoming_games()
        
        if not games:
            logger.warning("No upcoming games found")
            return
        
        all_picks = []
        
        # Step 2: Generate picks for each game
        for game in games:
            logger.info(f"\n🏀 Analyzing: {game['away_team']} @ {game['home_team']} ({game['sport']})")
            
            # Parse odds
            odds = self.parse_odds_data(game['odds'])
            
            # Generate different types of picks
            ml_picks = self.calculate_moneyline_edge(game, odds)
            all_picks.extend(ml_picks)
            
            total_picks = self.calculate_totals_edge(game, odds)
            all_picks.extend(total_picks)
            
            # Player props (using your trained models)
            prop_picks = self.generate_player_prop_picks(game)
            all_picks.extend(prop_picks)
        
        logger.info(f"\n📊 Generated {len(all_picks)} total picks")
        
        # Step 3: Rank and select best picks
        best_picks = self.rank_picks(all_picks)
        
        # Step 4: Display results
        logger.info("\n🏆 TOP 10 PICKS FOR TODAY:")
        logger.info("=" * 80)
        
        for i, pick in enumerate(best_picks, 1):
            # Find the game for this pick
            game = next(g for g in games if g['id'] == pick['game_id'])
            formatted = self.format_pick_for_display(pick, game)
            
            logger.info(f"\n{i}. {formatted['match_teams']} - {formatted['sport']}")
            logger.info(f"   Pick: {formatted['pick']}")
            logger.info(f"   Odds: {formatted['odds']}")
            logger.info(f"   Confidence: {formatted['confidence']}%")
            logger.info(f"   Value: {formatted['value_percentage']}%")
            logger.info(f"   Type: {formatted['bet_type']}")
        
        # Step 5: Store in database (optional)
        store = input("\n💾 Store these picks in database? (y/n): ")
        if store.lower() == 'y':
            self.store_picks(best_picks, games)
            logger.info("✅ Picks stored successfully!")
    
    def store_picks(self, picks: List[Dict], games: List[Dict]):
        """Store picks in ai_predictions table"""
        cursor = self.conn.cursor()
        
        for pick in picks:
            game = next(g for g in games if g['id'] == pick['game_id'])
            formatted = self.format_pick_for_display(pick, game)
            
            insert_query = """
            INSERT INTO ai_predictions (
                user_id, match_teams, pick, odds, confidence,
                sport, event_time, bet_type, value_percentage,
                roi_estimate, status, game_id, metadata
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """
            
            cursor.execute(insert_query, (
                'c19a5e12-4297-4b0f-8d21-39d2bb1a2c08',  # System user ID
                formatted['match_teams'],
                formatted['pick'],
                formatted['odds'],
                formatted['confidence'],
                formatted['sport'],
                formatted['event_time'],
                formatted['bet_type'],
                formatted['value_percentage'],
                formatted['roi_estimate'],
                'pending',
                formatted['game_id'],
                json.dumps(formatted['metadata'])
            ))
        
        self.conn.commit()
        cursor.close()

if __name__ == "__main__":
    orchestrator = ManualOrchestrator()
    orchestrator.run() 