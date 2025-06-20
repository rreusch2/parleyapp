#!/usr/bin/env python3
"""
ParleyApp Sports Betting Prediction API
Provides player props, over/under, and parlay predictions
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

# Add the sports betting package to Python path
sys.path.insert(0, '../sports-betting/src')

from sportsbet.evaluation._player_props import PlayerPropsBettor, MultiPropBettor, create_sample_player_data

# Import real data integration
from real_data_integration import RealDataManager, setup_real_data_integration

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global model storage (in production, use Redis or database)
MODELS = {}
PLAYER_DATA_CACHE = {}


class ParlayPredictor:
    """Main prediction service for parlays and props."""
    
    def __init__(self):
        self.prop_models = {}
        self.over_under_models = {}
        
        # Initialize real data manager
        try:
            self.real_data_manager = setup_real_data_integration()
            self.use_real_data = True
            logger.info("✅ Real data integration enabled")
        except Exception as e:
            logger.warning(f"⚠️ Real data integration failed, using mock data: {e}")
            self.real_data_manager = None
            self.use_real_data = False
        
    def load_models(self):
        """Load or initialize prediction models."""
        logger.info("Loading prediction models...")
        
        # Initialize player props models for different sports/prop types
        for sport in ['NBA', 'NFL', 'MLB', 'NHL']:
            self.prop_models[sport] = {}
            
            if sport == 'NBA':
                prop_types = ['points', 'rebounds', 'assists', 'three_pointers', 'steals', 'blocks']
            elif sport == 'NFL':
                prop_types = ['passing_yards', 'rushing_yards', 'receiving_yards', 'touchdowns', 'completions', 'targets']
            elif sport == 'MLB':
                prop_types = ['hits', 'runs', 'rbis', 'strikeouts', 'home_runs', 'stolen_bases']
            else:  # NHL
                prop_types = ['goals', 'assists', 'shots', 'saves', 'penalty_minutes', 'plus_minus']
            
            for prop_type in prop_types:
                try:
                    model = PlayerPropsBettor(
                        model_type='random_forest',
                        prop_type=prop_type,
                        sport=sport
                    )
                    
                    # Train with sample data (in production, use real historical data)
                    sample_data = create_sample_player_data(sport, 500)
                    
                    # More flexible column matching
                    target_columns = [
                        f'player_{prop_type}',
                        f'{prop_type}',
                        f'output__{prop_type}'
                    ]
                    
                    target_col = None
                    for col in target_columns:
                        if col in sample_data.columns:
                            target_col = col
                            break
                    
                    if target_col:
                        model.fit(sample_data, sample_data[target_col])
                        self.prop_models[sport][prop_type] = model
                        logger.info(f"Loaded {sport} {prop_type} model")
                    else:
                        logger.warning(f"No target column found for {sport} {prop_type}")
                        
                except Exception as e:
                    logger.error(f"Failed to load {sport} {prop_type} model: {e}")
        
        logger.info("All models loaded successfully")
    
    def predict_player_prop(
        self, 
        sport: str, 
        prop_type: str, 
        player_stats: Dict, 
        line_value: float
    ) -> Dict[str, Any]:
        """Predict a single player prop."""
        try:
            if sport not in self.prop_models or prop_type not in self.prop_models[sport]:
                return {
                    'error': f'Model not available for {sport} {prop_type}',
                    'available_models': list(self.prop_models.get(sport, {}).keys())
                }
            
            model = self.prop_models[sport][prop_type]
            
            # Convert player stats to DataFrame
            features_df = pd.DataFrame([player_stats])
            
            # Make prediction
            prediction = model.predict_with_confidence(features_df, line_value)
            
            return {
                'success': True,
                'sport': sport,
                'prop_type': prop_type,
                'prediction': prediction,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error predicting {sport} {prop_type}: {str(e)}")
            return {'error': str(e)}
    
    def predict_over_under(
        self, 
        sport: str, 
        game_data: Dict, 
        total_line: float
    ) -> Dict[str, Any]:
        """Predict over/under for game totals."""
        try:
            # Simple over/under prediction logic (replace with ML model)
            home_avg = game_data.get('home_avg_points', 100)
            away_avg = game_data.get('away_avg_points', 100)
            home_defense = game_data.get('home_defense_avg', 100)
            away_defense = game_data.get('away_defense_avg', 100)
            
            # Calculate predicted total
            predicted_total = (home_avg + away_avg + home_defense + away_defense) / 2
            
            # Adjust for game factors
            if game_data.get('weather'):
                weather = game_data['weather']
                if weather.get('wind_speed', 0) > 15:
                    predicted_total *= 0.95
                if weather.get('precipitation', 0) > 0:
                    predicted_total *= 0.92
                if weather.get('temperature', 70) < 40:
                    predicted_total *= 0.94
            
            # Calculate confidence and recommendation
            difference = abs(predicted_total - total_line)
            value_percentage = (difference / total_line) * 100
            
            confidence = 65
            if value_percentage > 5:
                confidence += min(value_percentage * 2, 20)
            
            recommendation = "Over" if predicted_total > total_line else "Under"
            
            return {
                'success': True,
                'sport': sport,
                'predicted_total': round(predicted_total, 1),
                'line_value': total_line,
                'recommendation': recommendation,
                'confidence': min(confidence, 95),
                'value_percentage': round(value_percentage, 2),
                'factors': {
                    'home_avg': home_avg,
                    'away_avg': away_avg,
                    'weather_impact': bool(game_data.get('weather')),
                    'game_factors': list(game_data.keys())
                },
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error predicting over/under: {str(e)}")
            return {'error': str(e)}
    
    def analyze_parlay(self, legs: List[Dict]) -> Dict[str, Any]:
        """Analyze a parlay and calculate combined odds/recommendations."""
        try:
            if len(legs) < 2:
                return {'error': 'Parlay must have at least 2 legs'}
            
            total_confidence = 1.0
            expected_values = []
            leg_results = []
            
            for i, leg in enumerate(legs):
                leg_type = leg.get('type')
                
                if leg_type == 'player_prop':
                    result = self.predict_player_prop(
                        leg['sport'],
                        leg['prop_type'],
                        leg['player_stats'],
                        leg['line_value']
                    )
                elif leg_type == 'over_under':
                    result = self.predict_over_under(
                        leg['sport'],
                        leg['game_data'],
                        leg['total_line']
                    )
                else:
                    result = {'error': f'Unknown leg type: {leg_type}'}
                
                if 'error' not in result:
                    confidence = result.get('prediction', result).get('confidence', 50) / 100
                    total_confidence *= confidence
                    expected_values.append(result.get('prediction', result).get('value_percentage', 0))
                    leg_results.append(result)
                else:
                    return {'error': f'Error in leg {i+1}: {result["error"]}'}
            
            # Calculate parlay metrics
            avg_confidence = total_confidence ** (1/len(legs)) * 100
            avg_value = sum(expected_values) / len(expected_values)
            
            # Simple Kelly Criterion for parlay sizing
            parlay_odds = 1.91 ** len(legs)  # Assuming -110 for each leg
            kelly_fraction = 0
            
            if total_confidence > (1 / parlay_odds):
                kelly_fraction = (total_confidence * parlay_odds - 1) / (parlay_odds - 1)
            
            recommended_stake = max(kelly_fraction * 100, 0)  # As percentage of bankroll
            
            return {
                'success': True,
                'parlay_analysis': {
                    'total_legs': len(legs),
                    'combined_confidence': round(avg_confidence, 1),
                    'average_value': round(avg_value, 2),
                    'estimated_payout': round(parlay_odds, 2),
                    'recommended_stake_percentage': round(min(recommended_stake, 10), 2),  # Cap at 10%
                    'kelly_fraction': round(kelly_fraction, 4),
                    'risk_level': 'Low' if len(legs) <= 3 else 'Medium' if len(legs) <= 6 else 'High'
                },
                'individual_legs': leg_results,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing parlay: {str(e)}")
            return {'error': str(e)}


# Initialize predictor
predictor = ParlayPredictor()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'parley-predictor',
        'timestamp': datetime.now().isoformat(),
        'models_loaded': len(predictor.prop_models)
    })


@app.route('/api/predict/player-prop', methods=['POST'])
def predict_player_prop():
    """Predict a player prop."""
    try:
        data = request.get_json()
        
        required_fields = ['sport', 'prop_type', 'line_value', 'player_stats']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        result = predictor.predict_player_prop(
            data['sport'],
            data['prop_type'],
            data['player_stats'],
            data['line_value']
        )
        
        status_code = 200 if 'error' not in result else 400
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error in predict_player_prop: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/predict/over-under', methods=['POST'])
def predict_over_under():
    """Predict over/under for game totals."""
    try:
        data = request.get_json()
        
        required_fields = ['sport', 'total_line', 'game_data']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        result = predictor.predict_over_under(
            data['sport'],
            data['game_data'],
            data['total_line']
        )
        
        status_code = 200 if 'error' not in result else 400
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error in predict_over_under: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/analyze/parlay', methods=['POST'])
def analyze_parlay():
    """Analyze a parlay."""
    try:
        data = request.get_json()
        
        if 'legs' not in data:
            return jsonify({'error': 'Missing required field: legs'}), 400
        
        result = predictor.analyze_parlay(data['legs'])
        
        status_code = 200 if 'error' not in result else 400
        return jsonify(result), status_code
        
    except Exception as e:
        logger.error(f"Error in analyze_parlay: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/models/available', methods=['GET'])
def get_available_models():
    """Get list of available prediction models."""
    try:
        available_models = {}
        
        for sport, models in predictor.prop_models.items():
            available_models[sport] = {
                'prop_types': list(models.keys()),
                'model_count': len(models)
            }
        
        return jsonify({
            'success': True,
            'available_models': available_models,
            'total_models': sum(len(models) for models in predictor.prop_models.values()),
            'supported_features': [
                'player_props',
                'over_under',
                'parlay_analysis'
            ]
        })
        
    except Exception as e:
        logger.error(f"Error getting available models: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/models/retrain', methods=['POST'])
def retrain_models():
    """Retrain models with new data (development endpoint)."""
    try:
        # This would typically load new training data from database
        # For now, just reinitialize with sample data
        predictor.load_models()
        
        return jsonify({
            'success': True,
            'message': 'Models retrained successfully',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error retraining models: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/examples/player-prop', methods=['GET'])
def example_player_prop():
    """Get example request for player prop prediction."""
    example = {
        "sport": "NBA",
        "prop_type": "points",
        "line_value": 24.5,
        "player_stats": {
            "player_points": 25.2,
            "opponent_allowed_points": 112.5,
            "is_home": 1,
            "days_rest": 1,
            "minutes_played": 34.5,
            "pace": 98.5,
            "back_to_back": 0,
            "usage_rate": 28.3
        }
    }
    
    return jsonify({
        'example_request': example,
        'endpoint': '/api/predict/player-prop',
        'method': 'POST',
        'description': 'Predict whether a player will go over or under their prop line'
    })


@app.route('/api/examples/parlay', methods=['GET'])
def example_parlay():
    """Get example request for parlay analysis."""
    example = {
        "legs": [
            {
                "type": "player_prop",
                "sport": "NBA",
                "prop_type": "points",
                "line_value": 24.5,
                "player_stats": {
                    "player_points": 25.2,
                    "opponent_allowed_points": 112.5,
                    "is_home": 1,
                    "days_rest": 1,
                    "minutes_played": 34.5,
                    "pace": 98.5
                }
            },
            {
                "type": "over_under",
                "sport": "NBA",
                "total_line": 225.5,
                "game_data": {
                    "home_avg_points": 115.2,
                    "away_avg_points": 108.7,
                    "home_defense_avg": 109.3,
                    "away_defense_avg": 112.1,
                    "pace": 98.5
                }
            }
        ]
    }
    
    return jsonify({
        'example_request': example,
        'endpoint': '/api/analyze/parlay',
        'method': 'POST',
        'description': 'Analyze a multi-leg parlay and get recommendations'
    })


# Commented out for now due to indentation issues - will be re-added in future update
# @app.route('/api/generate/daily-picks', methods=['POST']) 
# @app.route('/api/generate/player-all-props', methods=['POST'])

@app.route('/api/generate/player-all-props', methods=['POST'])
def generate_all_player_props():
    """Generate predictions for all available props for a specific player"""
    try:
        data = request.get_json()
        
        player_name = data.get('player_name')
        sport = data.get('sport')
        player_stats = data.get('player_stats')
        
        if not all([player_name, sport, player_stats]):
            return jsonify({'error': 'Missing required fields: player_name, sport, player_stats'}), 400
        
        # Get all available prop types for this sport
        available_props = list(predictor.prop_models.get(sport, {}).keys())
        
        if not available_props:
            return jsonify({
                'error': f'No models available for sport: {sport}',
                'available_sports': list(predictor.prop_models.keys())
            }), 400
        
        all_predictions = []
        
        for prop_type in available_props:
            # Use default line values (in real app, get from sportsbook API)
            default_lines = {
                'points': 24.5,
                'rebounds': 9.5,
                'assists': 7.5,
                'three_pointers': 2.5,
                'passing_yards': 275.5,
                'rushing_yards': 85.5,
                'receiving_yards': 65.5,
                'touchdowns': 1.5,
                'hits': 1.5,
                'runs': 0.5,
                'rbis': 1.5,
                'strikeouts': 6.5,
                'goals': 0.5,
                'shots': 3.5,
                'saves': 25.5
            }
            
            line_value = default_lines.get(prop_type, 10.0)
            
            # Get prediction for this prop
            prediction = predictor.predict_player_prop(sport, prop_type, player_stats, line_value)
            
            if prediction.get('success'):
                pred_data = prediction['prediction']
                all_predictions.append({
                    'prop_type': prop_type,
                    'line_value': line_value,
                    'predicted_value': pred_data.get('predicted_value'),
                    'recommendation': pred_data.get('recommendation'),
                    'confidence': pred_data.get('confidence'),
                    'value_percentage': pred_data.get('value_percentage'),
                    'expected_profit': pred_data.get('expected_profit')
                })
        
        if not all_predictions:
            return jsonify({'error': 'No successful predictions generated'}), 400
        
        # Sort by value percentage (best value first)
        all_predictions.sort(key=lambda x: x.get('value_percentage', 0), reverse=True)
        
        # Filter for only positive value bets
        value_bets = [p for p in all_predictions if p.get('value_percentage', 0) > 0]
        
        return jsonify({
            'success': True,
            'player_name': player_name,
            'sport': sport,
            'total_props_analyzed': len(all_predictions),
            'value_bets_found': len(value_bets),
            'best_predictions': all_predictions[:5],  # Top 5
            'value_bets': value_bets,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error generating all player props: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/generate/daily-picks', methods=['POST'])
def generate_daily_picks():
    """Generate best daily picks across all bet types"""
    try:
        data = request.get_json()
        
        # Optional fields with defaults
        date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
        sports = data.get('sports', ['NBA', 'NFL'])
        min_confidence = data.get('min_confidence', 70)
        max_picks = data.get('max_picks', 10)
        games = data.get('games', [])  # Real games would come from database
        
        all_picks = []
        
        # If no games provided, use sample data
        if not games:
            games = [
                {
                    'sport': 'NBA',
                    'game_id': 'nba_001',
                    'home_team': 'Lakers',
                    'away_team': 'Warriors', 
                    'game_time': '7:00 PM ET',
                    'players': [
                        {
                            'name': 'LeBron James',
                            'team': 'Lakers',
                            'props': ['points', 'rebounds', 'assists'],
                            'stats': {
                                'player_points': 25.2, 'opponent_allowed_points': 112.5,
                                'is_home': 1, 'days_rest': 1, 'minutes_played': 34.5,
                                'pace': 98.5, 'team_off_rating': 110.2, 'team_def_rating': 108.1
                            }
                        },
                        {
                            'name': 'Stephen Curry', 
                            'team': 'Warriors',
                            'props': ['points', 'assists'],
                            'stats': {
                                'player_points': 28.4, 'opponent_allowed_points': 108.2,
                                'is_home': 0, 'days_rest': 2, 'minutes_played': 35.8,
                                'pace': 102.1, 'team_off_rating': 118.5, 'team_def_rating': 110.4
                            }
                        }
                    ],
                    'totals': {
                        'game_total': 230.5,
                        'game_data': {
                            'home_avg_points': 115.2, 'away_avg_points': 118.5,
                            'home_defense_avg': 110.1, 'away_defense_avg': 112.8,
                            'pace_factor': 1.02
                        }
                    }
                }
            ]
        
        # Generate picks for each game
        for game in games:
            sport = game['sport']
            game_desc = f"{game['away_team']} @ {game['home_team']}"
            
            # Player props
            for player in game.get('players', []):
                for prop_type in player.get('props', []):
                    if sport in predictor.prop_models and prop_type in predictor.prop_models[sport]:
                        
                        # Default line values
                        default_lines = {
                            'points': 24.5, 'rebounds': 9.5, 'assists': 7.5, 'three_pointers': 2.5
                        }
                        line_value = default_lines.get(prop_type, 10.0)
                        
                        prediction = predictor.predict_player_prop(
                            sport, prop_type, player['stats'], line_value
                        )
                        
                        if prediction.get('success'):
                            pred_data = prediction['prediction']
                            confidence = pred_data.get('confidence', 0)
                            value_pct = pred_data.get('value_percentage', 0)
                            
                            if confidence >= min_confidence and value_pct > 0:
                                pick = {
                                    'pick_type': 'player_prop',
                                    'sport': sport,
                                    'game': game_desc,
                                    'game_time': game.get('game_time', 'TBD'),
                                    'player': player['name'],
                                    'team': player.get('team', ''),
                                    'prop_type': prop_type,
                                    'line_value': line_value,
                                    'predicted_value': pred_data.get('predicted_value'),
                                    'recommendation': pred_data.get('recommendation'),
                                    'confidence': confidence,
                                    'value_percentage': value_pct,
                                    'expected_profit': pred_data.get('expected_profit'),
                                    'priority_score': confidence * value_pct
                                }
                                all_picks.append(pick)
            
            # Game totals (simplified prediction for demo)
            totals = game.get('totals', {})
            if totals:
                game_data = totals.get('game_data', {})
                total_line = totals.get('game_total', 220.0)
                
                prediction = predictor.predict_over_under(sport, game_data, total_line)
                
                if prediction.get('success'):
                    confidence = prediction.get('confidence', 0)
                    value_pct = prediction.get('value_percentage', 0)
                    
                    if confidence >= min_confidence and value_pct > 0:
                        pick = {
                            'pick_type': 'game_total',
                            'sport': sport,
                            'game': game_desc,
                            'game_time': game.get('game_time', 'TBD'),
                            'bet_type': 'Over/Under',
                            'line_value': total_line,
                            'predicted_value': prediction.get('predicted_total'),
                            'recommendation': prediction.get('recommendation'),
                            'confidence': confidence,
                            'value_percentage': value_pct,
                            'expected_profit': 0,  # Would calculate based on odds
                            'priority_score': confidence * value_pct
                        }
                        all_picks.append(pick)
        
        # Sort by priority score (confidence * value)
        all_picks.sort(key=lambda x: x['priority_score'], reverse=True)
        top_picks = all_picks[:max_picks]
        
        # Calculate summary stats
        total_analyzed = len(all_picks)
        avg_confidence = sum(p['confidence'] for p in top_picks) / len(top_picks) if top_picks else 0
        avg_value = sum(p['value_percentage'] for p in top_picks) / len(top_picks) if top_picks else 0
        
        return jsonify({
            'success': True,
            'date': date,
            'sports_analyzed': sports,
            'games_analyzed': len(games),
            'total_picks_found': total_analyzed,
            'picks_returned': len(top_picks),
            'summary': {
                'avg_confidence': round(avg_confidence, 1),
                'avg_value_percentage': round(avg_value, 2),
                'best_pick': top_picks[0] if top_picks else None
            },
            'daily_picks': top_picks,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error generating daily picks: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/integrate/live-games', methods=['POST'])
def integrate_live_games():
    """Integrate with live sports data APIs to get current games and player props."""
    try:
        data = request.get_json()
        sport = data.get('sport', 'NBA')
        date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
        api_key = data.get('api_key')  # For external APIs
        
        # This would integrate with real APIs like:
        # - The Odds API: https://the-odds-api.com/
        # - ESPN API: http://site.api.espn.com/apis/site/v2/sports/
        # - FanDuel/DraftKings APIs
        
        # Mock implementation for demonstration
        live_games = [
            {
                'game_id': f'{sport.lower()}_game_001',
                'sport': sport,
                'date': date,
                'home_team': 'Los Angeles Lakers',
                'away_team': 'Golden State Warriors',
                'game_time': '7:00 PM ET',
                'status': 'scheduled',
                'players': [
                    {
                        'id': 'lebron_james',
                        'name': 'LeBron James',
                        'team': 'Lakers',
                        'position': 'F',
                        'props_available': {
                            'points': {'line': 24.5, 'over_odds': -110, 'under_odds': -110},
                            'rebounds': {'line': 9.5, 'over_odds': -115, 'under_odds': -105},
                            'assists': {'line': 7.5, 'over_odds': -105, 'under_odds': -115}
                        },
                        'recent_stats': {
                            'points_avg_5': 25.2,
                            'rebounds_avg_5': 8.8,
                            'assists_avg_5': 6.9,
                            'minutes_avg_5': 35.4
                        }
                    },
                    {
                        'id': 'stephen_curry',
                        'name': 'Stephen Curry',
                        'team': 'Warriors',
                        'position': 'G',
                        'props_available': {
                            'points': {'line': 27.5, 'over_odds': -110, 'under_odds': -110},
                            'three_pointers': {'line': 4.5, 'over_odds': -120, 'under_odds': +100},
                            'assists': {'line': 6.5, 'over_odds': -110, 'under_odds': -110}
                        },
                        'recent_stats': {
                            'points_avg_5': 28.4,
                            'three_pointers_avg_5': 5.1,
                            'assists_avg_5': 6.2,
                            'minutes_avg_5': 34.8
                        }
                    }
                ],
                'totals': {
                    'game_total': {'line': 230.5, 'over_odds': -110, 'under_odds': -110},
                    'team_totals': {
                        'home': {'line': 115.5, 'over_odds': -110, 'under_odds': -110},
                        'away': {'line': 115.0, 'over_odds': -110, 'under_odds': -110}
                    }
                }
            }
        ]
        
        # Generate AI predictions for all available props
        ai_predictions = []
        
        for game in live_games:
            for player in game['players']:
                for prop_type, prop_data in player['props_available'].items():
                    try:
                        # Prepare player stats for AI prediction
                        player_stats = {
                            f'player_{prop_type}': player['recent_stats'].get(f'{prop_type}_avg_5', prop_data['line']),
                            'opponent_allowed_points': 110,  # Would get from real data
                            'is_home': 1 if player['team'] == game['home_team'] else 0,
                            'days_rest': 1,  # Would calculate from schedule
                            'minutes_played': player['recent_stats'].get('minutes_avg_5', 35),
                            'pace': 100,  # Would get from team stats
                            'team_off_rating': 110,
                            'team_def_rating': 110
                        }
                        
                        prediction = predictor.predict_player_prop(
                            sport,
                            prop_type,
                            player_stats,
                            prop_data['line']
                        )
                        
                        if prediction.get('success'):
                            pred_data = prediction['prediction']
                            ai_predictions.append({
                                'game_id': game['game_id'],
                                'player_name': player['name'],
                                'team': player['team'],
                                'prop_type': prop_type,
                                'line_value': prop_data['line'],
                                'predicted_value': pred_data['predicted_value'],
                                'recommendation': pred_data['recommendation'],
                                'confidence': pred_data['confidence'],
                                'value_percentage': pred_data['value_percentage'],
                                'odds': prop_data['over_odds'] if pred_data['recommendation'] == 'Over' else prop_data['under_odds'],
                                'expected_profit': pred_data['expected_profit'],
                                'game_time': game['game_time']
                            })
                    except Exception as e:
                        logger.error(f"Error predicting {player['name']} {prop_type}: {e}")
        
        # Sort by value percentage
        ai_predictions.sort(key=lambda x: x['value_percentage'], reverse=True)
        
        return jsonify({
            'success': True,
            'sport': sport,
            'date': date,
            'games_found': len(live_games),
            'total_props_analyzed': len(ai_predictions),
            'games': live_games,
            'ai_predictions': ai_predictions[:20],  # Top 20 predictions
            'best_bets': [p for p in ai_predictions if p['value_percentage'] > 5][:10],
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error integrating live games: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/automate/daily-analysis', methods=['POST'])
def automate_daily_analysis():
    """Automated daily analysis that could be run via cron job."""
    try:
        data = request.get_json()
        sports = data.get('sports', ['NBA', 'NFL'])
        min_confidence = data.get('min_confidence', 75)
        max_picks = data.get('max_picks', 10)
        
        all_analysis = {}
        
        for sport in sports:
            # Get live games (would integrate with real API)
            live_games_response = integrate_live_games()
            live_data = live_games_response.get_json()
            
            if live_data.get('success'):
                sport_analysis = {
                    'games_analyzed': live_data['games_found'],
                    'total_props': live_data['total_props_analyzed'],
                    'best_bets': live_data['best_bets'],
                    'top_players': {},
                    'value_summary': {}
                }
                
                # Analyze top performers
                predictions = live_data['ai_predictions']
                for pred in predictions[:10]:
                    player = pred['player_name']
                    if player not in sport_analysis['top_players']:
                        sport_analysis['top_players'][player] = []
                    sport_analysis['top_players'][player].append({
                        'prop': pred['prop_type'],
                        'confidence': pred['confidence'],
                        'value': pred['value_percentage']
                    })
                
                # Calculate value summary
                if predictions:
                    sport_analysis['value_summary'] = {
                        'avg_confidence': sum(p['confidence'] for p in predictions) / len(predictions),
                        'avg_value_percentage': sum(p['value_percentage'] for p in predictions) / len(predictions),
                        'high_confidence_bets': len([p for p in predictions if p['confidence'] >= min_confidence]),
                        'positive_value_bets': len([p for p in predictions if p['value_percentage'] > 0])
                    }
                
                all_analysis[sport] = sport_analysis
        
        return jsonify({
            'success': True,
            'analysis_date': datetime.now().strftime('%Y-%m-%d'),
            'sports_analyzed': sports,
            'analysis': all_analysis,
            'summary': {
                'total_games': sum(a['games_analyzed'] for a in all_analysis.values()),
                'total_props': sum(a['total_props'] for a in all_analysis.values()),
                'total_best_bets': sum(len(a['best_bets']) for a in all_analysis.values())
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in daily analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Load models on startup
    predictor.load_models()
    
    # Get port from environment or default to 5001
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting ParleyApp Prediction API on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug) 