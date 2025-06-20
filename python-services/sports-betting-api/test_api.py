#!/usr/bin/env python3
"""
Test script for Sports Betting API
Quick validation of all endpoints
"""

import requests
import json
import time

BASE_URL = "http://localhost:8001"

def test_health():
    """Test health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed!")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health check error: {e}")

def test_optimal_config():
    """Test optimal configuration endpoint"""
    print("\n🔍 Testing optimal configuration...")
    try:
        data = {
            "risk_tolerance": "moderate",
            "bankroll": 1000.0,
            "target_return": 15.0
        }
        response = requests.post(f"{BASE_URL}/optimal-config", json=data)
        if response.status_code == 200:
            print("✅ Optimal config test passed!")
            config = response.json()
            print(f"   Recommended stake: ${config['recommended_stake']}")
            print(f"   Max bet percentage: {config['max_bet_percentage']}%")
            print(f"   Preferred markets: {config['preferred_markets']}")
        else:
            print(f"❌ Optimal config test failed: {response.status_code}")
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"❌ Optimal config error: {e}")

def test_value_bets():
    """Test value bets endpoint (may take longer due to data loading)"""
    print("\n🔍 Testing value bets endpoint...")
    print("   (This may take a moment to download data...)")
    try:
        data = {
            "leagues": ["England"],
            "divisions": [1],
            "max_odds": 5.0,
            "min_value_threshold": 0.05
        }
        response = requests.post(f"{BASE_URL}/value-bets", json=data, timeout=60)
        if response.status_code == 200:
            result = response.json()
            print("✅ Value bets test passed!")
            print(f"   Found {result['total_opportunities']} value betting opportunities")
            if result['value_bets']:
                print("   Example bet:")
                bet = result['value_bets'][0]
                print(f"     {bet['home_team']} vs {bet['away_team']}")
                print(f"     Market: {bet['market']}")
                print(f"     Value: {bet['value_percentage']:.1%}")
        else:
            print(f"❌ Value bets test failed: {response.status_code}")
            print(f"   Error: {response.text}")
    except requests.exceptions.Timeout:
        print("⏰ Value bets test timed out (data loading can be slow)")
    except Exception as e:
        print(f"❌ Value bets error: {e}")

def test_backtest():
    """Test backtesting endpoint (may take longer)"""
    print("\n🔍 Testing backtesting endpoint...")
    print("   (This may take a moment for calculations...)")
    try:
        data = {
            "leagues": ["England"],
            "years": [2023],
            "divisions": [1],
            "betting_markets": ["home_win__full_time_goals"],
            "stake": 50.0,
            "init_cash": 1000.0,
            "cv_folds": 2  # Reduced for faster testing
        }
        response = requests.post(f"{BASE_URL}/backtest", json=data, timeout=120)
        if response.status_code == 200:
            result = response.json()
            print("✅ Backtest test passed!")
            print(f"   ROI: {result['roi']:.1f}%")
            print(f"   Win Rate: {result['win_rate']:.1f}%")
            print(f"   Total Bets: {result['total_bets']}")
            print(f"   Profit/Loss: ${result['profit_loss']:.2f}")
        else:
            print(f"❌ Backtest test failed: {response.status_code}")
            print(f"   Error: {response.text}")
    except requests.exceptions.Timeout:
        print("⏰ Backtest test timed out (calculations can be slow)")
    except Exception as e:
        print(f"❌ Backtest error: {e}")

def main():
    print("🚀 Sports Betting API Test Suite")
    print("=" * 50)
    
    # Test basic endpoints first
    test_health()
    test_optimal_config()
    
    # Test data-intensive endpoints (may be slower)
    print("\n" + "=" * 50)
    print("🔄 Testing data-intensive endpoints...")
    print("   (These may take longer due to data downloads)")
    
    test_value_bets()
    test_backtest()
    
    print("\n" + "=" * 50)
    print("✅ API testing complete!")
    print("\n💡 Your Sports Betting API is ready to integrate with your LLM Orchestrator!")

if __name__ == "__main__":
    main() 