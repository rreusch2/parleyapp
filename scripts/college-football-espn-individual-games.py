#!/usr/bin/env python3
"""
College Football Individual Game Stats Ingestion - ESPN API
Fetches REAL individual game statistics (not averages) from ESPN API
Maps to existing player_game_stats schema for chart compatibility
"""

import os
import sys
import requests
import time
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from supabase import create_client, Client
from threading import Lock
from dotenv import load_dotenv

# Load environment variables
load_dotenv("backend/.env")

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Rate limiting
REQUEST_LOCK = Lock()
LAST_REQUEST_TIME = {"time": 0}
API_RATE_LIMIT = 0.5  # 500ms between requests

def rate_limited_request(url: str, timeout: int = 30) -> Optional[Dict]:
    """Make rate-limited HTTP request to ESPN API"""
    with REQUEST_LOCK:
        current_time = time.time()
        time_since_last = current_time - LAST_REQUEST_TIME["time"]
        if time_since_last < API_RATE_LIMIT:
            time.sleep(API_RATE_LIMIT - time_since_last)
        
        try:
            response = requests.get(url, timeout=timeout)
            LAST_REQUEST_TIME["time"] = time.time()
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                print(f"Rate limited, waiting 60 seconds...")
                time.sleep(60)
                return rate_limited_request(url, timeout)
            else:
                print(f"HTTP {response.status_code} for {url}")
                return None
        except Exception as e:
            print(f"Request error for {url}: {e}")
            return None

def create_or_update_cfb_player(player_data: Dict, team_name: str) -> Optional[str]:
    """Create or update CFB player record in Supabase"""
    try:
        player_name = player_data.get('displayName', '').strip()
        espn_player_id = str(player_data.get('id', ''))
        jersey = player_data.get('jersey', '')
        
        if not player_name or not espn_player_id:
            return None
        
        # Check if player exists by ESPN ID or name+team
        existing_query = supabase.table("players").select("*").or_(
            f"external_player_id.eq.{espn_player_id},"
            f"and(name.eq.{player_name},team.eq.{team_name})"
        )
        existing_result = existing_query.execute()
        
        if existing_result.data:
            # Update existing player
            player_id = existing_result.data[0]['id']
            update_data = {
                'external_player_id': espn_player_id,
                'name': player_name,
                'player_name': player_name,
                'team': team_name,
                'sport': 'College Football',
                'jersey_number': int(jersey) if jersey and jersey.isdigit() else None,
                'active': True,
                'updated_at': datetime.utcnow().isoformat()
            }
            
            supabase.table("players").update(update_data).eq("id", player_id).execute()
            return player_id
        else:
            # Create new player
            new_player = {
                'external_player_id': espn_player_id,
                'name': player_name,
                'player_name': player_name,
                'team': team_name,
                'sport': 'College Football',
                'jersey_number': int(jersey) if jersey and jersey.isdigit() else None,
                'active': True,
                'player_key': f"cfb_{espn_player_id}",
                'sport_key': 'americanfootball_ncaaf'
            }
            
            result = supabase.table("players").insert(new_player).execute()
            if result.data:
                return result.data[0]['id']
            return None
            
    except Exception as e:
        print(f"Error creating/updating player {player_data.get('displayName', 'Unknown')}: {e}")
        return None

def parse_stat_value(stat_str: str, stat_index: int = 0) -> float:
    """Parse stat value, handling complex formats like 'completions/attempts'"""
    try:
        if not stat_str or stat_str == '--':
            return 0.0
        
        # Handle completions/attempts format
        if '/' in stat_str:
            parts = stat_str.split('/')
            if stat_index < len(parts):
                return float(parts[stat_index])
            return 0.0
        
        # Handle regular numeric values
        return float(stat_str)
    except (ValueError, TypeError):
        return 0.0

