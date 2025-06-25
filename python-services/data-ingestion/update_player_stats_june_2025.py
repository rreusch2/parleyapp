#!/usr/bin/env python3
"""
Update Player Game Stats - April 13, 2025 to June 24, 2025
Uses pybaseball.statcast_batter() to fetch latest game data for all existing players
"""

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
from typing import Dict, List, Any, Optional
import logging

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('update_player_stats_june_2025.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PlayerStatsUpdater:
    """🔄 UPDATE PLAYER GAME STATS FROM APRIL 13 TO JUNE 24, 2025 🔄"""
    
    def __init__(self):
        self.conn = None
        self.processed_count = 0
        self.success_count = 0
        self.error_count = 0
        self.total_new_games = 0
        self._connect()
        
        # Enable pybaseball cache for faster processing
        pybaseball.cache.enable()
        logger.info("✅ Pybaseball cache enabled")
    
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
            logger.info("✅ Connected to database for stats update!")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def get_existing_players_with_stats(self) -> List[Dict]:
        """Get all existing players who have game stats and their latest game date"""
        cursor = self.conn.cursor()
        
        query = """
        SELECT 
            p.id as player_id,
            p.name,
            p.external_player_id as mlbam_id,
            p.team,
            MAX((pgs.stats->>'game_date')::date) as latest_game_date,
            COUNT(pgs.id) as total_games
        FROM players p
        INNER JOIN player_game_stats pgs ON p.id = pgs.player_id
        WHERE p.sport = 'MLB' 
        AND p.external_player_id IS NOT NULL
        AND pgs.stats->>'game_date' IS NOT NULL
        GROUP BY p.id, p.name, p.external_player_id, p.team
        HAVING MAX((pgs.stats->>'game_date')::date) >= '2024-01-01'
        ORDER BY MAX((pgs.stats->>'game_date')::date) DESC, COUNT(pgs.id) DESC;
        """
        
        cursor.execute(query)
        results = cursor.fetchall()
        cursor.close()
        
        players = []
        for row in results:
            players.append({
                'player_id': row[0],
                'name': row[1], 
                'mlbam_id': row[2],
                'team': row[3],
                'latest_game_date': row[4],
                'total_games': row[5]
            })
        
        logger.info(f"📊 Found {len(players)} players with existing game stats")
        logger.info(f"   Latest game date in DB: {players[0]['latest_game_date'] if players else 'None'}")
        
        return players
    
    def check_date_gap(self, players: List[Dict]) -> Dict:
        """Check what date range we need to fetch"""
        if not players:
            return {'start_date': '2025-04-13', 'end_date': '2025-06-24', 'days_gap': 72}
        
        latest_date = max(p['latest_game_date'] for p in players)
        start_date = latest_date + timedelta(days=1)  # Start from day after latest
        end_date = datetime.now().date()
        
        # Use specific date range requested
        start_date_str = '2025-04-14'  # Day after April 13
        end_date_str = '2025-06-24'
        
        gap_info = {
            'db_latest_date': str(latest_date),
            'start_date': start_date_str,
            'end_date': end_date_str,
            'days_gap': (datetime.strptime(end_date_str, '%Y-%m-%d').date() - 
                        datetime.strptime(start_date_str, '%Y-%m-%d').date()).days
        }
        
        logger.info(f"📅 DATE GAP ANALYSIS:")
        logger.info(f"   Latest in DB: {latest_date}")
        logger.info(f"   Fetching from: {start_date_str} to {end_date_str}")
        logger.info(f"   Days to fetch: {gap_info['days_gap']} days")
        
        return gap_info
    
    def update_player_stats(self, player: Dict, start_date: str, end_date: str) -> Dict:
        """Update stats for a single player"""
        logger.info(f"🔄 Updating {player['name']} (MLBAM: {player['mlbam_id']})")
        
        try:
            mlbam_id = int(player['mlbam_id'])
            
            # Fetch Statcast data using pybaseball
            logger.debug(f"   📊 Fetching Statcast data from {start_date} to {end_date}...")
            statcast_data = pybaseball.statcast_batter(start_date, end_date, player_id=mlbam_id)
            
            if statcast_data.empty:
                logger.info(f"   ⚠️ No new data found for {player['name']}")
                return {
                    'success': True,
                    'player_name': player['name'],
                    'games_added': 0,
                    'status': 'no_new_data'
                }
            
            logger.info(f"   📈 Found {len(statcast_data)} plate appearances")
            
            # Process the data
            cursor = self.conn.cursor()
            games_added = self._process_statcast_data(cursor, player['player_id'], statcast_data)
            self.conn.commit()
            
            logger.info(f"   ✅ Added {games_added} new games for {player['name']}")
            
            return {
                'success': True,
                'player_name': player['name'],
                'games_added': games_added,
                'status': 'updated',
                'plate_appearances': len(statcast_data)
            }
            
        except Exception as e:
            self.conn.rollback()
            logger.error(f"   ❌ Error updating {player['name']}: {e}")
            return {
                'success': False,
                'player_name': player['name'],
                'error': str(e),
                'games_added': 0
            }
    
    def _process_statcast_data(self, cursor, player_id: str, statcast_data: pd.DataFrame) -> int:
        """Process Statcast data into game-level stats (same logic as original)"""
        
        # Group by game date
        statcast_data['game_date'] = pd.to_datetime(statcast_data['game_date']).dt.date
        games = statcast_data.groupby('game_date')
        
        games_processed = 0
        
        for game_date, game_data in games:
            try:
                # Check if we already have this game
                cursor.execute("""
                    SELECT COUNT(*) FROM player_game_stats 
                    WHERE player_id = %s AND stats->>'game_date' = %s
                """, (player_id, str(game_date)))
                
                existing_count = cursor.fetchone()[0]
                if existing_count > 0:
                    logger.debug(f"   ⏭️ Skipping {game_date} - already exists")
                    continue
                
                # Calculate game statistics (same as original logic)
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
                
                # Create stats JSON (same structure as original)
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
                        id, event_id, player_id, stats, created_at
                    ) VALUES (%s, %s, %s, %s, NOW())
                """, (stats_id, event_id, player_id, json.dumps(game_stats)))
                
                games_processed += 1
                
            except Exception as e:
                logger.warning(f"   ⚠️ Error processing game {game_date}: {e}")
                continue
        
        return games_processed
    
    def run_update(self, max_players: Optional[int] = None) -> Dict:
        """Run the complete update process"""
        logger.info("🚀 STARTING PLAYER STATS UPDATE - APRIL 13 TO JUNE 24, 2025")
        logger.info("=" * 70)
        
        start_time = time.time()
        
        # Get existing players
        players = self.get_existing_players_with_stats()
        if not players:
            logger.error("❌ No players found!")
            return {'error': 'No players found'}
        
        # Check date gap
        date_info = self.check_date_gap(players)
        
        # Limit players if specified
        if max_players:
            players = players[:max_players]
            logger.info(f"🎯 Limited to first {max_players} players for testing")
        
        logger.info(f"🔄 Processing {len(players)} players...")
        
        results = {
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'total_new_games': 0,
            'date_range': date_info,
            'player_results': []
        }
        
        # Process each player
        for i, player in enumerate(players, 1):
            logger.info(f"📊 Progress: {i}/{len(players)} - {player['name']}")
            
            result = self.update_player_stats(
                player, 
                date_info['start_date'], 
                date_info['end_date']
            )
            
            results['processed'] += 1
            if result['success']:
                results['successful'] += 1
                results['total_new_games'] += result['games_added']
            else:
                results['failed'] += 1
            
            results['player_results'].append(result)
            
            # Progress update every 10 players
            if i % 10 == 0:
                progress = (i / len(players)) * 100
                logger.info(f"📈 PROGRESS: {progress:.1f}% | "
                           f"✅ {results['successful']} success | "
                           f"❌ {results['failed']} failed | "
                           f"🎮 {results['total_new_games']} new games")
            
            # Rate limiting to avoid overwhelming the API
            time.sleep(1)
        
        total_time = time.time() - start_time
        
        # Final stats
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM player_game_stats")
        total_games = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT player_id) FROM player_game_stats")
        total_players = cursor.fetchone()[0]
        
        # Get latest date after update
        cursor.execute("""
            SELECT MAX((stats->>'game_date')::date) 
            FROM player_game_stats 
            WHERE stats->>'game_date' IS NOT NULL
        """)
        latest_date = cursor.fetchone()[0]
        
        logger.info("🏁 UPDATE COMPLETE!")
        logger.info("=" * 70)
        logger.info(f"📊 RESULTS:")
        logger.info(f"   Players Processed: {results['processed']}")
        logger.info(f"   Successful Updates: {results['successful']}")
        logger.info(f"   Failed Updates: {results['failed']}")
        logger.info(f"   New Games Added: {results['total_new_games']}")
        logger.info(f"   Processing Time: {total_time/60:.1f} minutes")
        logger.info(f"🎉 FINAL DATABASE STATS:")
        logger.info(f"   Total Players: {total_players}")
        logger.info(f"   Total Game Records: {total_games}")
        logger.info(f"   Latest Game Date: {latest_date}")
        
        results['final_stats'] = {
            'total_players': total_players,
            'total_games': total_games,
            'latest_game_date': str(latest_date),
            'processing_time_minutes': total_time / 60
        }
        
        return results
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

def main():
    """🔄 RUN PLAYER STATS UPDATE"""
    updater = PlayerStatsUpdater()
    
    try:
        # For testing, start with just 10 players
        print("🧪 TEST MODE: Update first 10 players? (y/n)")
        response = input().lower().strip()
        
        if response == 'y':
            results = updater.run_update(max_players=10)
        else:
            results = updater.run_update()  # All players
        
        print(f"\n🎉 UPDATE COMPLETE!")
        print(f"Summary: {results.get('final_stats', results)}")
        
    except KeyboardInterrupt:
        logger.info("🛑 Operation cancelled by user")
    except Exception as e:
        logger.error(f"❌ Update failed: {e}")
    finally:
        updater.close()

if __name__ == "__main__":
    main() 