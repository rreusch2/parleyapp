#!/usr/bin/env python3
"""
FREE Sports Data APIs Backfill Script (2025)
============================================
Uses 100% free, no-signup-required APIs:
- NBA: nba_api (official NBA.com)
- NFL: nfl-data-py (nflfastR)
- NHL: nhl-api-py (official NHL API)

Zero cost, no API keys, production-ready data.
"""

import os
import sys
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from supabase import create_client, Client
from dotenv import load_dotenv
import time
import unicodedata
import re
import requests

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://iriaegoipkjtktitpary.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_SERVICE_ROLE_KEY not found in environment variables")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backfill_free_apis_2025.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
try:
    # Ensure UTF-8 console on Windows for names with accents
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# -------- Helpers (Global name normalization and constants) --------
def _normalize_name(name: str) -> str:
    """Normalize player name: remove accents/punctuation, lowercase, single spaces."""
    if not name:
        return ''
    # Strip accents
    name = unicodedata.normalize('NFKD', name)
    name = ''.join(ch for ch in name if not unicodedata.combining(ch))
    # Lowercase and keep alnum + spaces
    name = re.sub(r"[^a-zA-Z0-9\s]", "", name).lower()
    # Collapse whitespace
    name = re.sub(r"\s+", " ", name).strip()
    return name

# NHL team abbreviations for roster fetching
TEAM_ABBRS = [
    'ANA', 'ARI', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
    'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
    'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'VAN', 'VGK', 'WPG', 'WSH'
]

def build_nhl_roster_index(season: str) -> Dict[str, Dict[str, str]]:
    """Fetch all team rosters and build name-> {id, team} index using api-web.nhle.com."""
    index: Dict[str, Dict[str, str]] = {}
    for abbr in TEAM_ABBRS:
        url = f"https://api-web.nhle.com/v1/roster/{abbr}/{season}"
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            data = resp.json() or {}
            for group in ['forwards', 'defensemen', 'goalies']:
                for p in data.get(group, []) or []:
                    first = (p.get('firstName', {}) or {}).get('default', '')
                    last = (p.get('lastName', {}) or {}).get('default', '')
                    pid = str(p.get('id', '')).strip()
                    full = _normalize_name((first + ' ' + last).strip())
                    if full and pid:
                        index[full] = { 'id': pid, 'team': abbr }
        except Exception as e:
            logger.warning(f"Failed roster fetch for {abbr}: {e}")
            continue
    logger.info(f"Built NHL roster index: {len(index)} players")
    return index

def get_or_create_player(name: str, team: str, sport: str, position: str = None, external_id: str = None) -> Optional[str]:
    """Get existing player or create new one"""
    try:
        # Try to find existing player
        query = supabase.table('players').select('id').eq('name', name).eq('sport', sport)
        if team:
            query = query.eq('team', team)
        
        existing = query.execute()
        
        if existing.data:
            return existing.data[0]['id']

        # If we have an external_id, prefer linking to the existing record by external_player_id
        if external_id:
            by_ext = supabase.table('players').select('id').eq('external_player_id', external_id).execute()
            if by_ext.data:
                pid = by_ext.data[0]['id']
                try:
                    # Keep canonical record up to date
                    supabase.table('players').update({
                        'name': name,
                        'player_name': name,
                        'team': team,
                        'position': position,
                        'active': True
                    }).eq('id', pid).execute()
                except Exception:
                    pass
                return pid
        
        # Create new player
        player_key = f"{sport.lower()}_{name.lower().replace(' ', '_')}_{team.lower().replace(' ', '_')}"
        external_player_id = external_id if external_id else f"{sport.lower()}_{name.lower().replace(' ', '_')}"
        
        player_data = {
            'name': name,
            'player_name': name,  # Required field - same as name
            'team': team,
            'sport': sport,
            'position': position,
            'active': True,
            'external_player_id': external_player_id,
            'player_key': player_key
        }
        
        result = supabase.table('players').insert(player_data).execute()
        if result.data:
            logger.info(f"Created new {sport} player: {name} ({team})")
            return result.data[0]['id']
        
        return None
    except Exception as e:
        logger.error(f"Error getting/creating player {name}: {str(e)}")
        return None

