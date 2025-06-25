import os
from supabase import create_client, Client
from datetime import datetime, timedelta
import json
from typing import Dict, List, Any
import statistics

# Initialize Supabase client
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

class PropBetAnalyzer:
    def __init__(self):
        self.prop_types = {
            'hits': [0.5, 1.5, 2.5],  # Common O/U lines for hits
            'home_runs': [0.5, 1.5],  # HR props
            'walks': [0.5, 1.5],      # Walk props
            'strikeouts': [1.5, 2.5], # K props
            'total_bases': [1.5, 2.5, 3.5], # Total bases
        }
    
    def get_player_historical_data(self, player_id: str, days_back: int = 30) -> List[Dict]:
        """Get historical data for a player to calculate their averages"""
        try:
            # Get historical data (not including last 14 days for fair comparison)
            cutoff_date = (datetime.now() - timedelta(days=14)).strftime('%Y-%m-%d')
            historical_cutoff = (datetime.now() - timedelta(days=days_back + 14)).strftime('%Y-%m-%d')
            
            response = supabase.table('player_game_stats').select('*').eq('player_id', player_id).gte('stats->>game_date', historical_cutoff).lt('stats->>game_date', cutoff_date).execute()
            
            return response.data
        except Exception as e:
            print(f"Error getting historical data for player {player_id}: {e}")
            return []
    
    def calculate_total_bases(self, stats: Dict) -> int:
        """Calculate total bases from hits data"""
        hits = int(stats.get('hits', 0))
        doubles = stats.get('events', []).count('double')
        triples = stats.get('events', []).count('triple') 
        home_runs = int(stats.get('home_runs', 0))
        
        singles = hits - doubles - triples - home_runs
        return singles + (doubles * 2) + (triples * 3) + (home_runs * 4)
    
    def get_player_averages(self, player_id: str) -> Dict[str, float]:
        """Calculate a player's historical averages"""
        historical_data = self.get_player_historical_data(player_id)
        
        if not historical_data:
            # Return league averages as fallback
            return {
                'hits': 1.0,
                'home_runs': 0.3,
                'walks': 0.8,
                'strikeouts': 1.5,
                'total_bases': 1.8
            }
        
        averages = {}
        for prop in ['hits', 'home_runs', 'walks', 'strikeouts']:
            values = []
            for game in historical_data:
                if game['stats'] and prop in game['stats']:
                    values.append(float(game['stats'][prop]))
            
            averages[prop] = statistics.mean(values) if values else 0.0
        
        # Calculate total bases average
        tb_values = []
        for game in historical_data:
            if game['stats']:
                tb = self.calculate_total_bases(game['stats'])
                tb_values.append(tb)
        
        averages['total_bases'] = statistics.mean(tb_values) if tb_values else 0.0
        
        return averages
    
    def analyze_prop_performance(self, actual_stats: Dict, player_averages: Dict) -> Dict:
        """Analyze if a player hit various prop bets based on their averages"""
        results = {}
        
        # Get actual game stats
        actual_hits = int(actual_stats.get('hits', 0))
        actual_hrs = int(actual_stats.get('home_runs', 0))
        actual_walks = int(actual_stats.get('walks', 0))
        actual_ks = int(actual_stats.get('strikeouts', 0))
        actual_tb = self.calculate_total_bases(actual_stats)
        
        # Analyze each prop type
        for prop, lines in self.prop_types.items():
            results[prop] = {}
            
            if prop == 'hits':
                actual_value = actual_hits
            elif prop == 'home_runs':
                actual_value = actual_hrs
            elif prop == 'walks':
                actual_value = actual_walks
            elif prop == 'strikeouts':
                actual_value = actual_ks
            elif prop == 'total_bases':
                actual_value = actual_tb
            
            # For each common line, determine if it hit
            for line in lines:
                # Use player's average to determine "expected" line
                player_avg = player_averages.get(prop, line)
                
                # Create dynamic line based on player's performance
                # If player avg is much higher/lower than standard line, adjust
                if player_avg > line + 0.5:
                    adjusted_line = player_avg - 0.2  # Set line slightly below their average
                elif player_avg < line - 0.5:
                    adjusted_line = player_avg + 0.2  # Set line slightly above their average  
                else:
                    adjusted_line = line
                
                results[prop][f'o{adjusted_line}'] = {
                    'line': adjusted_line,
                    'actual': actual_value,
                    'result': 'W' if actual_value > adjusted_line else 'L',
                    'player_avg': player_avg
                }
                
                results[prop][f'u{adjusted_line}'] = {
                    'line': adjusted_line,
                    'actual': actual_value,
                    'result': 'W' if actual_value < adjusted_line else 'L',
                    'player_avg': player_avg
                }
        
        return results
    
    def update_betting_results(self):
        """Update betting_results for all games in the last 14 days"""
        try:
            # Get all games from last 14 days
            cutoff_date = (datetime.now() - timedelta(days=14)).strftime('%Y-%m-%d')
            
            response = supabase.table('player_game_stats').select('*').gte('stats->>game_date', cutoff_date).execute()
            
            games = response.data
            print(f"Found {len(games)} games to analyze")
            
            updated_count = 0
            
            for game in games:
                if not game['stats']:
                    continue
                
                player_id = game['player_id']
                
                # Get player's historical averages
                player_averages = self.get_player_averages(player_id)
                
                # Analyze prop performance
                prop_results = self.analyze_prop_performance(game['stats'], player_averages)
                
                # Update the betting_results column
                supabase.table('player_game_stats').update({
                    'betting_results': prop_results
                }).eq('id', game['id']).execute()
                
                updated_count += 1
                
                if updated_count % 50 == 0:
                    print(f"Updated {updated_count} games...")
            
            print(f"Successfully updated {updated_count} games with prop bet analysis")
            
        except Exception as e:
            print(f"Error updating betting results: {e}")
    
    def get_player_prop_summary(self, player_id: str) -> Dict:
        """Get a summary of how a player performed on props in the last 14 days"""
        try:
            cutoff_date = (datetime.now() - timedelta(days=14)).strftime('%Y-%m-%d')
            
            response = supabase.table('player_game_stats').select('*').eq('player_id', player_id).gte('stats->>game_date', cutoff_date).execute()
            
            games = response.data
            
            if not games:
                return {"error": "No games found for this player"}
            
            # Aggregate prop results
            prop_summary = {}
            
            for game in games:
                if not game.get('betting_results'):
                    continue
                
                betting_results = game['betting_results']
                
                for prop, lines in betting_results.items():
                    if prop not in prop_summary:
                        prop_summary[prop] = {'total_bets': 0, 'wins': 0, 'losses': 0}
                    
                    for line_key, result in lines.items():
                        prop_summary[prop]['total_bets'] += 1
                        if result['result'] == 'W':
                            prop_summary[prop]['wins'] += 1
                        else:
                            prop_summary[prop]['losses'] += 1
            
            # Calculate win percentages
            for prop in prop_summary:
                total = prop_summary[prop]['total_bets']
                wins = prop_summary[prop]['wins']
                prop_summary[prop]['win_percentage'] = (wins / total * 100) if total > 0 else 0
            
            return prop_summary
            
        except Exception as e:
            print(f"Error getting player prop summary: {e}")
            return {"error": str(e)}

def main():
    analyzer = PropBetAnalyzer()
    
    print("Starting prop bet analysis for last 14 days...")
    analyzer.update_betting_results()
    
    print("\nAnalysis complete! The betting_results column now contains:")
    print("- Prop bet results based on each player's historical averages")
    print("- Over/Under results for hits, home runs, walks, strikeouts, and total bases")
    print("- Win/Loss status for each prop")
    
    # Example: Get summary for first player
    response = supabase.table('player_game_stats').select('player_id').limit(1).execute()
    if response.data:
        example_player = response.data[0]['player_id']
        summary = analyzer.get_player_prop_summary(example_player)
        print(f"\nExample player summary: {json.dumps(summary, indent=2)}")

if __name__ == "__main__":
    main() 