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
        logging.FileHandler('smart_new_ingestion.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SmartNewPlayerIngestion:
    """🎯 SMART SYSTEM TO ADD NEW PLAYERS WITHOUT DUPLICATES! 🎯"""
    
    def __init__(self):
        self.conn = None
        self.existing_player_ids = set()
        self.existing_player_names = set()
        self._connect()
        
        # Enable pybaseball cache
        pybaseball.cache.enable()
    
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
            logger.info("✅ Connected to database for SMART NEW PLAYER INGESTION!")
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
    
    def discover_new_players(self, target_total: int = 500) -> List[Dict]:
        """Discover NEW players we don't have yet"""
        
        logger.info(f"🔍 DISCOVERING NEW PLAYERS TO REACH {target_total} TOTAL...")
        
        # Get existing players first
        existing_ids, existing_names, current_count = self.get_existing_players()
        
        needed_players = target_total - current_count
        logger.info(f"🎯 Need {needed_players} NEW players to reach {target_total} total")
        
        if needed_players <= 0:
            logger.info(f"🎉 Already have {current_count} players! No new players needed.")
            return []
        
        new_players = []
        
        try:
            # Get 2024 season batting stats (comprehensive list)
            logger.info("📊 Fetching 2024 MLB season batting stats...")
            season_stats = pybaseball.batting_stats(2024, qual=1)
            
            if not season_stats.empty:
                logger.info(f"📈 Found {len(season_stats)} players from 2024 season!")
                
                for idx, player_row in season_stats.iterrows():
                    try:
                        name = player_row.get('Name', f"Player_{idx}")
                        team = player_row.get('Team', 'UNK')
                        
                        # Try to get MLB ID
                        mlb_id = None
                        if 'IDfg' in player_row and pd.notna(player_row['IDfg']):
                            mlb_id = str(int(player_row['IDfg']))
                        elif 'mlbam_id' in player_row and pd.notna(player_row['mlbam_id']):
                            mlb_id = str(int(player_row['mlbam_id']))
                        else:
                            continue
                        
                        # Skip if we already have this player
                        if mlb_id in existing_ids or name in existing_names:
                            continue
                        
                        # Determine priority based on performance
                        games = player_row.get('G', 0)
                        at_bats = player_row.get('AB', 0)
                        
                        if games >= 100 and at_bats >= 300:
                            priority = 1  # High value player
                        elif games >= 50:
                            priority = 2  # Regular contributor
                        elif games >= 20:
                            priority = 3  # Part-time player
                        else:
                            priority = 4  # Limited appearances
                        
                        new_player = {
                            'name': name,
                            'mlb_id': mlb_id,
                            'team': team,
                            'position': 'UNK',
                            'priority': priority,
                            'games_2024': games,
                            'at_bats_2024': at_bats
                        }
                        
                        new_players.append(new_player)
                        
                        # Stop when we have enough
                        if len(new_players) >= needed_players * 2:  # Get extra for filtering
                            break
                        
                    except Exception as e:
                        logger.warning(f"Error processing player {idx}: {e}")
                        continue
            
            # Sort by priority and games played
            new_players.sort(key=lambda x: (x['priority'], -x['games_2024']))
            
            # Take only what we need
            selected_players = new_players[:needed_players]
            
            logger.info(f"🎯 SELECTED {len(selected_players)} NEW PLAYERS:")
            logger.info(f"   Priority 1 (High Value): {sum(1 for p in selected_players if p['priority'] == 1)}")
            logger.info(f"   Priority 2 (Regular): {sum(1 for p in selected_players if p['priority'] == 2)}")
            logger.info(f"   Priority 3 (Part-time): {sum(1 for p in selected_players if p['priority'] == 3)}")
            logger.info(f"   Priority 4 (Limited): {sum(1 for p in selected_players if p['priority'] == 4)}")
            
            return selected_players
            
        except Exception as e:
            logger.error(f"❌ Player discovery failed: {e}")
            return []
    
    def process_new_player(self, player_data: Dict) -> Dict[str, Any]:
        """Process a single NEW player and add their game data"""
        
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
            
            # Get Statcast data for full 2024 season
            start_date = '2024-04-01'
            end_date = '2024-10-31'
            
            logger.info(f"   📊 Fetching Statcast data for {player_data['name']}...")
            
            try:
                player_id_int = int(player_data['mlb_id'])
                statcast_data = pybaseball.statcast_batter(start_date, end_date, player_id=player_id_int)
                
                if statcast_data.empty:
                    logger.warning(f"   ⚠️ No Statcast data found for {player_data['name']}")
                    return {
                        'success': True,
                        'player_name': player_data['name'],
                        'games_added': 0,
                        'status': 'no_statcast_data'
                    }
                
                # Process game data
                games_added = self._process_statcast_data(cursor, player_id, statcast_data)
                
                self.conn.commit()
                
                logger.info(f"   ✅ Added {games_added} games for {player_data['name']}")
                
                return {
                    'success': True,
                    'player_name': player_data['name'],
                    'games_added': games_added,
                    'status': 'processed',
                    'plate_appearances': len(statcast_data)
                }
                
            except Exception as e:
                self.conn.rollback()
                logger.error(f"   ❌ Statcast error for {player_data['name']}: {e}")
                return {
                    'success': False,
                    'player_name': player_data['name'],
                    'error': f'Statcast error: {str(e)}',
                    'games_added': 0
                }
                
        except Exception as e:
            self.conn.rollback()
            logger.error(f"❌ Processing error for {player_data['name']}: {e}")
            return {
                'success': False,
                'player_name': player_data['name'],
                'error': f'Processing error: {str(e)}',
                'games_added': 0
            }
    
    def _process_statcast_data(self, cursor, player_id: str, statcast_data: pd.DataFrame) -> int:
        """Process Statcast data for a player"""
        
        # Group by game date
        statcast_data['game_date'] = pd.to_datetime(statcast_data['game_date']).dt.date
        games = statcast_data.groupby('game_date')
        
        games_processed = 0
        
        for game_date, game_data in games:
            try:
                # Calculate game statistics
                events = game_data['events'].dropna().tolist()
                at_bats = len(game_data[game_data['events'].notna()])
                hits = len(game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])])
                home_runs = len(game_data[game_data['events'] == 'home_run'])
                strikeouts = len(game_data[game_data['events'] == 'strikeout'])
                walks = len(game_data[game_data['events'] == 'walk'])
                
                # Advanced metrics
                hit_data = game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])]
                avg_launch_speed = hit_data['launch_speed'].mean() if not hit_data.empty else None
                avg_launch_angle = hit_data['launch_angle'].mean() if not hit_data.empty else None
                max_hit_distance = hit_data['hit_distance_sc'].max() if not hit_data.empty else None
                
                # Calculate estimates
                estimated_ba = hits / at_bats if at_bats > 0 else 0
                estimated_woba = (walks * 0.69 + hits * 0.888 + home_runs * 1.271) / at_bats if at_bats > 0 else 0
                
                # Create stats JSON
                game_stats = {
                    'type': 'batting',
                    'game_date': str(game_date),
                    'at_bats': at_bats,
                    'hits': hits,
                    'home_runs': home_runs,
                    'strikeouts': strikeouts,
                    'walks': walks,
                    'events': events,
                    'pitch_count': len(game_data),
                    'avg_launch_speed': float(avg_launch_speed) if pd.notna(avg_launch_speed) else None,
                    'avg_launch_angle': float(avg_launch_angle) if pd.notna(avg_launch_angle) else None,
                    'max_hit_distance': float(max_hit_distance) if pd.notna(max_hit_distance) else None,
                    'estimated_ba': estimated_ba,
                    'estimated_woba': estimated_woba
                }
                
                # Find matching sports_event
                event_id = None
                cursor.execute("""
                    SELECT id FROM sports_events 
                    WHERE sport = 'baseball' 
                    AND DATE(start_time) = %s
                    LIMIT 1
                """, (game_date,))
                
                result = cursor.fetchone()
                if result:
                    event_id = str(result[0])
                
                # Insert player game stats
                stats_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO player_game_stats (
                        id, event_id, player_id, stats
                    ) VALUES (%s, %s, %s, %s)
                """, (stats_id, event_id, player_id, json.dumps(game_stats)))
                
                games_processed += 1
                
            except Exception as e:
                logger.warning(f"Error processing game {game_date}: {e}")
                continue
        
        return games_processed
    
    def run_smart_ingestion(self, target_total: int = 500) -> Dict[str, Any]:
        """🎯 RUN SMART NEW PLAYER INGESTION TO REACH TARGET! 🎯"""
        
        logger.info(f"🚀 STARTING SMART NEW PLAYER INGESTION TO {target_total} TOTAL!")
        logger.info("=" * 70)
        
        # Discover new players we need
        new_players = self.discover_new_players(target_total)
        
        if not new_players:
            return {'message': 'No new players needed!'}
        
        logger.info(f"🎯 PROCESSING {len(new_players)} NEW PLAYERS...")
        
        start_time = time.time()
        results = {
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'total_new_games': 0,
            'new_players': []
        }
        
        for i, player_data in enumerate(new_players, 1):
            logger.info(f"🔄 Processing {i}/{len(new_players)}: {player_data['name']}")
            
            result = self.process_new_player(player_data)
            
            results['processed'] += 1
            if result['success']:
                results['successful'] += 1
                results['total_new_games'] += result['games_added']
            else:
                results['failed'] += 1
            
            results['new_players'].append(result)
            
            # Progress update every 10 players
            if i % 10 == 0:
                progress = (i / len(new_players)) * 100
                logger.info(f"📊 PROGRESS: {i}/{len(new_players)} ({progress:.1f}%) | "
                           f"✅ {results['successful']} success | ❌ {results['failed']} failed | "
                           f"🎮 {results['total_new_games']} new games")
            
            # Rate limiting
            time.sleep(1)
        
        total_time = time.time() - start_time
        
        # Final database stats
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM player_game_stats")
        total_games = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT player_id) FROM player_game_stats")
        total_players = cursor.fetchone()[0]
        
        logger.info(f"🏁 SMART INGESTION COMPLETE!")
        logger.info("=" * 70)
        logger.info(f"📊 FINAL RESULTS:")
        logger.info(f"   NEW Players Added: {results['successful']}")
        logger.info(f"   NEW Games Added: {results['total_new_games']}")
        logger.info(f"   Processing Time: {total_time/60:.1f} minutes")
        logger.info(f"🎉 FINAL DATABASE STATS:")
        logger.info(f"   Total Players: {total_players}")
        logger.info(f"   Total Game Records: {total_games}")
        logger.info(f"   Average Games/Player: {total_games/max(total_players,1):.1f}")
        
        results['final_stats'] = {
            'total_players': total_players,
            'total_games': total_games,
            'processing_time_minutes': total_time / 60
        }
        
        return results
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


def main():
    """🎯 RUN SMART NEW PLAYER INGESTION! 🎯"""
    ingestion = SmartNewPlayerIngestion()
    
    try:
        # Smart ingestion to reach 500 total players
        results = ingestion.run_smart_ingestion(target_total=500)
        
        print(f"\n🎉 SMART INGESTION COMPLETE!")
        print(f"Results summary: {results.get('final_stats', results)}")
        
    except KeyboardInterrupt:
        logger.info("🛑 Operation cancelled by user")
    except Exception as e:
        logger.error(f"❌ Smart ingestion failed: {e}")
    finally:
        ingestion.close()


if __name__ == "__main__":
    main() 