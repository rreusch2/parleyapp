#!/usr/bin/env python3
"""
NFL Database Updater - Updates missing player stats in Supabase
Uses ESPN API to get individual game stats for offensive players + kickers
"""

import requests
import json
import time
from datetime import datetime
import logging
import os
import sys
import uuid
import hashlib
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/Users/rreusch2/parleyapp/.env')

# Add the parent directory to the Python path to import Supabase client
sys.path.append('/Users/rreusch2/parleyapp/python-services/player-stats')

try:
    from supabase_client import SupabasePlayerStatsClient
    print("✅ Successfully imported Supabase client")
except ImportError as e:
    print(f"❌ Failed to import Supabase client: {e}")
    print("Make sure you have the supabase-py package installed: pip install supabase")
    sys.exit(1)

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NFLDatabaseUpdater:
    def __init__(self):
        self.base_url = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        self.supabase = SupabasePlayerStatsClient()
        
        # ESPN stat name mapping to our database format
        self.espn_stat_names = [
            "completions", "passingAttempts", "passingYards", "completionPct", 
            "yardsPerPassAttempt", "passingTouchdowns", "interceptions", "longPassing",
            "sacks", "QBRating", "adjQBR", "rushingAttempts", "rushingYards", 
            "yardsPerRushAttempt", "rushingTouchdowns", "longRushing"
        ]
        
        # Target positions for offensive players + kickers
        self.target_positions = ['QB', 'RB', 'WR', 'TE', 'K', 'FB']
        
    def get_espn_player_data(self, espn_player_id):
        """Get player's gamelog from ESPN"""
        url = f"{self.base_url}/athletes/{espn_player_id}/gamelog"
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get data for ESPN player {espn_player_id}: {e}")
            return None
    
    def parse_espn_game_stats(self, espn_data):
        """Parse ESPN gamelog data into individual game stats"""
        if not espn_data or 'events' not in espn_data:
            logger.warning("No events found in ESPN data")
            return []
        
        # Simplified logging - remove debug clutter
        logger.info(f"🔍 Parsing ESPN data with {len(espn_data.get('seasonTypes', []))} season types")
        
        game_stats = []
        
        # Look through seasonTypes -> categories -> events for individual game stats
        for section in espn_data.get('seasonTypes', []):
            # Check direct events (if any)
            if 'events' in section:
                pass  # Remove excessive logging
                
                for event in section['events']:
                    if 'eventId' in event and 'stats' in event:
                        pass  # Remove excessive logging
                        stats = self.map_espn_stats_to_db(event['stats'])
                        if stats:
                            # Get game info from the main events dictionary
                            event_id = event['eventId']
                            game_info = espn_data['events'].get(event_id, {})
                            
                            stats.update({
                                'espn_game_id': event_id,
                                'week': game_info.get('week'),
                                'game_date': game_info.get('gameDate'),
                                'opponent': game_info.get('opponent', {}).get('abbreviation'),
                                'game_result': game_info.get('gameResult'),
                                'score': game_info.get('score')
                            })
                            game_stats.append(stats)
                            logger.info(f"✅ Found game: Week {stats.get('week')} vs {stats.get('opponent')}")
                        else:
                            logger.warning(f"Failed to map stats for event {event['eventId']}")
                    else:
                        pass  # Remove excessive logging
            
            # Check categories for events (THIS IS THE KEY!)
            if 'categories' in section:
                for category in section['categories']:
                    if 'events' in category:
                        pass  # Remove excessive logging
                        
                        for event in category['events']:
                            if 'eventId' in event and 'stats' in event:
                                pass  # Remove excessive logging
                                stats = self.map_espn_stats_to_db(event['stats'])
                                if stats:
                                    # Get game info from the main events dictionary
                                    event_id = event['eventId']
                                    game_info = espn_data['events'].get(event_id, {})
                                    
                                    stats.update({
                                        'espn_game_id': event_id,
                                        'week': game_info.get('week'),
                                        'game_date': game_info.get('gameDate'),
                                        'opponent': game_info.get('opponent', {}).get('abbreviation'),
                                        'game_result': game_info.get('gameResult'),
                                        'score': game_info.get('score')
                                    })
                                    game_stats.append(stats)
                                    logger.info(f"✅ Found game: Week {stats.get('week')} vs {stats.get('opponent')}")
                                else:
                                    logger.warning(f"Failed to map stats for category event {event['eventId']}")
                            else:
                                pass  # Remove excessive logging
        
        logger.info(f"Parsed {len(game_stats)} games from ESPN data")
        return game_stats
    
    def map_espn_stats_to_db(self, espn_stats_array):
        """Map ESPN stats array to our database format"""
        if len(espn_stats_array) != len(self.espn_stat_names):
            logger.warning(f"Stats array length mismatch: {len(espn_stats_array)} vs {len(self.espn_stat_names)}")
            return None
        
        stats = {}
        for i, stat_name in enumerate(self.espn_stat_names):
            try:
                value = float(espn_stats_array[i]) if espn_stats_array[i] != '--' else 0
                # Convert to int for counting stats
                if stat_name in ['completions', 'passingAttempts', 'passingTouchdowns', 'interceptions', 
                                'rushingAttempts', 'rushingTouchdowns', 'sacks']:
                    value = int(value)
                stats[stat_name] = value
            except (ValueError, IndexError):
                stats[stat_name] = 0
        
        return stats
    
    def get_target_players(self):
        """Get offensive NFL players from database"""
        try:
            response = self.supabase.client.table('players').select(
                'id, name, external_player_id, position, team, sport'
            ).eq('sport', 'NFL').in_('position', self.target_positions).execute()
            
            logger.info(f"Found {len(response.data)} target NFL players")
            return response.data
        except Exception as e:
            logger.error(f"Failed to get players from database: {e}")
            return []
    
    def find_espn_player_id(self, player_name, position, team):
        """
        Automatically find and store ESPN player ID using ESPN team roster API
        """
        try:
            # First check if we already have the ESPN ID stored
            existing_espn_id = self.get_stored_espn_id(player_name, team)
            if existing_espn_id:
                return existing_espn_id
            
            # Try to find ESPN player ID via team roster lookup
            espn_id = self.discover_espn_player_id(player_name, position, team)
            
            if espn_id:
                # Store the discovered ESPN ID for future use
                self.store_espn_player_id(player_name, team, espn_id)
                logger.info(f"🎯 Discovered ESPN ID {espn_id} for {player_name}")
                return espn_id
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding ESPN ID for {player_name}: {e}")
            return None
    
    def get_stored_espn_id(self, player_name, team):
        """Check if we already have ESPN ID stored for this player"""
        try:
            response = self.supabase.client.table('players').select(
                'espn_player_id'
            ).eq('name', player_name).eq('sport', 'NFL').execute()
            
            if response.data and response.data[0].get('espn_player_id'):
                return response.data[0]['espn_player_id']
            
            return None
        except Exception as e:
            logger.error(f"Error checking stored ESPN ID for {player_name}: {e}")
            return None
    
    def store_espn_player_id(self, player_name, team, espn_id):
        """Store discovered ESPN player ID in database"""
        try:
            response = self.supabase.client.table('players').update({
                'espn_player_id': espn_id,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('name', player_name).eq('sport', 'NFL').execute()
            
            if response.data:
                logger.info(f"✅ Stored ESPN ID {espn_id} for {player_name}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Error storing ESPN ID for {player_name}: {e}")
            return False
    
    def discover_espn_player_id(self, player_name, position, team):
        """
        Discover ESPN player ID by searching ESPN team rosters
        """
        try:
            # ESPN team abbreviation mapping (simplified)
            espn_teams = {
                'ARI': 22, 'ATL': 1, 'BAL': 33, 'BUF': 2, 'CAR': 29, 'CHI': 3,
                'CIN': 4, 'CLE': 5, 'DAL': 6, 'DEN': 7, 'DET': 8, 'GB': 9,
                'HOU': 34, 'IND': 11, 'JAX': 30, 'KC': 12, 'LV': 13, 'LAC': 24,
                'LAR': 14, 'MIA': 15, 'MIN': 16, 'NE': 17, 'NO': 18, 'NYG': 19,
                'NYJ': 20, 'PHI': 21, 'PIT': 23, 'SF': 25, 'SEA': 26, 'TB': 27,
                'TEN': 10, 'WAS': 28
            }
            
            team_id = espn_teams.get(team)
            if not team_id:
                logger.warning(f"Unknown team abbreviation: {team}")
                return None
            
            # Get team roster from ESPN
            roster_url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{team_id}/roster"
            
            response = requests.get(roster_url, headers=self.headers, timeout=10)
            response.raise_for_status()
            roster_data = response.json()
            
            # Search for player in roster
            if 'athletes' in roster_data:
                for athlete in roster_data['athletes']:
                    # Check various name formats
                    athlete_name = athlete.get('displayName', '')
                    athlete_full_name = athlete.get('fullName', '')
                    
                    if (self.names_match(player_name, athlete_name) or 
                        self.names_match(player_name, athlete_full_name)):
                        
                        espn_id = athlete.get('id')
                        if espn_id:
                            logger.info(f"🔍 Found {player_name} -> ESPN ID: {espn_id}")
                            return str(espn_id)
            
            logger.warning(f"Player {player_name} not found in {team} roster")
            return None
            
        except Exception as e:
            logger.error(f"Error discovering ESPN ID for {player_name}: {e}")
            return None
    
    def names_match(self, name1, name2):
        """Check if two player names match (handles variations)"""
        if not name1 or not name2:
            return False
        
        # Simple matching - could be enhanced
        name1_clean = name1.lower().replace('.', '').replace(' jr', '').replace(' sr', '').strip()
        name2_clean = name2.lower().replace('.', '').replace(' jr', '').replace(' sr', '').strip()
        
        return name1_clean == name2_clean
    
    def get_existing_game_stats(self, player_id):
        """Get existing game stats for a player to avoid duplicates"""
        try:
            response = self.supabase.client.table('player_game_stats').select(
                'stats'
            ).eq('player_id', player_id).execute()
            
            existing_games = set()
            for stat in response.data:
                if stat.get('stats') and stat['stats'].get('espn_game_id'):
                    existing_games.add(stat['stats']['espn_game_id'])
            
            return existing_games
        except Exception as e:
            logger.error(f"Failed to get existing stats for player {player_id}: {e}")
            return set()
    
    def update_player_stats(self, player, game_stats):
        """Update player's game stats in the database"""
        player_id = player['id']
        player_name = player['name']
        
        # Get existing game stats to avoid duplicates
        existing_games = self.get_existing_game_stats(player_id)
        
        new_stats = []
        for game_stat in game_stats:
            espn_game_id = game_stat.get('espn_game_id')
            
            # Skip if we already have this game
            if espn_game_id in existing_games:
                logger.info(f"Skipping existing game {espn_game_id} for {player_name}")
                continue
            
            # Generate deterministic UUID from ESPN game ID
            espn_game_uuid = self.generate_uuid_from_espn_id(espn_game_id)
            
            # Prepare the database record  
            db_record = {
                'player_id': player_id,
                'event_id': espn_game_uuid,  # Use generated UUID
                'stats': {
                    'player_name': player_name,
                    'position': player['position'],
                    'team': player['team'],
                    'sport': 'NFL',
                    'season': 2025,
                    'week': game_stat.get('week'),
                    'game_date': game_stat.get('game_date'),
                    'opponent': game_stat.get('opponent'),
                    'game_result': game_stat.get('game_result'),
                    'score': game_stat.get('score'),
                    'espn_game_id': espn_game_id,
                    
                    # Passing stats
                    'passing_completions': game_stat.get('completions', 0),
                    'passing_attempts': game_stat.get('passingAttempts', 0),
                    'passing_yards': game_stat.get('passingYards', 0),
                    'passing_touchdowns': game_stat.get('passingTouchdowns', 0),
                    'passing_interceptions': game_stat.get('interceptions', 0),
                    'sacks': game_stat.get('sacks', 0),
                    
                    # Rushing stats
                    'rushing_attempts': game_stat.get('rushingAttempts', 0),
                    'rushing_yards': game_stat.get('rushingYards', 0),
                    'rushing_touchdowns': game_stat.get('rushingTouchdowns', 0),
                    
                    # Additional stats for receivers
                    'receptions': 0,  # ESPN doesn't provide receiving stats in QB gamelogs
                    'receiving_yards': 0,
                    'receiving_touchdowns': 0,
                    'targets': 0
                }
            }
            
            new_stats.append(db_record)
        
        # Insert new stats
        if new_stats:
            try:
                response = self.supabase.client.table('player_game_stats').insert(new_stats).execute()
                logger.info(f"✅ Inserted {len(new_stats)} new game stats for {player_name}")
                return len(new_stats)
            except Exception as e:
                logger.error(f"Failed to insert stats for {player_name}: {e}")
                return 0
        else:
            logger.info(f"No new stats to insert for {player_name}")
            return 0
    
    def process_player(self, player):
        """Process a single player"""
        player_name = player['name']
        external_id = player['external_player_id']
        
        logger.info(f"Processing {player_name} (External ID: {external_id})")
        
        # Try to find ESPN player ID
        espn_id = self.find_espn_player_id(player_name, player['position'], player['team'])
        
        if not espn_id:
            logger.warning(f"No ESPN ID mapping found for {player_name}")
            return 0
        
        # Get ESPN data
        espn_data = self.get_espn_player_data(espn_id)
        if not espn_data:
            logger.error(f"Failed to get ESPN data for {player_name}")
            return 0
        
        # Parse game stats
        game_stats = self.parse_espn_game_stats(espn_data)
        if not game_stats:
            logger.warning(f"No game stats found for {player_name}")
            return 0
        
        # Update database
        return self.update_player_stats(player, game_stats)
    
    def run_update(self, limit=5):
        """Run the update process"""
        logger.info("🏈 Starting NFL Database Update")
        
        # Get target players
        players = self.get_target_players()
        if not players:
            logger.error("No players found")
            return
        
        total_updated = 0
        players_processed = 0
        
        # Process players (limit for testing)
        for player in players[:limit]:
            try:
                stats_added = self.process_player(player)
                total_updated += stats_added
                players_processed += 1
                
                # Rate limiting
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"Error processing {player['name']}: {e}")
                continue
        
        logger.info(f"✅ Update complete: {players_processed} players processed, {total_updated} game stats added")
    
    def generate_uuid_from_espn_id(self, espn_game_id):
        """Generate a deterministic UUID from ESPN game ID"""
        # Create a deterministic UUID using namespace UUID and ESPN game ID
        namespace = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')  # Standard namespace
        return str(uuid.uuid5(namespace, f"espn_game_{espn_game_id}"))
    
    def find_players_missing_week2_stats(self):
        """Find NFL offensive players who don't have Week 2 2025 stats"""
        try:
            # Get all NFL offensive players
            response = self.supabase.client.table('players').select(
                'id, name, external_player_id, position, team, sport'
            ).eq('sport', 'NFL').in_('position', self.target_positions).limit(50).execute()
            
            all_players = response.data
            logger.info(f"Found {len(all_players)} total NFL offensive players")
            
            players_missing_week2 = []
            
            for player in all_players:
                # Check if player has Week 2 2025 stats
                stats_response = self.supabase.client.table('player_game_stats').select(
                    'stats'
                ).eq('player_id', player['id']).execute()
                
                has_week2_2025 = False
                if stats_response.data:
                    for stat_record in stats_response.data:
                        if stat_record.get('stats'):
                            stats = stat_record['stats']
                            if (stats.get('season') == 2025 and 
                                stats.get('week') == 2 and 
                                stats.get('sport') == 'NFL'):
                                has_week2_2025 = True
                                break
                
                if not has_week2_2025:
                    players_missing_week2.append(player)
                    logger.info(f"❌ {player['name']} ({player['position']}) missing Week 2 stats")
                else:
                    logger.info(f"✅ {player['name']} ({player['position']}) already has Week 2 stats")
            
            return players_missing_week2
            
        except Exception as e:
            logger.error(f"Failed to find players missing Week 2 stats: {e}")
            return []

def main():
    updater = NFLDatabaseUpdater()
    
    logger.info("🏈 Finding NFL players missing Week 2 stats...")
    
    # Get players who need Week 2 stats
    players_needing_week2 = updater.find_players_missing_week2_stats()
    
    if not players_needing_week2:
        logger.info("✅ All players already have Week 2 stats!")
        return
    
    logger.info(f"📋 Found {len(players_needing_week2)} players missing Week 2 stats")
    
    # Process in small batches
    batch_size = 10
    total_updated = 0
    
    for i in range(0, min(len(players_needing_week2), batch_size)):
        player = players_needing_week2[i]
        logger.info(f"Processing {i+1}/{min(len(players_needing_week2), batch_size)}: {player['name']} ({player['position']})")
        
        try:
            stats_added = updater.process_player(player)
            total_updated += stats_added
            
            # Rate limiting
            if i < batch_size - 1:
                time.sleep(2)
                
        except Exception as e:
            logger.error(f"Error processing {player['name']}: {e}")
            continue
    
    logger.info(f"✅ Batch complete: {total_updated} new stats added for Week 2")

if __name__ == "__main__":
    main()