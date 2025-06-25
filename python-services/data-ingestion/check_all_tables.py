#!/usr/bin/env python3

import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def check_database_tables():
    """Check all tables in our Supabase database"""
    try:
        # Connect using the same format that worked before
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'), 
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=int(os.getenv('DB_PORT', 5432)),
            sslmode='require'
        )
        
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        print('All Tables in Database:')
        print('=' * 50)
        for table in tables:
            print(f'  {table[0]}')
        
        # Check specifically for our new MLB tables
        mlb_tables = ['player_game_statistics', 'team_season_stats', 'team_game_results']
        print(f'\nChecking for MLB-specific tables:')
        for table_name in mlb_tables:
            cursor.execute(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table_name}'
                );
            """)
            exists = cursor.fetchone()[0]
            status = '✅ EXISTS' if exists else '❌ MISSING'
            print(f'  {table_name}: {status}')
        
        # Check for betting-related tables
        betting_tables = ['bets', 'predictions', 'betting_strategies', 'user_preferences']
        print(f'\nChecking for betting-related tables:')
        for table_name in betting_tables:
            cursor.execute(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table_name}'
                );
            """)
            exists = cursor.fetchone()[0]
            status = '✅ EXISTS' if exists else '❌ MISSING'
            print(f'  {table_name}: {status}')
            
        # Count current data
        print(f'\nCurrent Data Counts:')
        print('=' * 30)
        
        data_tables = ['players', 'teams', 'sports_events', 'player_game_statistics']
        for table_name in data_tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
                count = cursor.fetchone()[0]
                print(f'  {table_name}: {count} records')
            except psycopg2.Error:
                print(f'  {table_name}: Table not found')
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"Error checking database: {e}")
        return False

if __name__ == "__main__":
    check_database_tables() 