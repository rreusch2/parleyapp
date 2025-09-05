#!/usr/bin/env python3

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class CompleteNFL2024Fixer:
    def __init__(self):
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # Complete 2024 NFL schedule mapping - all games
        self.mappings = self._build_complete_mappings()

    def _build_complete_mappings(self):
        """Build complete game mappings from your provided schedule"""
        games = {}
        
        # Week 1 (Sep 5-9)
        week1 = [
            ("2024-09-05", [("KC", "BAL")]),
            ("2024-09-06", [("PHI", "GB")]),
            ("2024-09-08", [("ATL", "PIT"), ("BUF", "ARI"), ("CHI", "TEN"), ("CIN", "NE"), 
                           ("IND", "HOU"), ("MIA", "JAX"), ("NO", "CAR"), ("NYG", "MIN"),
                           ("LAC", "LV"), ("SEA", "DEN"), ("CLE", "DAL"), ("TB", "WAS"), ("DET", "LAR")]),
            ("2024-09-09", [("SF", "NYJ")])
        ]
        
        # Week 2 (Sep 12-16)
        week2 = [
            ("2024-09-12", [("MIA", "BUF")]),
            ("2024-09-15", [("BAL", "LV"), ("CAR", "LAC"), ("DAL", "NO"), ("DET", "TB"),
                           ("GB", "IND"), ("JAX", "CLE"), ("MIN", "SF"), ("NE", "SEA"),
                           ("TEN", "NYJ"), ("WAS", "NYG"), ("ARI", "LAR"), ("DEN", "PIT"),
                           ("KC", "CIN"), ("HOU", "CHI")]),
            ("2024-09-16", [("PHI", "ATL")])
        ]
        
        # Week 3 (Sep 19-23)
        week3 = [
            ("2024-09-19", [("NYJ", "NE")]),
            ("2024-09-22", [("CLE", "NYG"), ("IND", "CHI"), ("MIN", "HOU"), ("NO", "PHI"),
                           ("PIT", "LAC"), ("TB", "DEN"), ("TEN", "GB"), ("LV", "CAR"),
                           ("SEA", "MIA"), ("ARI", "DET"), ("DAL", "BAL"), ("LAR", "SF"), ("ATL", "KC")]),
            ("2024-09-23", [("BUF", "JAX"), ("CIN", "WAS")])
        ]
        
        # Add more weeks systematically
        additional_games = [
            # Week 4-18 and playoffs - key matchups from your data
            ("2024-09-26", [("NYG", "DAL")]),
            ("2024-09-29", [("ATL", "NO"), ("CAR", "CIN"), ("CHI", "LAR"), ("GB", "MIN"),
                           ("HOU", "JAX"), ("IND", "PIT"), ("NYJ", "DEN"), ("TB", "PHI"),
                           ("ARI", "WAS"), ("SF", "NE"), ("LAC", "KC"), ("LV", "CLE"), ("BAL", "BUF")]),
            ("2024-09-30", [("MIA", "TEN"), ("DET", "SEA")]),
            ("2024-10-03", [("ATL", "TB")]),
            ("2024-10-06", [("MIN", "NYJ"), ("CHI", "CAR"), ("CIN", "BAL"), ("HOU", "BUF"),
                           ("JAX", "IND"), ("NE", "MIA"), ("WAS", "CLE"), ("DEN", "LV"),
                           ("SF", "ARI"), ("LAR", "GB"), ("SEA", "NYG"), ("PIT", "DAL")]),
            ("2024-10-07", [("KC", "NO")]),
            ("2024-10-10", [("SEA", "SF")]),
            ("2024-10-13", [("CHI", "JAX"), ("BAL", "WAS"), ("GB", "ARI"), ("NE", "HOU"),
                           ("NO", "TB"), ("PHI", "CLE"), ("TEN", "IND"), ("LAC", "DEN"),
                           ("PIT", "LV"), ("CAR", "ATL"), ("DET", "DAL"), ("NYG", "CIN")]),
            ("2024-10-14", [("NYJ", "BUF")]),
            ("2024-10-17", [("NO", "DEN")]),
            ("2024-10-20", [("JAX", "NE"), ("ATL", "SEA"), ("BUF", "TEN"), ("CIN", "CLE"),
                           ("HOU", "GB"), ("MIA", "IND"), ("DET", "MIN"), ("NYG", "PHI"),
                           ("LAR", "LV"), ("WAS", "CAR"), ("SF", "KC"), ("PIT", "NYJ")]),
            ("2024-10-21", [("TB", "BAL"), ("ARI", "LAC")]),
            ("2024-10-24", [("LAR", "MIN")]),
            ("2024-10-27", [("CIN", "PHI"), ("CLE", "BAL"), ("DET", "TEN"), ("HOU", "IND"),
                           ("JAX", "GB"), ("MIA", "ARI"), ("NE", "NYJ"), ("TB", "ATL"),
                           ("LAC", "NO"), ("SEA", "BUF"), ("DEN", "CAR"), ("LV", "KC"),
                           ("WAS", "CHI"), ("SF", "DAL")]),
            ("2024-10-28", [("PIT", "NYG")]),
            ("2024-10-31", [("NYJ", "HOU")]),
            ("2024-11-03", [("ATL", "DAL"), ("BAL", "DEN"), ("BUF", "MIA"), ("CAR", "NO"),
                           ("CIN", "LV"), ("CLE", "LAC"), ("NYG", "WAS"), ("TEN", "NE"),
                           ("ARI", "CHI"), ("PHI", "JAX"), ("GB", "DET"), ("SEA", "LAR"), ("MIN", "IND")]),
            ("2024-11-04", [("KC", "TB")]),
            ("2024-11-07", [("BAL", "CIN")]),
            ("2024-11-10", [("CAR", "NYG"), ("CHI", "NE"), ("IND", "BUF"), ("JAX", "MIN"),
                           ("KC", "DEN"), ("NO", "ATL"), ("TB", "SF"), ("WAS", "PIT"),
                           ("LAC", "TEN"), ("ARI", "NYJ"), ("DAL", "PHI"), ("HOU", "DET")]),
            ("2024-11-11", [("LAR", "MIA")]),
            ("2024-11-14", [("PHI", "WAS")]),
            ("2024-11-17", [("CHI", "GB"), ("DET", "JAX"), ("MIA", "LV"), ("NE", "LAR"),
                           ("NO", "CLE"), ("NYJ", "IND"), ("PIT", "BAL"), ("TEN", "MIN"),
                           ("DEN", "ATL"), ("SF", "SEA"), ("BUF", "KC"), ("LAC", "CIN")]),
            ("2024-11-18", [("DAL", "HOU")]),
            ("2024-11-21", [("CLE", "PIT")]),
            ("2024-11-24", [("CAR", "KC"), ("CHI", "MIN"), ("HOU", "TEN"), ("IND", "DET"),
                           ("MIA", "NE"), ("NYG", "TB"), ("WAS", "DAL"), ("LV", "DEN"),
                           ("GB", "SF"), ("SEA", "ARI"), ("LAR", "PHI")]),
            ("2024-11-25", [("LAC", "BAL")]),
            ("2024-11-28", [("DET", "CHI"), ("DAL", "NYG"), ("GB", "MIA")]),
            ("2024-11-29", [("KC", "LV")]),
            ("2024-12-01", [("ATL", "LAC"), ("CIN", "PIT"), ("JAX", "HOU"), ("MIN", "ARI"),
                           ("NE", "IND"), ("NYJ", "SEA"), ("WAS", "TEN"), ("CAR", "TB"),
                           ("NO", "LAR"), ("BAL", "PHI"), ("BUF", "SF")]),
            ("2024-12-02", [("DEN", "CLE")]),
            ("2024-12-05", [("DET", "GB")]),
            ("2024-12-08", [("MIA", "NYJ"), ("MIN", "ATL"), ("NYG", "NO"), ("PHI", "CAR"),
                           ("PIT", "CLE"), ("TB", "LV"), ("TEN", "JAX"), ("ARI", "SEA"),
                           ("LAR", "BUF"), ("SF", "CHI"), ("KC", "LAC")]),
            ("2024-12-09", [("DAL", "CIN")]),
            ("2024-12-12", [("SF", "LAR")]),
            ("2024-12-15", [("CAR", "DAL"), ("CLE", "KC"), ("HOU", "MIA"), ("JAX", "NYJ"),
                           ("NO", "WAS"), ("NYG", "BAL"), ("TEN", "CIN"), ("ARI", "NE"),
                           ("DEN", "IND"), ("DET", "BUF"), ("LAC", "TB"), ("PHI", "PIT"), ("SEA", "GB")]),
            ("2024-12-16", [("MIN", "CHI"), ("LV", "ATL")]),
            ("2024-12-19", [("LAC", "DEN")]),
            ("2024-12-21", [("KC", "HOU"), ("BAL", "PIT")]),
            ("2024-12-22", [("ATL", "NYG"), ("CAR", "ARI"), ("CHI", "DET"), ("CIN", "CLE"),
                           ("IND", "TEN"), ("NYJ", "LAR"), ("WAS", "PHI"), ("SEA", "MIN"),
                           ("BUF", "NE"), ("LV", "JAX"), ("MIA", "SF"), ("DAL", "TB")]),
            ("2024-12-23", [("GB", "NO")]),
            ("2024-12-25", [("PIT", "KC"), ("HOU", "BAL")]),
            ("2024-12-26", [("CHI", "SEA")]),
            ("2024-12-28", [("NE", "LAC"), ("CIN", "DEN"), ("LAR", "ARI")]),
            ("2024-12-29", [("BUF", "NYJ"), ("JAX", "TEN"), ("NO", "LV"), ("NYG", "IND"),
                           ("PHI", "DAL"), ("TB", "CAR"), ("CLE", "MIA"), ("MIN", "GB"), ("WAS", "ATL")]),
            ("2024-12-30", [("SF", "DET")]),
            ("2025-01-04", [("BAL", "CLE"), ("PIT", "CIN")]),
            ("2025-01-05", [("ATL", "CAR"), ("DAL", "WAS"), ("GB", "CHI"), ("IND", "JAX"),
                           ("NE", "BUF"), ("PHI", "NYG"), ("TB", "NO"), ("TEN", "HOU"),
                           ("ARI", "SF"), ("DEN", "KC"), ("LAR", "SEA"), ("LV", "LAC"),
                           ("NYJ", "MIA"), ("DET", "MIN")]),
            # Playoffs
            ("2025-01-11", [("LAC", "HOU"), ("PIT", "BAL")]),
            ("2025-01-12", [("DEN", "BUF"), ("GB", "PHI"), ("WAS", "TB")]),
            ("2025-01-13", [("MIN", "LAR")]),
            ("2025-01-18", [("HOU", "KC"), ("WAS", "DET")]),
            ("2025-01-19", [("LAR", "PHI"), ("BAL", "BUF")]),
            ("2025-01-26", [("WAS", "PHI"), ("BUF", "KC")]),
            ("2025-02-09", [("KC", "PHI")])
        ]
        
        # Process all games into mapping
        all_weeks = week1 + week2 + week3 + additional_games
        
        for date, day_games in all_weeks:
            for home, away in day_games:
                games[f"{home}_{away}_home"] = date
                games[f"{away}_{home}_away"] = date
        
        return games

    def update_all_nfl_dates(self):
        print(f"🏈 Complete 2024 NFL Schedule Updater")
        print(f"📊 Using {len(self.mappings)} game mappings")
        
        result = self.supabase.table('player_game_stats').select('*').execute()
        players_result = self.supabase.table('players').select('id, team, sport').eq('sport', 'NFL').execute()
        player_teams = {p['id']: p['team'] for p in players_result.data}
        
        updated_count = 0
        checked_count = 0
        
        for record in result.data:
            stats = record.get('stats', {})
            
            if stats.get('sport') != 'NFL' or stats.get('game_date'):
                continue
            
            checked_count += 1
            
            player_team = player_teams.get(record['player_id'], '')
            opponent = stats.get('opponent', '')
            home_or_away = stats.get('home_or_away', '')
            
            if not all([player_team, opponent, home_or_away]):
                continue
            
            lookup_key = f"{player_team}_{opponent}_{home_or_away}"
            
            if lookup_key in self.mappings:
                game_date = self.mappings[lookup_key]
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
        
        print(f"✅ Updated {updated_count} out of {checked_count} NFL records")
        return updated_count

    def verify_results(self):
        nfl_with_dates = self.supabase.table('player_game_stats').select('id', count='exact').match({
            'stats->>sport': 'NFL'
        }).not_.is_('stats->>game_date', 'null').execute()
        
        nfl_without_dates = self.supabase.table('player_game_stats').select('id', count='exact').match({
            'stats->>sport': 'NFL'
        }).is_('stats->>game_date', 'null').execute()
        
        print(f"\n✅ NFL records WITH dates: {nfl_with_dates.count}")
        print(f"❌ NFL records WITHOUT dates: {nfl_without_dates.count}")

if __name__ == "__main__":
    fixer = CompleteNFL2024Fixer()
    updated = fixer.update_all_nfl_dates()
    fixer.verify_results()
    print(f"\n🎯 Updated {updated} NFL records with 2024 dates!")