def store_game_stats(player_id: str, stats: Dict, sport: str) -> bool:
    """Store player game stats"""
    try:
        game_stat_record = {
            'player_id': player_id,
            'event_id': stats.get('event_id'),
            'stats': stats,
            'fantasy_points': str(stats.get('fantasy_points', 0)),
            'minutes_played': stats.get('minutes_played'),
            'betting_results': {}
        }
        
        # Check if this game stat already exists
        game_date = stats.get('game_date', '')
        if game_date:
            existing = supabase.table('player_game_stats')\
                .select('id')\
                .eq('player_id', player_id)\
                .filter('stats->>game_date', 'eq', game_date)\
                .execute()
            
            if existing.data:
                result = supabase.table('player_game_stats').update(game_stat_record).eq('id', existing.data[0]['id']).execute()
                logger.debug(f"Updated {sport} game stats for player {player_id} on {game_date}")
            else:
                result = supabase.table('player_game_stats').insert(game_stat_record).execute()
                logger.debug(f"Inserted new {sport} game stats for player {player_id} on {game_date}")
            
            return True
        
        return False
    except Exception as e:
        logger.error(f"Error storing game stats: {str(e)}")
        return False

def backfill_nba_stats(days_back: int = 60, nba_max: int = 300, nba_offset: int = 0):
    """Backfill NBA stats using nba_api"""
    logger.info(f"Starting NBA stats backfill for last {days_back} days")
    
    try:
        from nba_api.stats.endpoints import playergamelog
        from nba_api.stats.static import players as nba_players
    except ImportError:
        logger.error("nba_api not installed. Run: pip install nba_api")
        return 0
    
    total_processed = 0
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days_back)
    
    # Get current NBA season (starts in October)
    now = datetime.now()
    if now.month >= 10:
        season = f"{now.year}-{str(now.year + 1)[2:]}"
    else:
        season = f"{now.year - 1}-{str(now.year)[2:]}"
    
    logger.info(f"Fetching NBA season {season} data")
    
    # Get all active players only
    all_players = nba_players.get_active_players()
    total_active = len(all_players)
    start = max(0, nba_offset)
    end = min(total_active, nba_offset + nba_max)
    batch = all_players[start:end]
    total_batch = len(batch)
    logger.info(f"Found {total_active} active NBA players | Processing batch {start}-{end} ({total_batch})")
    
    # Process in batches to avoid rate limits
    for idx, player in enumerate(batch):
        try:
            player_name = player['full_name']
            player_nba_id = str(player['id'])
            
            logger.info(f"[{idx+1}/{total_batch}] Fetching {player_name}")
            
            # Get game log for this player
            gamelog = playergamelog.PlayerGameLog(
                player_id=player_nba_id,
                season=season,
                timeout=30
            )
            
            time.sleep(0.6)  # Rate limiting
            
            games_df = gamelog.get_data_frames()[0]
            
            if games_df.empty:
                continue
            
            # Get player's team from most recent game
            team = games_df.iloc[0]['MATCHUP'].split()[0] if not games_df.empty else 'UNK'
            
            # Get or create player in our DB
            player_id = get_or_create_player(
                player_name,
                team,
                'NBA',
                position=None,
                external_id=player_nba_id
            )
            
            if not player_id:
                continue
            
            # Process each game
            for _, game in games_df.iterrows():
                game_date = datetime.strptime(str(game['GAME_DATE']), '%b %d, %Y').date()
                
                if game_date < start_date or game_date > end_date:
                    continue
                
                # Map NBA stats to our format
                mapped_stats = {
                    'game_date': game_date.isoformat(),
                    'team': team,
                    'opponent_team': game['MATCHUP'].split()[-1] if 'MATCHUP' in game else '',
                    'is_home': '@' not in str(game.get('MATCHUP', '')),
                    'minutes_played': str(game.get('MIN', '0')),
                    
                    # Core stats
                    'points': int(game.get('PTS', 0)),
                    'rebounds': int(game.get('REB', 0)),
                    'assists': int(game.get('AST', 0)),
                    'steals': int(game.get('STL', 0)),
                    'blocks': int(game.get('BLK', 0)),
                    'turnovers': int(game.get('TOV', 0)),
                    
                    # Shooting
                    'field_goals_made': int(game.get('FGM', 0)),
                    'field_goals_attempted': int(game.get('FGA', 0)),
                    'field_goal_pct': float(game.get('FG_PCT', 0)),
                    'three_pointers_made': int(game.get('FG3M', 0)),
                    'three_pointers_attempted': int(game.get('FG3A', 0)),
                    'three_point_pct': float(game.get('FG3_PCT', 0)),
                    'free_throws_made': int(game.get('FTM', 0)),
                    'free_throws_attempted': int(game.get('FTA', 0)),
                    'free_throw_pct': float(game.get('FT_PCT', 0)),
                    
                    # Additional
                    'personal_fouls': int(game.get('PF', 0)),
                    'plus_minus': int(game.get('PLUS_MINUS', 0)),
                    
                    # Fantasy
                    'fantasy_points': float(game.get('PTS', 0)) + float(game.get('REB', 0)) * 1.2 + float(game.get('AST', 0)) * 1.5,
                    
                    'sport': 'NBA',
                    'external_game_id': str(game.get('Game_ID', ''))
                }
                
                if store_game_stats(player_id, mapped_stats, 'NBA'):
                    total_processed += 1
        
        except Exception as e:
            logger.error(f"Error processing NBA player {player.get('full_name', 'Unknown')}: {str(e)}")
            continue
    
    logger.info(f"NBA backfill completed. Total processed: {total_processed}")
    return total_processed

