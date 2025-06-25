#!/usr/bin/env python3
"""
Team Model Training Script
Trains ML/Spread/Totals models using historical_games data
"""

import os
import sys
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, mean_absolute_error, roc_auc_score
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

class TeamModelTrainer:
    """Train models for team-based predictions"""
    
    def __init__(self):
        self.conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=int(os.getenv('DB_PORT', 5432)),
            sslmode='require'
        )
        logger.info("✅ Connected to database")
    
    def fetch_historical_games(self, sport: str, min_games: int = 100):
        """Fetch historical games for training"""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
        SELECT 
            home_team,
            away_team,
            home_score,
            away_score,
            ml_home_close,
            ml_away_close,
            spread_line_close,
            spread_home_odds_close,
            spread_away_odds_close,
            total_line_close,
            total_over_odds_close,
            total_under_odds_close,
            game_date
        FROM historical_games
        WHERE sport = %s
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
        ORDER BY game_date DESC
        """
        
        cursor.execute(query, (sport,))
        games = cursor.fetchall()
        cursor.close()
        
        logger.info(f"📊 Fetched {len(games)} {sport} games")
        
        if len(games) < min_games:
            logger.warning(f"⚠️ Only {len(games)} games available, need at least {min_games}")
            return None
            
        return pd.DataFrame(games)
    
    def create_team_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create features for team-based predictions"""
        # Calculate team statistics
        team_stats = {}
        
        for _, game in df.iterrows():
            home_team = game['home_team']
            away_team = game['away_team']
            
            # Initialize team stats if not exists
            for team in [home_team, away_team]:
                if team not in team_stats:
                    team_stats[team] = {
                        'games': 0,
                        'wins': 0,
                        'points_for': 0,
                        'points_against': 0,
                        'last_5_wins': [],
                        'last_5_totals': []
                    }
            
            # Update stats
            home_won = game['home_score'] > game['away_score']
            
            # Home team
            team_stats[home_team]['games'] += 1
            team_stats[home_team]['wins'] += int(home_won)
            team_stats[home_team]['points_for'] += game['home_score']
            team_stats[home_team]['points_against'] += game['away_score']
            team_stats[home_team]['last_5_wins'].append(int(home_won))
            team_stats[home_team]['last_5_totals'].append(game['home_score'] + game['away_score'])
            
            # Away team
            team_stats[away_team]['games'] += 1
            team_stats[away_team]['wins'] += int(not home_won)
            team_stats[away_team]['points_for'] += game['away_score']
            team_stats[away_team]['points_against'] += game['home_score']
            team_stats[away_team]['last_5_wins'].append(int(not home_won))
            team_stats[away_team]['last_5_totals'].append(game['home_score'] + game['away_score'])
            
            # Keep only last 5
            for team in [home_team, away_team]:
                team_stats[team]['last_5_wins'] = team_stats[team]['last_5_wins'][-5:]
                team_stats[team]['last_5_totals'] = team_stats[team]['last_5_totals'][-5:]
        
        # Create features for each game
        features = []
        
        for _, game in df.iterrows():
            home_team = game['home_team']
            away_team = game['away_team']
            
            home_stats = team_stats[home_team]
            away_stats = team_stats[away_team]
            
            # Calculate features
            feature_dict = {
                # Win percentages
                'home_win_pct': home_stats['wins'] / max(home_stats['games'], 1),
                'away_win_pct': away_stats['wins'] / max(away_stats['games'], 1),
                
                # Recent form
                'home_last_5_wins': sum(home_stats['last_5_wins']) / max(len(home_stats['last_5_wins']), 1),
                'away_last_5_wins': sum(away_stats['last_5_wins']) / max(len(away_stats['last_5_wins']), 1),
                
                # Scoring averages
                'home_ppg': home_stats['points_for'] / max(home_stats['games'], 1),
                'away_ppg': away_stats['points_for'] / max(away_stats['games'], 1),
                'home_papg': home_stats['points_against'] / max(home_stats['games'], 1),
                'away_papg': away_stats['points_against'] / max(away_stats['games'], 1),
                
                # Recent totals
                'home_last_5_total_avg': np.mean(home_stats['last_5_totals']) if home_stats['last_5_totals'] else 0,
                'away_last_5_total_avg': np.mean(away_stats['last_5_totals']) if away_stats['last_5_totals'] else 0,
                
                # Home advantage
                'is_home': 1,  # Always 1 for home team perspective
                
                # Targets
                'home_won': int(game['home_score'] > game['away_score']),
                'home_covered': int((game['home_score'] - game['away_score']) > (game['spread_line_close'] or 0)),
                'total_points': game['home_score'] + game['away_score'],
                'went_over': int((game['home_score'] + game['away_score']) > (game['total_line_close'] or 0))
            }
            
            features.append(feature_dict)
        
        return pd.DataFrame(features)
    
    def train_moneyline_model(self, sport: str):
        """Train model to predict moneyline winners"""
        logger.info(f"🏆 Training {sport} moneyline model...")
        
        # Fetch data
        df = self.fetch_historical_games(sport)
        if df is None:
            return None
        
        # Create features
        features_df = self.create_team_features(df)
        
        # Prepare data
        feature_cols = [
            'home_win_pct', 'away_win_pct',
            'home_last_5_wins', 'away_last_5_wins',
            'home_ppg', 'away_ppg',
            'home_papg', 'away_papg',
            'is_home'
        ]
        
        X = features_df[feature_cols]
        y = features_df['home_won']
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train model
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        
        model.fit(X_train_scaled, y_train)
        
        # Evaluate
        train_acc = model.score(X_train_scaled, y_train)
        test_acc = model.score(X_test_scaled, y_test)
        
        # Get probabilities for AUC
        y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
        auc = roc_auc_score(y_test, y_pred_proba)
        
        logger.info(f"✅ {sport} Moneyline Model Performance:")
        logger.info(f"   Train Accuracy: {train_acc:.3f}")
        logger.info(f"   Test Accuracy: {test_acc:.3f}")
        logger.info(f"   AUC Score: {auc:.3f}")
        
        # Save model
        model_data = {
            'model': model,
            'scaler': scaler,
            'feature_cols': feature_cols,
            'sport': sport,
            'metrics': {
                'train_acc': train_acc,
                'test_acc': test_acc,
                'auc': auc
            }
        }
        
        joblib.dump(model_data, f'models/{sport.lower()}_moneyline_model.pkl')
        logger.info(f"💾 Saved {sport} moneyline model")
        
        return model_data
    
    def train_spread_model(self, sport: str):
        """Train model to predict spread outcomes"""
        logger.info(f"📏 Training {sport} spread model...")
        
        # Similar to moneyline but predicting spread coverage
        # Implementation would follow same pattern
        logger.info("⚠️ Spread model training not yet implemented")
        return None
    
    def train_totals_model(self, sport: str):
        """Train model to predict over/under"""
        logger.info(f"📊 Training {sport} totals model...")
        
        # Fetch data
        df = self.fetch_historical_games(sport)
        if df is None:
            return None
        
        # Create features
        features_df = self.create_team_features(df)
        
        # Prepare data for totals prediction
        feature_cols = [
            'home_ppg', 'away_ppg',
            'home_papg', 'away_papg',
            'home_last_5_total_avg', 'away_last_5_total_avg'
        ]
        
        X = features_df[feature_cols]
        y = features_df['total_points']
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train model
        model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            random_state=42
        )
        
        model.fit(X_train_scaled, y_train)
        
        # Evaluate
        train_mae = mean_absolute_error(y_train, model.predict(X_train_scaled))
        test_mae = mean_absolute_error(y_test, model.predict(X_test_scaled))
        
        logger.info(f"✅ {sport} Totals Model Performance:")
        logger.info(f"   Train MAE: {train_mae:.2f}")
        logger.info(f"   Test MAE: {test_mae:.2f}")
        
        # Save model
        model_data = {
            'model': model,
            'scaler': scaler,
            'feature_cols': feature_cols,
            'sport': sport,
            'metrics': {
                'train_mae': train_mae,
                'test_mae': test_mae
            }
        }
        
        joblib.dump(model_data, f'models/{sport.lower()}_totals_model.pkl')
        logger.info(f"💾 Saved {sport} totals model")
        
        return model_data
    
    def train_all_sports(self):
        """Train models for all sports"""
        sports = ['MLB', 'NBA', 'NHL', 'NFL']
        
        for sport in sports:
            logger.info(f"\n{'='*60}")
            logger.info(f"Training {sport} models...")
            logger.info(f"{'='*60}")
            
            # Check if we have enough data
            cursor = self.conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM historical_games WHERE sport = %s",
                (sport,)
            )
            count = cursor.fetchone()[0]
            cursor.close()
            
            if count < 100:
                logger.warning(f"⚠️ Skipping {sport} - only {count} games available")
                continue
            
            # Train models
            self.train_moneyline_model(sport)
            self.train_totals_model(sport)
            # self.train_spread_model(sport)  # TODO: Implement

if __name__ == "__main__":
    trainer = TeamModelTrainer()
    trainer.train_all_sports() 