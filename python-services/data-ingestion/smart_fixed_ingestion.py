#!/usr/bin/env python3

import psycopg2
import pybaseball
import pandas as pd
import numpy as np
import os
import json
import time
import uuid
from dotenv import load_dotenv
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set
import logging

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('smart_fixed_ingestion.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SmartFixedPlayerIngestion:
    """🎯 FIXED SYSTEM TO ADD NEW PLAYERS WITH CORRECT MLBAM IDs! 🎯"""
    
    def __init__(self):
        self.conn = None
        # Enable pybaseball cache
        pybaseball.cache.enable()
        self._connect()
    
    def _connect(self):
        """Connect to Supabase database"""
        try:
            self.conn = psycopg2.connect(
                host=os.getenv('DB_HOST'),
                database=os.getenv('DB_NAME'),
                user=os.getenv('DB_USER'),
                password=os.getenv('DB_PASSWORD'),
                port=int(os.getenv('DB_PORT', 5432)),
                sslmode='require'
            )
            logger.info("✅ Connected to database for FIXED SMART INGESTION!")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def get_existing_players(self) -> tuple:
        """Get all existing players from database to avoid duplicates"""
        
        cursor = self.conn.cursor()
        
        # Get all existing players
        cursor.execute("""
            SELECT 
                p.external_player_id,
                p.name,
                COUNT(pgs.id) as game_count
            FROM players p
            LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
            WHERE p.sport = 'MLB'
            GROUP BY p.id, p.external_player_id, p.name
            ORDER BY game_count DESC;
        """)
        
        existing_players = cursor.fetchall()
        cursor.close()
        
        existing_ids = set()
        existing_names = set()
        total_with_games = 0
        
        for mlb_id, name, game_count in existing_players:
            if mlb_id:
                existing_ids.add(str(mlb_id))
            if name:
                existing_names.add(name)
            if game_count > 0:
                total_with_games += 1
        
        logger.info(f"📊 EXISTING PLAYERS IN DATABASE:")
        logger.info(f"   Total Players: {len(existing_players)}")
        logger.info(f"   Players with Game Data: {total_with_games}")
        logger.info(f"   Unique MLB IDs: {len(existing_ids)}")
        
        return existing_ids, existing_names, total_with_games
    
    def get_player_id_mapping(self) -> pd.DataFrame:
        """Get comprehensive player ID mapping with MLBAM IDs"""
        
        logger.info("🔍 Getting player ID mapping with MLBAM IDs...")
        
        try:
            # Get 2024 roster data which has MLBAM IDs
            rosters_2024 = []
            
            # Get 2024 team rosters
            teams = ['LAD', 'SD', 'NYY', 'BOS', 'HOU', 'LAA', 'TEX', 'ATL']  # Sample teams first
            
            for team in teams:
                try:
                    roster = pybaseball.team_batting(2024, team)
                    if not roster.empty:
                        roster['Team'] = team
                        rosters_2024.append(roster)
                except Exception as e:
                    logger.debug(f"Could not get roster for {team}: {e}")
                    continue
            
            if rosters_2024:
                all_rosters = pd.concat(rosters_2024, ignore_index=True)
                
                # Clean up names and get unique players
                all_rosters = all_rosters.dropna(subset=['Name'])
                all_rosters = all_rosters.drop_duplicates(subset=['Name'])
                
                logger.info(f"📊 Found {len(all_rosters)} players from team rosters")
                return all_rosters
            else:
                logger.warning("⚠️ No roster data found, trying alternative method...")
                
                # Fallback: Use playerid_lookup for common names
                common_names = [
                    ("Jose", "Altuve"), ("Aaron", "Judge"), ("Mookie", "Betts"), 
                    ("Bryce", "Harper"), ("Mike", "Trout"), ("Ronald", "Acuna"),
                    ("Vladimir", "Guerrero"), ("Fernando", "Tatis"), ("Cody", "Bellinger"),
                    ("Freddie", "Freeman")
                ]
                
                all_players = []
                for first, last in common_names:
                    try:
                        lookup = pybaseball.playerid_lookup(last, first)
                        if not lookup.empty:
                            lookup['Name'] = lookup['name_first'] + ' ' + lookup['name_last']
                            lookup['key_mlbam'] = lookup['key_mlbam'].astype(str)
                            all_players.append(lookup)
                    except Exception as e:
                        logger.debug(f"Lookup failed for {first} {last}: {e}")
                        continue
                
                if all_players:
                    return pd.concat(all_players, ignore_index=True)
                else:
                    return pd.DataFrame()
                
        except Exception as e:
            logger.error(f"❌ Error getting player ID mapping: {e}")
            return pd.DataFrame()
    
    def discover_new_players_simplified(self, target_total: int = 150) -> List[Dict]:
        """Simplified discovery focusing on teams we know have Statcast data"""
        
        logger.info(f"🔍 SIMPLIFIED DISCOVERY FOR {target_total} TOTAL PLAYERS...")
        
        # Get existing players first
        existing_ids, existing_names, current_count = self.get_existing_players()
        
        needed_players = target_total - current_count
        logger.info(f"🎯 Need {needed_players} NEW players to reach {target_total} total")
        
        if needed_players <= 0:
            logger.info(f"🎉 Already have {current_count} players! Target reached.")
            return []
        
        new_players = []
        
        # Use major teams with known Statcast coverage
        major_teams = [
            'LAD', 'SD', 'NYY', 'BOS', 'HOU', 'LAA', 'TEX', 'ATL', 'PHI', 'NYM',
            'SF', 'TOR', 'TB', 'SEA', 'MIN', 'CHC', 'STL', 'MIL', 'CLE', 'DET'
        ]
        
        try:
            for team in major_teams:
                if len(new_players) >= needed_players:
                    break
                    
                try:
                    logger.info(f"   🔍 Getting {team} roster...")
                    team_stats = pybaseball.team_batting(2024, team)
                    
                    if team_stats.empty:
                        continue
                    
                    # Process each player on this team
                    for idx, player_row in team_stats.iterrows():
                        if len(new_players) >= needed_players:
                            break
                            
                        name = player_row.get('Name', '')
                        
                        # Skip if we already have this player
                        if name in existing_names:
                            continue
                        
                        # Try to get MLBAM ID using playerid_lookup
                        try:
                            name_parts = name.split()
                            if len(name_parts) >= 2:
                                first_name = name_parts[0]
                                last_name = ' '.join(name_parts[1:])
                                
                                lookup = pybaseball.playerid_lookup(last_name, first_name)
                                
                                if not lookup.empty and 'key_mlbam' in lookup.columns:
                                    mlbam_id = lookup.iloc[0]['key_mlbam']
                                    
                                    if pd.notna(mlbam_id):
                                        games = player_row.get('G', 0)
                                        
                                        # Determine priority
                                        if games >= 120:
                                            priority = 1
                                        elif games >= 80:
                                            priority = 2
                                        else:
                                            priority = 3
                                        
                                        new_player = {
                                            'name': name,
                                            'mlb_id': str(int(mlbam_id)),
                                            'team': team,
                                            'position': 'UNK',
                                            'priority': priority,
                                            'games_2024': games
                                        }
                                        
                                        new_players.append(new_player)
                                        logger.info(f"      ✅ Found {name} (MLBAM: {mlbam_id})")
                            
                        except Exception as e:
                            logger.debug(f"Could not process {name}: {e}")
                            continue
                
                except Exception as e:
                    logger.warning(f"Could not process team {team}: {e}")
                    continue
            
            # Sort by priority and games
            new_players.sort(key=lambda x: (x['priority'], -x['games_2024']))
            
            logger.info(f"🎯 DISCOVERED {len(new_players)} NEW PLAYERS:")
            logger.info(f"   Priority 1: {sum(1 for p in new_players if p['priority'] == 1)}")
            logger.info(f"   Priority 2: {sum(1 for p in new_players if p['priority'] == 2)}")
            logger.info(f"   Priority 3: {sum(1 for p in new_players if p['priority'] == 3)}")
            
            return new_players
            
        except Exception as e:
            logger.error(f"❌ Player discovery failed: {e}")
            return []
    
    def process_new_player(self, player_data: Dict) -> Dict[str, Any]:
        """Process a single NEW player with Statcast data"""
        
        try:
            cursor = self.conn.cursor()
            
            # Create player record
            player_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO players (
                    id, external_player_id, name, position, team, sport,
                    player_key, player_name, sport_key, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                player_id, player_data['mlb_id'], player_data['name'], 
                player_data['position'], player_data['team'], 'MLB', 
                f"mlb_{player_data['mlb_id']}", player_data['name'], None, 'active'
            ))
            
            # Get Statcast data using CORRECT MLBAM ID
            start_date = '2024-04-01'
            end_date = '2024-10-31'
            
            logger.info(f"   📊 Fetching Statcast for {player_data['name']} (MLBAM: {player_data['mlb_id']})...")
            
            try:
                mlbam_id = int(player_data['mlb_id'])
                statcast_data = pybaseball.statcast_batter(start_date, end_date, player_id=mlbam_id)
                
                if statcast_data.empty:
                    logger.warning(f"   ⚠️ No Statcast data for {player_data['name']}")
                    self.conn.commit()  # Still commit the player record
                    return {
                        'success': True,
                        'player_name': player_data['name'],
                        'games_added': 0,
                        'status': 'no_statcast'
                    }
                
                # Process Statcast data into game records
                games_added = self._process_statcast_data(cursor, player_id, statcast_data)
                
                self.conn.commit()
                
                logger.info(f"   ✅ {player_data['name']}: {games_added} games from {len(statcast_data)} plate appearances")
                
                return {
                    'success': True,
                    'player_name': player_data['name'],
                    'games_added': games_added,
                    'status': 'success',
                    'plate_appearances': len(statcast_data)
                }
                
            except Exception as e:
                self.conn.rollback()
                logger.error(f"   ❌ Statcast error for {player_data['name']}: {e}")
                return {
                    'success': False,
                    'player_name': player_data['name'],
                    'error': str(e),
                    'games_added': 0
                }
                
        except Exception as e:
            self.conn.rollback()
            logger.error(f"❌ Player processing error for {player_data['name']}: {e}")
            return {
                'success': False,
                'player_name': player_data['name'],
                'error': str(e),
                'games_added': 0
            }
    
    def _process_statcast_data(self, cursor, player_id: str, statcast_data: pd.DataFrame) -> int:
        """Process Statcast data into game records"""
        
        # Group by game date
        statcast_data['game_date'] = pd.to_datetime(statcast_data['game_date']).dt.date
        games = statcast_data.groupby('game_date')
        
        games_processed = 0
        
        for game_date, game_data in games:
            try:
                # Calculate game stats
                events = game_data['events'].dropna().tolist()
                at_bats = len(game_data[game_data['events'].notna()])
                hits = len(game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])])
                home_runs = len(game_data[game_data['events'] == 'home_run'])
                
                # Advanced metrics from Statcast
                hit_data = game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])]
                avg_exit_velo = hit_data['launch_speed'].mean() if not hit_data.empty else None
                avg_launch_angle = hit_data['launch_angle'].mean() if not hit_data.empty else None
                
                # Create comprehensive stats
                game_stats = {
                    'type': 'batting',
                    'game_date': str(game_date),
                    'at_bats': at_bats,
                    'hits': hits,
                    'home_runs': home_runs,
                    'events': events,
                    'pitch_count': len(game_data),
                    'avg_launch_speed': float(avg_exit_velo) if pd.notna(avg_exit_velo) else None,
                    'avg_launch_angle': float(avg_launch_angle) if pd.notna(avg_launch_angle) else None,
                    'estimated_ba': hits / at_bats if at_bats > 0 else 0
                }
                
                # Insert game record
                stats_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO player_game_stats (
                        id, event_id, player_id, stats
                    ) VALUES (%s, %s, %s, %s)
                """, (stats_id, None, player_id, json.dumps(game_stats)))
                
                games_processed += 1
                
            except Exception as e:
                logger.debug(f"Error processing game {game_date}: {e}")
                continue
        
        return games_processed
    
    def run_fixed_ingestion(self, target_total: int = 150) -> Dict[str, Any]:
        """🚀 RUN FIXED INGESTION WITH CORRECT IDs! 🚀"""
        
        logger.info(f"🚀 STARTING FIXED INGESTION TO {target_total} TOTAL PLAYERS!")
        logger.info("=" * 60)
        
        # Discover new players
        new_players = self.discover_new_players_simplified(target_total)
        
        if not new_players:
            return {'message': f'Already at target of {target_total} players!'}
        
        logger.info(f"🎯 PROCESSING {len(new_players)} NEW PLAYERS...")
        
        results = {
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'total_new_games': 0,
            'details': []
        }
        
        for i, player_data in enumerate(new_players, 1):
            logger.info(f"🔄 {i}/{len(new_players)}: {player_data['name']}")
            
            result = self.process_new_player(player_data)
            
            results['processed'] += 1
            if result['success']:
                results['successful'] += 1
                results['total_new_games'] += result['games_added']
            else:
                results['failed'] += 1
            
            results['details'].append(result)
            
            if i % 3 == 0:
                logger.info(f"📊 Progress: {i}/{len(new_players)} | "
                           f"✅ {results['successful']} success | "
                           f"🎮 {results['total_new_games']} new games")
            
            time.sleep(1)  # Rate limiting
        
        # Final stats
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM player_game_stats")
        total_games = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT player_id) FROM player_game_stats")
        total_players = cursor.fetchone()[0]
        
        logger.info(f"🏁 FIXED INGESTION COMPLETE!")
        logger.info("=" * 60)
        logger.info(f"📊 RESULTS:")
        logger.info(f"   NEW Players: {results['successful']}")
        logger.info(f"   NEW Games: {results['total_new_games']}")
        logger.info(f"🎉 DATABASE TOTALS:")
        logger.info(f"   Total Players: {total_players}")
        logger.info(f"   Total Games: {total_games}")
        
        return results
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


def main():
    """🚀 MAIN ENTRY POINT! 🚀"""
    ingestion = SmartFixedPlayerIngestion()
    
    try:
        results = ingestion.run_fixed_ingestion(target_total=150)
        print(f"\n🎉 SUCCESS! Results: {results}")
        
    except KeyboardInterrupt:
        logger.info("🛑 Cancelled by user")
    except Exception as e:
        logger.error(f"❌ Failed: {e}")
    finally:
        ingestion.close()


if __name__ == "__main__":
    main() 