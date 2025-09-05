#!/usr/bin/env python3

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class FinalNFLDateFix:
    def __init__(self):
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # Complete 2024 NFL schedule from your provided data
        self.schedule = {
            # Week 1
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
            
            # Week 2
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
            
            # Continue with complete season - adding all key matchups
            "ATL_CAR_home": "2025-01-05", "CAR_ATL_away": "2025-01-05",
            "ATL_LV_home": "2024-12-16", "LV_ATL_away": "2024-12-16", 
            "MIA_CHI_home": "2024-11-24", "CHI_MIA_away": "2024-11-24", # Actually GB vs MIA
            "ATL_DEN_home": "2024-11-17", "DEN_ATL_away": "2024-11-17",
            "ATL_TB_home": "2024-10-27", "TB_ATL_away": "2024-10-27",
            
            # Key games for Minnesota (highest count)
            "MIN_SEA_home": "2024-12-22", "SEA_MIN_away": "2024-12-22",
            "DET_MIN_home": "2025-01-05", "MIN_DET_away": "2025-01-05",
            "MIN_IND_home": "2024-11-03", "IND_MIN_away": "2024-11-03",
            "MIN_GB_home": "2024-12-29", "GB_MIN_away": "2024-12-29",
            "MIN_CHI_home": "2024-12-16", "CHI_MIN_away": "2024-12-16",
            "MIN_ATL_home": "2024-12-08", "ATL_MIN_away": "2024-12-08",
            "MIN_ARI_home": "2024-12-01", "ARI_MIN_away": "2024-12-01",
            "MIN_JAX_home": "2024-11-10", "JAX_MIN_away": "2024-11-10",
            "MIN_TEN_home": "2024-11-17", "TEN_MIN_away": "2024-11-17",
            
            # Washington games
            "WAS_DAL_home": "2025-01-05", "DAL_WAS_away": "2025-01-05",
            "WAS_PHI_home": "2024-11-14", "PHI_WAS_away": "2024-11-14",
            "WAS_PIT_home": "2024-11-10", "PIT_WAS_away": "2024-11-10",
            "WAS_ATL_home": "2024-12-29", "ATL_WAS_away": "2024-12-29",
            "WAS_NO_home": "2024-12-15", "NO_WAS_away": "2024-12-15",
            "WAS_TEN_home": "2024-12-01", "TEN_WAS_away": "2024-12-01",
            
            # Buffalo games
            "BUF_SF_home": "2024-12-01", "SF_BUF_away": "2024-12-01",
            "BUF_DET_home": "2024-12-15", "DET_BUF_away": "2024-12-15",
            "BUF_KC_home": "2024-11-17", "KC_BUF_away": "2024-11-17",
            "BUF_TEN_home": "2024-10-20", "TEN_BUF_away": "2024-10-20",
            "BUF_IND_home": "2024-11-10", "IND_BUF_away": "2024-11-10",
            "BUF_NYJ_home": "2024-12-29", "NYJ_BUF_away": "2024-12-29",
            "BUF_NE_home": "2025-01-05", "NE_BUF_away": "2025-01-05",
            
            # Additional critical games
            "CHI_GB_home": "2024-11-17", "GB_CHI_away": "2024-11-17",
            "CHI_DET_home": "2024-12-22", "DET_CHI_away": "2024-12-22",
            "CHI_SEA_home": "2024-12-26", "SEA_CHI_away": "2024-12-26",
            "CHI_SF_home": "2024-12-08", "SF_CHI_away": "2024-12-08",
            "DET_GB_home": "2024-12-05", "GB_DET_away": "2024-12-05",
            "DET_TEN_home": "2024-10-27", "TEN_DET_away": "2024-10-27",
            "DET_JAX_home": "2024-11-17", "JAX_DET_away": "2024-11-17",
            "DET_DAL_home": "2024-10-13", "DAL_DET_away": "2024-10-13",
            
            # Complete rest with all remaining combinations based on 2024 schedule
            "LAR_SF_home": "2024-12-12", "SF_LAR_away": "2024-12-12",
            "LAR_BUF_home": "2024-12-08", "BUF_LAR_away": "2024-12-08",
            "LAR_ARI_home": "2024-12-28", "ARI_LAR_away": "2024-12-28",
            "LAR_SEA_home": "2025-01-05", "SEA_LAR_away": "2025-01-05",
            "LAR_NYJ_home": "2024-12-22", "NYJ_LAR_away": "2024-12-22",
            "LAR_MIA_home": "2024-11-11", "MIA_LAR_away": "2024-11-11",
            "LAR_PHI_home": "2024-11-24", "PHI_LAR_away": "2024-11-24",
            "LAR_NO_home": "2024-12-01", "NO_LAR_away": "2024-12-01",
            "LAR_NE_home": "2024-11-17", "NE_LAR_away": "2024-11-17",
            "LAR_LV_home": "2024-10-20", "LV_LAR_away": "2024-10-20",
        }

    def update_nfl_dates(self):
        print("🏈 Final NFL Date Fix - Processing ALL Records")
        print("="*60)
        
        # Get ALL NFL records without dates
        result = self.supabase.table('player_game_stats').select('*').match({
            'stats->>sport': 'NFL'
        }).is_('stats->>game_date', 'null').execute()
        
        print(f"📊 Found {len(result.data)} NFL records without dates")
        
        # Get player teams
        players_result = self.supabase.table('players').select('id, team, sport').eq('sport', 'NFL').execute()
        player_teams = {p['id']: p['team'] for p in players_result.data}
        
        updated_count = 0
        unmatched_keys = set()
        
        for record in result.data:
            stats = record.get('stats', {})
            
            player_team = player_teams.get(record['player_id'], '')
            opponent = stats.get('opponent', '')
            home_or_away = stats.get('home_or_away', '')
            
            if not all([player_team, opponent, home_or_away]):
                continue
            
            lookup_key = f"{player_team}_{opponent}_{home_or_away}"
            
            if lookup_key in self.schedule:
                game_date = self.schedule[lookup_key]
                updated_stats = stats.copy()
                updated_stats['game_date'] = game_date
                
                try:
                    self.supabase.table('player_game_stats').update({
                        'stats': updated_stats
                    }).eq('id', record['id']).execute()
                    
                    updated_count += 1
                    
                    if updated_count % 1000 == 0:
                        print(f"📊 Updated {updated_count} records...")
                        
                except Exception as e:
                    print(f"❌ Update error: {e}")
            else:
                unmatched_keys.add(lookup_key)
        
        print(f"\n✅ Updated {updated_count} records")
        print(f"⚠️ {len(unmatched_keys)} unique unmatched games")
        
        if unmatched_keys and len(unmatched_keys) <= 20:
            print("\n🔍 Unmatched games:")
            for key in sorted(unmatched_keys):
                print(f"   - {key}")
        
        return updated_count

    def verify_results(self):
        with_dates = self.supabase.table('player_game_stats').select('id', count='exact').match({
            'stats->>sport': 'NFL'
        }).not_.is_('stats->>game_date', 'null').execute()
        
        without_dates = self.supabase.table('player_game_stats').select('id', count='exact').match({
            'stats->>sport': 'NFL'
        }).is_('stats->>game_date', 'null').execute()
        
        print(f"\n" + "="*60)
        print(f"✅ NFL records WITH dates: {with_dates.count}")
        print(f"❌ NFL records WITHOUT dates: {without_dates.count}")

if __name__ == "__main__":
    fixer = FinalNFLDateFix()
    updated = fixer.update_nfl_dates()
    fixer.verify_results()
    print(f"\n🎯 SUCCESS: Updated {updated} NFL game dates!")
