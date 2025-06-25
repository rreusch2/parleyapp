#!/usr/bin/env python3
"""
Check Historical Games Table Structure
Debug script to see actual data structure and values
"""

import os
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

def check_table_structure():
    """Check the structure and sample data from historical_games table"""
    
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=int(os.getenv('DB_PORT', 5432)),
            sslmode='require'
        )
        
        print("✅ Connected to database")
        
        # Check table columns
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'historical_games'
                ORDER BY ordinal_position;
            """)
            columns = cursor.fetchall()
            
            print("\n📋 TABLE STRUCTURE:")
            print("=" * 50)
            for col in columns:
                print(f"  {col['column_name']}: {col['data_type']} ({'NULL' if col['is_nullable'] == 'YES' else 'NOT NULL'})")
        
        # Check sample data
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT * 
                FROM historical_games 
                WHERE sport = 'MLB'
                LIMIT 5;
            """)
            sample = cursor.fetchall()
            
            print(f"\n📊 SAMPLE DATA (5 records):")
            print("=" * 50)
            if sample:
                for i, row in enumerate(sample, 1):
                    print(f"\nRecord {i}:")
                    for key, value in row.items():
                        print(f"  {key}: {value}")
            else:
                print("No MLB records found")
        
        # Check unique seasons
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT DISTINCT season, COUNT(*) as game_count
                FROM historical_games 
                WHERE sport = 'MLB'
                GROUP BY season
                ORDER BY season;
            """)
            seasons = cursor.fetchall()
            
            print(f"\n📅 SEASONS AVAILABLE:")
            print("=" * 30)
            for season in seasons:
                print(f"  {season['season']}: {season['game_count']:,} games")
        
        # Check team names
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT DISTINCT home_team
                FROM historical_games 
                WHERE sport = 'MLB'
                ORDER BY home_team
                LIMIT 10;
            """)
            teams = cursor.fetchall()
            
            print(f"\n⚾ SAMPLE TEAM NAMES:")
            print("=" * 30)
            for team in teams:
                print(f"  {team['home_team']}")
        
        # Check date range
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    MIN(game_date) as earliest,
                    MAX(game_date) as latest,
                    COUNT(*) as total_games
                FROM historical_games 
                WHERE sport = 'MLB';
            """)
            date_info = cursor.fetchone()
            
            print(f"\n📆 DATE RANGE:")
            print("=" * 20)
            print(f"  Earliest: {date_info['earliest']}")
            print(f"  Latest: {date_info['latest']}")
            print(f"  Total games: {date_info['total_games']:,}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_table_structure() 