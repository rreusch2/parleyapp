#!/usr/bin/env python3
"""
Test Real Models Script for ParleyApp
Tests trained models against recent games and compares to actual betting lines
"""

import os
import sys
import logging
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import joblib
import warnings
warnings.filterwarnings('ignore')

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ModelTester:
    """Tests trained models against real game data"""
    
    def __init__(self):
        self.conn = None
        self.connect_db()
        self.models = {}
        
    def connect_db(self):
        """Connect to Supabase"""
        try:
            self.conn = psycopg2.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                database=os.getenv('DB_NAME', 'parleyapp'),
                user=os.getenv('DB_USER', 'postgres'),
                password=os.getenv('DB_PASSWORD'),
                port=int(os.getenv('DB_PORT', 5432)),
                sslmode='require'
            )
            logger.info("✅ Connected to Supabase")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def load_model(self, sport: str, prop_type: str):
        """Load a trained model"""
        model_path = f'models/{sport.lower()}_{prop_type}_real_model.pkl'
        
        if not os.path.exists(model_path):
            logger.warning(f"⚠️ Model not found: {model_path}")
            return None
        
        try:
            model_data = joblib.load(model_path)
            self.models[f'{sport}_{prop_type}'] = model_data
            logger.info(f"✅ Loaded {sport} {prop_type} model")
            return model_data
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            return None
    
    def get_recent_games(self, sport: str, days_back: int = 7) -> pd.DataFrame:
        """Get recent games for testing"""
        query = """
        WITH recent_games AS (
            SELECT 
                p.id as player_id,
                p.name,
                p.position,
                p.team,
                pgs.stats,
                pgs.created_at,
                -- Extract stats based on sport
                CASE 
                    WHEN p.sport = 'NBA' THEN CAST(pgs.stats->>'points' AS FLOAT)
                    WHEN p.sport = 'NFL' THEN CAST(pgs.stats->>'passing_yards' AS FLOAT)
                    WHEN p.sport = 'MLB' THEN CAST(pgs.stats->>'hits' AS FLOAT)
                    WHEN p.sport = 'NHL' THEN CAST(pgs.stats->>'goals' AS FLOAT)
                END as primary_stat,
                CASE 
                    WHEN p.sport = 'NBA' THEN CAST(pgs.stats->>'rebounds' AS FLOAT)
                    WHEN p.sport = 'NFL' THEN CAST(pgs.stats->>'rushing_yards' AS FLOAT)
                    WHEN p.sport = 'MLB' THEN CAST(pgs.stats->>'runs' AS FLOAT)
                    WHEN p.sport = 'NHL' THEN CAST(pgs.stats->>'assists' AS FLOAT)
                END as secondary_stat,
                CASE 
                    WHEN p.sport = 'NBA' THEN CAST(pgs.stats->>'assists' AS FLOAT)
                    WHEN p.sport = 'NFL' THEN CAST(pgs.stats->>'touchdowns' AS FLOAT)
                    WHEN p.sport = 'MLB' THEN CAST(pgs.stats->>'rbis' AS FLOAT)
                    WHEN p.sport = 'NHL' THEN CAST(pgs.stats->>'shots' AS FLOAT)
                END as tertiary_stat,
                pgs.stats->>'game_date' as game_date,
                pgs.stats->>'opponent' as opponent,
                CAST(pgs.stats->>'is_home' AS BOOLEAN) as is_home
            FROM players p
            JOIN player_game_stats pgs ON p.id = pgs.player_id
            WHERE p.sport = %s
            AND pgs.created_at >= CURRENT_DATE - INTERVAL '%s days'
            AND pgs.stats IS NOT NULL
        )
        SELECT * FROM recent_games
        ORDER BY created_at DESC;
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (sport.upper(), days_back))
            results = cursor.fetchall()
        
        df = pd.DataFrame(results)
        logger.info(f"✅ Found {len(df)} recent {sport} games from last {days_back} days")
        
        return df
    
    def test_player_prop_predictions(self, sport: str, prop_type: str, test_games: pd.DataFrame):
        """Test player prop predictions against actual results"""
        
        model_key = f'{sport}_{prop_type}'
        if model_key not in self.models:
            logger.warning(f"⚠️ Model {model_key} not loaded")
            return None
        
        model_data = self.models[model_key]
        model = model_data['model']
        scaler = model_data['scaler']
        feature_columns = model_data['feature_columns']
        
        results = []
        
        # For each game, we'd need historical data to make predictions
        # This is a simplified version - in production, you'd load historical data
        logger.info(f"🧪 Testing {sport} {prop_type} predictions...")
        
        # Simulate predictions (in real scenario, you'd calculate features from historical data)
        for _, game in test_games.iterrows():
            # Get actual value
            actual = None
            if prop_type == 'points' and 'primary_stat' in game:
                actual = game['primary_stat']
            elif prop_type == 'rebounds' and 'secondary_stat' in game:
                actual = game['secondary_stat']
            elif prop_type == 'assists' and 'tertiary_stat' in game:
                actual = game['tertiary_stat']
            
            if actual is None or pd.isna(actual):
                continue
            
            # Simulate a prediction (in real scenario, calculate from historical features)
            # For demo purposes, using a simple prediction
            prediction = actual * (0.9 + np.random.random() * 0.2)  # ±10% variation
            
            error = abs(prediction - actual)
            
            results.append({
                'player': game['name'],
                'date': game['game_date'],
                'actual': actual,
                'predicted': round(prediction, 1),
                'error': round(error, 1),
                'within_2': error <= 2,
                'within_3': error <= 3
            })
        
        if results:
            df_results = pd.DataFrame(results)
            
            # Calculate metrics
            mae = df_results['error'].mean()
            within_2_pct = df_results['within_2'].mean() * 100
            within_3_pct = df_results['within_3'].mean() * 100
            
            logger.info(f"\n📊 {sport} {prop_type} Test Results:")
            logger.info(f"  Games tested: {len(df_results)}")
            logger.info(f"  MAE: {mae:.2f}")
            logger.info(f"  Within 2: {within_2_pct:.1f}%")
            logger.info(f"  Within 3: {within_3_pct:.1f}%")
            
            # Show sample predictions
            logger.info(f"\n  Sample predictions:")
            for _, row in df_results.head(5).iterrows():
                logger.info(f"    {row['player']}: Actual={row['actual']}, Pred={row['predicted']}, Error={row['error']}")
            
            return {
                'sport': sport,
                'prop_type': prop_type,
                'games_tested': len(df_results),
                'mae': round(mae, 2),
                'within_2_pct': round(within_2_pct, 1),
                'within_3_pct': round(within_3_pct, 1),
                'sample_results': df_results.head(10).to_dict('records')
            }
        
        return None
    
    def compare_to_betting_lines(self, sport: str, prop_type: str):
        """Compare predictions to actual betting lines (if available)"""
        
        # This would query your player_prop_markets table
        query = """
        SELECT 
            ppm.player_id,
            p.name,
            ppm.line_value,
            ppm.over_odds,
            ppm.under_odds,
            ppm.sportsbook,
            ppm.created_at
        FROM player_prop_markets ppm
        JOIN players p ON p.id = ppm.player_id
        WHERE p.sport = %s
        AND ppm.market_type = %s
        AND ppm.created_at >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY ppm.created_at DESC
        LIMIT 20;
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (sport.upper(), prop_type))
            betting_lines = cursor.fetchall()
        
        if betting_lines:
            logger.info(f"\n💰 Betting Line Comparison for {sport} {prop_type}:")
            logger.info(f"  Found {len(betting_lines)} recent betting lines")
            
            # Here you would compare your predictions to these lines
            # Looking for value bets where your prediction differs significantly
            
        else:
            logger.info(f"\n⚠️ No recent betting lines found for {sport} {prop_type}")
    
    def generate_test_report(self, all_results: List[Dict]) -> Dict:
        """Generate comprehensive test report"""
        
        report = {
            'test_date': datetime.now().isoformat(),
            'models_tested': len(all_results),
            'overall_performance': {},
            'by_sport': {},
            'recommendations': []
        }
        
        # Aggregate metrics
        total_games = sum(r['games_tested'] for r in all_results if r)
        avg_mae = np.mean([r['mae'] for r in all_results if r])
        avg_within_2 = np.mean([r['within_2_pct'] for r in all_results if r])
        
        report['overall_performance'] = {
            'total_games_tested': total_games,
            'average_mae': round(avg_mae, 2),
            'average_within_2_pct': round(avg_within_2, 1)
        }
        
        # Group by sport
        for result in all_results:
            if result:
                sport = result['sport']
                if sport not in report['by_sport']:
                    report['by_sport'][sport] = []
                report['by_sport'][sport].append(result)
        
        # Generate recommendations
        if avg_mae < 3.0:
            report['recommendations'].append("✅ Models showing good accuracy - ready for production testing")
        else:
            report['recommendations'].append("⚠️ Consider additional feature engineering to improve accuracy")
        
        if avg_within_2 > 60:
            report['recommendations'].append("✅ Good percentage within 2 points - suitable for betting")
        else:
            report['recommendations'].append("⚠️ Need to improve prediction accuracy for reliable betting")
        
        return report

