#!/usr/bin/env python3
"""
Test Supabase Database Connection
Verifies that we can connect to Supabase with SSL
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_connection():
    """Test the Supabase database connection"""
    print("🔧 Testing Supabase Database Connection...")
    print("=" * 50)
    
    # Get credentials from environment
    db_config = {
        'host': os.getenv('DB_HOST'),
        'port': os.getenv('DB_PORT', '5432'),
        'database': os.getenv('DB_NAME', 'postgres'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD'),
        'sslmode': 'require'  # Supabase requires SSL
    }
    
    # Check if credentials are set
    if not db_config['host'] or not db_config['password']:
        print("❌ Database credentials not found in .env file")
        print("   Please ensure DB_HOST and DB_PASSWORD are set")
        return False
    
    print(f"📡 Connecting to: {db_config['host']}")
    print(f"📊 Database: {db_config['database']}")
    print(f"👤 User: {db_config['user']}")
    
    try:
        # Attempt connection
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Test query
        cur.execute("SELECT version();")
        version = cur.fetchone()
        
        print(f"\n✅ Connection successful!")
        print(f"🐘 PostgreSQL version: {version['version'].split(',')[0]}")
        
        # Check if enhanced schema tables exist
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('sports_events', 'teams', 'players', 'odds_data', 'player_props')
            ORDER BY table_name;
        """)
        
        tables = cur.fetchall()
        
        print(f"\n📋 Enhanced schema tables found: {len(tables)}")
        for table in tables:
            print(f"   ✓ {table['table_name']}")
        
        if len(tables) < 5:
            print("\n⚠️  Some enhanced schema tables are missing.")
            print("   You may need to run the schema migration.")
        
        # Check for existing data
        cur.execute("""
            SELECT 
                (SELECT COUNT(*) FROM sports_events) as events_count,
                (SELECT COUNT(*) FROM teams) as teams_count,
                (SELECT COUNT(*) FROM players) as players_count
        """)
        
        counts = cur.fetchone()
        
        print(f"\n📊 Current data status:")
        print(f"   - Sports events: {counts['events_count']}")
        print(f"   - Teams: {counts['teams_count']}")
        print(f"   - Players: {counts['players_count']}")
        
        cur.close()
        conn.close()
        
        return True
        
    except psycopg2.OperationalError as e:
        print(f"\n❌ Connection failed: {str(e)}")
        
        if "password authentication failed" in str(e):
            print("   → Check your database password")
        elif "could not translate host name" in str(e):
            print("   → Check your DB_HOST value")
        elif "SSL" in str(e):
            print("   → SSL connection issue (this is required for Supabase)")
        
        return False
        
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        return False

def main():
    """Main function"""
    print("🚀 Supabase Connection Test")
    print("=" * 70)
    
    if test_connection():
        print("\n✅ All tests passed! Ready for data ingestion.")
        print("\n🎯 Next step: python3 data_ingestor_supabase.py")
    else:
        print("\n❌ Connection test failed.")
        print("\n📝 Please check:")
        print("   1. Your .env file has correct Supabase credentials")
        print("   2. DB_HOST format: your-project.supabase.co")
        print("   3. DB_PASSWORD is your database password (not API key)")

if __name__ == "__main__":
    main() 