def map_espn_stats_to_standard_format(game_data: Dict, team_data: Dict, stat_category: Dict, athlete_data: Dict) -> Dict[str, Any]:
    """Map ESPN player game stats to standardized format for database storage"""
    stats = athlete_data.get('stats', [])
    stat_name = stat_category.get('name', '')
    keys = stat_category.get('keys', [])
    
    # Base game info
    mapped_stats = {
        'game_date': game_data.get('date', ''),
        'team': team_data.get('abbreviation', ''),
        'opponent_team': '',  # Will be set based on home/away
        'position': '',
        'season': datetime.now().year,
        'week': 0,  # ESPN doesn't provide week directly
        'external_game_id': str(game_data.get('id', '')),
        'home_team': '',
        'away_team': '',
        'final_score': '',
        
        # Initialize all stat categories
        'passing_yards': 0,
        'passing_completions': 0,
        'passing_attempts': 0,
        'passing_touchdowns': 0,
        'interceptions': 0,
        'rushing_yards': 0,
        'rushing_attempts': 0,
        'rushing_touchdowns': 0,
        'rushing_longest': 0,
        'receiving_yards': 0,
        'receptions': 0,
        'receiving_targets': 0,
        'receiving_touchdowns': 0,
        'receiving_longest': 0,
        'tackles_solo': 0,
        'tackles_assists': 0,
        'tackles_total': 0,
        'sacks': 0,
        'interceptions_defense': 0,
        'fumbles_forced': 0,
        'fumbles_recovered': 0,
        'field_goals_made': 0,
        'field_goals_attempted': 0,
        'extra_points_made': 0,
        'extra_points_attempted': 0,
        'punts': 0,
        'punt_yards': 0,
        'punt_average': 0,
        'kickoff_returns': 0,
        'kickoff_return_yards': 0,
        'punt_returns': 0,
        'punt_return_yards': 0,
        'fantasy_points': 0
    }
    
    # Map stats based on category
    if stat_name == 'passing' and len(stats) >= len(keys):
        for i, key in enumerate(keys):
            if i < len(stats):
                if key == 'completions/passingAttempts':
                    mapped_stats['passing_completions'] = parse_stat_value(stats[i], 0)
                    mapped_stats['passing_attempts'] = parse_stat_value(stats[i], 1)
                elif key == 'passingYards':
                    mapped_stats['passing_yards'] = parse_stat_value(stats[i])
                elif key == 'passingTouchdowns':
                    mapped_stats['passing_touchdowns'] = parse_stat_value(stats[i])
                elif key == 'interceptions':
                    mapped_stats['interceptions'] = parse_stat_value(stats[i])
    
    elif stat_name == 'rushing' and len(stats) >= len(keys):
        for i, key in enumerate(keys):
            if i < len(stats):
                if key == 'rushingAttempts':
                    mapped_stats['rushing_attempts'] = parse_stat_value(stats[i])
                elif key == 'rushingYards':
                    mapped_stats['rushing_yards'] = parse_stat_value(stats[i])
                elif key == 'yardsPerRushAttempt':
                    pass  # Calculated field
                elif key == 'rushingTouchdowns':
                    mapped_stats['rushing_touchdowns'] = parse_stat_value(stats[i])
                elif key == 'longRushing':
                    mapped_stats['rushing_longest'] = parse_stat_value(stats[i])
    
    elif stat_name == 'receiving' and len(stats) >= len(keys):
        for i, key in enumerate(keys):
            if i < len(stats):
                if key == 'receptions':
                    mapped_stats['receptions'] = parse_stat_value(stats[i])
                elif key == 'receivingYards':
                    mapped_stats['receiving_yards'] = parse_stat_value(stats[i])
                elif key == 'yardsPerReception':
                    pass  # Calculated field
                elif key == 'receivingTouchdowns':
                    mapped_stats['receiving_touchdowns'] = parse_stat_value(stats[i])
                elif key == 'longReception':
                    mapped_stats['receiving_longest'] = parse_stat_value(stats[i])
                elif key == 'receivingTargets':
                    mapped_stats['receiving_targets'] = parse_stat_value(stats[i])
    
    elif stat_name == 'defensive' and len(stats) >= len(keys):
        for i, key in enumerate(keys):
            if i < len(stats):
                if key == 'totalTackles':
                    mapped_stats['tackles_total'] = parse_stat_value(stats[i])
                elif key == 'soloTackles':
                    mapped_stats['tackles_solo'] = parse_stat_value(stats[i])
                elif key == 'sacks':
                    mapped_stats['sacks'] = parse_stat_value(stats[i])
                elif key == 'interceptions':
                    mapped_stats['interceptions_defense'] = parse_stat_value(stats[i])
                elif key == 'forcedFumbles':
                    mapped_stats['fumbles_forced'] = parse_stat_value(stats[i])
    
    # Calculate fantasy points (basic scoring)
    fantasy_points = (
        mapped_stats['passing_yards'] * 0.04 +
        mapped_stats['passing_touchdowns'] * 4 +
        mapped_stats['rushing_yards'] * 0.1 +
        mapped_stats['rushing_touchdowns'] * 6 +
        mapped_stats['receiving_yards'] * 0.1 +
        mapped_stats['receptions'] * 0.5 +
        mapped_stats['receiving_touchdowns'] * 6 -
        mapped_stats['interceptions'] * 2
    )
    mapped_stats['fantasy_points'] = round(fantasy_points, 1)
    
    return mapped_stats