def build_espn_nfl_player_mapping():
    """Build mapping of our NFL players to ESPN athlete IDs using team rosters"""
    logger.info("Building ESPN NFL player ID mapping...")
    
    try:
        # Get all NFL teams from ESPN
        teams_url = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams"
        teams_response = requests.get(teams_url, timeout=15)
        
        if teams_response.status_code != 200:
            logger.error(f"Failed to get NFL teams: {teams_response.status_code}")
            return {}
        
        teams_data = teams_response.json()
        espn_mapping = {}
        
        # Process each team
        for team_ref in teams_data.get('items', []):
            try:
                team_response = requests.get(team_ref['$ref'], timeout=10)
                if team_response.status_code != 200:
                    continue
                    
                team_data = team_response.json()
                team_abbr = team_data.get('abbreviation', '')
                team_name = team_data.get('displayName', '')
                
                logger.info(f"  Processing {team_name} ({team_abbr}) roster...")
                
                # Get team roster
                if 'athletes' in team_data:
                    roster_response = requests.get(team_data['athletes']['$ref'], timeout=10)
                    if roster_response.status_code == 200:
                        roster_data = roster_response.json()
                        
                        # Process each player on roster
                        for player_ref in roster_data.get('items', []):
                            try:
                                player_response = requests.get(player_ref['$ref'], timeout=10)
                                if player_response.status_code == 200:
                                    player_data = player_response.json()
                                    
                                    espn_name = player_data.get('displayName', '')
                                    espn_id = player_ref['$ref'].split('/')[-1].split('?')[0]
                                    position = player_data.get('position', {}).get('abbreviation', '')
                                    
                                    # Create mapping key (normalized name + team)
                                    normalized_name = _normalize_name(espn_name)
                                    mapping_key = f"{normalized_name}_{team_abbr}"
                                    
                                    espn_mapping[mapping_key] = {
                                        'espn_id': espn_id,
                                        'espn_name': espn_name,
                                        'team': team_abbr,
                                        'position': position
                                    }
                                
                                time.sleep(0.1)  # Rate limiting
                                
                            except Exception as e:
                                logger.warning(f"Error processing roster player: {str(e)}")
                                continue
                
                time.sleep(0.3)  # Rate limiting between teams
                
            except Exception as e:
                logger.warning(f"Error processing team: {str(e)}")
                continue
        
        logger.info(f"Built ESPN mapping for {len(espn_mapping)} players")
        return espn_mapping
        
    except Exception as e:
        logger.error(f"Error building ESPN mapping: {str(e)}")
        return {}

