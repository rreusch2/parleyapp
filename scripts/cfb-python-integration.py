#!/usr/bin/env python3
"""
College Football Data Integration using cfbd-json-py
Fetches 2024 team records and stores them in Supabase

Usage: python cfb-python-integration.py
"""

import os
import sys
from datetime import datetime
import pandas as pd
from supabase import create_client
import cfbd_json_py as cfbd
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase setup
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
CFBD_API_KEY = os.getenv('CFBD_API_KEY')

if not all([SUPABASE_URL, SUPABASE_SERVICE_KEY, CFBD_API_KEY]):
    print("❌ Missing required environment variables")
    print("Need: SUPABASE_URL, SUPABASE_SERVICE_KEY, CFBD_API_KEY")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def setup_cfb_teams():
    """Setup CFB teams in Supabase teams table"""
    print("🏫 Setting up CFB teams...")
    
    try:
        # Get FBS teams
        teams_df = cfbd.get_cfbd_team_information(
            api_key=CFBD_API_KEY,
            return_as_dict=False,
            division="fbs"
        )
        
        print(f"📋 Found {len(teams_df)} CFB teams")
        
        # Convert to format for Supabase
        team_inserts = []
        for _, team in teams_df.iterrows():
            team_inserts.append({
                'sport_key': 'americanfootball_ncaaf',
                'team_key': team['school'].lower().replace(' ', '-').replace('&', 'and') if pd.notna(team['school']) else 'unknown',
                'team_name': team['school'] if pd.notna(team['school']) else 'Unknown',
                'team_abbreviation': team['abbreviation'] if pd.notna(team['abbreviation']) else team['school'][:3].upper() if pd.notna(team['school']) else 'UNK',
                'city': team['school'] if pd.notna(team['school']) else 'Unknown',
                'conference': team['conference'] if pd.notna(team['conference']) else None,
                'division': team['division'] if pd.notna(team['division']) else None,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            })
        
        # Upsert teams
        response = supabase.table('teams').upsert(
            team_inserts, 
            on_conflict='team_key',
            ignore_duplicates=False
        ).execute()
        
        if response.data:
            print(f"✅ Setup {len(response.data)} CFB teams")
            return True
        else:
            print("❌ Failed to setup CFB teams")
            return False
            
    except Exception as e:
        print(f"❌ Error setting up CFB teams: {e}")
        return False

def get_cfb_team_records():
    """Get 2024 CFB team records and store in team_recent_stats"""
    print("🏆 Fetching 2024 CFB team records...")
    
    try:
        # Get 2024 team records
        records_df = cfbd.get_cfbd_team_records(
            api_key=CFBD_API_KEY,
            return_as_dict=False,
            year=2024
        )
        
        print(f"📋 Found {len(records_df)} team records for 2024")
        
        # Process each team record
        team_stats = []
        teams_found = 0
        
        for _, record in records_df.iterrows():
            # Get team_id from teams table
            try:
                team_response = supabase.table('teams').select('id').eq('team_name', record['team']).eq('sport_key', 'americanfootball_ncaaf').execute()
                
                if team_response.data and len(team_response.data) > 0:
                    team_id = team_response.data[0]['id']
                    teams_found += 1
                    
                    # Create team stat record
                    team_stats.append({
                        'team_id': team_id,
                        'team_name': record['team'],
                        'sport': 'College Football',
                        'sport_key': 'americanfootball_ncaaf',
                        'game_date': '2024-12-31',  # End of season
                        'opponent_team': 'Season Total',
                        'opponent_team_id': team_id,  # Use same team as placeholder
                        'is_home': True,
                        'team_score': int(record['total_wins']) if pd.notna(record['total_wins']) else 0,
                        'opponent_score': int(record['total_losses']) if pd.notna(record['total_losses']) else 0,
                        'game_result': 'W' if (pd.notna(record['total_wins']) and pd.notna(record['total_losses']) and record['total_wins'] > record['total_losses']) else 'L',
                        'margin': int(record['total_wins'] - record['total_losses']) if (pd.notna(record['total_wins']) and pd.notna(record['total_losses'])) else 0,
                        'external_game_id': f"{record['team']}-2024-season",
                        'created_at': datetime.now().isoformat(),
                        'updated_at': datetime.now().isoformat()
                    })
                    
            except Exception as e:
                print(f"⚠️ Team lookup failed for {record['team']}: {e}")
                continue
        
        print(f"🔍 Found {teams_found} teams in database out of {len(records_df)} records")
        
        # Store team stats if we have any
        if team_stats:
            print(f"🏈 Storing {len(team_stats)} team records...")
            
            response = supabase.table('team_recent_stats').upsert(
                team_stats,
                on_conflict='team_id,game_date,opponent_team_id',
                ignore_duplicates=False
            ).execute()
            
            if response.data:
                print(f"✅ Stored {len(response.data)} CFB team records")
                return True
            else:
                print("❌ Failed to store CFB team records")
                return False
        else:
            print("❌ No team stats to store")
            return False
            
    except Exception as e:
        print(f"❌ Error getting CFB team records: {e}")
        return False

def main():
    """Main integration function"""
    print("🚀 Starting CFB Python Data Integration...\n")
    
    try:
        # 1. Setup CFB teams first
        if not setup_cfb_teams():
            return False
        
        print()
        
        # 2. Get and store 2024 team records
        if not get_cfb_team_records():
            return False
        
        print()
        
        # 3. Check final results
        try:
            teams_count = supabase.table('teams').select('id', count='exact').eq('sport_key', 'americanfootball_ncaaf').execute()
            stats_count = supabase.table('team_recent_stats').select('id', count='exact').eq('sport', 'College Football').execute()
            trends_count = supabase.table('team_trends_data').select('team_id', count='exact').eq('sport_key', 'americanfootball_ncaaf').execute()
            
            print("📊 Final CFB Data Summary:")
            print(f"   Teams: {teams_count.count if teams_count.count else 0}")
            print(f"   Team Stats: {stats_count.count if stats_count.count else 0}")
            print(f"   Team Trends: {trends_count.count if trends_count.count else 0}")
        except Exception as e:
            print(f"⚠️ Could not get final counts: {e}")
        
        print("\n🎉 CFB Python Data Integration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ CFB Integration failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
