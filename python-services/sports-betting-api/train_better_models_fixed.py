#!/usr/bin/env python3
"""
TRAIN BETTER MODELS FOR DEEPSEEK TO USE (FIXED VERSION)
Handles missing values and trains robust models
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
    """Train advanced models with proper missing value handling"""
    print("🚀 TRAINING ADVANCED MODELS FOR DEEPSEEK (FIXED VERSION)")
    print("=" * 60)
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
            return None, None
            
        print(f"✅ Loaded {len(X_train)} matches (vs previous 2,588)")
        
        # Show improvement
        if 'league' in X_train.columns:
            league_counts = X_train['league'].value_counts()
            print(f"🏆 League breakdown:")
            for league, count in league_counts.items():
                print(f"   {league}: {count} matches")
        
        # CLEAN DATA - HANDLE MISSING VALUES
        print(f"\n🧹 CLEANING DATA...")
        
        # Check missing values
        missing_counts = X_train.isnull().sum()
        missing_features = missing_counts[missing_counts > 0]
        
        if len(missing_features) > 0:
            print(f"🔍 Found missing values in {len(missing_features)} features")
            print(f"   Worst: {missing_features.head().to_dict()}")
        else:
            print(f"✅ No missing values found")
        
        # Separate features by type
        numeric_features = []
        categorical_features = []
        
        for col in X_train.columns:
            if col.startswith('Unnamed'):
                continue
            elif X_train[col].dtype in ['int64', 'float64']:
                numeric_features.append(col)
            elif col in ['league', 'home_team', 'away_team']:
                categorical_features.append(col)
        
        print(f"📈 Numerical features: {len(numeric_features)}")
        print(f"🏷️ Categorical features: {len(categorical_features)}")
        
        # Create robust preprocessing pipeline with imputation
        preprocessor = make_column_transformer(
            # Categorical features with missing value handling
            (make_pipeline(
                SimpleImputer(strategy='constant', fill_value='Unknown'),
                OneHotEncoder(handle_unknown='ignore', max_categories=50)
            ), categorical_features),
            
            # Numerical features with missing value handling  
            (make_pipeline(
                SimpleImputer(strategy='median'),  # Use median for robustness
                StandardScaler()
            ), numeric_features),
            
            remainder='drop'
        )
        
        print(f"\n🎯 TRAINING ROBUST MODELS...")
        print("=" * 35)
        
        # Time series split for realistic validation
        tscv = TimeSeriesSplit(n_splits=3)  # Reduced for faster training
        
        # Advanced model configurations - ROBUST TO MISSING VALUES
        models = {
            'Random Forest (Advanced)': RandomForestClassifier(
                n_estimators=50,  # Reduced for speed
                max_depth=10,
                min_samples_split=20,
                random_state=42,
                class_weight='balanced'
            ),
            'Gradient Boosting (Premium)': GradientBoostingClassifier(
                n_estimators=50,  # Reduced for speed
                learning_rate=0.1,
                max_depth=6,
                random_state=42
            ),
            'Logistic Regression (Robust)': LogisticRegression(
                random_state=42, 
                max_iter=1000,
                class_weight='balanced',
                solver='liblinear'  # More robust solver
            )
        }
        
        best_models = {}
        performance_results = {}
        
        for name, base_model in models.items():
            print(f"\n🔄 Training {name}...")
            
            try:
                # Create full pipeline with imputation
                pipeline = make_pipeline(
                    preprocessor,
                    MultiOutputClassifier(base_model)
                )
                
                # Cross-validation with smaller splits for speed
                cv_scores = []
                fold_count = 0
                
                for train_idx, test_idx in tscv.split(X_train):
                    fold_count += 1
                    print(f"   Fold {fold_count}/{tscv.n_splits}...")
                    
                    X_train_fold, X_test_fold = X_train.iloc[train_idx], X_train.iloc[test_idx]
                    Y_train_fold, Y_test_fold = Y_train.iloc[train_idx], Y_train.iloc[test_idx]
                    
                    # Fit and predict
                    pipeline.fit(X_train_fold, Y_train_fold)
                    Y_pred = pipeline.predict(X_test_fold)
                    
                    # Calculate accuracy for home wins (first output)
                    home_win_acc = accuracy_score(Y_test_fold.iloc[:, 0], Y_pred[:, 0])
                    cv_scores.append(home_win_acc)
                
                cv_mean = np.mean(cv_scores)
                cv_std = np.std(cv_scores)
                
                print(f"   Accuracy: {cv_mean:.3f} ± {cv_std:.3f} ({cv_mean*100:.1f}%)")
                
                # Train final model on all data
                print(f"   Training final model on all data...")
                pipeline.fit(X_train, Y_train)
                
                # Store results
                best_models[name] = pipeline
                performance_results[name] = cv_mean
                
                # Performance assessment
                if cv_mean > 0.65:
                    print(f"   🚀 EXCELLENT! Significant improvement!")
                elif cv_mean > 0.60:
                    print(f"   ✅ GOOD! Better than baseline (61.3%)")
                elif cv_mean > 0.55:
                    print(f"   📈 DECENT! Above random (50%)")
                else:
                    print(f"   ⚠️ WEAK. Needs improvement")
                    
            except Exception as e:
                print(f"   ❌ Failed: {e}")
                continue
        
        if not best_models:
            print(f"\n❌ All models failed to train")
            return None, None
        
        # Find best model
        best_model_name = max(performance_results.keys(), 
                            key=lambda x: performance_results[x])
        best_accuracy = performance_results[best_model_name]
        
        print(f"\n🏆 BEST MODEL: {best_model_name}")
        print(f"   Accuracy: {best_accuracy:.3f} ({best_accuracy*100:.1f}%)")
        print(f"   Training data: {len(X_train):,} matches")
        
        # Save the best model
        model_save_path = 'models/'
        os.makedirs(model_save_path, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        model_filename = f'{model_save_path}advanced_model_{timestamp}.pkl'
        
        model_data = {
            'model': best_models[best_model_name],
            'model_name': best_model_name,
            'accuracy': best_accuracy,
            'training_data_size': len(X_train),
            'leagues': leagues,
            'years': years,
            'trained_at': datetime.now().isoformat(),
            'performance_all_models': performance_results
        }
        
        with open(model_filename, 'wb') as f:
            pickle.dump(model_data, f)
        
        print(f"\n💾 MODEL SAVED: {model_filename}")
        print(f"   Size: {os.path.getsize(model_filename) / 1024 / 1024:.1f} MB")
        
        # Show improvement
        baseline_acc = 0.613  # Your previous best
        improvement = best_accuracy - baseline_acc
        
        if improvement > 0:
            print(f"📈 IMPROVEMENT: +{improvement:.3f} ({improvement*100:.1f} percentage points!)")
        else:
            print(f"📊 PERFORMANCE: {improvement:.3f} vs baseline (still learning)")
        
        # Integration instructions
        print(f"\n🔌 NEXT STEPS TO INTEGRATE:")
        print(f"   1. Update app.py to load: {model_filename}")
        print(f"   2. Replace existing model with this one")
        print(f"   3. Restart Python API")
        print(f"   4. DeepSeek will get improved predictions!")
        
        return best_models[best_model_name], best_accuracy, model_filename
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        return None, None, None

def create_integration_code(model_filename):
    """Generate code to integrate the model into the API"""
    print(f"\n📝 INTEGRATION CODE FOR app.py:")
    print("=" * 40)
    
    code = f'''
# REPLACE YOUR MODEL LOADING SECTION WITH THIS:

import pickle
import os
from datetime import datetime

def load_advanced_model():
    """Load the advanced trained model"""
    model_path = '{model_filename}'
    
    if not os.path.exists(model_path):
        print(f"⚠️ Advanced model not found: {{model_path}}")
        return None, None
    
    try:
        with open(model_path, 'rb') as f:
            model_data = pickle.load(f)
        
        print(f"✅ Loaded advanced model: {{model_data['model_name']}}")
        print(f"   Accuracy: {{model_data['accuracy']:.3f}} ({{model_data['accuracy']*100:.1f}}%)")
        print(f"   Trained on: {{model_data['training_data_size']:,}} matches")
        
        return model_data['model'], model_data['accuracy']
    except Exception as e:
        print(f"❌ Error loading advanced model: {{e}}")
        return None, None

# Use it in your prediction endpoints:
advanced_model, model_accuracy = load_advanced_model()

if advanced_model:
    print(f"🚀 Using ADVANCED model ({{model_accuracy:.1%}} accuracy)")
    # Use advanced_model for predictions
else:
    print(f"⚠️ Falling back to basic model")
    # Use your existing basic model
'''
    
    print(code)

if __name__ == "__main__":
    print("🚀 ADVANCED MODEL TRAINER (FIXED)")
    print("Train better models for your DeepSeek API!")
    print()
    
    result = train_advanced_models()
    
    if result[0] and result[1]:  # model and accuracy exist
        model, accuracy, filename = result
        print(f"\n✅ SUCCESS! Advanced model trained.")
        print(f"📈 Performance: {accuracy:.1%}")
        
        if len(result) > 2 and result[2]:  # filename exists
            create_integration_code(result[2])
        
        print(f"\n🎯 BENEFITS FOR DEEPSEEK:")
        print(f"   ✓ More training data ({len(result) if hasattr(result, '__len__') else 'expanded'} leagues)")
        print(f"   ✓ Better algorithms (Random Forest + Gradient Boosting)")
        print(f"   ✓ Robust missing value handling")
        print(f"   ✓ Ready for API integration")
        print(f"   ✓ DeepSeek gets better predictions!")
    else:
        print(f"\n❌ Training failed - check errors above") 