#!/usr/bin/env python3
"""
Interactive Sports Betting Model Training & Testing
Train models on historical data and see immediate results!
"""

import sys
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Add the sports-betting library to path
sys.path.append('../sports-betting/src')

try:
    from sportsbet.datasets import SoccerDataLoader
    from sportsbet.evaluation import ClassifierBettor
    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.compose import make_column_transformer
    from sklearn.linear_model import LogisticRegression
    from sklearn.impute import SimpleImputer
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import OneHotEncoder
    from sklearn.multioutput import MultiOutputClassifier
except ImportError as e:
    print(f"Import error: {e}")
    print("Please install: pip install sports-betting scikit-learn pandas numpy")
    sys.exit(1)

def train_model_interactive():
    """Train a betting model and see immediate results"""
    print("🚀 SPORTS BETTING MODEL TRAINER")
    print("=" * 50)
    
    # Configure what to train on
    leagues = ['England', 'Spain', 'Italy']
    years = [2022, 2023, 2024]  # Recent years with good data
    
    print(f"📊 Training on: {', '.join(leagues)} ({', '.join(map(str, years))})")
    print("⏳ Downloading data... (this may take a moment)")
    
    try:
        # Create dataloader
        param_grid = {
            'league': leagues,
            'year': years,
            'division': [1]  # Top divisions only
        }
        
        dataloader = SoccerDataLoader(param_grid)
        
        # Extract training data
        print("📥 Extracting training data...")
        X_train, Y_train, O_train = dataloader.extract_train_data(odds_type='market_maximum')
        
        if X_train.empty:
            print("❌ No training data available. Try different leagues/years.")
            return
            
        print(f"✅ Loaded {len(X_train)} historical matches")
        
        # Check what columns we have for debugging
        print(f"📊 Available columns: {X_train.columns.tolist()}")
        
        # Try to find date column with different possible names
        date_col = None
        for col in ['date', 'Date', 'match_date', 'Date_match', 'fixture_date']:
            if col in X_train.columns:
                date_col = col
                break
                
        if date_col:
            print(f"📈 Date range: {X_train[date_col].min()} to {X_train[date_col].max()}")
        else:
            print(f"📈 Date column not found - proceeding without date info")
        
        # Show data stats
        print(f"\n🏆 LEAGUES BREAKDOWN:")
        league_counts = X_train['league'].value_counts()
        for league, count in league_counts.items():
            print(f"   {league}: {count} matches")
            
        print(f"\n💰 BETTING MARKETS:")
        betting_markets = ['home_win__full_time_goals', 'draw__full_time_goals', 'away_win__full_time_goals']
        print(f"   Training on: {', '.join(['Home Win', 'Draw', 'Away Win'])}")
        
        # Create betting strategy
        print(f"\n🧠 TRAINING MODEL...")
        tscv = TimeSeriesSplit(n_splits=3)
        
        # Create classifier pipeline
        classifier = make_pipeline(
            make_column_transformer(
                (OneHotEncoder(handle_unknown='ignore'), ['league', 'home_team', 'away_team']),
                remainder='passthrough'
            ),
            SimpleImputer(),
            MultiOutputClassifier(
                LogisticRegression(
                    solver='liblinear',
                    random_state=7,
                    class_weight='balanced',
                    C=50,
                    max_iter=1000
                )
            )
        )
        
        # Create bettor
        bettor = ClassifierBettor(
            classifier,
            betting_markets=betting_markets,
            stake=50.0,
            init_cash=10000.0
        )
        
        print("🔄 Running cross-validation...")
        
        # Manual cross-validation to see results
        splits = list(tscv.split(X_train))
        total_profits = []
        split_results = []
        
        for i, (train_idx, test_idx) in enumerate(splits):
            print(f"   Split {i+1}/{len(splits)}...")
            
            X_train_fold = X_train.iloc[train_idx]
            Y_train_fold = Y_train.iloc[train_idx]
            O_train_fold = O_train.iloc[train_idx]
            
            X_test_fold = X_train.iloc[test_idx]
            Y_test_fold = Y_train.iloc[test_idx]
            O_test_fold = O_train.iloc[test_idx]
            
            # Train the model
            bettor.fit(X_train_fold, Y_train_fold)
            
            # Test on validation fold
            bets_df = bettor.bet(X_test_fold, O_test_fold)
            
            if not bets_df.empty:
                profit = bets_df['profit'].sum()
                num_bets = len(bets_df)
                win_rate = (bets_df['profit'] > 0).mean() * 100
                
                total_profits.append(profit)
                split_results.append({
                    'split': i+1,
                    'profit': profit,
                    'num_bets': num_bets,
                    'win_rate': win_rate,
                    'roi': (profit / (num_bets * 50.0)) * 100 if num_bets > 0 else 0
                })
                
                print(f"      Profit: €{profit:.2f} | Bets: {num_bets} | Win Rate: {win_rate:.1f}%")
            else:
                print(f"      No bets placed in this split")
                split_results.append({
                    'split': i+1,
                    'profit': 0,
                    'num_bets': 0,
                    'win_rate': 0,
                    'roi': 0
                })
        
        # Show final results
        print(f"\n🎯 FINAL RESULTS:")
        print("=" * 30)
        
        avg_profit = np.mean(total_profits) if total_profits else 0
        total_bets = sum(r['num_bets'] for r in split_results)
        avg_win_rate = np.mean([r['win_rate'] for r in split_results])
        avg_roi = np.mean([r['roi'] for r in split_results])
        
        print(f"💰 Average Profit per Split: €{avg_profit:.2f}")
        print(f"🎲 Total Bets Across Splits: {total_bets}")
        print(f"🎯 Average Win Rate: {avg_win_rate:.1f}%")
        print(f"📈 Average ROI: {avg_roi:.1f}%")
        
        # Performance assessment
        if avg_roi > 5:
            print(f"🚀 EXCELLENT! This strategy is highly profitable!")
        elif avg_roi > 0:
            print(f"✅ GOOD! This strategy is profitable.")
        elif avg_roi > -5:
            print(f"⚠️  MARGINAL. Close to break-even.")
        else:
            print(f"❌ POOR. This strategy loses money.")
            
        print(f"\n🔬 Want to try different parameters?")
        print(f"   - Edit the leagues/years in this script")
        print(f"   - Adjust the stake amount")
        print(f"   - Try different betting markets")
        
        # Train final model on all data
        print(f"\n🎯 Training final model on all data...")
        bettor.fit(X_train, Y_train)
        
        # Try to get fixtures data
        try:
            X_fix, _, O_fix = dataloader.extract_fixtures_data()
            if not X_fix.empty:
                print(f"\n🔮 UPCOMING VALUE BETS:")
                value_bets = bettor.bet(X_fix, O_fix)
                if not value_bets.empty:
                    print(f"Found {len(value_bets)} value betting opportunities!")
                    for idx, bet in value_bets.head(5).iterrows():
                        print(f"   {bet.get('home_team', 'Team1')} vs {bet.get('away_team', 'Team2')}")
                else:
                    print("   No value bets found in upcoming fixtures")
            else:
                print("   No upcoming fixtures available")
        except Exception as e:
            print(f"   Could not fetch fixtures: {e}")
            
        return bettor, split_results
        
    except Exception as e:
        print(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def compare_strategies():
    """Compare different betting strategies"""
    print("\n🥊 STRATEGY COMPARISON")
    print("=" * 30)
    
    strategies = [
        {"name": "Conservative", "stake": 25, "C": 10},
        {"name": "Aggressive", "stake": 100, "C": 100},
        {"name": "Balanced", "stake": 50, "C": 50}
    ]
    
    # This would run multiple training sessions with different parameters
    print("TODO: Implement strategy comparison")
    print("You can manually edit the parameters above and re-run!")

if __name__ == "__main__":
    print("🎮 INTERACTIVE SPORTS BETTING TRAINER")
    print("Train models, see results, no waiting!")
    print()
    
    bettor, results = train_model_interactive()
    
    if bettor and results:
        print(f"\n✅ Training complete! Your model is ready.")
        print(f"💡 Next steps:")
        print(f"   1. Try different leagues/years")
        print(f"   2. Experiment with stake amounts") 
        print(f"   3. Test different betting markets")
        print(f"   4. Compare with your DeepSeek predictions!") 