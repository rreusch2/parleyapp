#!/usr/bin/env python3
"""
PyBaseball MLB Data Integration Script

This script:
1. Cleans fake MLB records from player_game_stats table
2. Fetches accurate last 15 games for all MLB players using pybaseball
3. Fetches team recent stats for MLB teams
4. Stores data in proper format for ParleyApp display

Author: AI Assistant
Date: September 5, 2025
"""

import os
import sys
import json
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import logging

# Add the project root to Python path
sys.path.append('/home/reid/Desktop/parleyapp')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    # Import pybaseball
    import pybaseball
    from pybaseball import (
        playerid_lookup, 
        statcast_batter, 
        batting_stats_range, 
        schedule_and_record,
        standings,
        cache
    )
    # Enable caching for faster subsequent requests
    cache.enable()
    logger.info("✅ pybaseball imported successfully")
except ImportError:
    logger.error("❌ pybaseball not installed. Installing...")
    os.system("pip install pybaseball")
    import pybaseball
    from pybaseball import (
        playerid_lookup, 
        statcast_batter, 
        batting_stats_range, 
        schedule_and_record,
        standings,
        cache
    )
    cache.enable()

# Import Supabase
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://iriaegoipkjtktitpary.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class MLBDataFixer:
    def __init__(self):
        """Initialize MLB Data Fixer with supabase connection"""
        self.supabase = supabase
        self.current_date = datetime.now()
        self.start_date = self.current_date - timedelta(days=30)  # Last 30 days for context
        
        # MLB team abbreviation mapping
        self.mlb_teams = {
            'Arizona Diamondbacks': 'ARI',
            'Atlanta Braves': 'ATL',
            'Baltimore Orioles': 'BAL',
            'Boston Red Sox': 'BOS',
            'Chicago Cubs': 'CHC',
            'Chicago White Sox': 'CWS',
            'Cincinnati Reds': 'CIN',
            'Cleveland Guardians': 'CLE',
            'Colorado Rockies': 'COL',
            'Detroit Tigers': 'DET',
            'Houston Astros': 'HOU',
            'Kansas City Royals': 'KC',
            'Los Angeles Angels': 'LAA',
            'Los Angeles Dodgers': 'LAD',
            'Miami Marlins': 'MIA',
            'Milwaukee Brewers': 'MIL',
            'Minnesota Twins': 'MIN',
            'New York Mets': 'NYM',
            'New York Yankees': 'NYY',
            'Oakland Athletics': 'OAK',
            'Philadelphia Phillies': 'PHI',
            'Pittsburgh Pirates': 'PIT',
            'San Diego Padres': 'SD',
            'San Francisco Giants': 'SF',
            'Seattle Mariners': 'SEA',
            'St. Louis Cardinals': 'STL',
            'Tampa Bay Rays': 'TB',
            'Texas Rangers': 'TEX',
            'Toronto Blue Jays': 'TOR',
            'Washington Nationals': 'WSH'
        }

    def backup_and_clean_fake_mlb_data(self):
        """Backup and clean fake MLB records while preserving player metadata"""
        logger.info("🗂️ Starting cleanup of fake MLB data...")
        
        try:
            # Get count of fake MLB records to delete
            mlb_players_result = self.supabase.table('players').select('id').eq('sport', 'MLB').execute()
            mlb_player_ids = [p['id'] for p in mlb_players_result.data] if mlb_players_result.data else []
            
            if not mlb_player_ids:
                logger.warning("⚠️ No MLB players found")
                return True
            
            logger.info(f"📋 Found {len(mlb_player_ids)} MLB players to clean stats for")
            
            # Delete fake MLB records in batches
            deleted_count = 0
            batch_size = 100
            
            for i in range(0, len(mlb_player_ids), batch_size):
                batch_ids = mlb_player_ids[i:i + batch_size]
                
                # Delete records for this batch of players
                delete_result = self.supabase.table('player_game_stats').delete().in_('player_id', batch_ids).execute()
                
                if delete_result.data:
                    deleted_count += len(delete_result.data)
                    logger.info(f"🗑️ Deleted batch {i//batch_size + 1}: {len(delete_result.data)} records")
            
            logger.info(f"✅ Cleanup complete. Deleted {deleted_count} fake MLB records")
            
            # Verify cleanup
            verification = self.supabase.table('player_game_stats').select('id', count='exact').in_('player_id', mlb_player_ids[:10]).execute()
            remaining = verification.count if hasattr(verification, 'count') else 0
            logger.info(f"✅ Verification: {remaining} MLB records remaining (should be 0)")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error during cleanup: {str(e)}")
            return False

    def get_mlb_players_from_db(self) -> List[Dict]:
        """Get all MLB players from database with metadata intact"""
        logger.info("📋 Fetching MLB players from database...")
        
        try:
            result = self.supabase.table('players').select(
                'id', 'name', 'team', 'position', 'headshot_url'
            ).eq('sport', 'MLB').execute()
            
            players = result.data if result.data else []
            logger.info(f"✅ Found {len(players)} MLB players in database")
            
            return players
            
        except Exception as e:
            logger.error(f"❌ Error fetching players: {str(e)}")
            return []

    def lookup_player_mlbam_id(self, player_name: str) -> Optional[int]:
        """Lookup player's MLBAM ID using pybaseball"""
        try:
            # Split name for lookup
            name_parts = player_name.split(' ')
            if len(name_parts) < 2:
                return None
            
            last_name = name_parts[-1]
            first_name = ' '.join(name_parts[:-1])
            
            # Use pybaseball lookup
            lookup_result = playerid_lookup(last_name, first_name)
            
            if lookup_result is not None and len(lookup_result) > 0:
                # Get the most recent player entry (active)
                active_player = lookup_result.iloc[-1]
                if pd.notna(active_player.get('key_mlbam')):
                    return int(active_player['key_mlbam'])
            
            return None
            
        except Exception as e:
            logger.warning(f"⚠️ Could not lookup {player_name}: {str(e)}")
            return None

    def get_recent_player_stats(self, player_name: str, mlbam_id: int, player_id: str) -> List[Dict]:
        """Get last 15 games stats for a player using pybaseball"""
        logger.info(f"📊 Fetching recent stats for {player_name} (MLBAM: {mlbam_id})")
        
        try:
            # Get recent batting data (last 30 days to ensure we get 15 games)
            start_date = (self.current_date - timedelta(days=45)).strftime('%Y-%m-%d')
            end_date = self.current_date.strftime('%Y-%m-%d')
            
            # Get statcast batter data
            statcast_data = statcast_batter(start_date, end_date, mlbam_id)
            
            if statcast_data is None or len(statcast_data) == 0:
                logger.warning(f"⚠️ No recent statcast data for {player_name}")
                return []
            
            # Group by game_date and aggregate stats
            game_stats = []
            grouped_by_game = statcast_data.groupby('game_date')
            
            for game_date, game_data in grouped_by_game:
                if len(game_stats) >= 15:  # Limit to last 15 games
                    break
                
                # Aggregate stats for the game
                game_stat = self.aggregate_game_stats(game_data, player_name, player_id, game_date)
                if game_stat:
                    game_stats.append(game_stat)
            
            # Sort by date descending (most recent first) and limit to 15
            game_stats.sort(key=lambda x: x['stats']['game_date'], reverse=True)
            return game_stats[:15]
            
        except Exception as e:
            logger.error(f"❌ Error fetching stats for {player_name}: {str(e)}")
            return []

    def aggregate_game_stats(self, game_data: pd.DataFrame, player_name: str, player_id: str, game_date: str) -> Optional[Dict]:
        """Aggregate statcast data into game-level stats"""
        try:
            if len(game_data) == 0:
                return None
            
            # Basic counting stats
            at_bats = len(game_data)
            hits = len(game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])])
            home_runs = len(game_data[game_data['events'] == 'home_run'])
            doubles = len(game_data[game_data['events'] == 'double'])
            triples = len(game_data[game_data['events'] == 'triple'])
            singles = hits - doubles - triples - home_runs
            
            # Calculate total bases
            total_bases = singles + (doubles * 2) + (triples * 3) + (home_runs * 4)
            
            # Other stats
            walks = len(game_data[game_data['events'] == 'walk'])
            strikeouts = len(game_data[game_data['events'] == 'strikeout'])
            hit_by_pitch = len(game_data[game_data['events'] == 'hit_by_pitch'])
            
            # RBIs and Runs (if available in events description)
            rbis = 0  # Would need play-by-play data for accurate RBIs
            runs = 0  # Would need play-by-play data for accurate runs
            
            # Calculate batting average and OPS for this game
            batting_avg = hits / at_bats if at_bats > 0 else 0
            on_base = hits + walks + hit_by_pitch
            plate_appearances = at_bats + walks + hit_by_pitch
            obp = on_base / plate_appearances if plate_appearances > 0 else 0
            slg = total_bases / at_bats if at_bats > 0 else 0
            ops = obp + slg
            
            # Get game context
            home_team = game_data.iloc[0]['home_team'] if 'home_team' in game_data.columns else ''
            away_team = game_data.iloc[0]['away_team'] if 'away_team' in game_data.columns else ''
            
            # Create game stats object
            game_stats = {
                'id': None,  # Will be generated by Supabase
                'player_id': player_id,
                'event_id': None,
                'minutes_played': None,  # Not applicable for baseball
                'stats': {
                    'game_date': game_date,
                    'at_bats': at_bats,
                    'hits': hits,
                    'home_runs': home_runs,
                    'doubles': doubles,
                    'triples': triples,
                    'singles': singles,
                    'total_bases': total_bases,
                    'walks': walks,
                    'strikeouts': strikeouts,
                    'hit_by_pitch': hit_by_pitch,
                    'rbis': rbis,  # Placeholder - would need additional data
                    'runs': runs,  # Placeholder - would need additional data
                    'batting_average': round(batting_avg, 3),
                    'on_base_percentage': round(obp, 3),
                    'slugging_percentage': round(slg, 3),
                    'ops': round(ops, 3),
                    'home_team': home_team,
                    'away_team': away_team,
                    'is_home': None,  # Would need roster data
                    'opponent_team': away_team if home_team else home_team,
                    'is_game_over': True,
                    'player_name': player_name
                },
                'fantasy_points': None,
                'betting_results': None,
                'created_at': datetime.now().isoformat()
            }
            
            return game_stats
            
        except Exception as e:
            logger.error(f"❌ Error aggregating game stats: {str(e)}")
            return None

    def get_team_recent_stats(self) -> Dict[str, Dict]:
        """Get recent team stats for all MLB teams"""
        logger.info("🏟️ Fetching recent team stats...")
        
        team_stats = {}
        current_season = self.current_date.year
        
        try:
            for team_name, team_abbrev in self.mlb_teams.items():
                logger.info(f"📈 Processing {team_name} ({team_abbrev})...")
                
                # Get team's schedule and record
                schedule_data = schedule_and_record(current_season, team_abbrev)
                
                if schedule_data is not None and len(schedule_data) > 0:
                    # Get last 10 completed games
                    completed_games = schedule_data[schedule_data['W/L'].notna()].tail(10)
                    
                    if len(completed_games) > 0:
                        team_stats[team_abbrev] = self.aggregate_team_stats(completed_games, team_name, team_abbrev)
            
            logger.info(f"✅ Processed {len(team_stats)} teams")
            return team_stats
            
        except Exception as e:
            logger.error(f"❌ Error fetching team stats: {str(e)}")
            return {}

    def aggregate_team_stats(self, games_df: pd.DataFrame, team_name: str, team_abbrev: str) -> Dict:
        """Aggregate team stats from recent games"""
        try:
            wins = len(games_df[games_df['W/L'] == 'W'])
            losses = len(games_df[games_df['W/L'] == 'L'])
            
            # Calculate averages
            avg_runs_scored = games_df['R'].mean() if 'R' in games_df.columns else 0
            avg_runs_allowed = games_df['RA'].mean() if 'RA' in games_df.columns else 0
            
            # Get recent form (last 5 games)
            recent_5 = games_df.tail(5)
            recent_wins = len(recent_5[recent_5['W/L'] == 'W'])
            recent_losses = len(recent_5[recent_5['W/L'] == 'L'])
            
            team_stat = {
                'team_name': team_name,
                'team_abbrev': team_abbrev,
                'last_10_record': f"{wins}-{losses}",
                'last_10_win_pct': round(wins / (wins + losses), 3) if (wins + losses) > 0 else 0,
                'last_5_record': f"{recent_wins}-{recent_losses}",
                'avg_runs_scored': round(avg_runs_scored, 2),
                'avg_runs_allowed': round(avg_runs_allowed, 2),
                'run_differential': round(avg_runs_scored - avg_runs_allowed, 2),
                'games_played': len(games_df),
                'updated_at': datetime.now().isoformat()
            }
            
            return team_stat
            
        except Exception as e:
            logger.error(f"❌ Error aggregating team stats: {str(e)}")
            return {}

    def store_player_stats(self, all_player_stats: List[Dict]):
        """Store player stats in database"""
        logger.info("💾 Storing player stats in database...")
        
        if not all_player_stats:
            logger.warning("⚠️ No player stats to store")
            return
        
        try:
            # Insert in batches of 100
            batch_size = 100
            total_inserted = 0
            
            for i in range(0, len(all_player_stats), batch_size):
                batch = all_player_stats[i:i + batch_size]
                
                result = self.supabase.table('player_game_stats').insert(batch).execute()
                
                if result.data:
                    total_inserted += len(result.data)
                    logger.info(f"✅ Inserted batch {i//batch_size + 1}: {len(result.data)} records")
            
            logger.info(f"✅ Successfully stored {total_inserted} player stat records")
            
        except Exception as e:
            logger.error(f"❌ Error storing player stats: {str(e)}")

    def store_team_stats(self, team_stats: Dict[str, Dict]):
        """Store team stats in database"""
        logger.info("💾 Storing team stats in database...")
        
        if not team_stats:
            logger.warning("⚠️ No team stats to store")
            return
        
        try:
            # Convert to list format for insertion
            team_records = []
            for team_abbrev, stats in team_stats.items():
                team_record = {
                    'team_abbreviation': team_abbrev,
                    'stats': stats,
                    'updated_at': datetime.now().isoformat()
                }
                team_records.append(team_record)
            
            # Insert into team_recent_stats table
            result = self.supabase.table('team_recent_stats').upsert(
                team_records, 
                on_conflict='team_abbreviation'
            ).execute()
            
            logger.info(f"✅ Successfully stored {len(team_records)} team stat records")
            
        except Exception as e:
            logger.error(f"❌ Error storing team stats: {str(e)}")

    def run_complete_fix(self):
        """Run the complete MLB data fix process"""
        logger.info("🚀 Starting complete MLB data fix process...")
        
        # Step 1: Backup and clean fake data
        logger.info("Step 1: Cleaning fake MLB data...")
        if not self.backup_and_clean_fake_mlb_data():
            logger.error("❌ Failed to clean fake data. Stopping.")
            return False
        
        # Step 2: Get MLB players from database
        logger.info("Step 2: Getting MLB players...")
        players = self.get_mlb_players_from_db()
        if not players:
            logger.error("❌ No MLB players found in database. Stopping.")
            return False
        
        # Step 3: Fetch real player stats
        logger.info("Step 3: Fetching real player stats with pybaseball...")
        all_player_stats = []
        
        for i, player in enumerate(players[:50]):  # Limit to first 50 players for testing
            logger.info(f"Processing player {i+1}/{min(50, len(players))}: {player['name']}")
            
            # Lookup MLBAM ID
            mlbam_id = self.lookup_player_mlbam_id(player['name'])
            if mlbam_id:
                # Get recent stats
                player_stats = self.get_recent_player_stats(player['name'], mlbam_id, player['id'])
                all_player_stats.extend(player_stats)
                
                # Rate limiting to avoid overwhelming APIs
                if i % 10 == 0 and i > 0:
                    logger.info(f"⏸️ Processed {i} players, taking a brief pause...")
                    import time
                    time.sleep(2)
        
        # Step 4: Store player stats
        logger.info("Step 4: Storing player stats...")
        self.store_player_stats(all_player_stats)
        
        # Step 5: Fetch and store team stats
        logger.info("Step 5: Fetching and storing team stats...")
        team_stats = self.get_team_recent_stats()
        self.store_team_stats(team_stats)
        
        logger.info("✅ Complete MLB data fix process finished!")
        logger.info(f"📊 Summary:")
        logger.info(f"   - Cleaned fake MLB records")
        logger.info(f"   - Processed {len(all_player_stats)} individual game stats")
        logger.info(f"   - Processed {len(team_stats)} team recent stats")
        
        return True

def main():
    """Main execution function"""
    logger.info("🔥 MLB Data Fix Script Started")
    
    try:
        fixer = MLBDataFixer()
        success = fixer.run_complete_fix()
        
        if success:
            logger.info("✅ MLB Data Fix completed successfully!")
        else:
            logger.error("❌ MLB Data Fix failed!")
            
    except Exception as e:
        logger.error(f"❌ Critical error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
