#!/usr/bin/env python3
"""
MLB Production Data Fix - Complete cleanup and real data population

This script:
1. Cleans ALL fake MLB records from player_game_stats
2. Populates with accurate last 15 games for all MLB players using pybaseball
3. Creates team recent stats for MLB teams
4. Optimized for production with rate limiting and error handling
"""

import os
import sys
import json
import pandas as pd
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    import pybaseball
    from pybaseball import playerid_lookup, statcast_batter, schedule_and_record, cache
    cache.enable()
    logger.info("✅ pybaseball imported successfully")
except ImportError:
    logger.error("❌ pybaseball not installed")
    sys.exit(1)

from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://iriaegoipkjtktitpary.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# MLB teams for team stats
MLB_TEAMS = {
    'Arizona Diamondbacks': 'ARI', 'Atlanta Braves': 'ATL', 'Baltimore Orioles': 'BAL',
    'Boston Red Sox': 'BOS', 'Chicago Cubs': 'CHC', 'Chicago White Sox': 'CWS',
    'Cincinnati Reds': 'CIN', 'Cleveland Guardians': 'CLE', 'Colorado Rockies': 'COL',
    'Detroit Tigers': 'DET', 'Houston Astros': 'HOU', 'Kansas City Royals': 'KC',
    'Los Angeles Angels': 'LAA', 'Los Angeles Dodgers': 'LAD', 'Miami Marlins': 'MIA',
    'Milwaukee Brewers': 'MIL', 'Minnesota Twins': 'MIN', 'New York Mets': 'NYM',
    'New York Yankees': 'NYY', 'Oakland Athletics': 'OAK', 'Philadelphia Phillies': 'PHI',
    'Pittsburgh Pirates': 'PIT', 'San Diego Padres': 'SD', 'San Francisco Giants': 'SF',
    'Seattle Mariners': 'SEA', 'St. Louis Cardinals': 'STL', 'Tampa Bay Rays': 'TB',
    'Texas Rangers': 'TEX', 'Toronto Blue Jays': 'TOR', 'Washington Nationals': 'WSH'
}

