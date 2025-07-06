#!/usr/bin/env python3
"""
Real Model Training Script for Predictive Play
Connects to Supabase and trains models with actual player game stats
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
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
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

class SupabaseDataLoader:
    """Loads real data from Supabase for model training"""
    
    def __init__(self):
        self.conn = None
        self.connect()
    
    def connect(self):
        """Connect to Supabase PostgreSQL"""
        try:
            self.conn = psycopg2.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                database=os.getenv('DB_NAME', 'Predictive Play'),
                user=os.getenv('DB_USER', 'postgres'),
                password=os.getenv('DB_PASSWORD'),
                port=int(os.getenv('DB_PORT', 5432)),
                sslmode='require'
            )
            logger.info("✅ Connected to Supabase successfully")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Supabase: {e}")
            raise
    
    def get_sports_summary(self) -> Dict[str, int]:
        """Get summary of available data by sport"""
        query = """
        SELECT 
            p.sport,
            COUNT(DISTINCT p.id) as player_count,
            COUNT(pgs.id) as total_game_stats
        FROM players p
        JOIN player_game_stats pgs ON p.id = pgs.player_id
        WHERE p.sport IS NOT NULL
        GROUP BY p.sport
        ORDER BY total_game_stats DESC;
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query)
            results = cursor.fetchall()
            
        summary = {row['sport']: {
            'players': row['player_count'],
            'game_stats': row['total_game_stats']
        } for row in results}
        
        logger.info("📊 Data Summary by Sport:")
        for sport, data in summary.items():
            logger.info(f"  {sport}: {data['players']} players, {data['game_stats']} game records")
        
        return summary
    
    def load_nba_player_stats(self, min_games: int = 10) -> pd.DataFrame:
        """Load NBA player game stats with calculated features"""
        query = """
        WITH player_games AS (
            SELECT 
                p.id as player_id,
                p.name,
                p.position,
                p.team,
                pgs.id as game_stat_id,
                pgs.stats,
                pgs.created_at,
                -- Extract common NBA stats from JSON (matching your exact structure)
                CAST(pgs.stats->>'points' AS FLOAT) as points,
                CAST(pgs.stats->>'rebounds' AS FLOAT) as rebounds,
                CAST(pgs.stats->>'assists' AS FLOAT) as assists,
                CAST(pgs.stats->>'steals' AS FLOAT) as steals,
                CAST(pgs.stats->>'blocks' AS FLOAT) as blocks,
                CAST(pgs.stats->>'turnovers' AS FLOAT) as turnovers,
                CAST(pgs.stats->>'minutes_played' AS FLOAT) as minutes,
                CAST(pgs.stats->>'field_goals_made' AS FLOAT) as fgm,
                CAST(pgs.stats->>'field_goals_attempted' AS FLOAT) as fga,
                CAST(pgs.stats->>'three_pointers_made' AS FLOAT) as fg3m,
                CAST(pgs.stats->>'three_pointers_attempted' AS FLOAT) as fg3a,
                CAST(pgs.stats->>'free_throws_made' AS FLOAT) as ftm,
                CAST(pgs.stats->>'free_throws_attempted' AS FLOAT) as fta,
                pgs.stats->>'game_date' as game_date,
                CAST(pgs.stats->>'plus_minus' AS FLOAT) as plus_minus,
                pgs.stats->>'type' as game_type
            FROM players p
            JOIN player_game_stats pgs ON p.id = pgs.player_id
            WHERE p.sport = 'NBA'
            AND pgs.stats IS NOT NULL
        ),
        player_counts AS (
            SELECT player_id, COUNT(*) as game_count
            FROM player_games
            GROUP BY player_id
            HAVING COUNT(*) >= %s
        )
        SELECT pg.*
        FROM player_games pg
        JOIN player_counts pc ON pg.player_id = pc.player_id
        ORDER BY pg.player_id, pg.game_date;
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (min_games,))
            results = cursor.fetchall()
        
        df = pd.DataFrame(results)
        logger.info(f"✅ Loaded {len(df)} NBA game records for {df['player_id'].nunique()} players")
        
        return df
    
    def load_sport_stats(self, sport: str, min_games: int = 10) -> pd.DataFrame:
        """Generic loader for any sport"""
        query = """
        WITH player_games AS (
            SELECT 
                p.id as player_id,
                p.name,
                p.position,
                p.team,
                p.sport,
                pgs.id as game_stat_id,
                pgs.stats,
                pgs.created_at
            FROM players p
            JOIN player_game_stats pgs ON p.id = pgs.player_id
            WHERE p.sport = %s
            AND pgs.stats IS NOT NULL
        ),
        player_counts AS (
            SELECT player_id, COUNT(*) as game_count
            FROM player_games
            GROUP BY player_id
            HAVING COUNT(*) >= %s
        )
        SELECT pg.*
        FROM player_games pg
        JOIN player_counts pc ON pg.player_id = pc.player_id;
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (sport.upper(), min_games))
            results = cursor.fetchall()
        
        df = pd.DataFrame(results)
        logger.info(f"✅ Loaded {len(df)} {sport} game records for {df['player_id'].nunique()} players")
        
        return df

