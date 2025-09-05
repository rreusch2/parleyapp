#!/usr/bin/env python3

import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    print("🏟️ Starting comprehensive sports logo population...")
    
    # Initialize Supabase
    supabase = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_ROLE_KEY']
    )
    
    # ESPN logo URL patterns for each sport
    sports_config = {
        'MLB': {
            'base_url': 'https://a.espncdn.com/i/teamlogos/mlb/500/',
            'suffix': '.png',
            'name': 'Major League Baseball'
        },
        'NHL': {
            'base_url': 'https://a.espncdn.com/i/teamlogos/nhl/500/',
            'suffix': '.png', 
            'name': 'National Hockey League'
        },
        'basketball_wnba': {
            'base_url': 'https://a.espncdn.com/i/teamlogos/wnba/500/',
            'suffix': '.png',
            'name': 'Women\'s National Basketball Association',
            'abbr_transform': lambda x: x.replace('_W', '').lower()  # Remove _W suffix and lowercase
        },
        'americanfootball_ncaaf': {
            'base_url': 'https://a.espncdn.com/i/teamlogos/ncf/500/',
            'suffix': '.png',
            'name': 'College Football',
            'use_team_id': True  # College uses team IDs, not abbreviations
        }
    }
    
    total_updated = 0
    
    for sport_key, config in sports_config.items():
        print(f"\n🏈 Processing {config['name']} ({sport_key})...")
        
        # Get teams for this sport
        teams_response = supabase.table('teams').select('id, team_name, team_abbreviation').eq('sport_key', sport_key).execute()
        teams = teams_response.data
        
        if not teams:
            print(f"⚠️ No teams found for {sport_key}")
            continue
            
        print(f"📋 Found {len(teams)} teams")
        sport_updated = 0
        
        for team in teams:
            try:
                # Generate logo URL based on sport configuration
                if config.get('use_team_id'):
                    # For college football, we'll need to implement team ID mapping
                    # Skip for now as it's more complex
                    continue
                elif 'abbr_transform' in config:
                    # Apply transformation (e.g., WNBA abbreviations)
                    abbr = config['abbr_transform'](team['team_abbreviation'])
                else:
                    # Use abbreviation as-is (lowercase for most ESPN URLs)
                    abbr = team['team_abbreviation'].lower()
                
                logo_url = f"{config['base_url']}{abbr}{config['suffix']}"
                
                # Test if logo exists
                if test_logo_url(logo_url):
                    # Update team in database
                    update_response = supabase.table('teams').update({
                        'logo_url': logo_url
                    }).eq('id', team['id']).execute()
                    
                    print(f"✅ Updated {team['team_abbreviation']}: {logo_url}")
                    sport_updated += 1
                else:
                    print(f"❌ Logo not found for {team['team_abbreviation']}: {logo_url}")
                    
            except Exception as e:
                print(f"⚠️ Error processing {team['team_abbreviation']}: {e}")
        
        print(f"🎉 Updated {sport_updated} {config['name']} team logos!")
        total_updated += sport_updated
    
    print(f"\n🏆 Successfully updated {total_updated} team logos across all sports!")

def test_logo_url(url: str) -> bool:
    """Test if a logo URL returns a valid image"""
    try:
        response = requests.head(url, timeout=5)
        return response.status_code == 200 and 'image' in response.headers.get('content-type', '')
    except:
        return False

if __name__ == "__main__":
    main()
