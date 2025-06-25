#!/usr/bin/env python3

import psycopg2
import pandas as pd
import numpy as np
import os
import json
from dotenv import load_dotenv
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple

# Load environment variables
load_dotenv()

class RealMLBDataAdapter:
    """Adapter to convert our real MLB Statcast data into AI model training format"""
    
    def __init__(self):
        self.conn = None
        self._connect()
    
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
        except Exception as e:
            print(f"Database connection error: {e}")
            raise
    
    def get_all_players_data(self) -> pd.DataFrame:
        """Get all player game statistics from our database"""
        query = """
        SELECT 
            p.id as player_id,
            p.name as player_name,
            p.external_player_id as mlb_id,
            p.position,
            p.team,
            pgs.stats,
            pgs.event_id,
            pgs.created_at
        FROM players p
        JOIN player_game_stats pgs ON p.id = pgs.player_id
        WHERE pgs.stats IS NOT NULL
        ORDER BY p.name, pgs.stats->>'game_date';
        """
        
        cursor = self.conn.cursor()
        cursor.execute(query)
        
        # Get column names
        columns = [desc[0] for desc in cursor.description]
        
        # Fetch all data
        rows = cursor.fetchall()
        cursor.close()
        
        # Convert to DataFrame
        df = pd.DataFrame(rows, columns=columns)
        
        # Parse stats JSON (already parsed by psycopg2 for JSONB columns)
        df['stats_parsed'] = df['stats'].apply(lambda x: x if isinstance(x, dict) else {})
        
        return df
    
    def extract_player_features(self, df: pd.DataFrame, prop_type: str = 'hits') -> pd.DataFrame:
        """Extract features for AI model training from real data"""
        
        # Extract individual stats from JSON
        feature_df = pd.DataFrame()
        
        for idx, row in df.iterrows():
            stats = row['stats_parsed']
            
            # Basic identifiers
            feature_df.loc[idx, 'player_id'] = row['player_id']
            feature_df.loc[idx, 'player_name'] = row['player_name']
            feature_df.loc[idx, 'mlb_id'] = row['mlb_id']
            feature_df.loc[idx, 'position'] = row['position']
            feature_df.loc[idx, 'team'] = row['team']
            feature_df.loc[idx, 'game_date'] = stats.get('game_date')
            
            # Real Statcast features
            feature_df.loc[idx, 'at_bats'] = stats.get('at_bats', 0)
            feature_df.loc[idx, 'hits'] = stats.get('hits', 0)
            feature_df.loc[idx, 'home_runs'] = stats.get('home_runs', 0)
            feature_df.loc[idx, 'strikeouts'] = stats.get('strikeouts', 0)
            feature_df.loc[idx, 'walks'] = stats.get('walks', 0)
            
            # Advanced Statcast metrics (exit velocity, launch angle, etc.)
            feature_df.loc[idx, 'avg_launch_speed'] = stats.get('avg_launch_speed', 0)
            feature_df.loc[idx, 'avg_launch_angle'] = stats.get('avg_launch_angle', 0)
            feature_df.loc[idx, 'max_hit_distance'] = stats.get('max_hit_distance', 0)
            feature_df.loc[idx, 'estimated_ba'] = stats.get('estimated_ba', 0)
            feature_df.loc[idx, 'estimated_woba'] = stats.get('estimated_woba', 0)
            feature_df.loc[idx, 'pitch_count'] = stats.get('pitch_count', 0)
            
            # Target variable (what we're predicting)
            feature_df.loc[idx, f'player_{prop_type}'] = stats.get(prop_type, 0)
        
        # Convert game_date to datetime
        feature_df['game_date'] = pd.to_datetime(feature_df['game_date'])
        
        # Sort by player and date for rolling calculations
        feature_df = feature_df.sort_values(['player_name', 'game_date'])
        
        return feature_df
    
    def add_rolling_features(self, df: pd.DataFrame, prop_type: str = 'hits') -> pd.DataFrame:
        """Add rolling averages and advanced features for AI training"""
        
        enhanced_df = df.copy()
        target_col = f'player_{prop_type}'
        
        # Group by player for rolling calculations
        for player_name in df['player_name'].unique():
            player_mask = df['player_name'] == player_name
            player_data = df[player_mask].copy()
            
            # Rolling averages (3, 5, 10 games)
            for window in [3, 5, 10]:
                col_name = f'{prop_type}_avg_{window}'
                enhanced_df.loc[player_mask, col_name] = (
                    player_data[target_col].rolling(window=window, min_periods=1).mean()
                )
            
            # Recent form features
            enhanced_df.loc[player_mask, 'recent_at_bats_avg'] = (
                player_data['at_bats'].rolling(window=5, min_periods=1).mean()
            )
            enhanced_df.loc[player_mask, 'recent_exit_velocity_avg'] = (
                player_data['avg_launch_speed'].rolling(window=5, min_periods=1).mean()
            )
            enhanced_df.loc[player_mask, 'recent_woba_avg'] = (
                player_data['estimated_woba'].rolling(window=5, min_periods=1).mean()
            )
            
            # Performance streaks
            enhanced_df.loc[player_mask, 'hot_streak'] = (
                (player_data[target_col] > player_data[target_col].rolling(10, min_periods=1).mean())
                .rolling(3).sum()
            )
        
        # Position-based features (power vs contact hitters)
        enhanced_df['is_power_position'] = enhanced_df['position'].isin(['OF', '1B', 'DH']).astype(int)
        
        # Game context features (simulate for now, could be enhanced later)
        enhanced_df['days_rest'] = np.random.choice([0, 1, 2, 3], len(enhanced_df), p=[0.3, 0.4, 0.2, 0.1])
        enhanced_df['is_home'] = np.random.choice([0, 1], len(enhanced_df), p=[0.5, 0.5])
        enhanced_df['season_game_number'] = enhanced_df.groupby('player_name').cumcount() + 1
        
        # Opponent features (simplified - could be enhanced with real opponent data)
        enhanced_df['opponent_allowed_hits'] = np.random.normal(8.5, 1.5, len(enhanced_df))
        
        return enhanced_df
    
    def create_training_dataset(self, prop_type: str = 'hits') -> Tuple[pd.DataFrame, pd.Series]:
        """Create a complete training dataset for AI models"""
        
        print(f"Creating training dataset for {prop_type} predictions...")
        
        # Get raw data
        raw_data = self.get_all_players_data()
        print(f"Retrieved {len(raw_data)} game records from {raw_data['player_name'].nunique()} players")
        
        # Extract features
        feature_data = self.extract_player_features(raw_data, prop_type)
        
        # Add rolling and advanced features
        enhanced_data = self.add_rolling_features(feature_data, prop_type)
        
        # Prepare features (X) and target (y)
        feature_columns = [
            f'{prop_type}_avg_3', f'{prop_type}_avg_5', f'{prop_type}_avg_10',
            'recent_at_bats_avg', 'recent_exit_velocity_avg', 'recent_woba_avg',
            'hot_streak', 'is_power_position', 'days_rest', 'is_home',
            'season_game_number', 'opponent_allowed_hits', 'avg_launch_speed',
            'avg_launch_angle', 'estimated_ba', 'estimated_woba'
        ]
        
        # Filter for available columns and handle missing values
        available_columns = [col for col in feature_columns if col in enhanced_data.columns]
        X = enhanced_data[available_columns].fillna(0)
        
        # Target variable
        y = enhanced_data[f'player_{prop_type}'].fillna(0)
        
        print(f"Training dataset: {len(X)} samples, {len(available_columns)} features")
        print(f"Target statistics: mean={y.mean():.2f}, std={y.std():.2f}")
        
        return X, y
    
    def get_player_lookup(self) -> Dict[str, Dict]:
        """Get player lookup for predictions"""
        query = """
        SELECT 
            p.id as player_id,
            p.name as player_name,
            p.external_player_id as mlb_id,
            p.position,
            p.team,
            COUNT(pgs.id) as games_count
        FROM players p
        LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
        WHERE p.sport = 'MLB'
        GROUP BY p.id, p.name, p.external_player_id, p.position, p.team
        ORDER BY games_count DESC;
        """
        
        cursor = self.conn.cursor()
        cursor.execute(query)
        
        players = {}
        for row in cursor.fetchall():
            player_id, name, mlb_id, position, team, games_count = row
            players[name] = {
                'id': str(player_id),
                'mlb_id': mlb_id,
                'position': position,
                'team': team,
                'games_count': games_count
            }
        
        cursor.close()
        return players
    
    def get_recent_player_stats(self, player_name: str, games: int = 5) -> Dict[str, float]:
        """Get recent performance for a specific player"""
        query = """
        SELECT pgs.stats
        FROM players p
        JOIN player_game_stats pgs ON p.id = pgs.player_id
        WHERE p.name = %s
        AND pgs.stats IS NOT NULL
        ORDER BY pgs.stats->>'game_date' DESC
        LIMIT %s;
        """
        
        cursor = self.conn.cursor()
        cursor.execute(query, (player_name, games))
        
        recent_stats = []
        for row in cursor.fetchall():
            stats = row[0]  # Already parsed by psycopg2
            if isinstance(stats, dict):
                recent_stats.append(stats)
        
        cursor.close()
        
        if not recent_stats:
            return {}
        
        # Calculate averages
        avg_stats = {
            'recent_hits': np.mean([s.get('hits', 0) for s in recent_stats]),
            'recent_at_bats': np.mean([s.get('at_bats', 0) for s in recent_stats]),
            'recent_exit_velocity': np.mean([s.get('avg_launch_speed', 0) for s in recent_stats if s.get('avg_launch_speed')]),
            'recent_batting_avg': np.mean([s.get('estimated_ba', 0) for s in recent_stats]),
            'recent_woba': np.mean([s.get('estimated_woba', 0) for s in recent_stats]),
            'games_analyzed': len(recent_stats)
        }
        
        return avg_stats
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


def test_real_data_adapter():
    """Test the real data adapter"""
    adapter = RealMLBDataAdapter()
    
    try:
        # Test getting training data for hits
        X, y = adapter.create_training_dataset('hits')
        print(f"\nTraining data shape: X={X.shape}, y={y.shape}")
        print(f"Features: {list(X.columns)}")
        print(f"Sample target values: {y.head().tolist()}")
        
        # Test player lookup
        players = adapter.get_player_lookup()
        print(f"\nAvailable players: {len(players)}")
        for name, info in list(players.items())[:5]:
            print(f"  {name}: {info['games_count']} games, {info['position']}, {info['team']}")
        
        # Test recent stats for a specific player
        if 'Aaron Judge' in players:
            recent = adapter.get_recent_player_stats('Aaron Judge')
            print(f"\nAaron Judge recent stats: {recent}")
        
    finally:
        adapter.close()


if __name__ == "__main__":
    test_real_data_adapter() 