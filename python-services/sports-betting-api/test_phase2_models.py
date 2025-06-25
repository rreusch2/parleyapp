#!/usr/bin/env python3
"""
Test script for Phase 2 Enhanced Prediction Models
Tests all new API endpoints and enhanced functionality
"""

import requests
import json
import time
from typing import Dict, Any

def test_api_endpoint(url: str, method: str = 'GET', data: Dict = None) -> Dict[str, Any]:
    """Helper function to test API endpoints"""
    try:
        if method.upper() == 'POST':
            response = requests.post(url, json=data, timeout=10)
        else:
            response = requests.get(url, timeout=10)
        
        return {
            'status_code': response.status_code,
            'success': response.status_code == 200,
            'data': response.json() if response.content else {},
            'error': None
        }
    except Exception as e:
        return {
            'status_code': None,
            'success': False,
            'data': {},
            'error': str(e)
        }

def run_phase2_api_tests():
    """Run comprehensive tests for Phase 2 enhanced API endpoints"""
    
    base_url = "http://localhost:5000"  # Adjust if needed
    
    print("🚀 Phase 2 Enhanced API Testing")
    print("=" * 60)
    
    tests = []
    
    # Test 1: Health Check
    print("\n1. Testing Health Check...")
    result = test_api_endpoint(f"{base_url}/health")
    tests.append(("Health Check", result))
    if result['success']:
        print(f"✅ Health check passed: {result['data'].get('version', 'Unknown')}")
    else:
        print(f"❌ Health check failed: {result.get('error', 'Unknown error')}")
    
    # Test 2: Enhanced Models Status
    print("\n2. Testing Enhanced Models Status...")
    result = test_api_endpoint(f"{base_url}/api/v2/models/status")
    tests.append(("Enhanced Models Status", result))
    if result['success']:
        framework_available = result['data'].get('enhanced_framework_available', False)
        print(f"✅ Enhanced models status: {'Available' if framework_available else 'Not Available'}")
    else:
        print(f"❌ Enhanced models status failed: {result.get('error', 'Unknown error')}")
    
    # Test 3: Enhanced Player Props Prediction
    print("\n3. Testing Enhanced Player Props Prediction...")
    player_prop_data = {
        "sport": "NBA",
        "prop_type": "points",
        "player_id": "test_player_123",
        "line": 25.5,
        "game_context": {
            "is_home": True,
            "rest_days": 2,
            "opponent": "Lakers",
            "minutes_expected": 35
        }
    }
    result = test_api_endpoint(f"{base_url}/api/v2/predict/player-prop", "POST", player_prop_data)
    tests.append(("Enhanced Player Props", result))
    if result['success']:
        data = result['data']
        print(f"✅ Player prop prediction:")
        print(f"   Prediction: {data.get('prediction', 'N/A')}")
        print(f"   Confidence: {data.get('confidence', 'N/A')}")
        print(f"   Enhanced: {data.get('enhanced', False)}")
    else:
        print(f"❌ Player prop prediction failed: {result.get('error', 'Unknown error')}")
    
    # Test 4: Enhanced Spread Prediction
    print("\n4. Testing Enhanced Spread Prediction...")
    spread_data = {
        "sport": "NBA",
        "game_id": "test_game_456",
        "spread_line": -5.5
    }
    result = test_api_endpoint(f"{base_url}/api/v2/predict/spread", "POST", spread_data)
    tests.append(("Enhanced Spread", result))
    if result['success']:
        data = result['data']
        print(f"✅ Spread prediction:")
        print(f"   Prediction: {data.get('prediction', 'N/A')}")
        print(f"   Confidence: {data.get('confidence', 'N/A')}")
        print(f"   Enhanced: {data.get('enhanced', False)}")
    else:
        print(f"❌ Spread prediction failed: {result.get('error', 'Unknown error')}")
    
    # Test 5: Enhanced Over/Under Prediction
    print("\n5. Testing Enhanced Over/Under Prediction...")
    total_data = {
        "sport": "NBA",
        "game_id": "test_game_789",
        "total_line": 225.5
    }
    result = test_api_endpoint(f"{base_url}/api/v2/predict/total", "POST", total_data)
    tests.append(("Enhanced Total", result))
    if result['success']:
        data = result['data']
        print(f"✅ Total prediction:")
        print(f"   Prediction: {data.get('prediction', 'N/A')}")
        print(f"   Confidence: {data.get('confidence', 'N/A')}")
        print(f"   Enhanced: {data.get('enhanced', False)}")
    else:
        print(f"❌ Total prediction failed: {result.get('error', 'Unknown error')}")
    
    # Test 6: Enhanced Parlay Analysis
    print("\n6. Testing Enhanced Parlay Analysis...")
    parlay_data = {
        "legs": [
            {
                "type": "player_prop",
                "sport": "NBA",
                "prop_type": "points",
                "player_id": "player_1",
                "line": 25.5,
                "game_context": {"is_home": True}
            },
            {
                "type": "spread",
                "sport": "NBA", 
                "game_id": "game_1",
                "spread_line": -5.5
            },
            {
                "type": "total",
                "sport": "NBA",
                "game_id": "game_2", 
                "total_line": 220.5
            }
        ]
    }
    result = test_api_endpoint(f"{base_url}/api/v2/analyze/parlay-enhanced", "POST", parlay_data)
    tests.append(("Enhanced Parlay", result))
    if result['success']:
        data = result['data']
        analysis = data.get('parlay_analysis', {})
        print(f"✅ Parlay analysis:")
        print(f"   Legs: {analysis.get('total_legs', 'N/A')}")
        print(f"   Combined Confidence: {analysis.get('combined_confidence', 'N/A')}")
        print(f"   Risk Level: {analysis.get('risk_level', 'N/A')}")
        print(f"   Enhanced: {data.get('enhanced', False)}")
    else:
        print(f"❌ Parlay analysis failed: {result.get('error', 'Unknown error')}")
    
    # Test 7: Legacy Player Props (backwards compatibility)
    print("\n7. Testing Legacy Player Props (Backwards Compatibility)...")
    legacy_data = {
        "sport": "NBA",
        "prop_type": "points",
        "player_stats": {"avg_points": 20.5, "games_played": 50},
        "line_value": 25.5
    }
    result = test_api_endpoint(f"{base_url}/api/predict/player-prop", "POST", legacy_data)
    tests.append(("Legacy Player Props", result))
    if result['success']:
        data = result['data']
        print(f"✅ Legacy player prop prediction:")
        print(f"   Enhanced: {data.get('enhanced', 'Not specified')}")
    else:
        print(f"❌ Legacy player prop prediction failed: {result.get('error', 'Unknown error')}")
    
    # Summary
    print("\n" + "=" * 60)
    print("PHASE 2 API TESTING SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, test in tests if test['success'])
    total = len(tests)
    success_rate = (passed / total) * 100
    
    for test_name, result in tests:
        status = "✅ PASS" if result['success'] else "❌ FAIL"
        print(f"{status} {test_name}")
        if not result['success'] and result.get('error'):
            print(f"     Error: {result['error']}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({success_rate:.1f}%)")
    
    if success_rate == 100:
        print("\n🎉 All Phase 2 Enhanced APIs are working correctly!")
    elif success_rate >= 80:
        print("\n✅ Most Phase 2 Enhanced APIs are working!")
    else:
        print("\n⚠️ Several API issues detected. Check server status.")
    
    return tests

def test_model_training():
    """Test model retraining functionality"""
    print("\n🔄 Testing Model Retraining...")
    
    base_url = "http://localhost:5000"
    retrain_data = {
        "sports": ["NBA"]  # Test with just NBA for speed
    }
    
    result = test_api_endpoint(f"{base_url}/api/v2/models/retrain", "POST", retrain_data)
    
    if result['success']:
        data = result['data']
        print(f"✅ Model retraining successful:")
        training_results = data.get('training_results', {})
        print(f"   Success Rate: {training_results.get('success_rate', 'N/A')}")
        print(f"   Total Models: {training_results.get('total_models', 'N/A')}")
    else:
        print(f"❌ Model retraining failed: {result.get('error', 'Unknown error')}")
    
    return result

if __name__ == "__main__":
    print("Phase 2 Enhanced Prediction Models - API Testing")
    print("This script tests all new Phase 2 API endpoints")
    print("\nNote: Make sure the Flask server is running on localhost:5000")
    print("To start server: python parley_predictor.py")
    
    input("\nPress Enter to start testing (or Ctrl+C to cancel)...")
    
    # Run API tests
    test_results = run_phase2_api_tests()
    
    # Optionally test retraining (comment out if you want to skip)
    # print("\n" + "="*60)
    # retrain_result = test_model_training()
    
    print("\n✅ Phase 2 API testing complete!")
    print("📋 If any tests failed, check:")
    print("  1. Flask server is running")
    print("  2. Enhanced models are properly loaded")  
    print("  3. Database connections (for full functionality)")
    print("  4. Required Python packages are installed") 