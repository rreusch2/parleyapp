#!/usr/bin/env python3
"""
Quick script to check the actual database structure
"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def check_table_structure(table_name):
    """Check the actual structure of a table"""
    try:
        # Use DATABASE_URL if available
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
        
        # Get table structure
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = %s 
            ORDER BY ordinal_position;
        """, (table_name,))
        
        columns = cursor.fetchall()
        
        print(f"{table_name} table structure:")
        print("=" * 80)
        for col in columns:
            column_name, data_type, is_nullable, column_default = col
            nullable = "NULL" if is_nullable == "YES" else "NOT NULL"
            default = f" DEFAULT {column_default}" if column_default else ""
            print(f"  {column_name:<25} {data_type:<20} {nullable:<10} {default}")
        
        print("\n")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"Error checking database structure: {e}")
        return False

if __name__ == "__main__":
    check_table_structure('players')
    check_table_structure('sports_events')
    check_table_structure('teams') 