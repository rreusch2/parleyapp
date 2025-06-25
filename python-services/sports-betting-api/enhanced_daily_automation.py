#!/usr/bin/env python3
"""
Enhanced Daily Automation Script for ParleyApp Phase 3
Leverages Phase 2 enhanced prediction models for improved accuracy
Automatically generates daily picks using real data and ML models
"""

import os
import sys
import json
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import numpy as np

# Add the current directory to the path to import enhanced_predictors
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from enhanced_predictors import (
        ModelTrainingFramework,
        EnhancedPlayerPropsPredictor,
        EnhancedSpreadPredictor,
        EnhancedOverUnderPredictor
    )
    ENHANCED_MODELS_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Enhanced models not available: {e}")
    ENHANCED_MODELS_AVAILABLE = False

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('enhanced_daily_automation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class EnhancedDailyAutomation:
    """Enhanced daily automation using Phase 2 prediction models"""
    
    def __init__(self):
        self.python_api_url = 'http://localhost:5001'
        self.backend_api_url = 'http://localhost:3001'
        self.model_framework = None
        
        # Initialize enhanced model framework if available
        if ENHANCED_MODELS_AVAILABLE:
            try:
                self.model_framework = ModelTrainingFramework()
                logger.info("✅ Enhanced model framework initialized")
            except Exception as e:
                logger.warning(f"⚠️ Could not initialize model framework: {e}")
        
        self.results = {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'enhanced_mode': ENHANCED_MODELS_AVAILABLE and self.model_framework is not None,
            'sports_analyzed': [],
            'total_predictions': 0,
            'enhanced_picks': [],
            'model_status': {},
            'errors': []
        }
    
    def run_enhanced_daily_analysis(self) -> Dict[str, Any]:
        """Run enhanced daily analysis using Phase 2 models"""
        logger.info("🚀 Starting enhanced daily analysis automation...")
        
        try:
            # 1. Check and initialize enhanced models
            if self.results['enhanced_mode']:
                logger.info("🔧 Initializing enhanced models...")
                model_status = self._initialize_enhanced_models()
                self.results['model_status'] = model_status
            
            # 2. Fetch today's games using enhanced data sources
            logger.info("📅 Fetching today's games...")
            games_data = self._fetch_todays_games()
            
            # 3. Generate enhanced predictions for each sport
            sports_to_analyze = ['NBA', 'NFL', 'MLB', 'NHL']
            for sport in sports_to_analyze:
                logger.info(f"📊 Analyzing {sport} with enhanced models...")
                sport_predictions = self._analyze_sport_enhanced(sport, games_data.get(sport, []))
                
                if sport_predictions:
                    self.results['sports_analyzed'].append(sport)
                    self.results['total_predictions'] += len(sport_predictions)
                    self.results['enhanced_picks'].extend(sport_predictions)
            
            # 4. Select top picks using enhanced criteria
            logger.info("🎯 Selecting top enhanced picks...")
            top_picks = self._select_top_enhanced_picks()
            
            # 5. Generate enhanced parlay recommendations
            logger.info("🔗 Generating enhanced parlay recommendations...")
            parlay_recommendations = self._generate_enhanced_parlays(top_picks)
            
            # 6. Save enhanced predictions to database
            logger.info("💾 Saving enhanced predictions to database...")
            saved_count = self._save_enhanced_predictions(top_picks)
            
            # 7. Generate comprehensive report
            self.results.update({
                'top_picks': top_picks[:15],
                'parlay_recommendations': parlay_recommendations,
                'saved_to_db': saved_count,
                'analysis_time': datetime.now().isoformat()
            })
            
            logger.info("✅ Enhanced daily analysis completed successfully!")
            return self.results
            
        except Exception as e:
            logger.error(f"❌ Error in enhanced daily analysis: {e}")
            self.results['errors'].append(str(e))
            return self.results
    
    def _initialize_enhanced_models(self) -> Dict[str, Any]:
        """Initialize and check status of enhanced models"""
        status = {
            'framework_available': False,
            'models_trained': {},
            'initialization_time': datetime.now().isoformat()
        }
        
        if not self.model_framework:
            return status
        
        try:
            # Check if models need training
            sports = ['NBA', 'NFL', 'MLB', 'NHL']
            prop_types = ['points', 'rebounds', 'assists', 'threes']
            
            for sport in sports:
                sport_status = {}
                
                # Check player props models
                for prop_type in prop_types:
                    try:
                        model = self.model_framework.get_model(sport, 'player_props', prop_type)
                        if model:
                            sport_status[f'{prop_type}_model'] = 'available'
                        else:
                            # Train model if not available
                            predictor = EnhancedPlayerPropsPredictor(sport, prop_type)
                            training_result = predictor.train()
                            sport_status[f'{prop_type}_model'] = training_result.get('status', 'failed')
                    except Exception as e:
                        sport_status[f'{prop_type}_model'] = f'error: {str(e)}'
                
                # Check spread model
                try:
                    spread_model = self.model_framework.get_model(sport, 'spread')
                    if spread_model:
                        sport_status['spread_model'] = 'available'
                    else:
                        predictor = EnhancedSpreadPredictor(sport)
                        training_result = predictor.train()
                        sport_status['spread_model'] = training_result.get('status', 'failed')
                except Exception as e:
                    sport_status['spread_model'] = f'error: {str(e)}'
                
                # Check total model
                try:
                    total_model = self.model_framework.get_model(sport, 'total')
                    if total_model:
                        sport_status['total_model'] = 'available'
                    else:
                        predictor = EnhancedOverUnderPredictor(sport)
                        training_result = predictor.train()
                        sport_status['total_model'] = training_result.get('status', 'failed')
                except Exception as e:
                    sport_status['total_model'] = f'error: {str(e)}'
                
                status['models_trained'][sport] = sport_status
            
            status['framework_available'] = True
            logger.info("✅ Enhanced models initialization completed")
            
        except Exception as e:
            logger.error(f"❌ Enhanced models initialization failed: {e}")
            status['error'] = str(e)
        
        return status
    
    def _fetch_todays_games(self) -> Dict[str, List[Dict]]:
        """Fetch today's games using enhanced data sources"""
        games_data = {}
        
        try:
            # Try to use enhanced API endpoints first
            response = requests.get(
                f'{self.python_api_url}/api/v2/games/today',
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                games_data = data.get('games_by_sport', {})
                logger.info(f"✅ Fetched games data for {len(games_data)} sports")
            else:
                # Fallback to individual sport fetching
                logger.info("📋 Using fallback game fetching...")
                for sport in ['NBA', 'NFL', 'MLB', 'NHL']:
                    sport_games = self._fetch_sport_games(sport)
                    if sport_games:
                        games_data[sport] = sport_games
        
        except Exception as e:
            logger.error(f"❌ Error fetching games data: {e}")
            self.results['errors'].append(f"Games fetch error: {str(e)}")
        
        return games_data
    
    def _fetch_sport_games(self, sport: str) -> List[Dict]:
        """Fetch games for a specific sport"""
        try:
            response = requests.get(
                f'{self.python_api_url}/api/games/{sport.lower()}/today',
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get('games', [])
        
        except Exception as e:
            logger.warning(f"⚠️ Could not fetch {sport} games: {e}")
        
        return []
    
    def _analyze_sport_enhanced(self, sport: str, games: List[Dict]) -> List[Dict]:
        """Analyze a sport using enhanced models"""
        predictions = []
        
        if not games:
            logger.info(f"📭 No games found for {sport}")
            return predictions
        
        try:
            for game in games:
                game_id = game.get('id', f"{sport}_{datetime.now().strftime('%Y%m%d')}")
                
                # Generate player props predictions
                player_props = self._predict_enhanced_player_props(sport, game)
                predictions.extend(player_props)
                
                # Generate spread predictions
                spread_prediction = self._predict_enhanced_spread(sport, game_id, game)
                if spread_prediction:
                    predictions.append(spread_prediction)
                
                # Generate total predictions
                total_prediction = self._predict_enhanced_total(sport, game_id, game)
                if total_prediction:
                    predictions.append(total_prediction)
        
        except Exception as e:
            logger.error(f"❌ Error analyzing {sport}: {e}")
            self.results['errors'].append(f"{sport} analysis error: {str(e)}")
        
        logger.info(f"✅ Generated {len(predictions)} predictions for {sport}")
        return predictions
    
    def _predict_enhanced_player_props(self, sport: str, game: Dict) -> List[Dict]:
        """Generate enhanced player props predictions"""
        predictions = []
        
        if not ENHANCED_MODELS_AVAILABLE or not self.model_framework:
            return predictions
        
        try:
            players = game.get('players', [])
            prop_types = ['points', 'rebounds', 'assists', 'threes']
            
            for player in players[:5]:  # Limit to top 5 players per game
                player_id = player.get('id', f"player_{player.get('name', 'unknown')}")
                
                for prop_type in prop_types:
                    try:
                        # Get or create enhanced model
                        predictor = EnhancedPlayerPropsPredictor(sport, prop_type)
                        
                        # Create game context
                        game_context = {
                            'is_home': player.get('is_home', True),
                            'rest_days': game.get('rest_days', 1),
                            'opponent': game.get('opponent', 'Unknown'),
                            'minutes_expected': player.get('minutes_avg', 30)
                        }
                        
                        # Get line from game data or estimate
                        line = player.get(f'{prop_type}_line', self._estimate_prop_line(prop_type))
                        
                        # Make enhanced prediction
                        result = predictor.predict(player_id, game_context, line)
                        
                        # Convert to our format
                        prediction = {
                            'type': 'player_prop',
                            'sport': sport,
                            'prop_type': prop_type,
                            'player_id': player_id,
                            'player_name': player.get('name', 'Unknown'),
                            'game_id': game.get('id'),
                            'line': line,
                            'prediction': result.prediction,
                            'confidence': result.confidence,
                            'value_percentage': result.value_percentage,
                            'enhanced': True,
                            'model_version': result.model_version,
                            'timestamp': result.timestamp.isoformat(),
                            'game_context': game_context
                        }
                        
                        # Only include high-confidence predictions
                        if result.confidence >= 0.65:
                            predictions.append(prediction)
                    
                    except Exception as e:
                        logger.warning(f"⚠️ Error predicting {prop_type} for {player.get('name')}: {e}")
        
        except Exception as e:
            logger.error(f"❌ Error in enhanced player props: {e}")
        
        return predictions
    
    def _predict_enhanced_spread(self, sport: str, game_id: str, game: Dict) -> Optional[Dict]:
        """Generate enhanced spread prediction"""
        if not ENHANCED_MODELS_AVAILABLE or not self.model_framework:
            return None
        
        try:
            predictor = EnhancedSpreadPredictor(sport)
            spread_line = game.get('spread_line', 0.0)
            
            result = predictor.predict(game_id, spread_line)
            
            return {
                'type': 'spread',
                'sport': sport,
                'game_id': game_id,
                'spread_line': spread_line,
                'prediction': result.prediction,
                'confidence': result.confidence,
                'value_percentage': result.value_percentage,
                'enhanced': True,
                'model_version': result.model_version,
                'timestamp': result.timestamp.isoformat()
            }
        
        except Exception as e:
            logger.warning(f"⚠️ Error predicting spread for {game_id}: {e}")
            return None
    
    def _predict_enhanced_total(self, sport: str, game_id: str, game: Dict) -> Optional[Dict]:
        """Generate enhanced total prediction"""
        if not ENHANCED_MODELS_AVAILABLE or not self.model_framework:
            return None
        
        try:
            predictor = EnhancedOverUnderPredictor(sport)
            total_line = game.get('total_line', 220.0)  # Default NBA total
            
            result = predictor.predict(game_id, total_line)
            
            return {
                'type': 'total',
                'sport': sport,
                'game_id': game_id,
                'total_line': total_line,
                'prediction': result.prediction,
                'confidence': result.confidence,
                'value_percentage': result.value_percentage,
                'enhanced': True,
                'model_version': result.model_version,
                'timestamp': result.timestamp.isoformat()
            }
        
        except Exception as e:
            logger.warning(f"⚠️ Error predicting total for {game_id}: {e}")
            return None
    
    def _estimate_prop_line(self, prop_type: str) -> float:
        """Estimate prop line if not available"""
        estimates = {
            'points': 20.5,
            'rebounds': 8.5,
            'assists': 6.5,
            'threes': 2.5,
            'steals': 1.5,
            'blocks': 1.0
        }
        return estimates.get(prop_type, 10.0)
    
    def _select_top_enhanced_picks(self) -> List[Dict]:
        """Select top picks using enhanced criteria"""
        all_picks = self.results['enhanced_picks']
        
        if not all_picks:
            return []
        
        # Sort by a combination of confidence and value
        def pick_score(pick):
            confidence = pick.get('confidence', 0.5)
            value_pct = pick.get('value_percentage', 0)
            enhanced_bonus = 0.1 if pick.get('enhanced', False) else 0
            return confidence * 0.6 + (value_pct / 100) * 0.3 + enhanced_bonus
        
        sorted_picks = sorted(all_picks, key=pick_score, reverse=True)
        
        # Filter for minimum quality thresholds
        quality_picks = [
            pick for pick in sorted_picks
            if pick.get('confidence', 0) >= 0.65 and pick.get('value_percentage', 0) >= 3.0
        ]
        
        logger.info(f"✅ Selected {len(quality_picks)} quality picks from {len(all_picks)} total")
        return quality_picks[:20]  # Top 20 picks
    
    def _generate_enhanced_parlays(self, picks: List[Dict]) -> List[Dict]:
        """Generate enhanced parlay recommendations"""
        if len(picks) < 2:
            return []
        
        parlays = []
        
        try:
            # Generate 2-leg parlays
            for i in range(min(10, len(picks))):
                for j in range(i + 1, min(15, len(picks))):
                    parlay = self._create_enhanced_parlay([picks[i], picks[j]])
                    if parlay:
                        parlays.append(parlay)
            
            # Generate 3-leg parlays (best picks only)
            if len(picks) >= 3:
                for i in range(min(5, len(picks))):
                    for j in range(i + 1, min(8, len(picks))):
                        for k in range(j + 1, min(10, len(picks))):
                            parlay = self._create_enhanced_parlay([picks[i], picks[j], picks[k]])
                            if parlay:
                                parlays.append(parlay)
            
            # Sort parlays by expected value
            sorted_parlays = sorted(parlays, key=lambda p: p.get('expected_value', 0), reverse=True)
            
        except Exception as e:
            logger.error(f"❌ Error generating parlays: {e}")
            return []
        
        return sorted_parlays[:10]  # Top 10 parlays
    
    def _create_enhanced_parlay(self, legs: List[Dict]) -> Optional[Dict]:
        """Create an enhanced parlay with correlation analysis"""
        if len(legs) < 2:
            return None
        
        try:
            # Calculate combined confidence (with correlation adjustment)
            confidences = [leg.get('confidence', 0.5) for leg in legs]
            
            # Simple correlation penalty (same game/player reduces independence)
            correlation_penalty = 0
            for i, leg1 in enumerate(legs):
                for leg2 in legs[i+1:]:
                    if leg1.get('game_id') == leg2.get('game_id'):
                        correlation_penalty += 0.1
                    if leg1.get('player_id') == leg2.get('player_id'):
                        correlation_penalty += 0.15
            
            # Combined probability with correlation adjustment
            combined_prob = np.prod(confidences) * (1 - min(correlation_penalty, 0.3))
            
            # Estimate odds (simplified)
            if combined_prob > 0:
                estimated_odds = 1 / combined_prob
                payout_multiplier = estimated_odds * 0.9  # Sportsbook margin
            else:
                payout_multiplier = 2.0
            
            # Expected value calculation
            total_value_pct = sum(leg.get('value_percentage', 0) for leg in legs)
            expected_value = combined_prob * payout_multiplier - 1.0
            
            return {
                'legs': legs,
                'leg_count': len(legs),
                'combined_confidence': round(combined_prob, 3),
                'estimated_odds': round(payout_multiplier, 2),
                'expected_value': round(expected_value, 3),
                'correlation_penalty': round(correlation_penalty, 3),
                'total_value_percentage': round(total_value_pct, 2),
                'enhanced': True,
                'recommendation': 'Strong' if expected_value > 0.15 else 'Moderate' if expected_value > 0.05 else 'Weak'
            }
        
        except Exception as e:
            logger.warning(f"⚠️ Error creating parlay: {e}")
            return None
    
    def _save_enhanced_predictions(self, picks: List[Dict]) -> int:
        """Save enhanced predictions to database"""
        saved_count = 0
        
        for pick in picks:
            try:
                # Enhanced prediction format for database
                prediction_data = {
                    'prediction_type': pick.get('type'),
                    'sport': pick.get('sport'),
                    'player_id': pick.get('player_id'),
                    'game_id': pick.get('game_id'),
                    'market_type': pick.get('prop_type', pick.get('type')),
                    'line_value': pick.get('line'),
                    'prediction_value': pick.get('prediction'),
                    'confidence_score': pick.get('confidence'),
                    'value_percentage': pick.get('value_percentage'),
                    'model_version': pick.get('model_version'),
                    'enhanced': pick.get('enhanced', False),
                    'user_id': 'enhanced-automation',
                    'created_at': pick.get('timestamp', datetime.now().isoformat()),
                    'game_context': pick.get('game_context', {})
                }
                
                # Save to backend
                response = requests.post(
                    f'{self.backend_api_url}/api/predictions/enhanced',
                    json=prediction_data,
                    timeout=10
                )
                
                if response.status_code == 200:
                    saved_count += 1
                else:
                    logger.warning(f"⚠️ Failed to save prediction: {response.status_code}")
            
            except Exception as e:
                logger.error(f"❌ Error saving prediction: {e}")
        
        logger.info(f"💾 Saved {saved_count}/{len(picks)} enhanced predictions")
        return saved_count
    
    def generate_enhanced_report(self) -> str:
        """Generate enhanced daily report"""
        results = self.results
        
        report = f"""
🚀 ParleyApp Enhanced Daily Analysis Report - {results['date']}
{'='*80}

🎯 Enhanced Mode: {'✅ ACTIVE' if results['enhanced_mode'] else '❌ DISABLED'}

📊 Analysis Summary:
• Sports Analyzed: {', '.join(results['sports_analyzed'])}
• Total Enhanced Predictions: {results['total_predictions']}
• Top Quality Picks: {len(results.get('top_picks', []))}
• Parlay Recommendations: {len(results.get('parlay_recommendations', []))}
• Saved to Database: {results.get('saved_to_db', 0)}

🤖 Model Status:
"""
        
        model_status = results.get('model_status', {})
        if model_status.get('framework_available'):
            for sport, status in model_status.get('models_trained', {}).items():
                report += f"• {sport}: "
                available_models = [k for k, v in status.items() if 'available' in str(v) or 'success' in str(v)]
                report += f"{len(available_models)} models ready\n"
        else:
            report += "• Enhanced models not available\n"
        
        report += "\n🎯 Top Enhanced Picks:\n"
        
        for i, pick in enumerate(results.get('top_picks', [])[:10], 1):
            enhanced_indicator = "🚀" if pick.get('enhanced') else "📊"
            report += f"{i:2d}. {enhanced_indicator} {pick.get('sport')} {pick.get('type', 'unknown')}"
            
            if pick.get('player_name'):
                report += f" - {pick['player_name']}"
            if pick.get('prop_type'):
                report += f" {pick['prop_type']}"
            
            report += f" | Confidence: {pick.get('confidence', 0):.1%}"
            report += f" | Value: {pick.get('value_percentage', 0):.1f}%\n"
        
        if results.get('errors'):
            report += f"\n⚠️ Errors Encountered:\n"
            for error in results['errors']:
                report += f"• {error}\n"
        
        report += f"\n🕐 Analysis completed at: {results.get('analysis_time', 'Unknown')}\n"
        
        return report

def main():
    """Main execution function"""
    try:
        automation = EnhancedDailyAutomation()
        results = automation.run_enhanced_daily_analysis()
        
        # Generate and save report
        report = automation.generate_enhanced_report()
        
        # Save report to file
        report_filename = f"enhanced_daily_report_{datetime.now().strftime('%Y%m%d')}.txt"
        with open(report_filename, 'w') as f:
            f.write(report)
        
        print(report)
        print(f"\n📄 Report saved to: {report_filename}")
        
        return 0 if not results.get('errors') else 1
        
    except Exception as e:
        logger.error(f"❌ Fatal error in enhanced daily automation: {e}")
        return 1

if __name__ == "__main__":
    exit(main()) 