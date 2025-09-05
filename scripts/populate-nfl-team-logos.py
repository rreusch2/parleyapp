#!/usr/bin/env python3
"""
NFL Team Logo Population Script for ParleyApp

This script fetches official NFL team logos from ESPN's API and updates
the Supabase teams table with high-quality logo URLs.

Features:
- Uses ESPN's official team logo CDN
- 500x500px high-resolution PNG logos
- Matches teams by abbreviation for accuracy
- Updates existing team records in database
"""

import os
import sys
import requests
import json
from supabase import create_client, Client
from typing import Dict, List, Optional

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://iriaegoipkjtktitpary.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# ESPN API endpoint for NFL teams with logos
ESPN_NFL_TEAMS_API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams'

def get_supabase_client() -> Client:
    """Initialize and return Supabase client"""
    if not SUPABASE_SERVICE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY environment variable not set")
    
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def fetch_espn_team_logos() -> Dict[str, str]:
    """
    Fetch NFL team logos from ESPN API
    
    Returns:
        Dictionary mapping team abbreviations to logo URLs
    """
    print("🏈 Fetching NFL team data from ESPN API...")
    
    try:
        response = requests.get(ESPN_NFL_TEAMS_API, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        team_logos = {}
        
        # Extract teams from ESPN API response
        if 'sports' in data and len(data['sports']) > 0:
            leagues = data['sports'][0].get('leagues', [])
            if leagues and len(leagues) > 0:
                teams = leagues[0].get('teams', [])
                
                for team_data in teams:
                    team = team_data.get('team', {})
                    abbreviation = team.get('abbreviation')
                    
                    # Get the default full-size logo (500x500px)
                    logos = team.get('logos', [])
                    if logos and abbreviation:
                        # Find the default full-size logo
                        default_logo = None
                        for logo in logos:
                            if 'full' in logo.get('rel', []) and 'default' in logo.get('rel', []):
                                default_logo = logo.get('href')
                                break
                        
                        if default_logo:
                            team_logos[abbreviation] = default_logo
                            print(f"  ✓ {team.get('displayName', abbreviation)}: {default_logo}")
        
        print(f"📊 Found {len(team_logos)} NFL team logos from ESPN")
        return team_logos
        
    except requests.RequestException as e:
        print(f"❌ Error fetching ESPN team data: {e}")
        return {}
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing ESPN API response: {e}")
        return {}

def get_existing_nfl_teams(supabase: Client) -> List[Dict]:
    """
    Get existing NFL teams from Supabase database
    
    Returns:
        List of team records from database
    """
    print("🔍 Fetching existing NFL teams from database...")
    
    try:
        response = supabase.table('teams').select('*').eq('sport_key', 'NFL').execute()
        teams = response.data
        
        print(f"📊 Found {len(teams)} NFL teams in database")
        return teams
        
    except Exception as e:
        print(f"❌ Error fetching teams from database: {e}")
        return []

def update_team_logo(supabase: Client, team_id: str, logo_url: str, team_name: str) -> bool:
    """
    Update a team's logo URL in the database
    
    Args:
        supabase: Supabase client
        team_id: Team UUID
        logo_url: ESPN logo URL
        team_name: Team name for logging
    
    Returns:
        True if successful, False otherwise
    """
    try:
        response = supabase.table('teams').update({
            'logo_url': logo_url,
            'updated_at': 'now()'
        }).eq('id', team_id).execute()
        
        if response.data:
            print(f"  ✅ Updated {team_name}: {logo_url}")
            return True
        else:
            print(f"  ❌ Failed to update {team_name}")
            return False
            
    except Exception as e:
        print(f"  ❌ Error updating {team_name}: {e}")
        return False

def main():
    """Main execution function"""
    print("🚀 Starting NFL Team Logo Population Script")
    print("=" * 60)
    
    # Initialize Supabase client
    try:
        supabase = get_supabase_client()
        print("✅ Connected to Supabase")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    # Fetch ESPN team logos
    espn_logos = fetch_espn_team_logos()
    if not espn_logos:
        print("❌ No team logos found from ESPN API")
        sys.exit(1)
    
    # Get existing teams from database
    db_teams = get_existing_nfl_teams(supabase)
    if not db_teams:
        print("❌ No NFL teams found in database")
        sys.exit(1)
    
    # Update teams with logos
    print("\n🔄 Updating team logos in database...")
    updated_count = 0
    matched_count = 0
    
    for team in db_teams:
        team_abbrev = team.get('team_abbreviation')
        team_name = team.get('team_name', team_abbrev)
        team_id = team.get('id')
        
        if not team_abbrev or not team_id:
            print(f"  ⚠️ Skipping team with missing data: {team}")
            continue
            
        # Match team abbreviation with ESPN data
        if team_abbrev in espn_logos:
            matched_count += 1
            logo_url = espn_logos[team_abbrev]
            
            if update_team_logo(supabase, team_id, logo_url, team_name):
                updated_count += 1
        else:
            print(f"  ⚠️ No ESPN logo found for: {team_name} ({team_abbrev})")
    
    # Summary
    print("\n" + "=" * 60)
    print("📈 UPDATE SUMMARY:")
    print(f"  • Total NFL teams in database: {len(db_teams)}")
    print(f"  • Teams matched with ESPN: {matched_count}")
    print(f"  • Teams successfully updated: {updated_count}")
    print(f"  • ESPN logos available: {len(espn_logos)}")
    
    if updated_count > 0:
        print(f"\n🎉 Successfully populated {updated_count} NFL team logos!")
        print("\n🔗 Logo Format Info:")
        print("  • High-quality 500x500px PNG images")
        print("  • Hosted on ESPN's reliable CDN")
        print("  • Official NFL team logos")
        print("  • Ready for frontend integration")
    else:
        print("\n⚠️ No teams were updated. Check team abbreviation matching.")
    
    print("\n✅ Script completed!")

if __name__ == "__main__":
    main()
