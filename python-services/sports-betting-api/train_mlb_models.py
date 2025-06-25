#!/usr/bin/env python3
"""
MLB Model Training Script for ParleyApp
Trains models for hits, home runs, RBIs, strikeouts using real MLB data
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

class MLBDataLoader:
    """Loads MLB data from Supabase"""
    
    def __init__(self):
        self.conn = None
        self.connect()
    
    def connect(self):
        """Connect to Supabase PostgreSQL"""
        try:
            self.conn = psycopg2.connect(
                host=os.getenv('DB_HOST'),
                database=os.getenv('DB_NAME'),
                user=os.getenv('DB_USER'),
                password=os.getenv('DB_PASSWORD'),
                port=int(os.getenv('DB_PORT', 5432)),
                sslmode='require'
            )
            logger.info("✅ Connected to Supabase successfully")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Supabase: {e}")
            raise
    
    def load_mlb_player_stats(self, min_games: int = 10) -> pd.DataFrame:
        """Load MLB player game stats with batting statistics"""
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
                -- Extract MLB batting stats from JSON
                CAST(pgs.stats->>'hits' AS FLOAT) as hits,
                CAST(pgs.stats->>'at_bats' AS FLOAT) as at_bats,
                CAST(pgs.stats->>'walks' AS FLOAT) as walks,
                CAST(pgs.stats->>'home_runs' AS FLOAT) as home_runs,
                CAST(pgs.stats->>'strikeouts' AS FLOAT) as strikeouts,
                CAST(pgs.stats->>'pitch_count' AS FLOAT) as pitch_count,
                CAST(pgs.stats->>'estimated_ba' AS FLOAT) as batting_avg,
                CAST(pgs.stats->>'estimated_woba' AS FLOAT) as woba,
                CAST(pgs.stats->>'avg_launch_angle' AS FLOAT) as launch_angle,
                CAST(pgs.stats->>'avg_launch_speed' AS FLOAT) as launch_speed,
                CAST(pgs.stats->>'max_hit_distance' AS FLOAT) as max_distance,
                pgs.stats->>'game_date' as game_date,
                pgs.stats->>'events' as events,
                -- Calculate additional stats
                CAST(pgs.stats->>'runs' AS FLOAT) as runs,
                CAST(pgs.stats->>'rbis' AS FLOAT) as rbis,
                CAST(pgs.stats->>'stolen_bases' AS FLOAT) as stolen_bases
            FROM players p
            JOIN player_game_stats pgs ON p.id = pgs.player_id
            WHERE p.sport = 'MLB'
            AND pgs.stats IS NOT NULL
            AND pgs.stats->>'type' = 'batting'
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
        logger.info(f"✅ Loaded {len(df)} MLB game records for {df['player_id'].nunique()} players")
        
        # Convert game_date to datetime
        df['game_date'] = pd.to_datetime(df['game_date'], errors='coerce')
        
        return df

class MLBFeatureEngineer:
    """Feature engineering specifically for MLB data"""
    
    @staticmethod
    def create_features(df: pd.DataFrame) -> pd.DataFrame:
        """Create advanced features for MLB predictions"""
        logger.info("⚾ Engineering MLB features...")
        
        # Sort by player and date
        df = df.sort_values(['player_id', 'game_date'])
        
        # Calculate rolling averages for batting stats
        rolling_windows = [5, 10, 20]
        batting_stats = ['hits', 'at_bats', 'home_runs', 'strikeouts', 'walks', 'rbis']
        
        for window in rolling_windows:
            for stat in batting_stats:
                col_name = f'{stat}_avg_{window}'
                df[col_name] = df.groupby('player_id')[stat].transform(
                    lambda x: x.rolling(window, min_periods=1).mean().shift(1)
                )
        
        # Calculate batting average over different windows
        for window in rolling_windows:
            df[f'ba_avg_{window}'] = df.groupby('player_id').apply(
                lambda x: (x['hits'].rolling(window, min_periods=1).sum() / 
                          x['at_bats'].rolling(window, min_periods=1).sum()).shift(1)
            ).reset_index(level=0, drop=True)
        
        # Advanced sabermetrics features
        df['launch_angle_avg_10'] = df.groupby('player_id')['launch_angle'].transform(
            lambda x: x.rolling(10, min_periods=1).mean().shift(1)
        )
        
        df['launch_speed_avg_10'] = df.groupby('player_id')['launch_speed'].transform(
            lambda x: x.rolling(10, min_periods=1).mean().shift(1)
        )
        
        # Recent form indicators
        for stat in ['hits', 'home_runs', 'strikeouts']:
            df[f'{stat}_trend'] = df.groupby('player_id')[stat].transform(
                lambda x: x.rolling(5, min_periods=1).mean().shift(1) - x.rolling(15, min_periods=1).mean().shift(1)
            )
        
        # Consistency metrics
        for stat in ['hits', 'home_runs']:
            df[f'{stat}_std_10'] = df.groupby('player_id')[stat].transform(
                lambda x: x.rolling(10, min_periods=1).std().shift(1)
            )
        
        # Days of rest
        df['days_rest'] = df.groupby('player_id')['game_date'].diff().dt.days.fillna(1)
        
        # Hot/cold streaks
        df['hits_last_3'] = df.groupby('player_id')['hits'].transform(
            lambda x: x.rolling(3, min_periods=1).sum().shift(1)
        )
        
        # Plate appearances (at_bats + walks)
        df['plate_appearances'] = df['at_bats'] + df['walks']
        df['pa_avg_10'] = df.groupby('player_id')['plate_appearances'].transform(
            lambda x: x.rolling(10, min_periods=1).mean().shift(1)
        )
        
        logger.info(f"✅ Created {len(df.columns)} features")
        
        return df

class MLBPlayerPropsTrainer:
    """Trains player prop models using real MLB data"""
    
    def __init__(self, prop_type: str = 'hits'):
        self.prop_type = prop_type
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = []
        self.model_path = f'models/mlb_{prop_type}_real_model.pkl'
    
    def prepare_training_data(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare features and target for training"""
        
        # Define feature columns based on prop type
        if self.prop_type == 'hits':
            base_features = [
                'hits_avg_5', 'hits_avg_10', 'hits_avg_20',
                'ba_avg_5', 'ba_avg_10',
                'at_bats_avg_5', 'at_bats_avg_10',
                'launch_angle_avg_10', 'launch_speed_avg_10',
                'hits_trend', 'hits_std_10',
                'hits_last_3', 'pa_avg_10',
                'days_rest'
            ]
        elif self.prop_type == 'home_runs':
            base_features = [
                'home_runs_avg_5', 'home_runs_avg_10', 'home_runs_avg_20',
                'launch_angle_avg_10', 'launch_speed_avg_10',
                'at_bats_avg_10',
                'home_runs_trend', 'home_runs_std_10',
                'days_rest'
            ]
        elif self.prop_type == 'strikeouts':
            base_features = [
                'strikeouts_avg_5', 'strikeouts_avg_10', 'strikeouts_avg_20',
                'at_bats_avg_5', 'at_bats_avg_10',
                'strikeouts_trend',
                'pa_avg_10', 'days_rest'
            ]
        elif self.prop_type == 'rbis':
            base_features = [
                'rbis_avg_5', 'rbis_avg_10', 'rbis_avg_20',
                'hits_avg_10', 'home_runs_avg_10',
                'at_bats_avg_10',
                'ba_avg_10',
                'days_rest'
            ]
        else:
            raise ValueError(f"Unknown prop type: {self.prop_type}")
        
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
        logger.info(f"⚾ Training MLB {self.prop_type} model with real data...")
        
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
        
        # Train model - use different models based on prop type
        if self.prop_type == 'home_runs':
            # Home runs are rare events, use RandomForest
            self.model = RandomForestRegressor(
                n_estimators=150,
                max_depth=8,
                min_samples_split=10,
                random_state=42
            )
        else:
            # For other stats, use GradientBoosting
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
        
        # Calculate accuracy within thresholds (adjusted for MLB)
        if self.prop_type == 'hits':
            thresholds = [0.5, 1, 1.5]
        elif self.prop_type == 'home_runs':
            thresholds = [0.5, 1, 1]  # Home runs are 0 or 1+ usually
        else:
            thresholds = [0.5, 1, 2]
        
        within_thresholds = {}
        for t in thresholds:
            within_t = np.mean(np.abs(test_pred - y_test) <= t) * 100
            within_thresholds[f'within_{t}'] = round(within_t, 1)
        
        results = {
            'status': 'success',
            'prop_type': self.prop_type,
            'samples_train': len(X_train),
            'samples_test': len(X_test),
            'train_mae': round(train_mae, 3),
            'test_mae': round(test_mae, 3),
            'test_rmse': round(test_rmse, 3),
            'test_r2': round(test_r2, 3),
            **within_thresholds,
            'feature_importance': self._get_feature_importance()
        }
        
        logger.info(f"✅ Model trained successfully!")
        logger.info(f"   Test MAE: {test_mae:.3f} {self.prop_type}")
        logger.info(f"   Within 1: {within_thresholds.get('within_1', 0)}%")
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
            'sport': 'MLB',
            'trained_at': datetime.now().isoformat()
        }, self.model_path)
        
        logger.info(f"💾 Model saved to {self.model_path}")

