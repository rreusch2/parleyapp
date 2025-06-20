"""Player props prediction models for sports betting."""

from __future__ import annotations

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import StandardScaler

from ._base import BaseBettor


class PlayerPropsBettor(BaseBettor):
    """A bettor for predicting player props."""
    
    def __init__(
        self,
        model_type: str = 'random_forest',
        prop_type: str = 'points',
        sport: str = 'NBA',
        **kwargs
    ):
        """Initialize the PlayerPropsBettor.
        
        Args:
            model_type: Type of model ('random_forest', 'gradient_boost', 'linear')
            prop_type: Type of prop to predict ('points', 'rebounds', 'assists', etc.)
            sport: Sport type ('NBA', 'NFL', 'MLB', 'NHL')
            **kwargs: Additional arguments for the base class
        """
        super().__init__(**kwargs)
        self.model_type = model_type
        self.prop_type = prop_type
        self.sport = sport
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = []
        
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
    
    def _prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Prepare features for player props prediction."""
        features = pd.DataFrame()
        
        # Basic player stats
        if f'player_{self.prop_type}' in data.columns:
            features[f'recent_{self.prop_type}'] = data[f'player_{self.prop_type}']
        
        # Rolling averages
        for window in [3, 5, 10]:
            if f'player_{self.prop_type}' in data.columns:
                features[f'{self.prop_type}_avg_{window}'] = (
                    data[f'player_{self.prop_type}'].rolling(window=window, min_periods=1).mean()
                )
        
        # Opponent stats (defense)
        if f'opponent_allowed_{self.prop_type}' in data.columns:
            features[f'opp_allowed_{self.prop_type}'] = data[f'opponent_allowed_{self.prop_type}']
        
        # Game context features
        context_features = [
            'is_home', 'days_rest', 'season_game_number',
            'back_to_back', 'minutes_played', 'usage_rate'
        ]
        
        for feature in context_features:
            if feature in data.columns:
                features[feature] = data[feature]
        
        # Sport-specific features
        if self.sport == 'NBA':
            nba_features = ['pace', 'defensive_rating', 'offensive_rating']
            for feature in nba_features:
                if feature in data.columns:
                    features[feature] = data[feature]
        
        elif self.sport == 'NFL':
            nfl_features = ['temperature', 'wind_speed', 'precipitation', 'dome_game']
            for feature in nfl_features:
                if feature in data.columns:
                    features[feature] = data[feature]
        
        # Injury/status indicators
        status_features = ['is_questionable', 'is_probable', 'minutes_restriction']
        for feature in status_features:
            if feature in data.columns:
                features[feature] = data[feature]
        
        # Fill missing values
        features = features.fillna(features.mean())
        
        return features
    
    def _fit(self, X: pd.DataFrame, Y: pd.DataFrame, O: pd.DataFrame | None = None) -> 'PlayerPropsBettor':
        """Fit the player props model (implementing abstract method)."""
        # For player props, we only use the target prop value from Y
        target_col = f'output__{self.prop_type}'
        if target_col not in Y.columns:
            # Try to find any column with the prop type
            matching_cols = [col for col in Y.columns if self.prop_type in col]
            if matching_cols:
                target_col = matching_cols[0]
            else:
                raise ValueError(f"No target column found for prop type {self.prop_type}")
        
        y = Y[target_col]
        
        # Prepare features
        features = self._prepare_features(X)
        self.feature_columns = features.columns.tolist()
        
        # Scale features
        X_scaled = self.scaler.fit_transform(features)
        
        # Create and train model
        self.model = self._create_model()
        self.model.fit(X_scaled, y)
        
        return self

    def fit(self, X: pd.DataFrame, y: pd.Series) -> 'PlayerPropsBettor':
        """Fit the player props model (convenience method)."""
        # Prepare features
        features = self._prepare_features(X)
        self.feature_columns = features.columns.tolist()
        
        # Scale features
        X_scaled = self.scaler.fit_transform(features)
        
        # Create and train model
        self.model = self._create_model()
        self.model.fit(X_scaled, y)
        
        return self
    
    def _predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Predict probabilities (implementing abstract method)."""
        # For regression models, we'll convert predictions to probabilities
        # This is a simplified approach - in practice you'd use proper probability models
        predictions = self.predict(X)
        
        # Convert to binary probabilities (simplified)
        # This assumes we're predicting over/under a line
        probabilities = np.column_stack([
            1 / (1 + np.exp(predictions - np.mean(predictions))),  # Under probability
            1 / (1 + np.exp(np.mean(predictions) - predictions))   # Over probability
        ])
        
        # Ensure probabilities sum to 1
        probabilities = probabilities / probabilities.sum(axis=1, keepdims=True)
        
        return probabilities

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Predict player prop values."""
        if self.model is None:
            raise ValueError("Model not fitted. Call fit() first.")
        
        # Prepare features
        features = self._prepare_features(X)
        
        # Ensure all required columns are present, filling with reasonable defaults
        missing_cols = set(self.feature_columns) - set(features.columns)
        for col in missing_cols:
            # Use intelligent defaults based on column name
            if 'recent_' in col or '_avg_' in col:
                # For recent stats and averages, use the current game value if available
                base_col = col.replace('recent_', '').replace('_avg_3', '').replace('_avg_5', '').replace('_avg_10', '')
                if f'player_{base_col}' in features.columns:
                    features[col] = features[f'player_{base_col}']
                else:
                    features[col] = 0
            else:
                features[col] = 0
        
        # Reorder columns to match training
        features = features[self.feature_columns]
        
        # Scale features
        X_scaled = self.scaler.transform(features)
        
        # Make predictions
        predictions = self.model.predict(X_scaled)
        
        return predictions
    
    def predict_with_confidence(
        self, 
        X: pd.DataFrame, 
        line_value: float
    ) -> Dict[str, Any]:
        """Predict with confidence intervals and betting recommendation."""
        predictions = self.predict(X)
        
        # Calculate confidence based on model type
        if hasattr(self.model, 'estimators_'):
            # For ensemble methods, use prediction variance
            tree_predictions = np.array([
                tree.predict(self.scaler.transform(self._prepare_features(X)[self.feature_columns]))
                for tree in self.model.estimators_
            ])
            prediction_std = np.std(tree_predictions, axis=0)
            confidence = 1 / (1 + prediction_std)  # Higher std = lower confidence
        else:
            # For linear models, use a simple heuristic
            confidence = np.full(len(predictions), 0.7)
        
        results = []
        for i, (pred, conf) in enumerate(zip(predictions, confidence)):
            # Determine recommendation
            difference = abs(pred - line_value)
            value_percentage = (difference / line_value) * 100
            
            recommendation = "Over" if pred > line_value else "Under"
            
            # Adjust confidence based on prediction distance from line
            if value_percentage > 10:
                conf = min(conf * 1.2, 0.95)
            elif value_percentage < 3:
                conf = conf * 0.8
            
            results.append({
                'predicted_value': round(pred, 2),
                'line_value': line_value,
                'recommendation': recommendation,
                'confidence': round(conf * 100, 1),
                'value_percentage': round(value_percentage, 2),
                'expected_profit': self._calculate_expected_profit(conf, value_percentage)
            })
        
        return results[0] if len(results) == 1 else results
    
    def _calculate_expected_profit(self, confidence: float, value_percentage: float) -> float:
        """Calculate expected profit based on confidence and value."""
        # Simple Kelly Criterion approximation
        prob_win = confidence
        odds_decimal = 1.91  # Assuming -110 odds
        
        if prob_win > (1 / odds_decimal):
            kelly_fraction = (prob_win * odds_decimal - 1) / (odds_decimal - 1)
            expected_profit = kelly_fraction * value_percentage
            return round(expected_profit, 2)
        else:
            return 0.0
    
    def get_feature_importance(self) -> pd.DataFrame:
        """Get feature importance for the trained model."""
        if self.model is None:
            raise ValueError("Model not fitted. Call fit() first.")
        
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
    
    def evaluate(self, X: pd.DataFrame, y: pd.Series) -> Dict[str, float]:
        """Evaluate the model performance."""
        predictions = self.predict(X)
        
        mae = mean_absolute_error(y, predictions)
        mse = mean_squared_error(y, predictions)
        rmse = np.sqrt(mse)
        
        # Calculate accuracy within certain thresholds
        accuracy_1 = np.mean(np.abs(y - predictions) <= 1)
        accuracy_2 = np.mean(np.abs(y - predictions) <= 2)
        accuracy_3 = np.mean(np.abs(y - predictions) <= 3)
        
        return {
            'mae': round(mae, 3),
            'mse': round(mse, 3),
            'rmse': round(rmse, 3),
            'accuracy_within_1': round(accuracy_1 * 100, 1),
            'accuracy_within_2': round(accuracy_2 * 100, 1),
            'accuracy_within_3': round(accuracy_3 * 100, 1)
        }


class MultiPropBettor:
    """A bettor that handles multiple prop types for a single player."""
    
    def __init__(self, sport: str = 'NBA', model_type: str = 'random_forest'):
        self.sport = sport
        self.model_type = model_type
        self.bettors = {}
        
    def add_prop_type(self, prop_type: str) -> None:
        """Add a new prop type to track."""
        self.bettors[prop_type] = PlayerPropsBettor(
            model_type=self.model_type,
            prop_type=prop_type,
            sport=self.sport
        )
    
    def fit(self, prop_type: str, X: pd.DataFrame, y: pd.Series) -> None:
        """Fit a specific prop type model."""
        if prop_type not in self.bettors:
            self.add_prop_type(prop_type)
        
        self.bettors[prop_type].fit(X, y)
    
    def predict_all_props(self, X: pd.DataFrame, lines: Dict[str, float]) -> Dict[str, Any]:
        """Predict all available prop types."""
        results = {}
        
        for prop_type, line_value in lines.items():
            if prop_type in self.bettors and self.bettors[prop_type].model is not None:
                prediction = self.bettors[prop_type].predict_with_confidence(X, line_value)
                results[prop_type] = prediction
        
        return results
    
    def get_best_bets(
        self, 
        X: pd.DataFrame, 
        lines: Dict[str, float], 
        min_confidence: float = 70,
        min_value: float = 5
    ) -> List[Dict[str, Any]]:
        """Get the best betting opportunities across all prop types."""
        all_predictions = self.predict_all_props(X, lines)
        
        best_bets = []
        for prop_type, prediction in all_predictions.items():
            if (prediction['confidence'] >= min_confidence and 
                prediction['value_percentage'] >= min_value):
                
                best_bets.append({
                    'prop_type': prop_type,
                    **prediction
                })
        
        # Sort by expected profit
        best_bets.sort(key=lambda x: x['expected_profit'], reverse=True)
        
        return best_bets


def create_sample_player_data(sport: str = 'NBA', n_games: int = 100) -> pd.DataFrame:
    """Create sample player data for testing."""
    np.random.seed(42)
    
    data = pd.DataFrame()
    
    if sport == 'NBA':
        # NBA player props data
        data['player_points'] = np.random.normal(25, 6, n_games)
        data['player_rebounds'] = np.random.normal(8, 3, n_games)
        data['player_assists'] = np.random.normal(6, 2.5, n_games)
        data['opponent_allowed_points'] = np.random.normal(110, 8, n_games)
        data['is_home'] = np.random.choice([0, 1], n_games, p=[0.4, 0.6])
        data['days_rest'] = np.random.choice([0, 1, 2, 3], n_games, p=[0.3, 0.4, 0.2, 0.1])
        data['minutes_played'] = np.random.normal(34, 4, n_games)
        data['pace'] = np.random.normal(100, 5, n_games)
        
    elif sport == 'NFL':
        # NFL player props data
        data['player_passing_yards'] = np.random.normal(280, 60, n_games)
        data['player_rushing_yards'] = np.random.normal(85, 35, n_games)
        data['player_receiving_yards'] = np.random.normal(65, 25, n_games)
        data['opponent_allowed_passing'] = np.random.normal(240, 40, n_games)
        data['is_home'] = np.random.choice([0, 1], n_games)
        data['temperature'] = np.random.normal(65, 15, n_games)
        data['wind_speed'] = np.random.exponential(8, n_games)
        data['dome_game'] = np.random.choice([0, 1], n_games, p=[0.7, 0.3])
    
    # Add some noise and correlations
    data = data.clip(lower=0)  # No negative stats
    
    return data


if __name__ == "__main__":
    # Example usage
    print("Creating sample NBA player props data...")
    data = create_sample_player_data('NBA', 200)
    
    # Split data
    train_data = data[:150]
    test_data = data[150:]
    
    # Train points prediction model
    bettor = PlayerPropsBettor(prop_type='points', sport='NBA')
    bettor.fit(train_data, train_data['player_points'])
    
    # Make predictions
    predictions = bettor.predict_with_confidence(test_data.head(1), line_value=24.5)
    print(f"\nPrediction for points line of 24.5: {predictions}")
    
    # Get feature importance
    importance = bettor.get_feature_importance()
    print(f"\nTop 5 most important features:")
    print(importance.head())
    
    # Evaluate model
    evaluation = bettor.evaluate(test_data, test_data['player_points'])
    print(f"\nModel evaluation: {evaluation}") 