def get_recent_cfb_games(days_back: int = 7) -> List[Dict]:
    """Get recent CFB games from ESPN API"""
    games = []
    
    for i in range(days_back):
        date = datetime.now() - timedelta(days=i)
        date_str = date.strftime('%Y%m%d')
        
        url = f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates={date_str}"
        data = rate_limited_request(url)
        
        if data and 'events' in data:
            for event in data['events']:
                if event.get('status', {}).get('type', {}).get('completed', False):
                    games.append({
                        'id': event['id'],
                        'name': event['name'],
                        'date': event['date'],
                        'status': event['status']
                    })
                    
        time.sleep(0.1)  # Small delay between date requests
    
    return games

def process_game_stats(game_id: str) -> int:
    """Process individual game stats for all players in a game"""
    processed_count = 0
    
    url = f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event={game_id}"
    data = rate_limited_request(url)
    
    if not data or 'boxscore' not in data:
        print(f"No boxscore data for game {game_id}")
        return 0
    
    game_info = data.get('header', {})
    boxscore = data['boxscore']
    
    if 'players' not in boxscore:
        print(f"No player stats for game {game_id}")
        return 0
    
    for team_stats in boxscore['players']:
        team_info = team_stats.get('team', {})
        team_name = team_info.get('abbreviation', '')
        
        if not team_name:
            continue
            
        for stat_category in team_stats.get('statistics', []):
            stat_name = stat_category.get('name', '')
            athletes = stat_category.get('athletes', [])
            
            for athlete_data in athletes:
                athlete_info = athlete_data.get('athlete', {})
                if not athlete_info or not athlete_info.get('displayName'):
                    continue
                
                # Create or update player
                player_id = create_or_update_cfb_player(athlete_info, team_name)
                if not player_id:
                    continue
                
                # Map stats to standard format
                game_stats = map_espn_stats_to_standard_format(
                    game_info, team_info, stat_category, athlete_data
                )
                
                try:
                    # Check if this player's game stats already exist
                    existing_query = supabase.table("player_game_stats").select("id").eq(
                        "player_id", player_id
                    ).eq("stats->>external_game_id", game_id)
                    
                    existing_result = existing_query.execute()
                    
                    if existing_result.data:
                        # Update existing record
                        supabase.table("player_game_stats").update({
                            "stats": game_stats,
                            "fantasy_points": game_stats['fantasy_points']
                        }).eq("id", existing_result.data[0]['id']).execute()
                    else:
                        # Insert new record
                        supabase.table("player_game_stats").insert({
                            "player_id": player_id,
                            "stats": game_stats,
                            "fantasy_points": game_stats['fantasy_points']
                        }).execute()
                    
                    processed_count += 1
                    
                except Exception as e:
                    print(f"Error saving stats for {athlete_info.get('displayName')}: {e}")
    
    return processed_count

def main():
    """Main execution function"""
    print("🏈 Starting CFB Individual Game Stats Ingestion (ESPN API)")
    print("=" * 60)
    
    # Get recent completed games
    print("Fetching recent CFB games...")
    games = get_recent_cfb_games(days_back=7)
    print(f"Found {len(games)} completed games")
    
    total_processed = 0
    
    for i, game in enumerate(games, 1):
        print(f"\n[{i}/{len(games)}] Processing: {game['name']}")
        print(f"Game ID: {game['id']}, Date: {game['date']}")
        
        try:
            count = process_game_stats(game['id'])
            total_processed += count
            print(f"✅ Processed {count} player game records")
            
        except Exception as e:
            print(f"❌ Error processing game {game['id']}: {e}")
            continue
        
        # Rate limiting between games
        if i < len(games):
            time.sleep(1)
    
    print("\n" + "=" * 60)
    print(f"🏈 CFB Individual Game Stats Ingestion Complete!")
    print(f"✅ Total player game records processed: {total_processed}")
    print(f"✅ Games processed: {len(games)}")
    print(f"📊 Data stored in player_game_stats table with real individual game statistics")

if __name__ == "__main__":
    main()