def check_mlb_data_quality():
    """Quick check of MLB data before training"""
    loader = MLBDataLoader()
    
    # Get a sample of data
    query = """
    SELECT 
        COUNT(DISTINCT p.id) as players,
        COUNT(pgs.id) as total_games,
        COUNT(CASE WHEN pgs.stats->>'hits' IS NOT NULL THEN 1 END) as has_hits,
        COUNT(CASE WHEN pgs.stats->>'home_runs' IS NOT NULL THEN 1 END) as has_hrs,
        COUNT(CASE WHEN pgs.stats->>'strikeouts' IS NOT NULL THEN 1 END) as has_ks,
        COUNT(CASE WHEN pgs.stats->>'rbis' IS NOT NULL THEN 1 END) as has_rbis
    FROM players p
    JOIN player_game_stats pgs ON p.id = pgs.player_id
    WHERE p.sport = 'MLB'
    AND pgs.stats->>'type' = 'batting';
    """
    
    with loader.conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(query)
        result = cursor.fetchone()
    
    logger.info("⚾ MLB DATA QUALITY CHECK:")
    logger.info(f"  Players: {result['players']}")
    logger.info(f"  Total Games: {result['total_games']:,}")
    logger.info(f"  Has Hits: {result['has_hits']:,} ({result['has_hits']/result['total_games']*100:.1f}%)")
    logger.info(f"  Has HRs: {result['has_hrs']:,} ({result['has_hrs']/result['total_games']*100:.1f}%)")
    logger.info(f"  Has Ks: {result['has_ks']:,} ({result['has_ks']/result['total_games']*100:.1f}%)")
    logger.info(f"  Has RBIs: {result['has_rbis']:,} ({result['has_rbis']/result['total_games']*100:.1f}%)")
    
    return result

