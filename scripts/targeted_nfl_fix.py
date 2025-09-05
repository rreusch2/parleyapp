#!/usr/bin/env python3

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class TargetedNFLFix:
    def __init__(self):
        # Initialize Supabase
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # Manual mapping of key games from the provided schedule
        # Format: "team_opponent_home/away": "date"
        self.game_mappings = {
            # Week 1 - September 5-9, 2024
            "KC_BAL_home": "2024-09-05", "BAL_KC_away": "2024-09-05",
            "PHI_GB_home": "2024-09-06", "GB_PHI_away": "2024-09-06",
            "ATL_PIT_home": "2024-09-08", "PIT_ATL_away": "2024-09-08",
            "BUF_ARI_home": "2024-09-08", "ARI_BUF_away": "2024-09-08",
            "CHI_TEN_home": "2024-09-08", "TEN_CHI_away": "2024-09-08",
            "CIN_NE_home": "2024-09-08", "NE_CIN_away": "2024-09-08",
            "IND_HOU_home": "2024-09-08", "HOU_IND_away": "2024-09-08",
            "MIA_JAX_home": "2024-09-08", "JAX_MIA_away": "2024-09-08",
            "NO_CAR_home": "2024-09-08", "CAR_NO_away": "2024-09-08",
            "NYG_MIN_home": "2024-09-08", "MIN_NYG_away": "2024-09-08",
            "LAC_LV_home": "2024-09-08", "LV_LAC_away": "2024-09-08",
            "SEA_DEN_home": "2024-09-08", "DEN_SEA_away": "2024-09-08",
            "CLE_DAL_home": "2024-09-08", "DAL_CLE_away": "2024-09-08",
            "TB_WAS_home": "2024-09-08", "WAS_TB_away": "2024-09-08",
            "DET_LAR_home": "2024-09-08", "LAR_DET_away": "2024-09-08",
            "SF_NYJ_home": "2024-09-09", "NYJ_SF_away": "2024-09-09",
            
            # Week 2 - September 12-16, 2024  
            "MIA_BUF_home": "2024-09-12", "BUF_MIA_away": "2024-09-12",
            "BAL_LV_home": "2024-09-15", "LV_BAL_away": "2024-09-15",
            "CAR_LAC_home": "2024-09-15", "LAC_CAR_away": "2024-09-15",
            "DAL_NO_home": "2024-09-15", "NO_DAL_away": "2024-09-15",
            "DET_TB_home": "2024-09-15", "TB_DET_away": "2024-09-15",
            "GB_IND_home": "2024-09-15", "IND_GB_away": "2024-09-15",
            "JAX_CLE_home": "2024-09-15", "CLE_JAX_away": "2024-09-15",
            "MIN_SF_home": "2024-09-15", "SF_MIN_away": "2024-09-15",
            "NE_SEA_home": "2024-09-15", "SEA_NE_away": "2024-09-15",
            "TEN_NYJ_home": "2024-09-15", "NYJ_TEN_away": "2024-09-15",
            "WAS_NYG_home": "2024-09-15", "NYG_WAS_away": "2024-09-15",
            "ARI_LAR_home": "2024-09-15", "LAR_ARI_away": "2024-09-15",
            "DEN_PIT_home": "2024-09-15", "PIT_DEN_away": "2024-09-15",
            "KC_CIN_home": "2024-09-15", "CIN_KC_away": "2024-09-15",
            "HOU_CHI_home": "2024-09-15", "CHI_HOU_away": "2024-09-15",
            "PHI_ATL_home": "2024-09-16", "ATL_PHI_away": "2024-09-16",
            
            # Key games from schedule - adding more based on database records
            "SEA_MIN_home": "2024-12-22", "MIN_SEA_away": "2024-12-22",  # Vikings 27 - Seahawks 24
            "DET_MIN_home": "2025-01-05", "MIN_DET_away": "2025-01-05",  # Lions 31 - Vikings 9
            "DAL_WAS_home": "2025-01-05", "WAS_DAL_away": "2025-01-05",  # Cowboys 19 - Commanders 23
            "PHI_WAS_home": "2024-11-14", "WAS_PHI_away": "2024-11-14",  # Eagles 26 - Commanders 18
            "IND_MIN_home": "2024-11-03", "MIN_IND_away": "2024-11-03",  # Vikings 21 - Colts 13
            "GB_MIN_home": "2024-12-29", "MIN_GB_away": "2024-12-29",   # Vikings 27 - Packers 25
            "CHI_MIN_home": "2024-12-16", "MIN_CHI_away": "2024-12-16", # Vikings 30 - Bears 12
            "PIT_WAS_home": "2024-11-10", "WAS_PIT_away": "2024-11-10", # Steelers 27 - Commanders 28
            "ATL_MIN_home": "2024-12-08", "MIN_ATL_away": "2024-12-08", # Vikings 42 - Falcons 21
            "ARI_MIN_home": "2024-12-01", "MIN_ARI_away": "2024-12-01", # Vikings 23 - Cardinals 22
            "JAX_MIN_home": "2024-11-10", "MIN_JAX_away": "2024-11-10", # Vikings 7 - Jaguars 12
            "ATL_WAS_home": "2024-12-29", "WAS_ATL_away": "2024-12-29", # Commanders 30 - Falcons 24
            "CHI_MIN_home": "2024-11-24", "MIN_CHI_away": "2024-11-24", # Vikings 27 - Bears 30
            "TEN_MIN_home": "2024-11-17", "MIN_TEN_away": "2024-11-17", # Vikings 13 - Titans 23
            "SF_BUF_home": "2024-12-01", "BUF_SF_away": "2024-12-01",   # Bills 35 - 49ers 10
            "DET_BUF_home": "2024-12-15", "BUF_DET_away": "2024-12-15", # Bills 42 - Lions 48
            "PHI_WAS_home": "2024-12-22", "WAS_PHI_away": "2024-12-22", # Commanders 36 - Eagles 33
            "NO_WAS_home": "2024-12-15", "WAS_NO_away": "2024-12-15",   # Commanders 19 - Saints 20
            "TEN_WAS_home": "2024-12-01", "WAS_TEN_away": "2024-12-01", # Commanders 42 - Titans 19
            
            # Additional key matchups from the data
            "KC_BUF_home": "2024-11-17", "BUF_KC_away": "2024-11-17",   # Bills 30 - Chiefs 21
            "LAC_BUF_home": "2024-12-15", "BUF_LAC_away": "2024-12-15", # Bills 42 - Chargers 17
            "NE_BUF_home": "2025-01-05", "BUF_NE_away": "2025-01-05",   # Patriots 23 - Bills 16
            "NYJ_BUF_home": "2024-12-29", "BUF_NYJ_away": "2024-12-29", # Bills 40 - Jets 14
            "TB_BUF_home": "2024-12-08", "BUF_TB_away": "2024-12-08",   # Bills 44 - Rams 42 (different game)
            
            # More from top database records
            "HOU_BUF_home": "2024-10-06", "BUF_HOU_away": "2024-10-06", # Texans 23 - Bills 20
            "TEN_BUF_home": "2024-10-20", "BUF_TEN_away": "2024-10-20", # Bills 34 - Titans 10
            "MIA_BUF_home": "2024-11-03", "BUF_MIA_away": "2024-11-03", # Bills 30 - Dolphins 27
            "IND_BUF_home": "2024-11-10", "BUF_IND_away": "2024-11-10", # Bills 20 - Colts 30
            "SEA_BUF_home": "2024-10-27", "BUF_SEA_away": "2024-10-27", # Bills 10 - Seahawks 31
            "NYJ_BUF_home": "2024-10-14", "BUF_NYJ_away": "2024-10-14", # Bills 20 - Jets 23
        }

    def update_nfl_dates_targeted(self):
        """Update NFL records using targeted mapping"""
        
        print("🏈 Targeted NFL Date Fix")
        print("="*50)
        print(f"📊 Using {len(self.game_mappings)} game mappings")
        
        # Get all NFL player game stats without dates
        result = self.supabase.table('player_game_stats').select('*').execute()
        
        if not result.data:
            print("❌ No records found")
            return 0
        
        # Get player team info
        players_result = self.supabase.table('players').select('id, team, sport').eq('sport', 'NFL').execute()
        player_teams = {p['id']: p['team'] for p in players_result.data}
        
        updated_count = 0
        checked_count = 0
        matched_keys = set()
        unmatched_keys = set()
        
        print("🔄 Processing NFL records...")
        
        for record in result.data:
            stats = record.get('stats', {})
            
            # Skip non-NFL or records that already have dates
            if stats.get('sport') != 'NFL' or stats.get('game_date'):
                continue
            
            checked_count += 1
            
            # Get game info
            player_team = player_teams.get(record['player_id'], '')
            opponent = stats.get('opponent', '')
            home_or_away = stats.get('home_or_away', '')
            
            if not all([player_team, opponent, home_or_away]):
                continue
            
            # Create lookup key
            lookup_key = f"{player_team}_{opponent}_{home_or_away}"
            
            if lookup_key in self.game_mappings:
                game_date = self.game_mappings[lookup_key]
                
                # Update the record
                updated_stats = stats.copy()
                updated_stats['game_date'] = game_date
                
                try:
                    self.supabase.table('player_game_stats').update({
                        'stats': updated_stats
                    }).eq('id', record['id']).execute()
                    
                    updated_count += 1
                    matched_keys.add(lookup_key)
                    
                    if updated_count % 500 == 0:
                        print(f"📊 Updated {updated_count} records...")
                        
                except Exception as e:
                    print(f"❌ Update error: {e}")
            else:
                unmatched_keys.add(lookup_key)
        
        print(f"\n✅ Updated {updated_count} out of {checked_count} NFL records")
        print(f"✅ Matched {len(matched_keys)} unique game types")
        print(f"⚠️ Unmatched {len(unmatched_keys)} unique game types")
        
        # Show top unmatched for debugging
        if unmatched_keys:
            print(f"\n⚠️ Top 15 unmatched keys:")
            for key in sorted(unmatched_keys)[:15]:
                print(f"   - {key}")
        
        return updated_count

    def verify_results(self):
        """Verify the final results"""
        print("\n" + "="*50)
        print("🔍 Final verification...")
        
        # Count NFL records with and without dates
        nfl_with_dates = self.supabase.table('player_game_stats').select('id', count='exact').match({
            'stats->>sport': 'NFL'
        }).not_.is_('stats->>game_date', 'null').execute()
        
        nfl_without_dates = self.supabase.table('player_game_stats').select('id', count='exact').match({
            'stats->>sport': 'NFL'
        }).is_('stats->>game_date', 'null').execute()
        
        print(f"✅ NFL records WITH dates: {nfl_with_dates.count}")
        print(f"❌ NFL records WITHOUT dates: {nfl_without_dates.count}")

if __name__ == "__main__":
    fixer = TargetedNFLFix()
    
    # Update the dates
    updated = fixer.update_nfl_dates_targeted()
    
    # Verify results
    fixer.verify_results()
    
    print(f"\n🎯 Successfully updated {updated} NFL game records!")
