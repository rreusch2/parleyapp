#!/usr/bin/env python3

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    print("🏒 Fixing remaining NHL team logos...")
    
    # Initialize Supabase
    supabase = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_ROLE_KEY']
    )
    
    # NHL team mappings for the failed ones
    nhl_fixes = {
        'TBL': 'tb',   # Tampa Bay Lightning  
        'SJS': 'sj',   # San Jose Sharks
        'LAK': 'la'    # Los Angeles Kings
    }
    
    for abbr, espn_abbr in nhl_fixes.items():
        logo_url = f"https://a.espncdn.com/i/teamlogos/nhl/500/{espn_abbr}.png"
        
        try:
            # Update team in database
            update_response = supabase.table('teams').update({
                'logo_url': logo_url
            }).eq('sport_key', 'NHL').eq('team_abbreviation', abbr).execute()
            
            print(f"✅ Fixed {abbr}: {logo_url}")
            
        except Exception as e:
            print(f"⚠️ Error fixing {abbr}: {e}")
    
    print("🎉 NHL logo fixes complete!")

if __name__ == "__main__":
    main()
