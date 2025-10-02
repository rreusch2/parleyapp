#!/usr/bin/env python3
"""
NFL 2025 Complete Offensive Stats Backfill
Comprehensive ingestion for Weeks 1-5 (current week as of Oct 2, 2025)
Uses StatMuse for reliable per-game stats for QB, RB, WR, TE, K
"""

import os
import sys
import logging
import re
import time
import argparse
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
import requests

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client
from dotenv import load_dotenv

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

SEASON = 2025
CURRENT_WEEK = 5  # As of Oct 2, 2025
OFFENSIVE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K']

# NFL team abbreviation to full name mapping
NFL_TEAM_MAP = {
    'ARI': 'Arizona Cardinals', 'ATL': 'Atlanta Falcons', 'BAL': 'Baltimore Ravens',
    'BUF': 'Buffalo Bills', 'CAR': 'Carolina Panthers', 'CHI': 'Chicago Bears',
    'CIN': 'Cincinnati Bengals', 'CLE': 'Cleveland Browns', 'DAL': 'Dallas Cowboys',
    'DEN': 'Denver Broncos', 'DET': 'Detroit Lions', 'GB': 'Green Bay Packers',
    'HOU': 'Houston Texans', 'IND': 'Indianapolis Colts', 'JAX': 'Jacksonville Jaguars',
    'KC': 'Kansas City Chiefs', 'LAC': 'Los Angeles Chargers', 'LAR': 'Los Angeles Rams',
    'LV': 'Las Vegas Raiders', 'MIA': 'Miami Dolphins', 'MIN': 'Minnesota Vikings',
    'NE': 'New England Patriots', 'NO': 'New Orleans Saints', 'NYG': 'New York Giants',
    'NYJ': 'New York Jets', 'PHI': 'Philadelphia Eagles', 'PIT': 'Pittsburgh Steelers',
    'SEA': 'Seattle Seahawks', 'SF': 'San Francisco 49ers', 'TB': 'Tampa Bay Buccaneers',
    'TEN': 'Tennessee Titans', 'WAS': 'Washington Commanders',
}

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/nfl-2025-complete-stats.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class NFL2025CompleteStats:
    def __init__(self):
        self.supabase: Client = self._init_supabase()
        self.statmuse_url = os.getenv("STATMUSE_API_URL", "https://web-production-f090e.up.railway.app")
        self.stats = {'processed': 0, 'inserted': 0, 'updated': 0, 'skipped': 0, 'failed': 0}
        
        # Load event index for event_id resolution
        self.event_index = self._build_event_index()
        logger.info(f"Loaded {len(self.event_index)} NFL events for 2025 season")

    def _init_supabase(self) -> Client:
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        if not url or not key:
            raise ValueError("Missing Supabase credentials")
        return create_client(url, key)

    def _build_event_index(self) -> Dict[Tuple[str, str, int], str]:
        """Build index of NFL events: (home_team, away_team, week) -> event_id"""
        try:
            response = self.supabase.table('sports_events').select(
                'id, home_team, away_team, start_time, sport_key'
            ).eq('sport_key', 'americanfootball_nfl').execute()
            
            index = {}
            for event in response.data:
                start_time = datetime.fromisoformat(event['start_time'].replace('Z', '+00:00'))
                # Approximate week from date (NFL season starts ~Sept 5)
                season_start = datetime(2025, 9, 5, tzinfo=timezone.utc)
                days_since_start = (start_time - season_start).days
                week = max(1, min(18, (days_since_start // 7) + 1))
                
                home = event['home_team']
                away = event['away_team']
                event_id = event['id']
                
                # Index by both team orders
                index[(home, away, week)] = event_id
                index[(away, home, week)] = event_id
                
            return index
        except Exception as e:
            logger.error(f"Error building event index: {e}")
            return {}

    def _resolve_event_id(self, team_abbr: str, week: int) -> Optional[str]:
        """Resolve event_id for a player's team and week"""
        if not team_abbr or team_abbr not in NFL_TEAM_MAP:
            return None
            
        team_full = NFL_TEAM_MAP[team_abbr]
        
        # Try to find event with this team
        for (home, away, w), event_id in self.event_index.items():
            if w == week and (home == team_full or away == team_full):
                return event_id
        
        return None

    def get_offensive_players(self) -> List[Dict]:
        """Get all NFL offensive players"""
        try:
            response = self.supabase.table('players').select(
                'id, name, team, position'
            ).eq('sport', 'NFL').in_('position', OFFENSIVE_POSITIONS).execute()
            
            players = response.data
            logger.info(f"Found {len(players)} NFL offensive players")
            return players
        except Exception as e:
            logger.error(f"Error fetching players: {e}")
            return []

    def get_existing_weeks(self, player_id: str) -> set:
        """Get weeks that already have data for a player"""
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
            elif position == 'WR' or position == 'TE':
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
            
            time.sleep(0.08)  # Rate limiting
            return None
            
        except Exception as e:
            logger.error(f"StatMuse query error for {player_name}: {e}")
            return None

    def extract_stats(self, statmuse_data: Dict, position: str) -> Dict[str, Any]:
        """Extract numeric stats from StatMuse response"""
        answer = statmuse_data.get('answer', '')
        stats = {}
        
        # Extract numbers from answer
        numbers = re.findall(r'\d+\.?\d*', answer)
        
        if position == 'QB':
            if len(numbers) >= 3:
                stats['passing_yards'] = float(numbers[0])
                stats['passing_touchdowns'] = float(numbers[1])
                stats['passing_interceptions'] = float(numbers[2])
        elif position == 'RB':
            if len(numbers) >= 2:
                stats['rushing_yards'] = float(numbers[0])
                stats['rushing_touchdowns'] = float(numbers[1])
            if len(numbers) >= 3:
                stats['receptions'] = float(numbers[2])
        elif position in ['WR', 'TE']:
            if len(numbers) >= 3:
                stats['receptions'] = float(numbers[0])
                stats['receiving_yards'] = float(numbers[1])
                stats['receiving_touchdowns'] = float(numbers[2])
        elif position == 'K':
            if len(numbers) >= 2:
                stats['field_goals_made'] = float(numbers[0])
                stats['extra_points_made'] = float(numbers[1])
        
        return stats

    def calculate_fantasy_points(self, stats: Dict, position: str) -> float:
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

    def store_player_week_stats(self, player_id: str, player_name: str, team: str, 
                                position: str, week: int, stats: Dict, event_id: Optional[str]) -> bool:
        """Store or update player stats for a specific week"""
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
                'fantasy_points': self.calculate_fantasy_points(stats, position),
                'fantasy_points_ppr': self.calculate_fantasy_points(stats, position),  # Same for now
                'data_source': 'statmuse',
                'updated_at': datetime.now().isoformat()
            }
            
            # Check if record exists
            existing = self.supabase.table('player_game_stats').select('id, stats').eq(
                'player_id', player_id
            ).execute()
            
            existing_record = None
            for record in existing.data:
                if record['stats'].get('season') == SEASON and record['stats'].get('week') == week:
                    existing_record = record
                    break
            
            if existing_record:
                # Update existing
                self.supabase.table('player_game_stats').update({
                    'stats': complete_stats,
                    'event_id': event_id
                }).eq('id', existing_record['id']).execute()
                self.stats['updated'] += 1
                logger.info(f"✅ Updated {player_name} Week {week}: {complete_stats.get('fantasy_points', 0)} pts")
            else:
                # Insert new
                self.supabase.table('player_game_stats').insert({
                    'player_id': player_id,
                    'event_id': event_id,
                    'stats': complete_stats,
                    'created_at': datetime.now().isoformat()
                }).execute()
                self.stats['inserted'] += 1
                logger.info(f"✅ Inserted {player_name} Week {week}: {complete_stats.get('fantasy_points', 0)} pts")
            
            return True
            
        except Exception as e:
            logger.error(f"Error storing stats for {player_name} Week {week}: {e}")
            return False

    def process_player(self, player: Dict, weeks: List[int]) -> int:
        """Process a single player for specified weeks"""
        player_id = player['id']
        player_name = player['name']
        team = player.get('team', '')
        position = player.get('position', '')
        
        if not team:
            logger.warning(f"Skipping {player_name} - no team data")
            return 0
        
        # Get existing weeks
        existing_weeks = self.get_existing_weeks(player_id)
        weeks_to_fetch = [w for w in weeks if w not in existing_weeks]
        
        if not weeks_to_fetch:
            logger.debug(f"{player_name} already has all requested weeks")
            return 0
        
        success_count = 0
        
        for week in weeks_to_fetch:
            self.stats['processed'] += 1
            
            # Resolve event_id
            event_id = self._resolve_event_id(team, week)
            if not event_id:
                logger.warning(f"Could not resolve event_id for {player_name} ({team}) Week {week}")
                self.stats['skipped'] += 1
                continue
            
            # Query StatMuse
            statmuse_data = self.query_statmuse(player_name, position, week)
            if not statmuse_data:
                logger.warning(f"No StatMuse data for {player_name} Week {week}")
                self.stats['skipped'] += 1
                continue
            
            # Extract stats
            stats = self.extract_stats(statmuse_data, position)
            if not stats:
                logger.warning(f"Could not extract stats for {player_name} Week {week}")
                self.stats['skipped'] += 1
                continue
            
            # Store stats
            if self.store_player_week_stats(player_id, player_name, team, position, week, stats, event_id):
                success_count += 1
            else:
                self.stats['failed'] += 1
            
            time.sleep(0.1)  # Rate limiting
        
        return success_count

    def run(self, limit: Optional[int] = None, weeks: Optional[List[int]] = None):
        """Run the complete stats backfill"""
        logger.info("="*80)
        logger.info(f"NFL 2025 COMPLETE OFFENSIVE STATS BACKFILL")
        logger.info(f"Season: {SEASON} | Weeks: {weeks or list(range(1, CURRENT_WEEK + 1))}")
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
        
        weeks_to_process = weeks or list(range(1, CURRENT_WEEK + 1))
        
        # Process each player
        for idx, player in enumerate(players, 1):
            logger.info(f"\n[{idx}/{len(players)}] Processing {player['name']} ({player['position']}, {player.get('team', 'NO TEAM')})...")
            
            try:
                self.process_player(player, weeks_to_process)
            except Exception as e:
                logger.error(f"Error processing {player['name']}: {e}")
                self.stats['failed'] += 1
            
            # Progress update every 50 players
            if idx % 50 == 0:
                elapsed = time.time() - start_time
                logger.info(f"\n{'='*60}")
                logger.info(f"Progress: {idx}/{len(players)} players")
                logger.info(f"Inserted: {self.stats['inserted']} | Updated: {self.stats['updated']}")
                logger.info(f"Skipped: {self.stats['skipped']} | Failed: {self.stats['failed']}")
                logger.info(f"Elapsed: {elapsed/60:.1f} minutes")
                logger.info(f"{'='*60}\n")
        
        # Final summary
        elapsed = time.time() - start_time
        logger.info("\n" + "="*80)
        logger.info("NFL 2025 COMPLETE STATS BACKFILL COMPLETE")
        logger.info("="*80)
        logger.info(f"Players processed: {len(players)}")
        logger.info(f"✅ Inserted: {self.stats['inserted']}")
        logger.info(f"🔄 Updated: {self.stats['updated']}")
        logger.info(f"⏭️  Skipped: {self.stats['skipped']}")
        logger.info(f"❌ Failed: {self.stats['failed']}")
        logger.info(f"⏱️  Total time: {elapsed/60:.1f} minutes")
        logger.info(f"⚡ Avg per player: {elapsed/len(players):.1f} seconds")
        logger.info("="*80)

def main():
    parser = argparse.ArgumentParser(description='NFL 2025 Complete Offensive Stats Backfill')
    parser.add_argument('--limit', type=int, help='Limit number of players (for testing)')
    parser.add_argument('--weeks', type=str, help='Comma-separated weeks (e.g., "1,2,3")')
    parser.add_argument('--player', type=str, help='Process specific player by name')
    
    args = parser.parse_args()
    
    try:
        ingester = NFL2025CompleteStats()
        
        # Parse weeks
        weeks = None
        if args.weeks:
            weeks = [int(w.strip()) for w in args.weeks.split(',')]
        
        if args.player:
            # Process single player
            players = ingester.get_offensive_players()
            target = next((p for p in players if p['name'].lower() == args.player.lower()), None)
            
            if target:
                logger.info(f"Processing single player: {target['name']}")
                ingester.process_player(target, weeks or list(range(1, CURRENT_WEEK + 1)))
            else:
                logger.error(f"Player '{args.player}' not found")
        else:
            # Process all players
            ingester.run(limit=args.limit, weeks=weeks)
            
    except KeyboardInterrupt:
        logger.info("\n\nProcess interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    main()