def fetch_espn_player_stats(espn_id: str, player_name: str, target_weeks: List[int]):
    """Fetch ESPN game log stats for specific weeks"""
    try:
        # Get player game log
        gamelog_url = f"https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{espn_id}/gamelog"
        response = requests.get(gamelog_url, timeout=15)
        
        if response.status_code != 200:
            logger.warning(f"No gamelog for {player_name} (ESPN ID: {espn_id}): {response.status_code}")
            return []
        
        gamelog_data = response.json()
        stats_list = []
        
        # Extract 2025 season games
        categories = gamelog_data.get('categories', [])
        if not categories:
            return []
        
        # Find 2025 season data
        season_2025_found = False
        for category in categories:
            events = category.get('events', [])
            for event in events:
                try:
                    # Check if this is 2025 season
                    if '2025' in str(event):
                        season_2025_found = True
                        
                        # Extract game info
                        game_info = event.get('game', {})
                        week = game_info.get('week', {}).get('number', 0)
                        
                        # Only process target weeks
                        if week not in target_weeks:
                            continue
                        
                        # Extract stats
                        stats = event.get('stats', [])
                        game_stats = {
                            'game_date': game_info.get('date', ''),
                            'week': week,
                            'season': 2025,
                            'team': game_info.get('team', {}).get('abbreviation', ''),
                            'opponent_team': game_info.get('opponent', {}).get('abbreviation', ''),
                            'is_home': game_info.get('isHome', False),
                            'sport': 'NFL'
                        }
                        
                        # Parse individual stats
                        for stat in stats:
                            stat_name = stat.get('name', '').lower().replace(' ', '_')
                            stat_value = stat.get('value', 0)
                            
                            # Convert to appropriate type
                            try:
                                if '.' in str(stat_value):
                                    game_stats[stat_name] = float(stat_value)
                                else:
                                    game_stats[stat_name] = int(stat_value)
                            except:
                                game_stats[stat_name] = str(stat_value)
                        
                        # Calculate fantasy points (basic formula)
                        fantasy_points = 0
                        fantasy_points += game_stats.get('passing_yards', 0) * 0.04
                        fantasy_points += game_stats.get('passing_tds', 0) * 4
                        fantasy_points += game_stats.get('rushing_yards', 0) * 0.1
                        fantasy_points += game_stats.get('rushing_tds', 0) * 6
                        fantasy_points += game_stats.get('receiving_yards', 0) * 0.1
                        fantasy_points += game_stats.get('receiving_tds', 0) * 6
                        fantasy_points += game_stats.get('receptions', 0) * 0.5  # PPR
                        fantasy_points -= game_stats.get('interceptions', 0) * 2
                        
                        game_stats['fantasy_points'] = round(fantasy_points, 2)
                        game_stats['external_game_id'] = f"espn_{espn_id}_{week}_2025"
                        
                        stats_list.append(game_stats)
                
                except Exception as e:
                    logger.warning(f"Error parsing game for {player_name}: {str(e)}")
                    continue
        
        if not season_2025_found:
            logger.warning(f"No 2025 season data found for {player_name}")
        
        return stats_list
        
    except Exception as e:
        logger.error(f"Error fetching ESPN stats for {player_name}: {str(e)}")
        return []

