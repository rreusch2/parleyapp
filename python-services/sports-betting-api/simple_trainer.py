#!/usr/bin/env python3
"""
SIMPLE SPORTS BETTING MODEL TRAINER
Train models and see results IMMEDIATELY!
"""

import sys
import pandas as pd
import numpy as np
from datetime import datetime

# Add the sports-betting library to path
sys.path.append('../sports-betting/src')

try:
    from sportsbet.datasets import SoccerDataLoader
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import accuracy_score, classification_report
    from sklearn.preprocessing import LabelEncoder
    import warnings
    warnings.filterwarnings('ignore')
except ImportError as e:
    print(f"Import error: {e}")
    print("Install with: pip install sports-betting scikit-learn pandas numpy")
    sys.exit(1)

def simple_model_training():
    """Simple model training with immediate results"""
    print("🚀 SIMPLE SPORTS BETTING MODEL TRAINER")
    print("=" * 50)
    print("🎯 Goal: Train models to predict match outcomes")
    print()
    
    # Configuration
    leagues = ['England']  # Start simple
    years = [2023, 2024]   # Recent data
    
    print(f"📊 Training on: {', '.join(leagues)} ({', '.join(map(str, years))})")
    print("⏳ Loading data...")
    
    try:
        # Create dataloader
        param_grid = {
            'league': leagues,
            'year': years
        }
        
        dataloader = SoccerDataLoader(param_grid)
        
        # Extract training data
        X_train, Y_train, O_train = dataloader.extract_train_data(odds_type='market_maximum')
        
        if X_train.empty:
            print("❌ No data available. Try different leagues/years.")
            return
            
        print(f"✅ Loaded {len(X_train)} matches")
        
        # Show basic stats
        if 'league' in X_train.columns:
            print(f"🏆 Leagues: {X_train['league'].value_counts().to_dict()}")
        
        print(f"📊 Outcome distribution:")
        for i, outcome in enumerate(['Home Win', 'Draw', 'Away Win']):
            count = (Y_train.iloc[:, i] == 1).sum() if not Y_train.empty else 0
            percentage = (count / len(Y_train)) * 100 if len(Y_train) > 0 else 0
            print(f"   {outcome}: {count} ({percentage:.1f}%)")
        
        # Prepare features for simple ML
        print(f"\n🧠 PREPARING FEATURES...")
        
        # Select numerical features only (keep it simple)
        numeric_features = []
        for col in X_train.columns:
            if X_train[col].dtype in ['int64', 'float64'] and not col.startswith('Unnamed'):
                numeric_features.append(col)
        
        print(f"📈 Using {len(numeric_features)} numerical features")
        
        if len(numeric_features) < 3:
            print("❌ Not enough numerical features for training")
            return
            
        # Get clean data
        X_clean = X_train[numeric_features].fillna(0)
        
        # Create simple target (home win prediction)
        y_home_win = Y_train.iloc[:, 0] if not Y_train.empty else pd.Series([0] * len(X_clean))
        
        print(f"\n🎯 TRAINING MODELS...")
        print("=" * 30)
        
        # Split data
        X_train_split, X_test_split, y_train_split, y_test_split = train_test_split(
            X_clean, y_home_win, test_size=0.2, random_state=42, stratify=y_home_win
        )
        
        print(f"📊 Training set: {len(X_train_split)} matches")
        print(f"📊 Test set: {len(X_test_split)} matches")
        
        # Try different models
        models = {
            'Logistic Regression': LogisticRegression(random_state=42, max_iter=1000),
            'Random Forest': RandomForestClassifier(n_estimators=50, random_state=42, max_depth=10)
        }
        
        results = {}
        
        for name, model in models.items():
            print(f"\n🔄 Training {name}...")
            
            # Train model
            model.fit(X_train_split, y_train_split)
            
            # Make predictions
            y_pred = model.predict(X_test_split)
            
            # Calculate accuracy
            accuracy = accuracy_score(y_test_split, y_pred)
            
            # Cross validation
            cv_scores = cross_val_score(model, X_clean, y_home_win, cv=5)
            cv_mean = cv_scores.mean()
            
            results[name] = {
                'test_accuracy': accuracy,
                'cv_accuracy': cv_mean,
                'cv_std': cv_scores.std()
            }
            
            print(f"   Test Accuracy: {accuracy:.3f} ({accuracy*100:.1f}%)")
            print(f"   CV Accuracy: {cv_mean:.3f} ± {cv_scores.std():.3f}")
            
            # Betting simulation (simple)
            print(f"   💰 BETTING SIMULATION:")
            
            # Predict probabilities
            if hasattr(model, 'predict_proba'):
                probs = model.predict_proba(X_test_split)[:, 1]  # Probability of home win
                
                # Simple betting strategy: bet on home when confidence > 60%
                confident_bets = probs > 0.6
                
                if confident_bets.sum() > 0:
                    bet_outcomes = y_test_split[confident_bets]
                    win_rate = bet_outcomes.mean() * 100
                    
                    # Simulate betting with $50 stakes
                    stake = 50
                    total_bets = confident_bets.sum()
                    wins = bet_outcomes.sum()
                    losses = total_bets - wins
                    
                    # Assume average odds of 2.0 for home wins
                    winnings = wins * stake * 2.0  # Double money on wins
                    losses_amount = losses * stake
                    profit = winnings - (total_bets * stake)
                    roi = (profit / (total_bets * stake)) * 100 if total_bets > 0 else 0
                    
                    print(f"      Confident bets (>60%): {total_bets}")
                    print(f"      Win rate: {win_rate:.1f}%")
                    print(f"      Profit: ${profit:.2f}")
                    print(f"      ROI: {roi:.1f}%")
                    
                    if roi > 10:
                        print(f"      🚀 EXCELLENT! Very profitable strategy!")
                    elif roi > 0:
                        print(f"      ✅ GOOD! Profitable strategy")
                    else:
                        print(f"      ❌ Needs improvement")
                else:
                    print(f"      No confident bets found")
        
        # Summary
        print(f"\n🏆 FINAL RESULTS:")
        print("=" * 30)
        
        best_model = max(results.keys(), key=lambda x: results[x]['cv_accuracy'])
        print(f"🥇 Best Model: {best_model}")
        print(f"   Accuracy: {results[best_model]['cv_accuracy']:.3f}")
        
        if results[best_model]['cv_accuracy'] > 0.6:
            print(f"🚀 EXCELLENT! Model beats random guessing significantly!")
        elif results[best_model]['cv_accuracy'] > 0.55:
            print(f"✅ GOOD! Model shows predictive power")
        elif results[best_model]['cv_accuracy'] > 0.5:
            print(f"⚠️ MARGINAL. Slight edge over random")
        else:
            print(f"❌ POOR. No better than random guessing")
        
        print(f"\n💡 NEXT STEPS:")
        print(f"   1. Try different leagues/years")
        print(f"   2. Add more sophisticated features")
        print(f"   3. Experiment with betting thresholds")
        print(f"   4. Compare with your DeepSeek predictions!")
        
        return results
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def quick_comparison():
    """Quick comparison of different approaches"""
    print(f"\n🥊 QUICK MODEL COMPARISON")
    print("=" * 30)
    
    approaches = [
        "Logistic Regression (Simple)",
        "Random Forest (Complex)",
        "Your DeepSeek AI (Hybrid)"
    ]
    
    print("Compare these approaches:")
    for i, approach in enumerate(approaches, 1):
        print(f"   {i}. {approach}")
    
    print(f"\n💡 Run this script multiple times with different settings!")

if __name__ == "__main__":
    print("🎮 SIMPLE SPORTS BETTING TRAINER")
    print("Get immediate model training results!")
    print()
    
    results = simple_model_training()
    
    if results:
        print(f"\n✅ Training complete!")
        quick_comparison()
    else:
        print(f"\n❌ Training failed - check the errors above") 