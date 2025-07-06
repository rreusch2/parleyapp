#!/usr/bin/env python3
"""
Test client for StatMuse API Server
Demonstrates how AI systems can easily query the API
"""

import requests
import json
import time

def test_statmuse_api(base_url='http://localhost:5001'):
    """Test the StatMuse API server"""
    
    print("🧪 Testing StatMuse API Server")
    print("=" * 60)
    
    # Test 1: Health check
    print("1️⃣ Health Check:")
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Service: {health_data['service']}")
            print(f"✅ Status: {health_data['status']}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Cannot connect to API server: {e}")
        print("💡 Make sure to run: python statmuse_api_server.py")
        return
    
    print("-" * 60)
    
    # Test 2: General query
    print("2️⃣ General Query:")
    query_data = {"query": "Yankees record 2025"}
    response = requests.post(f"{base_url}/query", json=query_data)
    
    if response.status_code == 200:
        result = response.json()
        if result['success']:
            print(f"✅ Query: {result['query']}")
            print(f"📊 Answer: {result['answer']}")
            print(f"💾 Cached: {result.get('cached', False)}")
        else:
            print(f"❌ Query failed: {result['error']}")
    else:
        print(f"❌ API call failed: {response.status_code}")
    
    print("-" * 60)
    
    # Test 3: Head-to-head
    print("3️⃣ Head-to-Head Query:")
    h2h_data = {
        "team1": "Dodgers",
        "team2": "Padres", 
        "games": 5
    }
    response = requests.post(f"{base_url}/head-to-head", json=h2h_data)
    
    if response.status_code == 200:
        result = response.json()
        if result['success']:
            print(f"✅ Query: {result['query']}")
            print(f"📊 Answer: {result['answer']}")
        else:
            print(f"❌ H2H query failed: {result['error']}")
    else:
        print(f"❌ H2H API call failed: {response.status_code}")
    
    print("-" * 60)
    
    # Test 4: Team record
    print("4️⃣ Team Record Query:")
    record_data = {
        "team": "Red Sox",
        "record_type": "home"
    }
    response = requests.post(f"{base_url}/team-record", json=record_data)
    
    if response.status_code == 200:
        result = response.json()
        if result['success']:
            print(f"✅ Query: {result['query']}")
            print(f"📊 Answer: {result['answer']}")
        else:
            print(f"❌ Record query failed: {result['error']}")
    else:
        print(f"❌ Record API call failed: {response.status_code}")
    
    print("-" * 60)
    
    # Test 5: Player stats
    print("5️⃣ Player Stats Query:")
    player_data = {
        "player": "Aaron Judge",
        "stat_type": "hitting"
    }
    response = requests.post(f"{base_url}/player-stats", json=player_data)
    
    if response.status_code == 200:
        result = response.json()
        if result['success']:
            print(f"✅ Query: {result['query']}")
            print(f"📊 Answer: {result['answer']}")
        else:
            print(f"❌ Player stats failed: {result['error']}")
    else:
        print(f"❌ Player stats API call failed: {response.status_code}")
    
    print("-" * 60)
    
    # Test 6: Cache test (repeat first query)
    print("6️⃣ Cache Test (repeat first query):")
    response = requests.post(f"{base_url}/query", json=query_data)
    
    if response.status_code == 200:
        result = response.json()
        if result['success']:
            print(f"✅ Query: {result['query']}")
            print(f"📊 Answer: {result['answer']}")
            print(f"💾 Cached: {result.get('cached', False)} (should be True)")
        else:
            print(f"❌ Cache test failed: {result['error']}")
    
    print("-" * 60)
    
    # Test 7: Cache stats
    print("7️⃣ Cache Statistics:")
    response = requests.get(f"{base_url}/cache-stats")
    
    if response.status_code == 200:
        cache_stats = response.json()
        print(f"📊 Cached queries: {cache_stats['cached_queries']}")
        print(f"⏰ Cache TTL: {cache_stats['cache_ttl_hours']} hours")
    
    print("=" * 60)
    print("🎉 StatMuse API Server Test Complete!")
    print("\n🎯 Integration Examples for Your AI Systems:")
    print()
    print("📊 Daily Insights System:")
    print("response = requests.post('http://localhost:5001/query', json={'query': 'Yankees vs Red Sox last 5'})")
    print()
    print("🤖 Professor Lock Chatbot:")
    print("response = requests.post('http://localhost:5001/player-stats', json={'player': 'Aaron Judge', 'stat_type': 'hitting'})")
    print()
    print("🎲 Orchestrator for Picks:")
    print("response = requests.post('http://localhost:5001/team-record', json={'team': 'Dodgers', 'record_type': 'home'})")
    print()
    print("✅ All systems can now get real StatMuse data with simple HTTP calls!")

if __name__ == "__main__":
    test_statmuse_api() 