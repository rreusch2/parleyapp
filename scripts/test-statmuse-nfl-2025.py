#!/usr/bin/env python3
"""
Test StatMuse API server for NFL 2025 Week 1 data availability
"""

import os
import sys
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

def test_statmuse_api():
    """Test StatMuse API server for NFL 2025 data"""
    
    statmuse_url = os.getenv("STATMUSE_API_URL", "https://web-production-f090e.up.railway.app")
    
    print("🏈 Testing StatMuse API for NFL 2025 Week 1 Data")
    print("=" * 60)
    print(f"StatMuse API URL: {statmuse_url}")
    
    # Test 1: Health check
    print("\n🔍 Testing API health...")
    try:
        response = requests.get(f"{statmuse_url}/health", timeout=10)
        if response.status_code == 200:
            print("✅ StatMuse API is healthy")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health check error: {e}")
    
    # Test 2: Test sample NFL player queries for Week 1 2025
    test_queries = [
        "Josh Allen passing yards Week 1 2025",
        "Saquon Barkley rushing yards Week 1 2025", 
        "Tyreek Hill receiving yards Week 1 2025",
        "Travis Kelce receptions Week 1 2025",
        "Justin Jefferson targets Week 1 2025",
        "NFL Week 1 2025 stats",
        "Josh Allen stats September 2025"
    ]
    
    print("\n🔍 Testing NFL player queries...")
    
    for query in test_queries:
        print(f"\nTesting: '{query}'")
        try:
            payload = {"query": query}
            response = requests.post(f"{statmuse_url}/query", json=payload, timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                
                # Check if we got meaningful data
                response_text = result.get('response', '')
                has_stats = any(keyword in response_text.lower() for keyword in 
                               ['yards', 'touchdowns', 'receptions', 'carries', 'attempts'])
                
                if has_stats:
                    print(f"✅ Got stats data: {response_text[:100]}...")
                else:
                    print(f"⚠️ No stats found: {response_text[:100]}...")
                    
            else:
                print(f"❌ Error {response.status_code}: {response.text[:100]}")
                
        except Exception as e:
            print(f"❌ Query error: {e}")
    
    # Test 3: Test position-specific queries
    print("\n🔍 Testing position-specific queries...")
    
    position_queries = [
        ("QB", "Patrick Mahomes passing stats Week 1 2025"),
        ("RB", "Christian McCaffrey rushing stats Week 1 2025"),
        ("WR", "Cooper Kupp receiving stats Week 1 2025"),
        ("TE", "Travis Kelce receiving stats Week 1 2025"),
        ("K", "Justin Tucker field goals Week 1 2025"),
        ("DEF", "49ers defense sacks Week 1 2025")
    ]
    
    for position, query in position_queries:
        print(f"\n{position} Query: '{query}'")
        try:
            payload = {"query": query}
            response = requests.post(f"{statmuse_url}/query", json=payload, timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                response_text = result.get('response', '')
                
                # Check for position-specific stats
                position_keywords = {
                    'QB': ['passing', 'completions', 'attempts', 'interceptions'],
                    'RB': ['rushing', 'carries', 'yards'],
                    'WR': ['receiving', 'receptions', 'targets'],
                    'TE': ['receiving', 'receptions', 'targets'],
                    'K': ['field goals', 'extra points'],
                    'DEF': ['sacks', 'interceptions', 'tackles']
                }
                
                has_relevant_stats = any(keyword in response_text.lower() 
                                       for keyword in position_keywords.get(position, []))
                
                if has_relevant_stats:
                    print(f"✅ {position} stats found: {response_text[:80]}...")
                else:
                    print(f"⚠️ No {position} stats: {response_text[:80]}...")
            else:
                print(f"❌ Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {e}")
    
    # Test 4: Test current date queries
    print("\n🔍 Testing current date awareness...")
    current_queries = [
        "NFL games this week",
        "NFL Week 1 2025 results",
        "latest NFL stats",
        "NFL games September 8 2025"
    ]
    
    for query in current_queries:
        print(f"\nTesting: '{query}'")
        try:
            payload = {"query": query}
            response = requests.post(f"{statmuse_url}/query", json=payload, timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                response_text = result.get('response', '')
                
                # Check if response mentions 2025 or current data
                is_current = any(keyword in response_text.lower() for keyword in 
                               ['2025', 'week 1', 'september', 'latest', 'recent'])
                
                if is_current:
                    print(f"✅ Current data: {response_text[:80]}...")
                else:
                    print(f"⚠️ Possibly old data: {response_text[:80]}...")
            else:
                print(f"❌ Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_statmuse_api()
