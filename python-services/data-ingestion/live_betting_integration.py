#!/usr/bin/env python3

import psycopg2
import requests
import pandas as pd
import numpy as np
import os
import json
import time
from dotenv import load_dotenv
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from real_mlb_props_predictor import RealMLBPropsBettor

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('live_betting_integration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class LiveBettingIntegrator:
    """Integrate massive MLB dataset with The Odds API for real-time predictions"""
    
    def __init__(self):
        self.conn = None
        self.odds_api_key = os.getenv('ODDS_API_KEY')  # From The Odds API
        self.odds_base_url = "https://api.the-odds-api.com/v4"
        self.predictor = None
        self._connect()
        self._initialize_predictor()
    
    def _connect(self):
        """Connect to Supabase database"""
        try:
            self.conn = psycopg2.connect(
                host=os.getenv('DB_HOST'),
                database=os.getenv('DB_NAME'),
                user=os.getenv('DB_USER'),
                password=os.getenv('DB_PASSWORD'),
                port=int(os.getenv('DB_PORT', 5432)),
                sslmode='require'
            )
            logger.info("✅ Database connection established")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def _initialize_predictor(self):
        """Initialize the real MLB predictor with our massive dataset"""
        try:
            logger.info("🤖 Initializing Real MLB Predictor with massive dataset...")
            self.predictor = RealMLBPropsBettor()
            
            # Train on our massive 1,520 record dataset
            self.predictor.train_model()
            
            logger.info("✅ Real MLB Predictor initialized with 1,520+ records!")
        except Exception as e:
            logger.error(f"❌ Predictor initialization failed: {e}")
            self.predictor = None
    
    def get_live_odds(self, sport: str = 'baseball_mlb') -> List[Dict]:
        """Get live betting odds from The Odds API"""
        
        if not self.odds_api_key:
            logger.error("❌ ODDS_API_KEY not found in environment variables")
            return []
        
        try:
            # Get live games with odds
            url = f"{self.odds_base_url}/sports/{sport}/odds"
            params = {
                'apiKey': self.odds_api_key,
                'regions': 'us',
                'markets': 'h2h,spreads,totals,player_props',
                'oddsFormat': 'american',
                'dateFormat': 'iso'
            }
            
            logger.info("📡 Fetching live odds from The Odds API...")
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            games = response.json()
            logger.info(f"✅ Retrieved {len(games)} live games with odds")
            
            return games
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch live odds: {e}")
            return []
    
    def get_player_props_odds(self, sport: str = 'baseball_mlb') -> List[Dict]:
        """Get player prop betting odds"""
        
        if not self.odds_api_key:
            return []
        
        try:
            url = f"{self.odds_base_url}/sports/{sport}/odds"
            params = {
                'apiKey': self.odds_api_key,
                'regions': 'us',
                'markets': 'player_hits,player_home_runs,player_rbis,player_strikeouts',
                'oddsFormat': 'american',
                'dateFormat': 'iso'
            }
            
            logger.info("⚾ Fetching player prop odds...")
            response = requests.get(url, params=params)
            response.raise_for_status()
            
            props = response.json()
            logger.info(f"✅ Retrieved player props for {len(props)} games")
            
            return props
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch player props: {e}")
            return []
    
    def analyze_betting_opportunity(self, game_odds: Dict, player_props: List[Dict] = None) -> Dict[str, Any]:
        """Analyze a betting opportunity using our massive dataset"""
        
        if not self.predictor:
            return {'error': 'Predictor not initialized'}
        
        try:
            analysis = {
                'game_id': game_odds.get('id'),
                'home_team': game_odds.get('home_team'),
                'away_team': game_odds.get('away_team'),
                'commence_time': game_odds.get('commence_time'),
                'predictions': [],
                'recommended_bets': [],
                'confidence_scores': {}
            }
            
            # Analyze team matchup
            teams = [game_odds.get('home_team'), game_odds.get('away_team')]
            
            # Get our historical data for these teams
            cursor = self.conn.cursor()
            
            for team in teams:
                try:
                    # Get recent player performances for this team
                    cursor.execute("""
                        SELECT p.name, p.external_player_id, pgs.stats
                        FROM players p
                        JOIN player_game_stats pgs ON p.id = pgs.player_id
                        WHERE p.team = %s
                        ORDER BY pgs.created_at DESC
                        LIMIT 50;
                    """, (team,))
                    
                    team_data = cursor.fetchall()
                    
                    if team_data:
                        # Use our real predictor for each player
                        team_predictions = []
                        
                        for player_name, mlb_id, stats_json in team_data[:10]:  # Top 10 players
                            try:
                                stats = json.loads(stats_json) if isinstance(stats_json, str) else stats_json
                                
                                # Create prediction input
                                prediction_input = {
                                    'player_name': player_name,
                                    'recent_ba': stats.get('estimated_ba', 0.250),
                                    'recent_hr': stats.get('home_runs', 0),
                                    'launch_speed': stats.get('avg_launch_speed', 90.0),
                                    'launch_angle': stats.get('avg_launch_angle', 15.0)
                                }
                                
                                # Generate prediction using our massive dataset
                                if self.predictor:
                                    prediction = self.predictor.predict_player_performance(prediction_input)
                                    team_predictions.append({
                                        'player': player_name,
                                        'predicted_hits': prediction.get('predicted_hits', 0),
                                        'confidence': prediction.get('confidence', 0.5)
                                    })
                                
                            except Exception as e:
                                logger.warning(f"Error predicting for {player_name}: {e}")
                                continue
                        
                        analysis['predictions'].append({
                            'team': team,
                            'player_predictions': team_predictions,
                            'team_total_predicted_hits': sum(p.get('predicted_hits', 0) for p in team_predictions)
                        })
                
                except Exception as e:
                    logger.warning(f"Error analyzing team {team}: {e}")
                    continue
            
            # Generate betting recommendations
            if analysis['predictions']:
                recommendations = self._generate_betting_recommendations(game_odds, analysis['predictions'])
                analysis['recommended_bets'] = recommendations
            
            return analysis
            
        except Exception as e:
            logger.error(f"❌ Error analyzing betting opportunity: {e}")
            return {'error': str(e)}
    
    def _generate_betting_recommendations(self, game_odds: Dict, predictions: List[Dict]) -> List[Dict]:
        """Generate specific betting recommendations based on our analysis"""
        
        recommendations = []
        
        try:
            # Analyze the bookmaker odds
            bookmakers = game_odds.get('bookmakers', [])
            
            for bookmaker in bookmakers:
                markets = bookmaker.get('markets', [])
                
                for market in markets:
                    market_key = market.get('key')
                    outcomes = market.get('outcomes', [])
                    
                    if market_key == 'totals':  # Over/Under predictions
                        for outcome in outcomes:
                            if outcome.get('name') == 'Over':
                                total_line = outcome.get('point')
                                odds = outcome.get('price')
                                
                                # Compare with our predictions
                                predicted_total = sum(p.get('team_total_predicted_hits', 0) for p in predictions)
                                
                                if predicted_total > total_line * 1.1:  # 10% edge
                                    recommendations.append({
                                        'type': 'over_total',
                                        'market': 'Total Hits',
                                        'line': total_line,
                                        'predicted': predicted_total,
                                        'odds': odds,
                                        'edge': ((predicted_total / total_line) - 1) * 100,
                                        'confidence': 'high' if predicted_total > total_line * 1.2 else 'medium',
                                        'reasoning': f"Our 1,520-record dataset predicts {predicted_total:.1f} total hits vs line of {total_line}"
                                    })
                    
                    elif market_key == 'h2h':  # Moneyline predictions
                        home_team_prediction = next((p for p in predictions if p['team'] == game_odds.get('home_team')), None)
                        away_team_prediction = next((p for p in predictions if p['team'] == game_odds.get('away_team')), None)
                        
                        if home_team_prediction and away_team_prediction:
                            home_score = home_team_prediction.get('team_total_predicted_hits', 0)
                            away_score = away_team_prediction.get('team_total_predicted_hits', 0)
                            
                            if abs(home_score - away_score) > 2:  # Significant edge
                                winner = game_odds.get('home_team') if home_score > away_score else game_odds.get('away_team')
                                winner_odds = next((o.get('price') for o in outcomes if o.get('name') == winner), None)
                                
                                if winner_odds:
                                    recommendations.append({
                                        'type': 'moneyline',
                                        'market': 'Winner',
                                        'pick': winner,
                                        'predicted_edge': abs(home_score - away_score),
                                        'odds': winner_odds,
                                        'confidence': 'high' if abs(home_score - away_score) > 3 else 'medium',
                                        'reasoning': f"Predicted hits: {winner} {max(home_score, away_score):.1f} vs opponent {min(home_score, away_score):.1f}"
                                    })
        
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
        
        return recommendations
    
    def run_live_analysis(self) -> Dict[str, Any]:
        """Run complete live betting analysis"""
        
        logger.info("🚀 STARTING LIVE BETTING ANALYSIS")
        logger.info("=" * 60)
        
        # Get live odds
        live_games = self.get_live_odds()
        
        if not live_games:
            logger.warning("⚠️ No live games found")
            return {'error': 'No live games available'}
        
        # Get player props
        player_props = self.get_player_props_odds()
        
        # Analyze each game
        analysis_results = []
        
        for game in live_games[:5]:  # Analyze top 5 games
            logger.info(f"🔍 Analyzing: {game.get('away_team')} @ {game.get('home_team')}")
            
            game_analysis = self.analyze_betting_opportunity(game, player_props)
            analysis_results.append(game_analysis)
            
            # Rate limiting
            time.sleep(1)
        
        # Summary
        total_recommendations = sum(len(r.get('recommended_bets', [])) for r in analysis_results)
        
        logger.info("🏁 LIVE BETTING ANALYSIS COMPLETE!")
        logger.info(f"📊 Analyzed {len(analysis_results)} games")
        logger.info(f"💡 Generated {total_recommendations} betting recommendations")
        
        return {
            'games_analyzed': len(analysis_results),
            'total_recommendations': total_recommendations,
            'analysis_results': analysis_results,
            'dataset_size': '1,520 professional MLB records',
            'prediction_model': 'RealMLBPropsBettor trained on Statcast data'
        }
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


def main():
    """Run live betting integration"""
    integrator = LiveBettingIntegrator()
    
    try:
        # Run live analysis
        results = integrator.run_live_analysis()
        
        print(f"\n🎉 LIVE BETTING INTEGRATION COMPLETE!")
        print(f"Results: {json.dumps(results, indent=2)}")
        
        # Save results
        with open('live_betting_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info("💾 Results saved to live_betting_results.json")
        
    except KeyboardInterrupt:
        logger.info("🛑 Operation cancelled by user")
    except Exception as e:
        logger.error(f"❌ Live betting integration failed: {e}")
    finally:
        integrator.close()


if __name__ == "__main__":
    main() 