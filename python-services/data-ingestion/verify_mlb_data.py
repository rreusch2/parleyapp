#!/usr/bin/env python3
"""
Quick script to verify MLB data was stored successfully
"""

import psycopg2
import os
from dotenv import load_dotenv
import json

load_dotenv()

def verify_mlb_data():
    """Check if MLB data was stored successfully"""
    try:
        # Connect to database
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            conn = psycopg2.connect(database_url)
        else:
            conn = psycopg2.connect(
                host=os.getenv('DB_HOST'),
                port=os.getenv('DB_PORT', '5432'),
                database=os.getenv('DB_NAME', 'postgres'),
                user=os.getenv('DB_USER', 'postgres'),
                password=os.getenv('DB_PASSWORD'),
                sslmode=os.getenv('DB_SSL_MODE', 'require')
            )
        
        cursor = conn.cursor()
        
        # Check players
        cursor.execute("""
            SELECT COUNT(*), 
                   STRING_AGG(DISTINCT name, ', ') as player_names
            FROM players 
            WHERE sport = 'MLB'
        """)
        player_count, player_names = cursor.fetchone()
        
        print("🏟️  MLB Data Verification")
        print("=" * 50)
        print(f"👨‍⚾ MLB Players: {player_count}")
        if player_names:
            print(f"   Names: {player_names}")
        
        # Check sports events
        cursor.execute("""
            SELECT COUNT(*), 
                   MIN(start_time) as earliest_game,
                   MAX(start_time) as latest_game
            FROM sports_events 
            WHERE sport = 'MLB'
        """)
        event_count, earliest, latest = cursor.fetchone()
        
        print(f"🏟️  MLB Games: {event_count}")
        if earliest:
            print(f"   Date range: {earliest.date()} to {latest.date()}")
        
        # Check player game stats
        cursor.execute("""
            SELECT COUNT(*) 
            FROM player_game_stats pgs
            JOIN players p ON pgs.player_id = p.id
            WHERE p.sport = 'MLB'
        """)
        stats_count = cursor.fetchone()[0]
        
        print(f"📊 Player Game Stats: {stats_count}")
        
        # Show sample stats
        if stats_count > 0:
            cursor.execute("""
                SELECT p.name, pgs.stats
                FROM player_game_stats pgs
                JOIN players p ON pgs.player_id = p.id
                WHERE p.sport = 'MLB'
                LIMIT 1
            """)
            
            result = cursor.fetchone()
            if result:
                player_name, stats_json = result
                print(f"\n📈 Sample stats for {player_name}:")
                stats = stats_json
                if isinstance(stats, str):
                    stats = json.loads(stats)
                
                print(f"   Type: {stats.get('type')}")
                print(f"   At Bats: {stats.get('at_bats')}")
                print(f"   Hits: {stats.get('hits')}")
                print(f"   Home Runs: {stats.get('home_runs')}")
                print(f"   Events: {len(stats.get('events', []))} recorded")
        
        cursor.close()
        conn.close()
        
        if player_count > 0 and stats_count > 0:
            print("\n✅ SUCCESS: MLB data ingestion is working!")
            print("🎯 Your AI models now have access to real MLB statistics!")
        else:
            print("\n⚠️  No data found - this might be normal if no recent games")
            
        return True
        
    except Exception as e:
        print(f"❌ Error verifying data: {e}")
        return False

if __name__ == "__main__":
    verify_mlb_data() 