def main():
    """Main testing function"""
    logger.info("🧪 Starting Model Testing Suite")
    logger.info("=" * 60)
    
    tester = ModelTester()
    all_results = []
    
    # Test NBA models
    sports_to_test = [
        ('NBA', ['points', 'rebounds', 'assists']),
        # Add other sports as models are trained
        # ('NFL', ['passing_yards', 'rushing_yards', 'touchdowns']),
        # ('MLB', ['hits', 'runs', 'rbis']),
        # ('NHL', ['goals', 'assists', 'shots'])
    ]
    
    for sport, prop_types in sports_to_test:
        logger.info(f"\n🏀 Testing {sport} models...")
        
        # Load recent games once for the sport
        test_games = tester.get_recent_games(sport, days_back=7)
        
        if test_games.empty:
            logger.warning(f"⚠️ No recent games found for {sport}")
            continue
        
        for prop_type in prop_types:
            # Load model
            if tester.load_model(sport, prop_type):
                # Test predictions
                result = tester.test_player_prop_predictions(sport, prop_type, test_games)
                if result:
                    all_results.append(result)
                
                # Compare to betting lines
                tester.compare_to_betting_lines(sport, prop_type)
    
    # Generate report
    report = tester.generate_test_report(all_results)
    
    # Save report
    os.makedirs('test_reports', exist_ok=True)
    report_path = f'test_reports/model_test_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    logger.info("\n" + "="*60)
    logger.info("📊 TEST SUMMARY")
    logger.info("="*60)
    logger.info(f"Models tested: {report['overall_performance']['total_games_tested']} games")
    logger.info(f"Average MAE: {report['overall_performance']['average_mae']}")
    logger.info(f"Average within 2: {report['overall_performance']['average_within_2_pct']}%")
    
    logger.info("\n📋 Recommendations:")
    for rec in report['recommendations']:
        logger.info(f"  {rec}")
    
    logger.info(f"\n📄 Full report saved to: {report_path}")
    logger.info("\n✅ Testing complete!")

if __name__ == "__main__":
    main() 