class NBAFeatureEngineer:
    """Feature engineering specifically for NBA data"""
    
    @staticmethod
    def create_features(df: pd.DataFrame) -> pd.DataFrame:
        """Create advanced features for NBA predictions"""
        logger.info("🔧 Engineering NBA features...")
        
        # Sort by player and date
        df = df.sort_values(['player_id', 'game_date'])
        
        # Calculate rolling averages for each stat
        rolling_windows = [5, 10, 20]
        stats_to_average = ['points', 'rebounds', 'assists', 'minutes', 'steals', 'blocks']
        
        for window in rolling_windows:
            for stat in stats_to_average:
                col_name = f'{stat}_avg_{window}'
                df[col_name] = df.groupby('player_id')[stat].transform(
                    lambda x: x.rolling(window, min_periods=1).mean().shift(1)
                )
        
        # Calculate shooting percentages
        df['fg_pct'] = df.apply(lambda x: x['fgm'] / x['fga'] if x['fga'] > 0 else 0, axis=1)
        df['fg3_pct'] = df.apply(lambda x: x['fg3m'] / x['fg3a'] if x['fg3a'] > 0 else 0, axis=1)
        df['ft_pct'] = df.apply(lambda x: x['ftm'] / x['fta'] if x['fta'] > 0 else 0, axis=1)
        
        # Plus/minus as a feature
        df['plus_minus_avg_5'] = df.groupby('player_id')['plus_minus'].transform(
            lambda x: x.rolling(5, min_periods=1).mean().shift(1)
        )
        
        # Days of rest (calculate from game dates)
        df['game_date'] = pd.to_datetime(df['game_date'], errors='coerce')
        df['days_rest'] = df.groupby('player_id')['game_date'].diff().dt.days.fillna(2)
        
        # Position encoding
        position_map = {'PG': 1, 'SG': 2, 'SF': 3, 'PF': 4, 'C': 5}
        df['position_encoded'] = df['position'].map(position_map).fillna(3)
        
        # Recent form indicators for all main stats
        for stat in ['points', 'rebounds', 'assists']:
            df[f'{stat}_trend'] = df.groupby('player_id')[stat].transform(
                lambda x: x.rolling(5, min_periods=1).mean().shift(1) - x.rolling(10, min_periods=1).mean().shift(1)
            )
            
            # Consistency metrics
            df[f'{stat}_std_10'] = df.groupby('player_id')[stat].transform(
                lambda x: x.rolling(10, min_periods=1).std().shift(1)
            )
        
        logger.info(f"✅ Created {len(df.columns)} features")
        
        return df

