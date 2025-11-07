#!/usr/bin/env python3
"""
Test script to check if nfl-data-py has 2025 season data available
"""

import nfl_data_py as nfl
import pandas as pd
from datetime import datetime

def test_nfl_2025_data():
    print("Testing nfl-data-py for 2025 season data...")
    
    # Test years to check
    test_years = [2025, 2024]
    
    for year in test_years:
        try:
            print(f"\n=== Testing {year} season ===")
            
            # Try to get weekly data
            weekly_data = nfl.import_weekly_data([year])
            
            if weekly_data.empty:
                print(f"❌ No weekly data for {year}")
            else:
                print(f"✅ Found weekly data for {year}")
                print(f"   Total records: {len(weekly_data)}")
                
                # Check weeks available
                if 'week' in weekly_data.columns:
                    weeks = sorted(weekly_data['week'].unique())
                    print(f"   Weeks available: {weeks}")
                    max_week = max(weeks)
                    print(f"   Latest week: {max_week}")
                
                # Check latest few records
                if 'player_display_name' in weekly_data.columns:
                    sample_players = weekly_data['player_display_name'].value_counts().head(3)
                    print(f"   Sample players: {list(sample_players.index)}")
                
        except Exception as e:
            print(f"❌ Error fetching {year} data: {str(e)}")
    
    print(f"\n=== Test completed at {datetime.now()} ===")

if __name__ == "__main__":
    test_nfl_2025_data()
