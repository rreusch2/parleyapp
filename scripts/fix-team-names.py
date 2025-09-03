#!/usr/bin/env python3
"""
Script to fix inconsistent team names in the database
Maps abbreviation-only team names to proper full names with cities
"""

import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv('backend/.env')

def get_supabase_client() -> Client:
    """Initialize Supabase client"""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
    
    return create_client(url, key)

# Comprehensive team name mappings
TEAM_NAME_MAPPINGS = {
    'MLB': {
        'BOS': {'name': 'Boston Red Sox', 'city': 'Boston'},
        'CLE': {'name': 'Cleveland Guardians', 'city': 'Cleveland'},
        'COL': {'name': 'Colorado Rockies', 'city': 'Denver'},
        'KC': {'name': 'Kansas City Royals', 'city': 'Kansas City'},
        'LAA': {'name': 'Los Angeles Angels', 'city': 'Los Angeles'},
        'LAD': {'name': 'Los Angeles Dodgers', 'city': 'Los Angeles'},
        'NYY': {'name': 'New York Yankees', 'city': 'New York'},
        'TEX': {'name': 'Texas Rangers', 'city': 'Arlington'},
        # Add cities for existing full names
        'Arizona Diamondbacks': {'name': 'Arizona Diamondbacks', 'city': 'Phoenix'},
        'Atlanta Braves': {'name': 'Atlanta Braves', 'city': 'Atlanta'},
        'Baltimore Orioles': {'name': 'Baltimore Orioles', 'city': 'Baltimore'},
        'Chicago Cubs': {'name': 'Chicago Cubs', 'city': 'Chicago'},
        'Chicago White Sox': {'name': 'Chicago White Sox', 'city': 'Chicago'},
        'Cincinnati Reds': {'name': 'Cincinnati Reds', 'city': 'Cincinnati'},
        'Detroit Tigers': {'name': 'Detroit Tigers', 'city': 'Detroit'},
        'Houston Astros': {'name': 'Houston Astros', 'city': 'Houston'},
        'Miami Marlins': {'name': 'Miami Marlins', 'city': 'Miami'},
        'Milwaukee Brewers': {'name': 'Milwaukee Brewers', 'city': 'Milwaukee'},
        'Minnesota Twins': {'name': 'Minnesota Twins', 'city': 'Minneapolis'},
        'New York Mets': {'name': 'New York Mets', 'city': 'New York'},
        'Oakland Athletics': {'name': 'Oakland Athletics', 'city': 'Oakland'},
        'Philadelphia Phillies': {'name': 'Philadelphia Phillies', 'city': 'Philadelphia'},
        'Pittsburgh Pirates': {'name': 'Pittsburgh Pirates', 'city': 'Pittsburgh'},
        'San Diego Padres': {'name': 'San Diego Padres', 'city': 'San Diego'},
        'San Francisco Giants': {'name': 'San Francisco Giants', 'city': 'San Francisco'},
        'Seattle Mariners': {'name': 'Seattle Mariners', 'city': 'Seattle'},
        'St. Louis Cardinals': {'name': 'St. Louis Cardinals', 'city': 'St. Louis'},
        'Tampa Bay Rays': {'name': 'Tampa Bay Rays', 'city': 'Tampa Bay'},
        'Toronto Blue Jays': {'name': 'Toronto Blue Jays', 'city': 'Toronto'},
        'Washington Nationals': {'name': 'Washington Nationals', 'city': 'Washington'}
    },
    'NFL': {
        # Common NFL abbreviation fixes
        'CHI': {'name': 'Chicago Bears', 'city': 'Chicago'},
        'KC': {'name': 'Kansas City Chiefs', 'city': 'Kansas City'},
        'GB': {'name': 'Green Bay Packers', 'city': 'Green Bay'},
        'NE': {'name': 'New England Patriots', 'city': 'Boston'},
        'NO': {'name': 'New Orleans Saints', 'city': 'New Orleans'},
        'NYG': {'name': 'New York Giants', 'city': 'New York'},
        'NYJ': {'name': 'New York Jets', 'city': 'New York'},
        'SF': {'name': 'San Francisco 49ers', 'city': 'San Francisco'},
        'TB': {'name': 'Tampa Bay Buccaneers', 'city': 'Tampa Bay'},
        'LV': {'name': 'Las Vegas Raiders', 'city': 'Las Vegas'},
        'LAC': {'name': 'Los Angeles Chargers', 'city': 'Los Angeles'},
        'LAR': {'name': 'Los Angeles Rams', 'city': 'Los Angeles'}
    },
    'basketball_wnba': {
        'ATL': {'name': 'Atlanta Dream', 'city': 'Atlanta'},
        'CHI': {'name': 'Chicago Sky', 'city': 'Chicago'},
        'CONN': {'name': 'Connecticut Sun', 'city': 'Uncasville'},
        'DAL': {'name': 'Dallas Wings', 'city': 'Dallas'},
        'IND': {'name': 'Indiana Fever', 'city': 'Indianapolis'},
        'LAS': {'name': 'Las Vegas Aces', 'city': 'Las Vegas'},
        'MIN': {'name': 'Minnesota Lynx', 'city': 'Minneapolis'},
        'NY': {'name': 'New York Liberty', 'city': 'New York'},
        'PHX': {'name': 'Phoenix Mercury', 'city': 'Phoenix'},
        'SEA': {'name': 'Seattle Storm', 'city': 'Seattle'},
        'WASH': {'name': 'Washington Mystics', 'city': 'Washington'},
        'GS': {'name': 'Golden State Valkyries', 'city': 'San Francisco'}
    }
}