class RealNBAPlayerPropsTrainer:
    """Trains player prop models using real NBA data"""
    
    def __init__(self, prop_type: str = 'points'):
        self.prop_type = prop_type
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = []
        self.model_path = f'models/nba_{prop_type}_real_model.pkl'
    
    def prepare_training_data(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare features and target for training"""
        
        # Define feature columns based on prop type
        base_features = [
            f'{self.prop_type}_avg_5',
            f'{self.prop_type}_avg_10',
            f'{self.prop_type}_avg_20',
            'minutes_avg_5',
            'minutes_avg_10',
            'plus_minus_avg_5',
            'position_encoded',
            'days_rest',
            f'{self.prop_type}_trend',
            f'{self.prop_type}_std_10'
        ]
        
        # Add additional relevant features
        if self.prop_type == 'points':
            base_features.extend(['fg_pct', 'fg3_pct', 'ft_pct'])
        elif self.prop_type == 'rebounds':
            base_features.extend(['blocks_avg_5', 'minutes_avg_20'])
        elif self.prop_type == 'assists':
            base_features.extend(['turnovers', 'steals_avg_5'])
        
        # Filter to valid rows
        valid_mask = df[base_features].notna().all(axis=1) & df[self.prop_type].notna()
        df_valid = df[valid_mask].copy()
        
        if len(df_valid) < 100:
            logger.warning(f"⚠️ Only {len(df_valid)} valid samples for {self.prop_type}")
            return None, None
        
        self.feature_columns = base_features
        X = df_valid[base_features].values
        y = df_valid[self.prop_type].values
        
        logger.info(f"✅ Prepared {len(X)} samples with {len(base_features)} features")
        
        return X, y
    
    def train(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Train the model with real data"""
        logger.info(f"🚀 Training NBA {self.prop_type} model with real data...")
        
        # Prepare data
        X, y = self.prepare_training_data(df)
        
        if X is None:
            return {'status': 'failed', 'reason': 'Insufficient data'}
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            random_state=42
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        train_pred = self.model.predict(X_train_scaled)
        test_pred = self.model.predict(X_test_scaled)
        
        train_mae = mean_absolute_error(y_train, train_pred)
        test_mae = mean_absolute_error(y_test, test_pred)
        test_rmse = np.sqrt(mean_squared_error(y_test, test_pred))
        test_r2 = r2_score(y_test, test_pred)
        
        # Calculate accuracy within thresholds
        within_1 = np.mean(np.abs(test_pred - y_test) <= 1) * 100
        within_2 = np.mean(np.abs(test_pred - y_test) <= 2) * 100
        within_3 = np.mean(np.abs(test_pred - y_test) <= 3) * 100
        
        results = {
            'status': 'success',
            'prop_type': self.prop_type,
            'samples_train': len(X_train),
            'samples_test': len(X_test),
            'train_mae': round(train_mae, 2),
            'test_mae': round(test_mae, 2),
            'test_rmse': round(test_rmse, 2),
            'test_r2': round(test_r2, 3),
            'accuracy_within_1': round(within_1, 1),
            'accuracy_within_2': round(within_2, 1),
            'accuracy_within_3': round(within_3, 1),
            'feature_importance': self._get_feature_importance()
        }
        
        logger.info(f"✅ Model trained successfully!")
        logger.info(f"   Test MAE: {test_mae:.2f} {self.prop_type}")
        logger.info(f"   Within 2 {self.prop_type}: {within_2:.1f}%")
        logger.info(f"   R²: {test_r2:.3f}")
        
        # Save model
        self.save_model()
        
        return results
    
    def _get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance scores"""
        if self.model and hasattr(self.model, 'feature_importances_'):
            importance = self.model.feature_importances_
            return {
                self.feature_columns[i]: round(float(importance[i]), 4)
                for i in range(len(self.feature_columns))
            }
        return {}
    
    def save_model(self):
        """Save trained model and scaler"""
        os.makedirs('models', exist_ok=True)
        
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_columns': self.feature_columns,
            'prop_type': self.prop_type,
            'trained_at': datetime.now().isoformat()
        }, self.model_path)
        
        logger.info(f"💾 Model saved to {self.model_path}")
    
    def predict(self, features: Dict[str, float]) -> Tuple[float, float]:
        """Make a prediction with confidence score"""
        if not self.model:
            raise ValueError("Model not trained yet")
        
        # Prepare features in correct order
        X = np.array([[features.get(col, 0) for col in self.feature_columns]])
        X_scaled = self.scaler.transform(X)
        
        prediction = self.model.predict(X_scaled)[0]
        
        # Simple confidence based on prediction variance
        confidence = 0.75  # Placeholder - would use prediction intervals
        
        return prediction, confidence

def train_all_nba_models():
    """Main function to train all NBA models"""
    logger.info("🏀 Starting NBA Model Training with Real Data")
    logger.info("=" * 60)
    
    # Initialize data loader
    loader = SupabaseDataLoader()
    
    # Get data summary
    summary = loader.get_sports_summary()
    
    # Load NBA data
    logger.info("\n📥 Loading NBA player game stats...")
    df_nba = loader.load_nba_player_stats(min_games=10)
    
    # Engineer features
    engineer = NBAFeatureEngineer()
    df_nba = engineer.create_features(df_nba)
    
    # Train models for different prop types
    prop_types = ['points', 'rebounds', 'assists']
    results = {}
    
    for prop_type in prop_types:
        logger.info(f"\n{'='*60}")
        logger.info(f"Training {prop_type.upper()} model...")
        
        trainer = RealNBAPlayerPropsTrainer(prop_type)
        result = trainer.train(df_nba)
        results[prop_type] = result
    
    # Summary report
    logger.info("\n" + "="*60)
    logger.info("🎯 TRAINING SUMMARY")
    logger.info("="*60)
    
    for prop_type, result in results.items():
        if result['status'] == 'success':
            logger.info(f"\n{prop_type.upper()}:")
            logger.info(f"  ✅ Test MAE: {result['test_mae']}")
            logger.info(f"  ✅ Within 2: {result['accuracy_within_2']}%")
            logger.info(f"  ✅ R²: {result['test_r2']}")
        else:
            logger.info(f"\n{prop_type.upper()}: ❌ Failed - {result.get('reason', 'Unknown')}")
    
    logger.info("\n✅ NBA model training complete!")
    logger.info("📋 Next steps:")
    logger.info("  1. Test predictions on recent games")
    logger.info("  2. Compare against betting lines")
    logger.info("  3. Train models for other sports")
    logger.info("  4. Set up automated retraining")
    
    return results

if __name__ == "__main__":
    train_all_nba_models() 