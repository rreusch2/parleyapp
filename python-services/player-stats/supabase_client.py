#!/usr/bin/env python3
"""
Supabase Client for Player Stats Service
Handles database operations for player game stats
"""

import os
import json
from supabase import create_client, Client
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import uuid

class SupabasePlayerStatsClient:
    def __init__(self):
        # Load environment variables
        self.url = os.getenv('SUPABASE_URL')
        self.service_key = os.getenv('SUPABASE_SERVICE_KEY')
        
        if not self.url or not self.service_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required")
        
        # Create Supabase client with service role key for full access
        self.client: Client = create_client(self.url, self.service_key)
        print(f"✅ Connected to Supabase: {self.url[:50]}...")

    def get_or_create_player(self, player_data: Dict) -> Optional[str]:
        """Get existing player or create new one, return player_id"""
        try:
            # First, try to find existing player by external_player_id
            result = self.client.table('players').select('id').eq('external_player_id', player_data['external_player_id']).eq('sport', player_data['sport']).execute()
            
            if result.data:
                return result.data[0]['id']
            
            # Try to find by name and sport (fallback)
            result = self.client.table('players').select('id').eq('name', player_data['name']).eq('sport', player_data['sport']).execute()
            
            if result.data:
                # Update with external_player_id if missing
                player_id = result.data[0]['id']
                self.client.table('players').update({
                    'external_player_id': player_data['external_player_id'],
                    'team': player_data['team'],
                    'position': player_data['position'],
                    'active': player_data['active']
                }).eq('id', player_id).execute()
                return player_id
            
            # Create new player
            new_player = {
                'id': str(uuid.uuid4()),
                'external_player_id': player_data['external_player_id'],
                'name': player_data['name'],
                'team': player_data['team'],
                'sport': player_data['sport'],
                'position': player_data['position'],
                'active': player_data['active'],
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            result = self.client.table('players').insert(new_player).execute()
            
            if result.data:
                print(f"✅ Created new {player_data['sport']} player: {player_data['name']}")
                return result.data[0]['id']
            
        except Exception as e:
            print(f"❌ Error getting/creating player {player_data['name']}: {e}")
            return None

    def get_existing_game_dates(self, player_id: str, days_back: int = 30) -> List[str]:
        """Get existing game dates for a player to avoid duplicates"""
        try:
            # Get recent game dates
            cutoff_date = (datetime.utcnow() - timedelta(days=days_back)).isoformat()
            
            result = self.client.table('player_game_stats').select('stats').eq('player_id', player_id).gte('created_at', cutoff_date).execute()
            
            existing_dates = set()
            if result.data:
                for record in result.data:
                    if record['stats'] and 'game_date' in record['stats']:
                        existing_dates.add(record['stats']['game_date'])
            
            return list(existing_dates)
            
        except Exception as e:
            print(f"❌ Error getting existing game dates for player {player_id}: {e}")
            return []

    def insert_player_game_stats(self, player_id: str, game_stats: Dict) -> bool:
        """Insert player game stats record"""
        try:
            # Check if this game already exists
            game_date = game_stats.get('game_date')
            if game_date:
                existing = self.client.table('player_game_stats').select('id').eq('player_id', player_id).contains('stats', {'game_date': game_date}).execute()
                
                if existing.data:
                    print(f"⚠️ Game stats already exist for player {player_id} on {game_date}")
                    return True

            # Create game stats record
            game_record = {
                'id': str(uuid.uuid4()),
                'player_id': player_id,
                'stats': game_stats,
                'recent_games_count': len(game_stats),
                'minutes_played': game_stats.get('minutes'),
                'fantasy_points': None,
                'betting_results': {},
                'created_at': datetime.utcnow().isoformat()
            }
            
            result = self.client.table('player_game_stats').insert(game_record).execute()
            
            if result.data:
                return True
            else:
                print(f"❌ Failed to insert game stats for player {player_id}")
                return False
                
        except Exception as e:
            print(f"❌ Error inserting game stats: {e}")
            return False

    def update_player_trends_data(self, player_id: str, sport: str) -> bool:
        """Update player_trends_data table with calculated averages"""
        try:
            # Get recent 10 games for this player
            result = self.client.table('player_game_stats').select('stats').eq('player_id', player_id).order('created_at', desc=True).limit(10).execute()
            
            if not result.data:
                return False
            
            games = [record['stats'] for record in result.data if record['stats']]
            
            if not games:
                return False

            # Get player info for required fields
            player_result = self.client.table('players').select('name, team, position').eq('id', player_id).execute()
            player_info = player_result.data[0] if player_result.data else {}

            # Calculate averages based on sport
            trends_data = self._calculate_trends_data(games, sport)
            trends_data['player_id'] = player_id
            trends_data['player_name'] = player_info.get('name', 'Unknown')
            trends_data['team_name'] = player_info.get('team', 'Unknown')
            trends_data['position'] = player_info.get('position', 'Unknown')
            trends_data['sport_key'] = sport
            trends_data['games_played'] = len(games)
            trends_data['recent_games_count'] = len(games)
            trends_data['last_game_date'] = max(g.get('game_date', '') for g in games) if games else None
            trends_data['last_updated'] = datetime.utcnow().isoformat()

            # Upsert trends data
            result = self.client.table('player_trends_data').upsert(trends_data).execute()
            
            return bool(result.data)
            
        except Exception as e:
            print(f"❌ Error updating trends data for player {player_id}: {e}")
            return False

    def _calculate_trends_data(self, games: List[Dict], sport: str) -> Dict:
        """Calculate trend statistics from recent games"""
        trends = {
            'form_trend': 'stable',
            'trend_direction': 'neutral',
            'confidence_score': 0.0,
            'over_under_trends': {},
            'betting_value_score': 0.0
        }
        
        if sport == 'MLB':
            # MLB batting/pitching stats (match database column names)
            if games[0].get('type') == 'batting':
                trends.update({
                    'avg_hits': sum(g.get('hits', 0) for g in games) / len(games),
                    'avg_home_runs': sum(g.get('home_runs', 0) for g in games) / len(games),
                    'avg_rbis': sum(g.get('rbis', 0) for g in games) / len(games),
                    'avg_runs': sum(g.get('runs_scored', 0) for g in games) / len(games),  # Fixed column name
                    'avg_total_bases': sum(g.get('total_bases', 0) for g in games) / len(games),
                    'avg_stolen_bases': sum(g.get('stolen_bases', 0) for g in games) / len(games),
                    'avg_walks': sum(g.get('walks', 0) for g in games) / len(games),
                    'avg_strikeouts': sum(g.get('strikeouts', 0) for g in games) / len(games),
                    'batting_average': sum(g.get('batting_average', 0) for g in games) / len(games)
                })
            else:
                trends.update({
                    'avg_strikeouts_pitched': sum(g.get('strikeouts_pitched', 0) for g in games) / len(games),
                    'avg_hits_allowed': sum(g.get('hits_allowed', 0) for g in games) / len(games),
                    'avg_walks_allowed': sum(g.get('walks_allowed', 0) for g in games) / len(games),
                    'avg_earned_runs': sum(g.get('earned_runs', 0) for g in games) / len(games),
                    'avg_innings_pitched': sum(g.get('innings_pitched', 0) for g in games) / len(games),
                    'era': sum(g.get('earned_runs', 0) for g in games) / len(games)
                })
                
        elif sport in ['WNBA', 'NBA']:
            # Basketball stats
            trends.update({
                'avg_points': sum(g.get('points', 0) for g in games) / len(games),
                'avg_rebounds': sum(g.get('rebounds', 0) for g in games) / len(games),
                'avg_assists': sum(g.get('assists', 0) for g in games) / len(games),
                'avg_steals': sum(g.get('steals', 0) for g in games) / len(games),
                'avg_blocks': sum(g.get('blocks', 0) for g in games) / len(games),
                'avg_turnovers': sum(g.get('turnovers', 0) for g in games) / len(games),
                'avg_three_pointers': sum(g.get('three_pointers', 0) for g in games) / len(games),
                'avg_minutes': sum(g.get('minutes', 0) for g in games) / len(games),
                'field_goal_percentage': sum(g.get('field_goal_percentage', 0) for g in games) / len(games),
                'three_point_percentage': sum(g.get('three_point_percentage', 0) for g in games) / len(games)
            })

        return trends

    def get_all_active_players(self, sport: str) -> List[Dict]:
        """Get all active players for a sport"""
        try:
            result = self.client.table('players').select('*').eq('sport', sport).eq('active', True).execute()
            return result.data if result.data else []
        except Exception as e:
            print(f"❌ Error getting active players for {sport}: {e}")
            return []

    def bulk_insert_players(self, players: List[Dict]) -> bool:
        """Bulk insert multiple players"""
        try:
            # Add UUIDs and timestamps
            for player in players:
                player['id'] = str(uuid.uuid4())
                player['created_at'] = datetime.utcnow().isoformat()
                player['updated_at'] = datetime.utcnow().isoformat()
            
            result = self.client.table('players').insert(players).execute()
            
            if result.data:
                print(f"✅ Bulk inserted {len(players)} players")
                return True
            
        except Exception as e:
            print(f"❌ Error bulk inserting players: {e}")
            
        return False

    def get_player_by_external_id(self, external_id: str, sport: str) -> Optional[Dict]:
        """Get player by external ID and sport"""
        try:
            result = self.client.table('players').select('*').eq('external_player_id', external_id).eq('sport', sport).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"❌ Error getting player by external ID {external_id}: {e}")
            return None

    def find_player_by_name_team(self, name: str, team: str, sport: str) -> Optional[Dict]:
        """Find player by name, team, and sport"""
        try:
            # Try exact name match first
            result = self.client.table('players').select('*').eq('name', name).eq('sport', sport).execute()
            
            # If multiple results, filter by team
            if result.data:
                if len(result.data) == 1:
                    return result.data[0]
                
                # Multiple players with same name, filter by team
                for player in result.data:
                    if player.get('team') == team:
                        return player
                
                # Return first match if no team match
                return result.data[0]
            
            return None
            
        except Exception as e:
            print(f"❌ Error finding player {name}: {e}")
            return None

    def update_player_external_id(self, player_id: str, external_id: str) -> bool:
        """Update player's external_player_id"""
        try:
            result = self.client.table('players').update({
                'external_player_id': external_id,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', player_id).execute()
            
            return bool(result.data)
            
        except Exception as e:
            print(f"❌ Error updating external ID for player {player_id}: {e}")
            return False


if __name__ == "__main__":
    # Test the client
    client = SupabasePlayerStatsClient()
    
    # Test getting active MLB players
    mlb_players = client.get_all_active_players('MLB')
    print(f"Active MLB players: {len(mlb_players)}")
    
    if mlb_players:
        player = mlb_players[0]
        print(f"Sample player: {player['name']} - {player['team']}")
