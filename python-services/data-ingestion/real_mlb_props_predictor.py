#!/usr/bin/env python3

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import StandardScaler
import joblib
import os
from datetime import datetime

from real_data_adapter import RealMLBDataAdapter

class RealMLBPropsBettor:
    """A bettor for predicting MLB player props using REAL Statcast data"""
    
    def __init__(
        self,
        model_type: str = 'random_forest',
        prop_type: str = 'hits',
        **kwargs
    ):
        """Initialize the Real MLB Props Bettor.
        
        Args:
            model_type: Type of model ('random_forest', 'gradient_boost', 'linear')
            prop_type: Type of prop to predict ('hits', 'home_runs', 'strikeouts', etc.)
        """
        self.model_type = model_type
        self.prop_type = prop_type
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = []
        self.training_stats = {}
        self.data_adapter = None
        
    def _create_model(self):
        """Create the appropriate model based on model_type."""
        if self.model_type == 'random_forest':
            return RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
        elif self.model_type == 'gradient_boost':
            return GradientBoostingRegressor(
                n_estimators=100,
                max_depth=6,
                random_state=42
            )
        elif self.model_type == 'linear':
            return LinearRegression()
        else:
            raise ValueError(f"Unknown model_type: {self.model_type}")
    
    def train_model(self) -> Dict[str, Any]:
        """Train the model using real MLB Statcast data"""
        return self.train_with_real_data()
    
    def train_with_real_data(self) -> Dict[str, Any]:
        """Train the model using real MLB Statcast data"""
        print(f"🔥 Training {self.prop_type} predictor with REAL MLB data...")
        
        try:
            # Initialize data adapter
            self.data_adapter = RealMLBDataAdapter()
            
            # Get real training data
            X, y = self.data_adapter.create_training_dataset(self.prop_type)
            
            # Store feature columns
            self.feature_columns = X.columns.tolist()
            
            # Split data for validation
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Create and train model
            self.model = self._create_model()
            self.model.fit(X_train_scaled, y_train)
            
            # Evaluate model
            train_pred = self.model.predict(X_train_scaled)
            test_pred = self.model.predict(X_test_scaled)
            
            self.training_stats = {
                'status': 'success',
                'model_type': self.model_type,
                'prop_type': self.prop_type,
                'training_samples': len(X_train),
                'test_samples': len(X_test),
                'features_count': len(self.feature_columns),
                'train_mae': round(mean_absolute_error(y_train, train_pred), 3),
                'test_mae': round(mean_absolute_error(y_test, test_pred), 3),
                'train_rmse': round(np.sqrt(mean_squared_error(y_train, train_pred)), 3),
                'test_rmse': round(np.sqrt(mean_squared_error(y_test, test_pred)), 3),
                'target_mean': round(y.mean(), 3),
                'target_std': round(y.std(), 3),
                'data_source': 'real_mlb_statcast',
                'training_date': datetime.now().isoformat()
            }
            
            print(f"✅ Model trained successfully!")
            print(f"   Training MAE: {self.training_stats['train_mae']}")
            print(f"   Test MAE: {self.training_stats['test_mae']}")
            print(f"   Features: {len(self.feature_columns)}")
            print(f"   Data: {len(X)} real MLB game records")
            
            return self.training_stats
            
        except Exception as e:
            error_stats = {
                'status': 'error',
                'error': str(e),
                'model_type': self.model_type,
                'prop_type': self.prop_type,
                'data_source': 'real_mlb_statcast'
            }
            print(f"❌ Training failed: {e}")
            return error_stats
        
        finally:
            if self.data_adapter:
                self.data_adapter.close()
    
    def predict_for_player(
        self, 
        player_name: str, 
        line_value: float,
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Make a prediction for a specific player using real data"""
        
        if self.model is None:
            return {
                'success': False,
                'error': 'Model not trained. Call train_with_real_data() first.',
                'player_name': player_name
            }
        
        try:
            # Get player's recent real stats
            if not self.data_adapter:
                self.data_adapter = RealMLBDataAdapter()
            
            recent_stats = self.data_adapter.get_recent_player_stats(player_name, games=10)
            
            if not recent_stats:
                return {
                    'success': False,
                    'error': f'No recent data found for {player_name}',
                    'player_name': player_name
                }
            
            # Create feature vector from real stats
            features = self._create_prediction_features(recent_stats, context or {})
            
            # Ensure all required features are present
            feature_df = pd.DataFrame([features])
            missing_cols = set(self.feature_columns) - set(feature_df.columns)
            for col in missing_cols:
                feature_df[col] = 0  # Fill missing with 0
            
            # Reorder to match training
            feature_df = feature_df[self.feature_columns]
            
            # Scale and predict
            features_scaled = self.scaler.transform(feature_df)
            prediction = self.model.predict(features_scaled)[0]
            
            # Calculate confidence based on model variance (for ensemble models)
            if hasattr(self.model, 'estimators_'):
                tree_predictions = np.array([
                    tree.predict(features_scaled)[0] for tree in self.model.estimators_
                ])
                prediction_std = np.std(tree_predictions)
                confidence = min(0.95, max(0.55, 1 / (1 + prediction_std)))
            else:
                confidence = 0.75  # Default for linear models
            
            # Determine recommendation
            difference = abs(prediction - line_value)
            value_percentage = (difference / max(line_value, 0.1)) * 100
            recommendation = "Over" if prediction > line_value else "Under"
            
            # Adjust confidence based on prediction distance
            if value_percentage > 15:
                confidence = min(confidence * 1.2, 0.95)
            elif value_percentage < 5:
                confidence = confidence * 0.8
            
            result = {
                'success': True,
                'player_name': player_name,
                'prop_type': self.prop_type,
                'predicted_value': round(prediction, 2),
                'line_value': line_value,
                'recommendation': recommendation,
                'confidence': round(confidence * 100, 1),
                'value_percentage': round(value_percentage, 2),
                'recent_stats': recent_stats,
                'model_info': {
                    'type': self.model_type,
                    'data_source': 'real_mlb_statcast',
                    'training_mae': self.training_stats.get('test_mae', 'unknown')
                }
            }
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'player_name': player_name,
                'prop_type': self.prop_type
            }
        
        finally:
            if self.data_adapter:
                self.data_adapter.close()
    
    def _create_prediction_features(
        self, 
        recent_stats: Dict[str, float], 
        context: Dict[str, Any]
    ) -> Dict[str, float]:
        """Create feature vector for prediction from real player stats"""
        
        features = {}
        
        # Rolling averages based on recent performance
        features[f'{self.prop_type}_avg_3'] = recent_stats.get(f'recent_{self.prop_type}', 0)
        features[f'{self.prop_type}_avg_5'] = recent_stats.get(f'recent_{self.prop_type}', 0)
        features[f'{self.prop_type}_avg_10'] = recent_stats.get(f'recent_{self.prop_type}', 0)
        
        # Recent performance features
        features['recent_at_bats_avg'] = recent_stats.get('recent_at_bats', 12)
        features['recent_exit_velocity_avg'] = recent_stats.get('recent_exit_velocity', 85)
        features['recent_woba_avg'] = recent_stats.get('recent_woba', 0.32)
        
        # Context features
        features['is_home'] = context.get('is_home', 1)
        features['days_rest'] = context.get('days_rest', 1)
        features['season_game_number'] = context.get('season_game_number', 50)
        
        # Position features (simplified for now)
        position = context.get('position', 'OF')
        features['is_power_position'] = 1 if position in ['OF', '1B', 'DH'] else 0
        
        # Opponent features (simplified)
        features['opponent_allowed_hits'] = context.get('opponent_allowed_hits', 8.5)
        
        # Real Statcast features
        features['avg_launch_speed'] = recent_stats.get('recent_exit_velocity', 85)
        features['avg_launch_angle'] = context.get('avg_launch_angle', 15)  # Could be enhanced
        features['estimated_ba'] = recent_stats.get('recent_batting_avg', 0.25)
        features['estimated_woba'] = recent_stats.get('recent_woba', 0.32)
        
        # Performance streak (simplified)
        features['hot_streak'] = 1 if recent_stats.get('recent_batting_avg', 0) > 0.3 else 0
        
        return features
    
    def get_feature_importance(self) -> pd.DataFrame:
        """Get feature importance for the trained model"""
        if self.model is None:
            raise ValueError("Model not trained. Call train_with_real_data() first.")
        
        if hasattr(self.model, 'feature_importances_'):
            importance_df = pd.DataFrame({
                'feature': self.feature_columns,
                'importance': self.model.feature_importances_
            }).sort_values('importance', ascending=False)
            
            return importance_df
        else:
            # For linear models, use absolute coefficients
            if hasattr(self.model, 'coef_'):
                importance_df = pd.DataFrame({
                    'feature': self.feature_columns,
                    'importance': np.abs(self.model.coef_)
                }).sort_values('importance', ascending=False)
                
                return importance_df
        
        return pd.DataFrame()
    
    def save_model(self, filepath: str):
        """Save the trained model"""
        if self.model is None:
            raise ValueError("No model to save. Train first.")
        
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_columns': self.feature_columns,
            'training_stats': self.training_stats,
            'model_type': self.model_type,
            'prop_type': self.prop_type
        }
        
        joblib.dump(model_data, filepath)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """Load a trained model"""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file not found: {filepath}")
        
        model_data = joblib.load(filepath)
        
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_columns = model_data['feature_columns']
        self.training_stats = model_data['training_stats']
        self.model_type = model_data['model_type']
        self.prop_type = model_data['prop_type']
        
        print(f"Model loaded from {filepath}")


def test_real_mlb_predictor():
    """Test the real MLB predictor"""
    print("🔥 TESTING REAL MLB PREDICTOR")
    print("=" * 50)
    
    # Test hits prediction
    hits_predictor = RealMLBPropsBettor(
        model_type='random_forest',
        prop_type='hits'
    )
    
    # Train with real data
    training_result = hits_predictor.train_with_real_data()
    print(f"\nTraining Result: {training_result}")
    
    if training_result['status'] == 'success':
        # Test predictions for real players
        test_players = ['Aaron Judge', 'Shohei Ohtani', 'Manny Machado']
        
        for player in test_players:
            prediction = hits_predictor.predict_for_player(
                player_name=player,
                line_value=1.5,  # 1.5 hits line
                context={'is_home': 1, 'days_rest': 1}
            )
            
            print(f"\n{player} Hits Prediction:")
            if prediction['success']:
                print(f"  Predicted: {prediction['predicted_value']} hits")
                print(f"  Line: {prediction['line_value']}")
                print(f"  Recommendation: {prediction['recommendation']}")
                print(f"  Confidence: {prediction['confidence']}%")
                print(f"  Value: {prediction['value_percentage']}%")
                print(f"  Recent Stats: {prediction['recent_stats']}")
            else:
                print(f"  Error: {prediction['error']}")
        
        # Show feature importance
        print(f"\n🎯 MOST IMPORTANT FEATURES:")
        importance = hits_predictor.get_feature_importance()
        print(importance.head(10))


if __name__ == "__main__":
    test_real_mlb_predictor() 