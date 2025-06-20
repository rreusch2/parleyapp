#!/usr/bin/env python3
"""
TRAIN BETTER MODELS FOR DEEPSEEK TO USE
Improve the underlying ML models so DeepSeek gets better predictions
"""

import sys
import pandas as pd
import numpy as np
import pickle
import os
from datetime import datetime

# Add the sports-betting library to path
sys.path.append('../sports-betting/src')

try:
    from sportsbet.datasets import SoccerDataLoader
    from sportsbet.evaluation import ClassifierBettor
    from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
    from sklearn.compose import make_column_transformer
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
    from sklearn.multioutput import MultiOutputClassifier
    from sklearn.metrics import accuracy_score, log_loss
    import warnings
    warnings.filterwarnings('ignore')
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

def train_advanced_models():
    """Train advanced models with more data and better algorithms"""
    print("🚀 TRAINING ADVANCED MODELS FOR DEEPSEEK")
    print("=" * 50)
    print("🎯 Goal: Create better models for your DeepSeek API to use")
    print()
    
    # EXPANDED CONFIGURATION
    leagues = ['England', 'Spain', 'Italy', 'Germany', 'France']  # Major leagues
    years = [2020, 2021, 2022, 2023, 2024]  # 5 years of data
    
    print(f"📊 Training on: {', '.join(leagues)}")
    print(f"📅 Years: {', '.join(map(str, years))} (5 years of data)")
    print("⏳ Loading expanded dataset... (this will take longer)")
    
    try:
        # Create dataloader with expanded parameters
        param_grid = {
            'league': leagues,
            'year': years,
            'division': [1]  # Top divisions only for quality
        }
        
        dataloader = SoccerDataLoader(param_grid)
        
        # Extract training data
        print("📥 Extracting training data...")
        X_train, Y_train, O_train = dataloader.extract_train_data(odds_type='market_maximum')
        
        if X_train.empty:
            print("❌ No data available. Check internet connection.")
            return None
            
        print(f"✅ Loaded {len(X_train)} matches (vs previous 2,588)")
        
        # Show improvement
        if 'league' in X_train.columns:
            league_counts = X_train['league'].value_counts()
            print(f"🏆 League breakdown:")
            for league, count in league_counts.items():
                print(f"   {league}: {count} matches")
        
        # Prepare advanced features
        print(f"\n🧠 PREPARING ADVANCED FEATURES...")
        
        # Get all numerical features
        numeric_features = [col for col in X_train.columns 
                          if X_train[col].dtype in ['int64', 'float64'] 
                          and not col.startswith('Unnamed')]
        
        # Get categorical features
        categorical_features = []
        for col in ['league', 'home_team', 'away_team']:
            if col in X_train.columns:
                categorical_features.append(col)
        
        print(f"📈 Numerical features: {len(numeric_features)}")
        print(f"🏷️ Categorical features: {len(categorical_features)}")
        
        # Create advanced preprocessing pipeline
        preprocessor = make_column_transformer(
            (OneHotEncoder(handle_unknown='ignore', max_categories=50), categorical_features),
            (StandardScaler(), numeric_features),
            remainder='drop'
        )
        
        # Prepare targets
        betting_markets = ['home_win__full_time_goals', 'draw__full_time_goals', 'away_win__full_time_goals']
        
        print(f"\n🎯 TRAINING ADVANCED MODELS...")
        print("=" * 35)
        
        # Time series split for realistic validation
        tscv = TimeSeriesSplit(n_splits=5)
        
        # Advanced model configurations
        models = {
            'Logistic Regression (Tuned)': LogisticRegression(
                random_state=42, 
                max_iter=2000,
                class_weight='balanced'
            ),
            'Random Forest (Advanced)': RandomForestClassifier(
                n_estimators=100,
                max_depth=15,
                min_samples_split=10,
                random_state=42,
                class_weight='balanced'
            ),
            'Gradient Boosting (Premium)': GradientBoostingClassifier(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=6,
                random_state=42
            )
        }
        
        best_models = {}
        performance_results = {}
        
        for name, base_model in models.items():
            print(f"\n🔄 Training {name}...")
            
            # Create full pipeline
            if name == 'Gradient Boosting (Premium)':
                # Gradient Boosting works better with single output
                pipeline = make_pipeline(preprocessor, base_model)
                
                # Train separate model for home wins (most important)
                y_home_win = Y_train.iloc[:, 0]
                pipeline.fit(X_train, y_home_win)
                
                # Evaluate
                cv_scores = []
                for train_idx, test_idx in tscv.split(X_train):
                    X_train_fold, X_test_fold = X_train.iloc[train_idx], X_train.iloc[test_idx]
                    y_train_fold, y_test_fold = y_home_win.iloc[train_idx], y_home_win.iloc[test_idx]
                    
                    pipeline.fit(X_train_fold, y_train_fold)
                    y_pred = pipeline.predict(X_test_fold)
                    cv_scores.append(accuracy_score(y_test_fold, y_pred))
                
                cv_mean = np.mean(cv_scores)
                
            else:
                # Multi-output for other models
                pipeline = make_pipeline(
                    preprocessor,
                    MultiOutputClassifier(base_model)
                )
                
                # Cross-validation
                cv_scores = []
                for train_idx, test_idx in tscv.split(X_train):
                    X_train_fold, X_test_fold = X_train.iloc[train_idx], X_train.iloc[test_idx]
                    Y_train_fold, Y_test_fold = Y_train.iloc[train_idx], Y_train.iloc[test_idx]
                    
                    pipeline.fit(X_train_fold, Y_train_fold)
                    Y_pred = pipeline.predict(X_test_fold)
                    
                    # Calculate accuracy for home wins (first output)
                    home_win_acc = accuracy_score(Y_test_fold.iloc[:, 0], Y_pred[:, 0])
                    cv_scores.append(home_win_acc)
                
                cv_mean = np.mean(cv_scores)
            
            print(f"   Cross-validation accuracy: {cv_mean:.3f} ({cv_mean*100:.1f}%)")
            
            # Train final model on all data
            if name == 'Gradient Boosting (Premium)':
                pipeline.fit(X_train, Y_train.iloc[:, 0])
            else:
                pipeline.fit(X_train, Y_train)
            
            # Store results
            best_models[name] = pipeline
            performance_results[name] = cv_mean
            
            # Performance assessment
            if cv_mean > 0.65:
                print(f"   🚀 EXCELLENT! Significant improvement!")
            elif cv_mean > 0.6:
                print(f"   ✅ GOOD! Better than baseline")
            else:
                print(f"   ⚠️ MARGINAL. Similar to baseline")
        
        # Find best model
        best_model_name = max(performance_results.keys(), 
                            key=lambda x: performance_results[x])
        best_accuracy = performance_results[best_model_name]
        
        print(f"\n🏆 BEST MODEL: {best_model_name}")
        print(f"   Accuracy: {best_accuracy:.3f} ({best_accuracy*100:.1f}%)")
        
        # Save the best model
        model_save_path = 'models/'
        os.makedirs(model_save_path, exist_ok=True)
        
        model_filename = f'{model_save_path}best_model_{datetime.now().strftime("%Y%m%d_%H%M")}.pkl'
        
        with open(model_filename, 'wb') as f:
            pickle.dump({
                'model': best_models[best_model_name],
                'model_name': best_model_name,
                'accuracy': best_accuracy,
                'training_data_size': len(X_train),
                'leagues': leagues,
                'years': years,
                'trained_at': datetime.now().isoformat()
            }, f)
        
        print(f"\n💾 MODEL SAVED: {model_filename}")
        print(f"   Your DeepSeek API can now use this improved model!")
        
        # Show API integration instructions
        print(f"\n🔌 TO USE IN YOUR API:")
        print(f"   1. Update app.py to load this model")
        print(f"   2. Replace the basic LogisticRegression")
        print(f"   3. DeepSeek will get better predictions!")
        
        return best_models[best_model_name], best_accuracy
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def create_model_loading_code():
    """Generate code to load the model in the API"""
    print(f"\n📝 API INTEGRATION CODE:")
    print("=" * 25)
    
    code = '''
# Add this to your app.py to use the advanced model:

import pickle
from datetime import datetime

# Load the advanced model
def load_advanced_model():
    model_path = 'models/best_model_[TIMESTAMP].pkl'  # Update with actual filename
    with open(model_path, 'rb') as f:
        model_data = pickle.load(f)
    return model_data['model'], model_data['accuracy']

# Replace the basic model creation with:
advanced_model, model_accuracy = load_advanced_model()

# Now your DeepSeek API will use the advanced model!
'''
    
    print(code)

if __name__ == "__main__":
    print("🚀 ADVANCED MODEL TRAINER")
    print("Train better models for your DeepSeek API!")
    print()
    
    model, accuracy = train_advanced_models()
    
    if model and accuracy:
        print(f"\n✅ SUCCESS! Advanced model trained.")
        print(f"📈 Improvement: {accuracy:.1%} accuracy (vs previous ~61%)")
        create_model_loading_code()
        
        print(f"\n🎯 NEXT STEPS:")
        print(f"   1. Update your API to use this model")
        print(f"   2. Restart your Python API") 
        print(f"   3. DeepSeek will now use better predictions!")
        print(f"   4. Test and compare results!")
    else:
        print(f"\n❌ Training failed - check errors above") 