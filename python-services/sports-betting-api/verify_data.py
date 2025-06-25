#!/usr/bin/env python3
"""Quick data verification before training"""

import os
import sys
sys.path.append('../data-ingestion')
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import json

load_dotenv()

try:
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        port=int(os.getenv('DB_PORT', 5432)),
        sslmode='require'
    )
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    print("✅ Connected to Supabase!")
    
    # Get data summary
    cursor.execute("""
        SELECT 
            p.sport,
            COUNT(DISTINCT p.id) as players,
            COUNT(pgs.id) as games
        FROM players p
        JOIN player_game_stats pgs ON p.id = pgs.player_id
        WHERE p.sport IS NOT NULL
        GROUP BY p.sport
        ORDER BY games DESC
    """)
    
    print("\n📊 DATA SUMMARY BY SPORT:")
    print("-" * 40)
    for row in cursor.fetchall():
        print(f"{row['sport']}: {row['players']} players, {row['games']:,} games")
    
    # Get sample NBA stats
    cursor.execute("""
        SELECT 
            p.name,
            pgs.stats
        FROM players p
        JOIN player_game_stats pgs ON p.id = pgs.player_id
        WHERE p.sport = 'NBA'
        AND pgs.stats->>'points' IS NOT NULL
        LIMIT 3
    """)
    
    print("\n🏀 SAMPLE NBA DATA:")
    print("-" * 40)
    for row in cursor.fetchall():
        stats = row['stats']
        print(f"\nPlayer: {row['name']}")
        print(f"Points: {stats.get('points')}")
        print(f"Rebounds: {stats.get('rebounds')}")
        print(f"Assists: {stats.get('assists')}")
        print(f"Minutes: {stats.get('minutes_played')}")
        print(f"Game Date: {stats.get('game_date')}")
    
    # Check for required fields
    cursor.execute("""
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN stats->>'points' IS NOT NULL THEN 1 END) as has_points,
               COUNT(CASE WHEN stats->>'rebounds' IS NOT NULL THEN 1 END) as has_rebounds,
               COUNT(CASE WHEN stats->>'assists' IS NOT NULL THEN 1 END) as has_assists,
               COUNT(CASE WHEN stats->>'minutes_played' IS NOT NULL THEN 1 END) as has_minutes
        FROM player_game_stats pgs
        JOIN players p ON p.id = pgs.player_id
        WHERE p.sport = 'NBA'
    """)
    
    row = cursor.fetchone()
    print(f"\n✅ NBA DATA COMPLETENESS:")
    print(f"Total NBA records: {row['total']:,}")
    print(f"Has points: {row['has_points']:,} ({row['has_points']/row['total']*100:.1f}%)")
    print(f"Has rebounds: {row['has_rebounds']:,} ({row['has_rebounds']/row['total']*100:.1f}%)")
    print(f"Has assists: {row['has_assists']:,} ({row['has_assists']/row['total']*100:.1f}%)")
    print(f"Has minutes: {row['has_minutes']:,} ({row['has_minutes']/row['total']*100:.1f}%)")
    
    cursor.close()
    conn.close()
    
    print("\n✅ Data verification complete! Ready to train models.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nMake sure your .env file has:")
    print("DB_HOST=your-supabase-host")
    print("DB_NAME=postgres")
    print("DB_USER=postgres")
    print("DB_PASSWORD=your-password")
    print("DB_PORT=5432") 