class MLBProductionFixer:
    def __init__(self):
        self.supabase = supabase
        self.current_date = datetime.now()
        
    def clean_all_fake_mlb_data(self):
        """Clean all fake MLB data from player_game_stats"""
        logger.info("🧹 Cleaning ALL fake MLB data from database...")
        
        try:
            # Get all MLB players
            players_result = self.supabase.table('players').select('id', 'name').eq('sport', 'MLB').execute()
            mlb_players = players_result.data if players_result.data else []
            
            if not mlb_players:
                logger.warning("⚠️ No MLB players found")
                return True
                
            logger.info(f"📋 Found {len(mlb_players)} MLB players to clean")
            
            # Delete in batches to avoid timeout
            deleted_total = 0
            batch_size = 50
            player_ids = [p['id'] for p in mlb_players]
            
            for i in range(0, len(player_ids), batch_size):
                batch_ids = player_ids[i:i + batch_size]
                
                delete_result = self.supabase.table('player_game_stats').delete().in_('player_id', batch_ids).execute()
                deleted_count = len(delete_result.data) if delete_result.data else 0
                deleted_total += deleted_count
                
                logger.info(f"🗑️ Batch {i//batch_size + 1}: Deleted {deleted_count} records")
                
                # Brief pause between batches
                time.sleep(0.5)
            
            logger.info(f"✅ Cleaned {deleted_total} fake MLB records total")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error cleaning fake data: {str(e)}")
            return False
    
    def lookup_player_mlbam_id(self, player_name: str) -> Optional[int]:
        """Lookup player's MLBAM ID with retry logic"""
        try:
            name_parts = player_name.split(' ')
            if len(name_parts) < 2:
                return None
                
            last_name = name_parts[-1]
            first_name = ' '.join(name_parts[:-1])
            
            # Try lookup with retry
            for attempt in range(3):
                try:
                    lookup_result = playerid_lookup(last_name, first_name)
                    
                    if lookup_result is not None and len(lookup_result) > 0:
                        active_player = lookup_result.iloc[-1]
                        if pd.notna(active_player.get('key_mlbam')):
                            return int(active_player['key_mlbam'])
                    break
                except Exception as e:
                    if attempt < 2:
                        logger.warning(f"⚠️ Lookup attempt {attempt + 1} failed for {player_name}, retrying...")
                        time.sleep(2)
                    else:
                        logger.warning(f"⚠️ All lookup attempts failed for {player_name}: {str(e)}")
            
            return None
            
        except Exception as e:
            logger.warning(f"⚠️ Could not lookup {player_name}: {str(e)}")
            return None
    
    def get_real_player_stats(self, player: Dict) -> List[Dict]:
        """Get real stats for a single player"""
        player_name = player['name']
        player_id = player['id']
        
        try:
            # Lookup MLBAM ID
            mlbam_id = self.lookup_player_mlbam_id(player_name)
            if not mlbam_id:
                logger.warning(f"⚠️ No MLBAM ID found for {player_name}")
                return []
            
            # Get recent statcast data (last 45 days to ensure we get enough games)
            end_date = self.current_date.strftime('%Y-%m-%d')
            start_date = (self.current_date - timedelta(days=45)).strftime('%Y-%m-%d')
            
            statcast_data = statcast_batter(start_date, end_date, mlbam_id)
            
            if statcast_data is None or len(statcast_data) == 0:
                logger.warning(f"⚠️ No recent statcast data for {player_name}")
                return []
            
            # Group by game and create stats
            game_stats = []
            for game_date, game_data in statcast_data.groupby('game_date'):
                if len(game_stats) >= 15:  # Limit to last 15 games
                    break
                    
                game_stat = self.create_game_stat_record(game_data, player_name, player_id, str(game_date))
                if game_stat:
                    game_stats.append(game_stat)
            
            # Sort by date descending and return last 15
            game_stats.sort(key=lambda x: x['stats']['game_date'], reverse=True)
            logger.info(f"✅ {player_name}: {len(game_stats[:15])} games processed")
            
            return game_stats[:15]
            
        except Exception as e:
            logger.error(f"❌ Error processing {player_name}: {str(e)}")
            return []
    
    def create_game_stat_record(self, game_data: pd.DataFrame, player_name: str, player_id: str, game_date: str) -> Optional[Dict]:
        """Create formatted game stat record"""
        try:
            if len(game_data) == 0:
                return None
            
            # Calculate basic stats
            at_bats = len(game_data)
            hits = len(game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])])
            home_runs = len(game_data[game_data['events'] == 'home_run'])
            doubles = len(game_data[game_data['events'] == 'double'])
            triples = len(game_data[game_data['events'] == 'triple'])
            singles = hits - doubles - triples - home_runs
            
            total_bases = singles + (doubles * 2) + (triples * 3) + (home_runs * 4)
            walks = len(game_data[game_data['events'] == 'walk'])
            strikeouts = len(game_data[game_data['events'] == 'strikeout'])
            hit_by_pitch = len(game_data[game_data['events'] == 'hit_by_pitch'])
            
            # Calculate advanced stats
            batting_avg = hits / at_bats if at_bats > 0 else 0
            on_base = hits + walks + hit_by_pitch
            plate_appearances = at_bats + walks + hit_by_pitch
            obp = on_base / plate_appearances if plate_appearances > 0 else 0
            slg = total_bases / at_bats if at_bats > 0 else 0
            ops = obp + slg
            
            # Game context
            home_team = game_data.iloc[0].get('home_team', '')
            away_team = game_data.iloc[0].get('away_team', '')
            
            return {
                'player_id': player_id,
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
                    'batting_average': round(batting_avg, 3),
                    'on_base_percentage': round(obp, 3),
                    'slugging_percentage': round(slg, 3),
                    'ops': round(ops, 3),
                    'home_team': home_team,
                    'away_team': away_team,
                    'opponent_team': away_team if home_team else home_team,
                    'player_name': player_name,
                    'data_source': 'pybaseball_statcast',
                    'is_real_data': True
                },
                'created_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error creating game stat for {player_name}: {str(e)}")
            return None
    
    def process_all_mlb_players(self):
        """Process all MLB players to get real stats"""
        logger.info("📊 Processing ALL MLB players for real stats...")
        
        try:
            # Get all MLB players
            players_result = self.supabase.table('players').select('id', 'name', 'team').eq('sport', 'MLB').execute()
            all_players = players_result.data if players_result.data else []
            
            if not all_players:
                logger.error("❌ No MLB players found")
                return []
            
            logger.info(f"👥 Processing {len(all_players)} MLB players...")
            
            all_stats = []
            processed_count = 0
            
            # Process players in batches to avoid overwhelming APIs
            batch_size = 20
            for i in range(0, len(all_players), batch_size):
                batch = all_players[i:i + batch_size]
                logger.info(f"📦 Processing batch {i//batch_size + 1}/{(len(all_players) + batch_size - 1)//batch_size}")
                
                for player in batch:
                    processed_count += 1
                    logger.info(f"🔄 ({processed_count}/{len(all_players)}) Processing: {player['name']}")
                    
                    player_stats = self.get_real_player_stats(player)
                    all_stats.extend(player_stats)
                    
                    # Rate limiting - pause between players
                    time.sleep(1)
                
                # Longer pause between batches
                if i + batch_size < len(all_players):
                    logger.info("⏸️ Pausing between batches...")
                    time.sleep(5)
            
            logger.info(f"✅ Processed all players. Generated {len(all_stats)} game stat records")
            return all_stats
            
        except Exception as e:
            logger.error(f"❌ Error processing players: {str(e)}")
            return []
    
    def store_player_stats_batch(self, stats_batch: List[Dict]):
        """Store player stats in database"""
        try:
            if not stats_batch:
                return 0
                
            result = self.supabase.table('player_game_stats').insert(stats_batch).execute()
            return len(result.data) if result.data else 0
            
        except Exception as e:
            logger.error(f"❌ Error storing stats batch: {str(e)}")
            return 0
    
    def create_team_recent_stats(self):
        """Create recent stats for all MLB teams"""
        logger.info("🏟️ Creating team recent stats...")
        
        team_stats = []
        current_season = self.current_date.year
        
        for team_name, team_abbrev in MLB_TEAMS.items():
            logger.info(f"📈 Processing team: {team_name} ({team_abbrev})")
            
            try:
                # Get team schedule and record
                schedule_data = schedule_and_record(current_season, team_abbrev)
                
                if schedule_data is not None and len(schedule_data) > 0:
                    # Get last 10 completed games
                    completed_games = schedule_data[schedule_data['W/L'].notna()].tail(10)
                    
                    if len(completed_games) > 0:
                        team_stat = self.aggregate_team_stats(completed_games, team_name, team_abbrev)
                        if team_stat:
                            team_stats.append(team_stat)
                
                # Rate limiting
                time.sleep(2)
                
            except Exception as e:
                logger.warning(f"⚠️ Error processing {team_name}: {str(e)}")
                continue
        
        # Store team stats
        if team_stats:
            try:
                result = self.supabase.table('team_recent_stats').upsert(
                    team_stats, 
                    on_conflict='team_abbreviation'
                ).execute()
                logger.info(f"✅ Stored {len(team_stats)} team recent stats")
            except Exception as e:
                logger.error(f"❌ Error storing team stats: {str(e)}")
        
        return len(team_stats)
    
    def aggregate_team_stats(self, games_df: pd.DataFrame, team_name: str, team_abbrev: str) -> Optional[Dict]:
        """Aggregate team stats from recent games"""
        try:
            wins = len(games_df[games_df['W/L'] == 'W'])
            losses = len(games_df[games_df['W/L'] == 'L'])
            
            avg_runs_scored = games_df['R'].mean() if 'R' in games_df.columns else 0
            avg_runs_allowed = games_df['RA'].mean() if 'RA' in games_df.columns else 0
            
            # Recent form (last 5 games)
            recent_5 = games_df.tail(5)
            recent_wins = len(recent_5[recent_5['W/L'] == 'W'])
            recent_losses = len(recent_5[recent_5['W/L'] == 'L'])
            
            return {
                'team_abbreviation': team_abbrev,
                'stats': {
                    'team_name': team_name,
                    'team_abbrev': team_abbrev,
                    'last_10_record': f"{wins}-{losses}",
                    'last_10_win_pct': round(wins / (wins + losses), 3) if (wins + losses) > 0 else 0,
                    'last_5_record': f"{recent_wins}-{recent_losses}",
                    'avg_runs_scored': round(avg_runs_scored, 2),
                    'avg_runs_allowed': round(avg_runs_allowed, 2),
                    'run_differential': round(avg_runs_scored - avg_runs_allowed, 2),
                    'games_played': len(games_df),
                    'data_source': 'pybaseball_schedule',
                    'updated_at': datetime.now().isoformat()
                },
                'updated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error aggregating team stats for {team_name}: {str(e)}")
            return None
    
    def run_production_fix(self):
        """Run complete production MLB data fix"""
        logger.info("🚀 Starting PRODUCTION MLB Data Fix...")
        
        # Step 1: Clean all fake data
        logger.info("Step 1: Cleaning ALL fake MLB data...")
        if not self.clean_all_fake_mlb_data():
            logger.error("❌ Failed to clean fake data")
            return False
        
        # Step 2: Process all players for real stats
        logger.info("Step 2: Getting real stats for ALL MLB players...")
        all_player_stats = self.process_all_mlb_players()
        
        # Step 3: Store player stats in batches
        logger.info("Step 3: Storing player stats in database...")
        if all_player_stats:
            batch_size = 100
            stored_total = 0
            
            for i in range(0, len(all_player_stats), batch_size):
                batch = all_player_stats[i:i + batch_size]
                stored_count = self.store_player_stats_batch(batch)
                stored_total += stored_count
                logger.info(f"💾 Stored batch {i//batch_size + 1}: {stored_count} records")
            
            logger.info(f"✅ Total player stats stored: {stored_total}")
        
        # Step 4: Create team recent stats
        logger.info("Step 4: Creating team recent stats...")
        team_count = self.create_team_recent_stats()
        
        # Summary
        logger.info("🎉 PRODUCTION MLB Data Fix Complete!")
        logger.info(f"📊 Summary:")
        logger.info(f"   - Cleaned all fake MLB records")
        logger.info(f"   - Processed {len(all_player_stats)} individual game stats")
        logger.info(f"   - Created {team_count} team recent stats")
        
        return True

def main():
    """Main production function"""
    logger.info("🔥 MLB Production Data Fix Started")
    
    try:
        fixer = MLBProductionFixer()
        success = fixer.run_production_fix()
        
        if success:
            logger.info("✅ MLB Production Data Fix completed successfully!")
        else:
            logger.error("❌ MLB Production Data Fix failed!")
            
    except Exception as e:
        logger.error(f"❌ Critical error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
