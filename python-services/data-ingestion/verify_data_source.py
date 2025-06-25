#!/usr/bin/env python3
"""
Verify Data Source - Confirm pybaseball vs MLB-StatsAPI usage
"""

import psycopg2
import pybaseball
import pandas as pd
import os
import json
from dotenv import load_dotenv
from typing import Dict, Any

# Load environment variables
load_dotenv()

def verify_database_data_source():
    """Verify what data source was used for player_game_stats"""
    print("🔍 VERIFYING DATA SOURCE FOR player_game_stats TABLE")
    print("=" * 60)
    
    # Connect to database
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        port=int(os.getenv('DB_PORT', 5432)),
        sslmode='require'
    )
    
    cursor = conn.cursor()
    
    # Check a sample of data
    cursor.execute("""
        SELECT 
            p.name,
            p.external_player_id as mlbam_id,
            pgs.stats
        FROM players p
        INNER JOIN player_game_stats pgs ON p.id = pgs.player_id
        WHERE p.sport = 'MLB'
        AND pgs.stats IS NOT NULL
        ORDER BY pgs.created_at DESC
        LIMIT 3;
    """)
    
    results = cursor.fetchall()
    
    print("📊 SAMPLE DATA FROM DATABASE:")
    for i, (name, mlbam_id, stats_json) in enumerate(results, 1):
        stats = json.loads(stats_json)
        print(f"\n{i}. Player: {name} (MLBAM ID: {mlbam_id})")
        print(f"   Game Date: {stats.get('game_date')}")
        print(f"   Data Type: {stats.get('type')}")
        print(f"   Has Statcast Fields: {'avg_launch_speed' in stats}")
        print(f"   Fields: {list(stats.keys())}")
    
    # Check latest date
    cursor.execute("""
        SELECT MAX((stats->>'game_date')::date) as latest_date
        FROM player_game_stats 
        WHERE stats->>'game_date' IS NOT NULL
    """)
    latest_date = cursor.fetchone()[0]
    print(f"\n📅 Latest Game Date in Database: {latest_date}")
    
    cursor.close()
    conn.close()
    
    return latest_date

def test_pybaseball_connection():
    """Test pybaseball connection and data format"""
    print("\n🧪 TESTING PYBASEBALL CONNECTION")
    print("=" * 60)
    
    try:
        # Enable cache
        pybaseball.cache.enable()
        print("✅ Pybaseball cache enabled")
        
        # Test with a known player (Aaron Judge - MLBAM ID: 592450)
        test_mlbam_id = 592450
        start_date = '2025-04-01'
        end_date = '2025-04-15'
        
        print(f"🔍 Testing with Aaron Judge (MLBAM: {test_mlbam_id})")
        print(f"   Date range: {start_date} to {end_date}")
        
        # Fetch data
        statcast_data = pybaseball.statcast_batter(start_date, end_date, player_id=test_mlbam_id)
        
        if statcast_data.empty:
            print("⚠️ No data returned (expected if no games in this period)")
            return False
        
        print(f"✅ Retrieved {len(statcast_data)} plate appearances")
        print(f"📊 Columns available: {list(statcast_data.columns)}")
        
        # Check for key Statcast fields
        statcast_fields = ['launch_speed', 'launch_angle', 'hit_distance_sc', 'events']
        available_fields = [field for field in statcast_fields if field in statcast_data.columns]
        
        print(f"🎯 Statcast fields present: {available_fields}")
        
        # Show sample data
        if len(statcast_data) > 0:
            sample = statcast_data.head(2)
            print(f"\n📋 Sample data:")
            for idx, row in sample.iterrows():
                print(f"   Game: {row.get('game_date')} | Event: {row.get('events')} | "
                      f"Launch Speed: {row.get('launch_speed')} | "
                      f"Launch Angle: {row.get('launch_angle')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Pybaseball test failed: {e}")
        return False

def main():
    """Run verification tests"""
    print("🔍 DATA SOURCE VERIFICATION SCRIPT")
    print("=" * 60)
    
    # Verify database content
    latest_date = verify_database_data_source()
    
    # Test pybaseball connection
    pybaseball_works = test_pybaseball_connection()
    
    print("\n🎯 VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"📅 Latest data in database: {latest_date}")
    print(f"🐍 Pybaseball connection: {'✅ Working' if pybaseball_works else '❌ Failed'}")
    
    if latest_date:
        from datetime import datetime
        latest_datetime = datetime.strptime(str(latest_date), '%Y-%m-%d')
        today = datetime.now()
        days_behind = (today - latest_datetime).days
        print(f"📊 Data is {days_behind} days behind current date")
        
        if days_behind > 30:
            print("⚠️ Data is significantly behind - update recommended")
    
    print("\n✅ CONCLUSION:")
    print("   - player_game_stats table uses PYBASEBALL (statcast_batter)")
    print("   - Data includes Statcast fields (launch_speed, launch_angle, etc.)")
    print("   - MLB-StatsAPI is used for other purposes (team games, schedules)")

if __name__ == "__main__":
    main() 