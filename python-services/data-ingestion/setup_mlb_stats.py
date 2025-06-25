#!/usr/bin/env python3
"""
Setup script for MLB Statistics Integration
1. Runs database migration to add missing tables
2. Tests the MLB stats ingestor
3. Optionally ingests sample data
"""

import psycopg2
import os
import sys
from pathlib import Path

def run_database_migration():
    """Run the MLB tables migration script"""
    print("🔧 Running database migration...")
    
    try:
        # Read the migration script
        migration_file = Path(__file__).parent / "mlb_tables_migration.sql"
        
        if not migration_file.exists():
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        # Connect to database
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'postgres'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD')
        )
        
        cursor = conn.cursor()
        cursor.execute(migration_sql)
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✅ Database migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Database migration failed: {e}")
        return False

def test_mlb_ingestor():
    """Test the MLB statistics ingestor"""
    print("🧪 Testing MLB statistics ingestor...")
    
    try:
        # Import the fixed ingestor
        sys.path.append(str(Path(__file__).parent))
        from mlb_stats_ingestor_fixed import MLBStatsIngestor
        
        # Create ingestor instance
        ingestor = MLBStatsIngestor()
        
        # Test database connection
        if not ingestor.test_connection():
            print("❌ Database connection failed")
            return False
        
        print("✅ Database connection successful!")
        print("✅ MLB statistics ingestor is ready!")
        return True
        
    except Exception as e:
        print(f"❌ MLB ingestor test failed: {e}")
        return False

def ingest_sample_data():
    """Ingest sample data to test the system"""
    print("📊 Ingesting sample MLB data...")
    
    try:
        from mlb_stats_ingestor_fixed import MLBStatsIngestor
        
        ingestor = MLBStatsIngestor()
        
        # Test with Aaron Judge
        print("Getting Aaron Judge statistics...")
        ingestor.ingest_player_batting_stats('Judge', 'Aaron')
        
        print("✅ Sample data ingestion completed!")
        return True
        
    except Exception as e:
        print(f"❌ Sample data ingestion failed: {e}")
        print(f"This might be due to no recent games or network issues")
        return False

def check_environment():
    """Check if required environment variables are set"""
    print("🔍 Checking environment variables...")
    
    required_vars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("Please set these variables before running the setup.")
        return False
    
    print("✅ All required environment variables are set!")
    return True

def main():
    """Main setup function"""
    print("🏁 Starting MLB Statistics Setup")
    print("=" * 50)
    
    # Check environment
    if not check_environment():
        sys.exit(1)
    
    # Run database migration
    if not run_database_migration():
        print("❌ Setup failed at database migration step")
        sys.exit(1)
    
    # Test the ingestor
    if not test_mlb_ingestor():
        print("❌ Setup failed at ingestor test step")
        sys.exit(1)
    
    # Ask if user wants to ingest sample data
    response = input("\n🤔 Would you like to ingest sample data? (y/n): ").lower().strip()
    
    if response == 'y' or response == 'yes':
        ingest_sample_data()
    
    print("\n" + "=" * 50)
    print("🎉 MLB Statistics Setup Complete!")
    print("\nNext steps:")
    print("1. Your database now has the required tables for MLB statistics")
    print("2. You can run the ingestor to get real MLB data")
    print("3. Your AI models can now train on real baseball statistics!")
    print("\nTo run daily updates:")
    print("python mlb_stats_ingestor_fixed.py")

if __name__ == "__main__":
    main() 