#!/usr/bin/env python3
"""
Historical Games Model Training Script for Predictive Play
Trains moneyline, spread, and over/under models using historical_games table with 25,000+ MLB records
"""

import os
import sys
import logging
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error, r2_score, classification_report
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

class HistoricalGamesLoader:
    """Loads MLB historical games data from Supabase"""
    
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
    
    def load_historical_games(self, sport: str = 'MLB', start_date: str = '2020-01-01') -> pd.DataFrame:
        """Load historical games data with basic info"""
        query = """
        SELECT 
            id,
            external_game_id,
            sport,
            league,
            season,
            home_team,
            away_team,
            game_date,
            home_score,
            away_score
        FROM historical_games
        WHERE sport = %s
        AND game_date >= %s
        AND home_score IS NOT NULL 
        AND away_score IS NOT NULL
        ORDER BY game_date ASC;
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (sport, start_date))
            results = cursor.fetchall()
        
        df = pd.DataFrame(results)
        logger.info(f"✅ Loaded {len(df)} {sport} historical games from {start_date} onwards")
        
        # Convert game_date to datetime (it's already a datetime from postgres)
        df['game_date'] = pd.to_datetime(df['game_date'], errors='coerce')
        
        # Calculate basic betting outcomes
        df['moneyline_outcome'] = (df['home_score'] > df['away_score']).astype(int)
        df['point_spread'] = df['home_score'] - df['away_score']
        df['total_score'] = df['home_score'] + df['away_score']
        
        return df
    
    def get_data_summary(self) -> Dict[str, Any]:
        """Get summary of historical games data"""
        query = """
        SELECT 
            sport,
            league,
            COUNT(*) as total_games,
            COUNT(DISTINCT EXTRACT(YEAR FROM game_date)) as years,
            COUNT(DISTINCT home_team) as teams,
            MIN(game_date) as earliest_game,
            MAX(game_date) as latest_game,
            AVG(home_score + away_score) as avg_total_score,
            AVG(home_score - away_score) as avg_spread
        FROM historical_games
        WHERE home_score IS NOT NULL AND away_score IS NOT NULL
        GROUP BY sport, league
        ORDER BY total_games DESC;
        """
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query)
            results = cursor.fetchall()
        
        summary = {}
        for row in results:
            key = f"{row['sport']}_{row['league']}"
            summary[key] = dict(row)
        
        logger.info("📊 Historical Games Data Summary:")
        for key, data in summary.items():
            logger.info(f"  {key}: {data['total_games']:,} games, {data['teams']} teams, {data['years']} years")
            logger.info(f"    Date range: {data['earliest_game']} to {data['latest_game']}")
            logger.info(f"    Avg total: {data['avg_total_score']:.1f}, Avg spread: {data['avg_spread']:.1f}")
        
        return summary

class MLBTeamFeatureEngineer:
    """Feature engineering specifically for MLB team-level betting"""
    
    @staticmethod
    def create_team_features(df: pd.DataFrame) -> pd.DataFrame:
        """Create advanced features for MLB team betting predictions"""
        logger.info("⚾ Engineering MLB team features...")
        
        # Sort by date
        df = df.sort_values(['game_date']).reset_index(drop=True)
        
        # Initialize lists to store rolling stats
        home_features = {}
        away_features = {}
        
        # Rolling windows
        windows = [5, 10, 20]
        
        # For each team, calculate rolling stats
        for window in windows:
            logger.info(f"  Calculating {window}-game rolling averages...")
            
            # Home team rolling stats
            df[f'home_runs_avg_{window}'] = df.groupby('home_team').apply(
                lambda x: x['home_score'].rolling(window, min_periods=1).mean().shift(1)
            ).reset_index(level=0, drop=True)
            
            df[f'home_runs_allowed_avg_{window}'] = df.groupby('home_team').apply(
                lambda x: x['away_score'].rolling(window, min_periods=1).mean().shift(1)
            ).reset_index(level=0, drop=True)
            
            df[f'home_run_diff_avg_{window}'] = df.groupby('home_team').apply(
                lambda x: (x['home_score'] - x['away_score']).rolling(window, min_periods=1).mean().shift(1)
            ).reset_index(level=0, drop=True)
            
            df[f'home_win_pct_{window}'] = df.groupby('home_team').apply(
                lambda x: (x['home_score'] > x['away_score']).rolling(window, min_periods=1).mean().shift(1)
            ).reset_index(level=0, drop=True)
            
            # Away team rolling stats
            df[f'away_runs_avg_{window}'] = df.groupby('away_team').apply(
                lambda x: x['away_score'].rolling(window, min_periods=1).mean().shift(1)
            ).reset_index(level=0, drop=True)
            
            df[f'away_runs_allowed_avg_{window}'] = df.groupby('away_team').apply(
                lambda x: x['home_score'].rolling(window, min_periods=1).mean().shift(1)
            ).reset_index(level=0, drop=True)
            
            df[f'away_run_diff_avg_{window}'] = df.groupby('away_team').apply(
                lambda x: (x['away_score'] - x['home_score']).rolling(window, min_periods=1).mean().shift(1)
            ).reset_index(level=0, drop=True)
            
            df[f'away_win_pct_{window}'] = df.groupby('away_team').apply(
                lambda x: (x['away_score'] > x['home_score']).rolling(window, min_periods=1).mean().shift(1)
            ).reset_index(level=0, drop=True)
        
        # Rest days
        df['home_rest_days'] = df.groupby('home_team')['game_date'].diff().dt.days.fillna(2)
        df['away_rest_days'] = df.groupby('away_team')['game_date'].diff().dt.days.fillna(2)
        
        # Season progress
        df['season_game_number'] = df.groupby(['season', 'home_team']).cumcount() + 1
        
        # Form trends (last 5 vs last 15)
        df['home_form_trend'] = (
            df.groupby('home_team').apply(
                lambda x: (x['home_score'] - x['away_score']).rolling(5, min_periods=1).mean().shift(1) -
                         (x['home_score'] - x['away_score']).rolling(15, min_periods=1).mean().shift(1)
            ).reset_index(level=0, drop=True)
        )
        
        df['away_form_trend'] = (
            df.groupby('away_team').apply(
                lambda x: (x['away_score'] - x['home_score']).rolling(5, min_periods=1).mean().shift(1) -
                         (x['away_score'] - x['home_score']).rolling(15, min_periods=1).mean().shift(1)
            ).reset_index(level=0, drop=True)
        )
        
        # Team strength differential features
        df['run_diff_differential'] = df['home_run_diff_avg_10'] - df['away_run_diff_avg_10']
        df['win_pct_differential'] = df['home_win_pct_10'] - df['away_win_pct_10']
        df['runs_scored_differential'] = df['home_runs_avg_10'] - df['away_runs_avg_10']
        df['runs_allowed_differential'] = df['away_runs_allowed_avg_10'] - df['home_runs_allowed_avg_10']
        
        logger.info(f"✅ Created team features with {len([col for col in df.columns if 'avg' in col or 'pct' in col or 'diff' in col])} engineered columns")
        
        return df

class BettingModelTrainer:
    """Trains different types of betting models"""
    
    def __init__(self, model_type: str):
        self.model_type = model_type  # 'moneyline', 'spread', 'total'
        self.models = {}
        self.scalers = {}
        self.feature_columns = []
        self.results = {}
    
    def prepare_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Optional[pd.Series]]:
        """Prepare features for training"""
        
        # Define feature columns (excluding identifiers and targets)
        exclude_cols = [
            'id', 'external_game_id', 'sport', 'league', 'season', 
            'home_team', 'away_team', 'game_date', 'home_score', 'away_score',
            'moneyline_outcome', 'point_spread', 'total_score'
        ]
        
        feature_cols = [col for col in df.columns if col not in exclude_cols and not df[col].isna().all()]
        
        # Remove rows with NaN in features
        df_clean = df[feature_cols + ['moneyline_outcome', 'point_spread', 'total_score']].dropna()
        
        if len(df_clean) < 100:
            logger.warning(f"⚠️ Only {len(df_clean)} clean samples available")
            return pd.DataFrame(), None
        
        X = df_clean[feature_cols]
        
        # Set target based on model type
        if self.model_type == 'moneyline':
            y = df_clean['moneyline_outcome']
        elif self.model_type == 'spread':
            y = df_clean['point_spread']
        elif self.model_type == 'total':
            y = df_clean['total_score']
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")
        
        self.feature_columns = feature_cols
        logger.info(f"✅ Prepared {len(X)} samples with {len(feature_cols)} features for {self.model_type}")
        
        return X, y
    
    def train_models(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, Any]:
        """Train multiple models and compare performance"""
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y if self.model_type == 'moneyline' else None
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        self.scalers['main'] = scaler
        
        # Define models based on type
        if self.model_type == 'moneyline':
            models_to_try = {
                'Logistic Regression': LogisticRegression(random_state=42, max_iter=1000),
                'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10),
                'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=42)
            }
        else:  # spread or total
            models_to_try = {
                'Random Forest': RandomForestRegressor(n_estimators=100, random_state=42, max_depth=12),
                'Gradient Boosting': GradientBoostingRegressor(n_estimators=100, random_state=42)
            }
        
        results = {}
        
        for name, model in models_to_try.items():
            logger.info(f"🔄 Training {name} for {self.model_type}...")
            
            # Train model
            if 'Logistic' in name:
                model.fit(X_train_scaled, y_train)
                y_pred = model.predict(X_test_scaled)
                y_pred_proba = model.predict_proba(X_test_scaled)[:, 1] if hasattr(model, 'predict_proba') else None
            else:
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                y_pred_proba = None
            
            # Evaluate based on model type
            if self.model_type == 'moneyline':
                accuracy = accuracy_score(y_test, y_pred)
                cv_scores = cross_val_score(model, X_train_scaled if 'Logistic' in name else X_train, y_train, cv=5)
                
                results[name] = {
                    'accuracy': round(accuracy, 4),
                    'cv_mean': round(cv_scores.mean(), 4),
                    'cv_std': round(cv_scores.std(), 4),
                    'samples_train': len(X_train),
                    'samples_test': len(X_test)
                }
                
                logger.info(f"   ✅ Accuracy: {accuracy:.3f} ({accuracy*100:.1f}%)")
                logger.info(f"   ✅ CV Score: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")
                
            else:  # regression models
                mae = mean_absolute_error(y_test, y_pred)
                rmse = np.sqrt(mean_squared_error(y_test, y_pred))
                r2 = r2_score(y_test, y_pred)
                
                results[name] = {
                    'mae': round(mae, 3),
                    'rmse': round(rmse, 3),
                    'r2': round(r2, 4),
                    'samples_train': len(X_train),
                    'samples_test': len(X_test)
                }
                
                logger.info(f"   ✅ MAE: {mae:.2f}")
                logger.info(f"   ✅ RMSE: {rmse:.2f}")
                logger.info(f"   ✅ R²: {r2:.3f}")
                
                # Calculate accuracy within reasonable ranges
                if self.model_type == 'spread':
                    within_3 = np.mean(np.abs(y_pred - y_test) <= 3) * 100
                    within_5 = np.mean(np.abs(y_pred - y_test) <= 5) * 100
                    results[name]['within_3_runs'] = round(within_3, 1)
                    results[name]['within_5_runs'] = round(within_5, 1)
                    logger.info(f"   ✅ Within 3 runs: {within_3:.1f}%")
                    
                elif self.model_type == 'total':
                    within_1 = np.mean(np.abs(y_pred - y_test) <= 1) * 100
                    within_2 = np.mean(np.abs(y_pred - y_test) <= 2) * 100
                    results[name]['within_1_run'] = round(within_1, 1)
                    results[name]['within_2_runs'] = round(within_2, 1)
                    logger.info(f"   ✅ Within 1 run: {within_1:.1f}%")
            
            # Store model
            self.models[name] = model
        
        # Select best model
        if self.model_type == 'moneyline':
            best_model_name = max(results.keys(), key=lambda x: results[x]['cv_mean'])
        else:
            best_model_name = max(results.keys(), key=lambda x: results[x]['r2'])
        
        self.best_model = self.models[best_model_name]
        self.best_model_name = best_model_name
        
        logger.info(f"🏆 Best {self.model_type} model: {best_model_name}")
        
        return results
    
    def save_model(self):
        """Save the best model"""
        os.makedirs('models', exist_ok=True)
        
        model_path = f'models/mlb_{self.model_type}_historical_model.pkl'
        
        joblib.dump({
            'model': self.best_model,
            'scaler': self.scalers.get('main'),
            'feature_columns': self.feature_columns,
            'model_type': self.model_type,
            'model_name': self.best_model_name,
            'sport': 'MLB',
            'trained_at': datetime.now().isoformat()
        }, model_path)
        
        logger.info(f"💾 {self.model_type.title()} model saved to {model_path}")

def main():
    """Main training function for historical games models"""
    logger.info("⚾ Starting MLB Historical Games Model Training")
    logger.info("=" * 60)
    logger.info("🎯 Training: Moneyline, Spread, and Over/Under models")
    logger.info("📊 Data source: historical_games table (25,000+ MLB records)")
    
    # Initialize data loader
    loader = HistoricalGamesLoader()
    
    # Get data summary
    logger.info("\n📋 Data Summary:")
    summary = loader.get_data_summary()
    
    # Load MLB historical games
    logger.info(f"\n📥 Loading MLB historical games...")
    df = loader.load_historical_games('MLB', '2020-01-01')
    
    if len(df) < 1000:
        logger.error("❌ Insufficient data for training. Need at least 1000 games.")
        return
    
    logger.info(f"✅ Loaded {len(df):,} MLB games")
    logger.info(f"   Home team wins: {df['moneyline_outcome'].sum():,} ({df['moneyline_outcome'].mean()*100:.1f}%)")
    logger.info(f"   Average total score: {df['total_score'].mean():.1f}")
    logger.info(f"   Average spread: {df['point_spread'].mean():.1f}")
    
    # Engineer features
    logger.info(f"\n🔧 Engineering team features...")
    engineer = MLBTeamFeatureEngineer()
    df = engineer.create_team_features(df)
    
    # Train models
    model_types = ['moneyline', 'spread', 'total']
    all_results = {}
    
    for model_type in model_types:
        logger.info(f"\n{'='*60}")
        logger.info(f"🚀 Training {model_type.upper()} models...")
        logger.info("=" * 60)
        
        trainer = BettingModelTrainer(model_type)
        X, y = trainer.prepare_features(df)
        
        if X.empty:
            logger.error(f"❌ No valid data for {model_type} training")
            continue
        
        results = trainer.train_models(X, y)
        trainer.save_model()
        
        all_results[model_type] = results
    
    # Final summary
    logger.info(f"\n" + "="*60)
    logger.info("🏆 TRAINING SUMMARY")
    logger.info("="*60)
    
    for model_type, results in all_results.items():
        logger.info(f"\n{model_type.upper()} MODELS:")
        
        for model_name, metrics in results.items():
            logger.info(f"  {model_name}:")
            
            if model_type == 'moneyline':
                logger.info(f"    ✅ Accuracy: {metrics['accuracy']:.3f} ({metrics['accuracy']*100:.1f}%)")
                logger.info(f"    ✅ CV Score: {metrics['cv_mean']:.3f}")
                    
            else:
                logger.info(f"    ✅ MAE: {metrics['mae']:.2f}")
                logger.info(f"    ✅ R²: {metrics['r2']:.3f}")
                
                if model_type == 'spread' and 'within_3_runs' in metrics:
                    logger.info(f"    ✅ Within 3 runs: {metrics['within_3_runs']:.1f}%")
                elif model_type == 'total' and 'within_1_run' in metrics:
                    logger.info(f"    ✅ Within 1 run: {metrics['within_1_run']:.1f}%")
    
    logger.info(f"\n✅ All models trained and saved!")
    logger.info(f"📋 Next steps:")
    logger.info(f"  1. Test predictions on recent games")
    logger.info(f"  2. Compare against sportsbook lines")
    logger.info(f"  3. Set up automated daily predictions")
    logger.info(f"  4. Monitor model performance over time")
    
    return all_results

if __name__ == "__main__":
    main() 