def fix_team_names():
    """Fix team names in the database"""
    supabase = get_supabase_client()
    
    print("🔧 Starting team name fix process...")
    
    for sport_key, teams in TEAM_NAME_MAPPINGS.items():
        print(f"\n📊 Processing {sport_key} teams...")
        
        for old_name, team_data in teams.items():
            try:
                # Update team name and city
                result = supabase.table('teams').update({
                    'team_name': team_data['name'],
                    'city': team_data['city'],
                    'updated_at': 'now()'
                }).eq('sport_key', sport_key).eq('team_name', old_name).execute()
                
                if result.data:
                    print(f"  ✅ Updated {old_name} → {team_data['name']} ({team_data['city']})")
                else:
                    # Try by abbreviation if team_name didn't match
                    result = supabase.table('teams').update({
                        'team_name': team_data['name'],
                        'city': team_data['city'],
                        'updated_at': 'now()'
                    }).eq('sport_key', sport_key).eq('team_abbreviation', old_name).execute()
                    
                    if result.data:
                        print(f"  ✅ Updated {old_name} (by abbrev) → {team_data['name']} ({team_data['city']})")
                    else:
                        print(f"  ⚠️  No match found for {old_name} in {sport_key}")
                        
            except Exception as e:
                print(f"  ❌ Error updating {old_name}: {e}")

def add_search_keywords():
    """Add search keywords to team metadata for better search"""
    supabase = get_supabase_client()
    
    print("\n🔍 Adding search keywords to team metadata...")
    
    # Get all teams
    result = supabase.table('teams').select('*').execute()
    teams = result.data
    
    for team in teams:
        keywords = []
        
        # Add team name words
        if team['team_name']:
            keywords.extend(team['team_name'].lower().split())
        
        # Add city words
        if team['city']:
            keywords.extend(team['city'].lower().split())
        
        # Add abbreviation
        if team['team_abbreviation']:
            keywords.append(team['team_abbreviation'].lower())
        
        # Add sport-specific keywords
        sport_keywords = {
            'MLB': ['baseball', 'mlb', 'major league'],
            'NFL': ['football', 'nfl', 'national football'],
            'basketball_wnba': ['basketball', 'wnba', 'womens'],
            'americanfootball_ncaaf': ['college football', 'ncaaf', 'college']
        }
        
        if team['sport_key'] in sport_keywords:
            keywords.extend(sport_keywords[team['sport_key']])
        
        # Remove duplicates and create metadata
        keywords = list(set(keywords))
        
        # Update metadata
        metadata = team.get('metadata', {}) or {}
        metadata['search_keywords'] = keywords
        
        try:
            supabase.table('teams').update({
                'metadata': metadata,
                'updated_at': 'now()'
            }).eq('id', team['id']).execute()
            
            print(f"  ✅ Added keywords for {team['team_name']}: {keywords[:5]}...")
            
        except Exception as e:
            print(f"  ❌ Error updating metadata for {team['team_name']}: {e}")

def main():
    """Main execution"""
    try:
        print("🚀 Team Name Fix Script Starting...")
        
        # Fix team names
        fix_team_names()
        
        # Add search keywords
        add_search_keywords()
        
        print("\n✅ Team name fix completed successfully!")
        print("📊 Run this script periodically to maintain data quality")
        
    except Exception as e:
        print(f"❌ Script failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