def backfill_nfl_stats(weeks: int = 4):
    """Backfill NFL stats using ESPN API for 2025 current season"""
    logger.info(f"Starting NFL stats backfill using ESPN API for 2025 season")
    
    total_processed = 0
    
    try:
        # First, check what weeks we already have vs what we need
        # Join with players table to filter by sport
        existing_weeks_query = supabase.table('player_game_stats')\
            .select('stats, players!inner(sport)')\
            .filter('players.sport', 'eq', 'NFL')\
            .filter('stats->>season', 'eq', '2025')\
            .execute()
        
        existing_weeks = set()
        for record in existing_weeks_query.data:
            week = record['stats'].get('week')
            if week:
                existing_weeks.add(int(week))
        
        # Determine which weeks we need (current week is ~9, we have 1-4)
        current_week = 9  # Estimated based on Nov 3, 2025
        all_weeks = set(range(1, current_week + 1))
        missing_weeks = sorted(list(all_weeks - existing_weeks))
        
        if not missing_weeks:
            logger.info("No missing NFL weeks found")
            return 0
        
        logger.info(f"Missing weeks: {missing_weeks}, will fetch: {missing_weeks}")
        
        # Build ESPN player mapping
        espn_mapping = build_espn_nfl_player_mapping()
        if not espn_mapping:
            logger.error("Failed to build ESPN player mapping")
            return 0
        
        # Get our NFL players who have recent props (active players)
        props_query = supabase.table('player_props_v2')\
            .select('player_id')\
            .eq('sport', 'NFL')\
            .gte('local_game_date', (datetime.now() - timedelta(days=14)).date().isoformat())\
            .execute()
        
        if not props_query.data:
            logger.warning("No NFL players with recent props found")
            return 0
        
        active_player_ids = list(set([p['player_id'] for p in props_query.data]))
        logger.info(f"Found {len(active_player_ids)} active NFL players with recent props")
        
        # Get player details
        players_query = supabase.table('players')\
            .select('id, name, team, position')\
            .in_('id', active_player_ids)\
            .eq('sport', 'NFL')\
            .execute()
        
        mapped_players = 0
        for idx, player in enumerate(players_query.data):
            try:
                player_name = player['name']
                player_id = player['id']
                team = player.get('team', '')
                
                if not team:
                    continue
                
                # Try to find ESPN mapping
                normalized_name = _normalize_name(player_name)
                mapping_key = f"{normalized_name}_{team}"
                
                espn_info = espn_mapping.get(mapping_key)
                if not espn_info:
                    # Try without team (less reliable)
                    possible_keys = [k for k in espn_mapping.keys() if normalized_name in k]
                    if possible_keys:
                        espn_info = espn_mapping[possible_keys[0]]
                        logger.info(f"  Fuzzy matched {player_name} -> {espn_info['espn_name']}")
                
                if not espn_info:
                    logger.warning(f"  No ESPN mapping for {player_name} ({team})")
                    continue
                
                espn_id = espn_info['espn_id']
                logger.info(f"[{idx+1}/{len(players_query.data)}] Fetching {player_name} -> ESPN ID {espn_id}")
                
                # Fetch stats for missing weeks
                player_stats = fetch_espn_player_stats(espn_id, player_name, missing_weeks)
                
                # Store each game's stats
                for game_stats in player_stats:
                    if store_game_stats(player_id, game_stats, 'NFL'):
                        total_processed += 1
                        logger.debug(f"  Stored week {game_stats['week']} for {player_name}")
                
                mapped_players += 1
                time.sleep(0.2)  # Rate limiting
                
            except Exception as e:
                logger.error(f"Error processing NFL player {player.get('name', 'Unknown')}: {str(e)}")
                continue
        
        logger.info(f"Successfully mapped {mapped_players} players")
        
    except Exception as e:
        logger.error(f"Error in NFL ESPN backfill: {str(e)}")
    
    logger.info(f"NFL backfill completed. Total processed: {total_processed}")
    return total_processed

