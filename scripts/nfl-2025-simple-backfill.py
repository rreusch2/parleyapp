#!/usr/bin/env python3
"""
NFL 2025 Simple Stats Backfill - Weeks 1-4
Just get the stats, no event_id complexity
"""

import os
import sys
import logging
import re
import time
import argparse
from datetime import datetime
from typing import Dict, List, Optional
import requests

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client
from dotenv import load_dotenv

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(project_root, '.env'))

SEASON = 2025
OFFENSIVE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K']

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/nfl-simple-backfill.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class NFLSimpleBackfill:
    def __init__(self):
        self.supabase = self._init_supabase()
        self.statmuse_url = os.getenv("STATMUSE_API_URL", "https://web-production-f090e.up.railway.app")
        self.stats = {'processed': 0, 'inserted': 0, 'skipped': 0, 'failed': 0}

    def _init_supabase(self) -> Client:
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        if not url or not key:
            raise ValueError("Missing Supabase credentials")
        return create_client(url, key)

    def get_offensive_players(self) -> List[Dict]:
        """Get all NFL offensive players with team data"""
        try:
            response = self.supabase.table('players').select(
                'id, name, team, position'
            ).eq('sport', 'NFL').in_('position', OFFENSIVE_POSITIONS).execute()
            
            # Filter out players without team
            players = [p for p in response.data if p.get('team')]
            logger.info(f"Found {len(players)} NFL offensive players with team data")
            return players
        except Exception as e:
            logger.error(f"Error fetching players: {e}")
            return []

    def get_existing_weeks(self, player_id: str) -> set:
        """Get weeks that already exist for a player"""
        try:
            response = self.supabase.table('player_game_stats').select(
                'stats'
            ).eq('player_id', player_id).execute()
            
            existing = set()
            for record in response.data:
                stats = record.get('stats', {})
                if stats.get('league') == 'NFL' and stats.get('season') == SEASON:
                    week = stats.get('week')
                    if week:
                        existing.add(int(week))
            
            return existing
        except Exception as e:
            logger.error(f"Error fetching existing weeks: {e}")
            return set()

    def query_statmuse(self, player_name: str, position: str, week: int) -> Optional[Dict]:
        """Query StatMuse for player stats"""
        try:
            # Position-specific queries
            if position == 'QB':
                prompt = f"{player_name} passing yards touchdowns interceptions Week {week} 2025"
            elif position == 'RB':
                prompt = f"{player_name} rushing yards touchdowns receptions Week {week} 2025"
            elif position in ['WR', 'TE']:
                prompt = f"{player_name} receptions yards touchdowns Week {week} 2025"
            elif position == 'K':
                prompt = f"{player_name} field goals extra points Week {week} 2025"
            else:
                prompt = f"{player_name} stats Week {week} 2025"
            
            response = requests.post(
                f"{self.statmuse_url}/api/query",
                json={"query": prompt},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    return data
            
            time.sleep(0.08)
            return None
            
        except Exception as e:
            logger.debug(f"StatMuse query error for {player_name}: {e}")
            return None

    def extract_stats(self, statmuse_data: Dict, position: str) -> Dict:
        """Extract numeric stats from StatMuse response"""
        answer = statmuse_data.get('answer', '')
        stats = {}
        
        # Extract all numbers from answer
        numbers = re.findall(r'\d+\.?\d*', answer)
        if not numbers:
            return stats
        
        # Convert to floats
        nums = [float(n) for n in numbers]
        
        if position == 'QB' and len(nums) >= 3:
            stats['passing_yards'] = nums[0]
            stats['passing_touchdowns'] = nums[1]
            stats['passing_interceptions'] = nums[2]
            if len(nums) >= 4:
                stats['rushing_yards'] = nums[3]
        elif position == 'RB' and len(nums) >= 2:
            stats['rushing_yards'] = nums[0]
            stats['rushing_touchdowns'] = nums[1]
            if len(nums) >= 3:
                stats['receptions'] = nums[2]
            if len(nums) >= 4:
                stats['receiving_yards'] = nums[3]
        elif position in ['WR', 'TE'] and len(nums) >= 3:
            stats['receptions'] = nums[0]
            stats['receiving_yards'] = nums[1]
            stats['receiving_touchdowns'] = nums[2]
        elif position == 'K' and len(nums) >= 2:
            stats['field_goals_made'] = nums[0]
            stats['extra_points_made'] = nums[1]
        
        return stats

    def calculate_fantasy_points(self, stats: Dict) -> float:
        """Calculate standard fantasy points"""
        points = 0.0
        
        # Passing (0.04 per yard, 4 per TD, -2 per INT)
        points += stats.get('passing_yards', 0) * 0.04
        points += stats.get('passing_touchdowns', 0) * 4
        points -= stats.get('passing_interceptions', 0) * 2
        
        # Rushing (0.1 per yard, 6 per TD)
        points += stats.get('rushing_yards', 0) * 0.1
        points += stats.get('rushing_touchdowns', 0) * 6
        
        # Receiving (1 per reception, 0.1 per yard, 6 per TD)
        points += stats.get('receptions', 0) * 1
        points += stats.get('receiving_yards', 0) * 0.1
        points += stats.get('receiving_touchdowns', 0) * 6
        
        # Kicking (3 per FG, 1 per XP)
        points += stats.get('field_goals_made', 0) * 3
        points += stats.get('extra_points_made', 0) * 1
        
        return round(points, 2)

    def insert_player_week_stats(self, player_id: str, player_name: str, team: str, 
                                 position: str, week: int, stats: Dict) -> bool:
        """Insert player stats for a specific week (no event_id required)"""
        try:
            # Build complete stats object
            complete_stats = {
                'league': 'NFL',
                'season': SEASON,
                'week': week,
                'season_type': 'REG',
                'team': team,
                'position': position,
                **stats,
                'fantasy_points': self.calculate_fantasy_points(stats),
                'fantasy_points_ppr': self.calculate_fantasy_points(stats),
                'data_source': 'statmuse',
                'updated_at': datetime.now().isoformat()
            }
            
            # Insert without event_id
            self.supabase.table('player_game_stats').insert({
                'player_id': player_id,
                'stats': complete_stats,
                'created_at': datetime.now().isoformat()
            }).execute()
            
            self.stats['inserted'] += 1
            logger.info(f"✅ {player_name} Week {week}: {complete_stats.get('fantasy_points', 0)} pts")
            return True
            
        except Exception as e:
            # Check if it's a duplicate
            if 'duplicate' in str(e).lower() or 'unique' in str(e).lower():
                self.stats['skipped'] += 1
                logger.debug(f"Skipped {player_name} Week {week} (duplicate)")
            else:
                logger.error(f"Error storing {player_name} Week {week}: {e}")
                self.stats['failed'] += 1
            return False

    def process_player(self, player: Dict, weeks: List[int]) -> int:
        """Process a single player for specified weeks"""
        player_id = player['id']
        player_name = player['name']
        team = player.get('team', '')
        position = player.get('position', '')
        
        # Get existing weeks to skip
        existing_weeks = self.get_existing_weeks(player_id)
        weeks_to_fetch = [w for w in weeks if w not in existing_weeks]
        
        if not weeks_to_fetch:
            logger.debug(f"{player_name} already has all weeks")
            return 0
        
        success_count = 0
        
        for week in weeks_to_fetch:
            self.stats['processed'] += 1
            
            # Query StatMuse
            statmuse_data = self.query_statmuse(player_name, position, week)
            if not statmuse_data:
                self.stats['skipped'] += 1
                continue
            
            # Extract stats
            stats = self.extract_stats(statmuse_data, position)
            if not stats:
                self.stats['skipped'] += 1
                continue
            
            # Insert stats (no event_id)
            if self.insert_player_week_stats(player_id, player_name, team, position, week, stats):
                success_count += 1
            
            time.sleep(0.1)  # Rate limiting
        
        return success_count

    def run(self, weeks: List[int], limit: Optional[int] = None):
        """Run the backfill"""
        logger.info("="*80)
        logger.info(f"NFL 2025 SIMPLE STATS BACKFILL - Weeks {weeks}")
        logger.info("="*80)
        
        start_time = time.time()
        
        # Get players
        players = self.get_offensive_players()
        if not players:
            logger.error("No players found")
            return
        
        if limit:
            players = players[:limit]
            logger.info(f"Limited to first {limit} players")
        
        # Process each player
        for idx, player in enumerate(players, 1):
            logger.info(f"\n[{idx}/{len(players)}] {player['name']} ({player['position']}, {player['team']})...")
            
            try:
                self.process_player(player, weeks)
            except Exception as e:
                logger.error(f"Error processing {player['name']}: {e}")
                self.stats['failed'] += 1
            
            # Progress every 50 players
            if idx % 50 == 0:
                elapsed = time.time() - start_time
                logger.info(f"\n{'='*60}")
                logger.info(f"Progress: {idx}/{len(players)}")
                logger.info(f"✅ Inserted: {self.stats['inserted']}")
                logger.info(f"⏭️  Skipped: {self.stats['skipped']}")
                logger.info(f"❌ Failed: {self.stats['failed']}")
                logger.info(f"⏱️  Time: {elapsed/60:.1f} min")
                logger.info(f"{'='*60}\n")
        
        # Final summary
        elapsed = time.time() - start_time
        logger.info("\n" + "="*80)
        logger.info("BACKFILL COMPLETE")
        logger.info("="*80)
        logger.info(f"Players: {len(players)}")
        logger.info(f"✅ Inserted: {self.stats['inserted']}")
        logger.info(f"⏭️  Skipped: {self.stats['skipped']}")
        logger.info(f"❌ Failed: {self.stats['failed']}")
        logger.info(f"⏱️  Total: {elapsed/60:.1f} minutes")
        logger.info("="*80)

def main():
    parser = argparse.ArgumentParser(description='NFL 2025 Simple Stats Backfill')
    parser.add_argument('--weeks', type=str, default='1,2,3,4', help='Weeks to backfill (e.g., "1,2,3,4")')
    parser.add_argument('--limit', type=int, help='Limit number of players (for testing)')
    
    args = parser.parse_args()
    
    try:
        backfill = NFLSimpleBackfill()
        weeks = [int(w.strip()) for w in args.weeks.split(',')]
        backfill.run(weeks, limit=args.limit)
    except KeyboardInterrupt:
        logger.info("\n\nInterrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    main()
