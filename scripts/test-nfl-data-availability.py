#!/usr/bin/env python3
"""
Test script to check what NFL data is available from nfl-data-py
"""

import nfl_data_py as nfl
import pandas as pd
from datetime import datetime

def test_data_availability():
    print("🏈 Testing NFL Data Availability")
    print("=" * 50)
    
    # Test different years to see what's available
    years_to_test = [2024, 2025]
    
    for year in years_to_test:
        print(f"\nTesting year {year}:")
        try:
            # Try to get weekly data
            weekly_data = nfl.import_weekly_data([year])
            
            if len(weekly_data) > 0:
                print(f"  ✅ {year} data available: {len(weekly_data)} records")
                
                # Check season types
                season_types = weekly_data['season_type'].unique()
                print(f"  Season types: {season_types}")
                
                # Check weeks available
                weeks = sorted(weekly_data['week'].unique())
                print(f"  Weeks available: {weeks}")
                
                # Show latest data
                latest_week = weekly_data['week'].max()
                latest_season_type = weekly_data[weekly_data['week'] == latest_week]['season_type'].iloc[0]
                print(f"  Latest data: Week {latest_week} ({latest_season_type})")
                
                # Show some recent records
                recent_data = weekly_data[weekly_data['week'] == latest_week].head(3)
                print(f"  Sample recent records:")
                for idx, row in recent_data.iterrows():
                    print(f"    {row.get('player_display_name', 'N/A')} ({row.get('recent_team', 'N/A')}) - Week {row.get('week')}")
            else:
                print(f"  ❌ No {year} data found")
                
        except Exception as e:
            print(f"  ❌ Error fetching {year} data: {e}")
    
    # Test what the most recent available data is
    print(f"\n🔍 Checking most recent available data...")
    try:
        # Try to get the most recent data by starting with current year
        current_year = datetime.now().year
        
        # Work backwards to find available data
        for test_year in range(current_year, current_year - 3, -1):
            try:
                weekly_data = nfl.import_weekly_data([test_year])
                if len(weekly_data) > 0:
                    latest_records = weekly_data.sort_values(['season', 'week'], ascending=False).head(5)
                    print(f"\nMost Recent Available Data (Top 5 records):")
                    for idx, row in latest_records.iterrows():
                        print(f"  {row.get('player_display_name', 'N/A')} ({row.get('recent_team', 'N/A')}) - "
                              f"Season {row.get('season')}, Week {row.get('week')} ({row.get('season_type', 'N/A')})")
                    break
            except Exception:
                continue
                
    except Exception as e:
        print(f"Error checking recent data: {e}")

if __name__ == "__main__":
    test_data_availability()