def backfill_nhl_stats(days_back: int = 60):
    """Backfill NHL stats using nhl-api-py"""
    logger.info(f"Starting NHL stats backfill for last {days_back} days")
    
    try:
        from nhlpy import NHLClient
    except ImportError:
        logger.error("nhl-api-py not installed. Run: pip install nhl-api-py")
        return 0
    
    total_processed = 0
    client = NHLClient()
    
    # Get current NHL season - November 2025 = 2025-26 season (started Oct 8, 2025)
    now = datetime.now()
    if now.month >= 10:
        season = f"{now.year}{now.year + 1}"
    else:
        season = f"{now.year - 1}{now.year}"
    
    logger.info(f"Using NHL season {season} (November 2025 = 2025-26 season)")
    
    logger.info(f"Fetching NHL season {season} data")
    
    try:
        # Build roster index once so we can resolve numeric IDs
        roster_index = build_nhl_roster_index(season)
        
        # Use a simpler approach: Get all players from our DB who have recent NHL props
        logger.info("Fetching NHL players from props table...")
        
        # Get unique NHL player IDs from recent props
        props_query = supabase.table('player_props_v2')\
            .select('player_id')\
            .eq('sport', 'NHL')\
            .gte('local_game_date', (datetime.now() - timedelta(days=7)).date().isoformat())\
            .execute()
        
        if not props_query.data:
            logger.warning("No NHL props found in last 7 days")
            return 0
        
        player_ids = list(set([p['player_id'] for p in props_query.data if p.get('player_id')]))
        logger.info(f"Found {len(player_ids)} unique NHL players with recent props")
        
        # Get player details
        players_query = supabase.table('players')\
            .select('id, name, team, external_player_id')\
            .in_('id', player_ids)\
            .eq('sport', 'NHL')\
            .execute()
        
        if not players_query.data:
            logger.warning("No NHL player details found")
            return 0
        
        logger.info(f"Processing {len(players_query.data)} NHL players")
        
        for idx, player in enumerate(players_query.data):
            try:
                player_name = player['name']
                player_id = player['id']
                team = player.get('team', 'UNK')
                external_id = player.get('external_player_id', '')
                
                logger.info(f"[{idx+1}/{len(players_query.data)}] Fetching {player_name} ({team})")
                
                # If external ID not numeric, try to resolve from roster index by normalized name
                if not external_id or not external_id.isdigit():
                    name_norm = _normalize_name(player_name)
                    hit = roster_index.get(name_norm)
                    if hit:
                        resolved_id = hit['id']
                        resolved_team = hit.get('team', team)
                        try:
                            supabase.table('players').update({
                                'external_player_id': resolved_id,
                                'team': resolved_team
                            }).eq('id', player_id).execute()
                            external_id = resolved_id
                            team = resolved_team
                            logger.info(f"  Resolved NHL ID for {player_name} -> {resolved_id} ({resolved_team})")
                        except Exception as e:
                            logger.warning(f"  Failed to persist resolved ID for {player_name}: {e}")
                    else:
                        logger.warning(f"  No valid external_player_id for {player_name}, skipping")
                        continue
                
                try:
                    # Get player game log
                    logger.debug(f"  Calling NHL API for {player_name} (ID: {external_id}, Season: {season})")
                    game_log = client.stats.player_game_log(
                        player_id=external_id,
                        season_id=season,
                        game_type=2  # Regular season
                    )
                    
                    time.sleep(0.8)  # Rate limiting
                    
                    # NHL API returns a list directly, not a dict with 'gameLog' key
                    if not game_log or not isinstance(game_log, list) or len(game_log) == 0:
                        logger.warning(f"  No game log data for {player_name} (response type: {type(game_log)}, len: {len(game_log) if isinstance(game_log, list) else 'N/A'})")
                        continue
                    
                    games = game_log  # It's already a list
                    logger.info(f"  Found {len(games)} games for {player_name}")
                    
                    # Process each game
                    for game in games[:30]:  # Last 30 games
                        try:
                            game_date_str = game.get('gameDate', '')
                            if not game_date_str:
                                continue
                            
                            game_date = datetime.strptime(game_date_str, '%Y-%m-%d').date()
                            
                            # Check if within our date range
                            if game_date < (datetime.now().date() - timedelta(days=days_back)):
                                continue
                            
                            # Map NHL stats to our format
                            mapped_stats = {
                                'game_date': game_date.isoformat(),
                                'team': team,
                                'opponent_team': game.get('opponentAbbrev', ''),
                                'is_home': game.get('homeRoadFlag', '') == 'H',
                                
                                # Skater stats
                                'goals': int(game.get('goals', 0)),
                                'assists': int(game.get('assists', 0)),
                                'points': int(game.get('points', 0)),
                                'shots_on_goal': int(game.get('shots', 0)),
                                'plus_minus': int(game.get('plusMinus', 0)),
                                'penalty_minutes': int(game.get('pim', 0)),
                                'time_on_ice': str(game.get('toi', '0')),
                                
                                # Goalie stats (if applicable)
                                'saves': int(game.get('saves', 0)),
                                'goals_against': int(game.get('goalsAgainst', 0)),
                                'shots_against': int(game.get('shotsAgainst', 0)),
                                'save_pct': float(game.get('savePct', 0)) if game.get('savePct') else 0,
                                
                                # Fantasy
                                'fantasy_points': int(game.get('goals', 0)) * 3 + int(game.get('assists', 0)) * 2,
                                
                                'sport': 'NHL',
                                'external_game_id': str(game.get('gameId', ''))
                            }
                            
                            if store_game_stats(player_id, mapped_stats, 'NHL'):
                                total_processed += 1
                        
                        except Exception as e:
                            logger.error(f"  Error processing game for {player_name}: {str(e)}")
                            continue
                
                except Exception as e:
                    logger.error(f"  Error fetching game log for {player_name}: {str(e)}")
                    continue
            
            except Exception as e:
                logger.error(f"Error processing NHL player: {str(e)}")
                continue
    
    except Exception as e:
        logger.error(f"Error in NHL backfill: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    
    logger.info(f"NHL backfill completed. Total processed: {total_processed}")
    return total_processed

def main():
    """Main backfill function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Backfill player game stats using 100% free APIs (2025)")
    parser.add_argument("--sport", choices=['NBA', 'NFL', 'NHL', 'ALL'], default='ALL', help="Sport to backfill")
    parser.add_argument("--days", type=int, default=60, help="Number of days back to fetch (NBA/NHL)")
    parser.add_argument("--weeks", type=int, default=4, help="Number of weeks back to fetch (NFL)")
    parser.add_argument("--nba_max", type=int, default=300, help="Max active NBA players to process")
    parser.add_argument("--nba_offset", type=int, default=0, help="Offset into active NBA players list for batching")
    
    args = parser.parse_args()
    
    logger.info(f"=" * 60)
    logger.info(f"FREE APIs Backfill Script (2025)")
    logger.info(f"Sport: {args.sport} | Days: {args.days} | Weeks: {args.weeks}")
    logger.info(f"=" * 60)
    
    total = 0
    
    if args.sport in ['NBA', 'ALL']:
        logger.info("=" * 60)
        logger.info("STARTING NBA BACKFILL (nba_api)")
        logger.info("=" * 60)
        total += backfill_nba_stats(args.days, nba_max=args.nba_max, nba_offset=args.nba_offset)
    
    if args.sport in ['NFL', 'ALL']:
        logger.info("=" * 60)
        logger.info("STARTING NFL BACKFILL (nfl-data-py)")
        logger.info("=" * 60)
        total += backfill_nfl_stats(args.weeks)
    
    if args.sport in ['NHL', 'ALL']:
        logger.info("=" * 60)
        logger.info("STARTING NHL BACKFILL (nhl-api-py)")
        logger.info("=" * 60)
        total += backfill_nhl_stats(args.days)
    
    logger.info("=" * 60)
    logger.info(f"BACKFILL COMPLETED! Total stats processed: {total}")
    logger.info("=" * 60)
    
    logger.info("\nNext steps:")
    logger.info("1. Verify data in Supabase")
    logger.info("2. Check Trends tab in mobile app")
    logger.info("3. Run daily to keep data current")

if __name__ == "__main__":
    main()