def train_all_mlb_models():
    """Main function to train all MLB models"""
    logger.info("⚾ Starting MLB Model Training with Real Data")
    logger.info("=" * 60)
    
    # Check data quality first
    data_check = check_mlb_data_quality()
    
    # Initialize data loader
    loader = MLBDataLoader()
    
    # Load MLB data
    logger.info("\n📥 Loading MLB player batting stats...")
    df_mlb = loader.load_mlb_player_stats(min_games=20)  # Higher threshold for MLB
    
    # Engineer features
    engineer = MLBFeatureEngineer()
    df_mlb = engineer.create_features(df_mlb)
    
    # Train models for different prop types
    prop_types = ['hits', 'home_runs', 'strikeouts']
    
    # Check if we have RBIs data
    if data_check['has_rbis'] > 1000:
        prop_types.append('rbis')
    
    results = {}
    
    for prop_type in prop_types:
        logger.info(f"\n{'='*60}")
        logger.info(f"Training {prop_type.upper()} model...")
        
        trainer = MLBPlayerPropsTrainer(prop_type)
        result = trainer.train(df_mlb)
        results[prop_type] = result
    
    # Summary report
    logger.info("\n" + "="*60)
    logger.info("⚾ MLB TRAINING SUMMARY")
    logger.info("="*60)
    
    for prop_type, result in results.items():
        if result['status'] == 'success':
            logger.info(f"\n{prop_type.upper()}:")
            logger.info(f"  ✅ Test MAE: {result['test_mae']}")
            logger.info(f"  ✅ Within 1: {result.get('within_1', 'N/A')}%")
            logger.info(f"  ✅ R²: {result['test_r2']}")
        else:
            logger.info(f"\n{prop_type.upper()}: ❌ Failed - {result.get('reason', 'Unknown')}")
    
    logger.info("\n✅ MLB model training complete!")
    logger.info("📋 Next steps:")
    logger.info("  1. Test predictions on recent games")
    logger.info("  2. Compare against DraftKings/FanDuel lines")
    logger.info("  3. Set up live predictions for today's games")
    
    return results

if __name__ == "__main__":
    train_all_mlb_models() 