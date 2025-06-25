#!/usr/bin/env python3
"""
Supabase Configuration Helper
Helps set up the .env file with your Supabase credentials
"""

import os
import re
from getpass import getpass

def extract_supabase_info(connection_string):
    """Extract host, database, user from Supabase connection string"""
    # Pattern: postgresql://postgres:[password]@[host]:5432/postgres
    pattern = r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)'
    match = re.match(pattern, connection_string)
    
    if match:
        user, password, host, port, database = match.groups()
        return {
            'user': user,
            'password': password,
            'host': host,
            'port': port,
            'database': database
        }
    return None

def main():
    print("🚀 Supabase Configuration Helper")
    print("=" * 50)
    print("\nThis will help you configure your Supabase database connection.")
    print("\nYou can find these in your Supabase dashboard:")
    print("1. Go to app.supabase.com")
    print("2. Select your project")
    print("3. Go to Settings → Database")
    print()
    
    # Ask for connection method
    print("How would you like to configure?")
    print("1. Use connection string (recommended)")
    print("2. Enter credentials manually")
    choice = input("\nChoice (1 or 2): ").strip()
    
    if choice == "1":
        connection_string = getpass("Paste your Supabase connection string: ")
        info = extract_supabase_info(connection_string)
        
        if not info:
            print("❌ Invalid connection string format")
            return
            
        db_host = info['host']
        db_port = info['port']
        db_name = info['database']
        db_user = info['user']
        db_password = info['password']
        
    else:
        # Manual entry
        print("\nEnter your Supabase credentials:")
        db_host = input("Host (e.g., your-project.supabase.co): ").strip()
        db_port = input("Port (default 5432): ").strip() or "5432"
        db_name = input("Database name (default postgres): ").strip() or "postgres"
        db_user = input("User (default postgres): ").strip() or "postgres"
        db_password = getpass("Password: ")
    
    # Get API key
    print("\nNow enter your API keys:")
    theodds_key = input("The Odds API key: ").strip()
    
    # Create .env file
    env_content = f"""# The Odds API Configuration
THEODDS_API_KEY={theodds_key}
API_PROVIDER=theodds
SPORTS_API_KEY={theodds_key}

# Supabase Database Configuration
DB_HOST={db_host}
DB_PORT={db_port}
DB_NAME={db_name}
DB_USER={db_user}
DB_PASSWORD={db_password}

# Important: Supabase requires SSL
DB_SSL_MODE=require

# Alternative: Use connection string
# DATABASE_URL=postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?sslmode=require

# Redis Configuration (optional, for caching)
REDIS_URL=redis://localhost:6379

# Sports to track
ENABLED_SPORTS=NFL,NBA,MLB,NHL

# Logging
LOG_LEVEL=INFO
"""
    
    # Backup existing .env if it exists
    if os.path.exists('.env'):
        os.rename('.env', '.env.backup')
        print("\n✅ Backed up existing .env to .env.backup")
    
    # Write new .env
    with open('.env', 'w') as f:
        f.write(env_content)
    
    print("\n✅ Created .env file with your configuration!")
    print("\n🎯 Next steps:")
    print("1. Test the connection: python3 test_supabase_connection.py")
    print("2. Run data ingestion: python3 data_ingestor.py")
    
    # Also update the Python path for imports
    print("\n📝 Note: The data_ingestor.py needs to be updated to support SSL.")
    print("We'll create a modified version for Supabase compatibility.")

if __name__ == "__main__":
    main() 