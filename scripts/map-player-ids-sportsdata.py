#!/usr/bin/env python3
"""
SportsData.io Player ID Mapping Script
=====================================
Maps existing players to SportsData.io player IDs using their Player Season Stats endpoint.
"""

import os
import sys
import time
import requests
import logging
from typing import List, Dict, Optional
from supabase import create_client, Client
from difflib import SequenceMatcher
import threading

# Configuration
SPORTSDATA_API_KEY = "03d3518bdc1d468cba7855b6e1fcdfa6"
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/mlb/stats/json"

# Rate limiting
API_RATE_LIMIT = 1.0
REQUEST_LOCK = threading.Lock()
LAST_REQUEST_TIME = {"time": 0}

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://iriaegoipkjtktitpary.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/player-id-mapping.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def rate_limited_request(url: str) -> Optional[List[Dict]]:
    """Make rate-limited API request"""
    with REQUEST_LOCK:
        current_time = time.time()
        time_since_last = current_time - LAST_REQUEST_TIME["time"]
        if time_since_last < API_RATE_LIMIT:
            time.sleep(API_RATE_LIMIT - time_since_last)
        
        try:
            response = requests.get(url, timeout=30)
            LAST_REQUEST_TIME["time"] = time.time()
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                logger.warning("Rate limit hit, waiting 60 seconds...")
                time.sleep(60)
                return rate_limited_request(url)
            else:
                logger.error(f"API request failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Request error: {str(e)}")
            return None

def fetch_sportsdata_players(season: str = "2024") -> List[Dict]:
    """Fetch all MLB players from SportsData.io for the season"""
    url = f"{SPORTSDATA_BASE_URL}/PlayerSeasonStats/{season}?key={SPORTSDATA_API_KEY}"
    
    logger.info(f"Fetching all MLB players from SportsData.io for {season}...")
    data = rate_limited_request(url)
    
    if data:
        logger.info(f"Retrieved {len(data)} players from SportsData.io")
        return data
    else:
        logger.error("Failed to fetch players from SportsData.io")
        return []

def calculate_name_similarity(name1: str, name2: str) -> float:
    """Calculate similarity between two player names"""
    # Clean names for comparison
    name1_clean = name1.lower().strip()
    name2_clean = name2.lower().strip()
    
    # Direct match
    if name1_clean == name2_clean:
        return 1.0
    
    # Check if one is a subset of the other (for cases like "Mike Trout" vs "Michael Trout")
    if name1_clean in name2_clean or name2_clean in name1_clean:
        return 0.9
    
    # Use sequence matcher for similarity
    return SequenceMatcher(None, name1_clean, name2_clean).ratio()

def find_best_match(parley_player: Dict, sportsdata_players: List[Dict]) -> Optional[Dict]:
    """Find the best matching SportsData.io player for a Parley player"""
    parley_name = parley_player['name']
    parley_team = parley_player.get('team', '').upper()
    
    best_match = None
    best_score = 0.0
    
    for sd_player in sportsdata_players:
        sd_name = sd_player.get('Name', '')
        sd_team = sd_player.get('Team', '').upper()
        
        # Calculate name similarity
        name_score = calculate_name_similarity(parley_name, sd_name)
        
        # Boost score if teams match
        team_boost = 0.1 if parley_team and sd_team and parley_team == sd_team else 0.0
        
        total_score = name_score + team_boost
        
        if total_score > best_score and name_score > 0.8:  # Require high name similarity
            best_score = total_score
            best_match = sd_player
    
    return best_match if best_score > 0.8 else None

def update_player_sportsdata_id(player_uuid: str, sportsdata_id: str, confidence: float) -> bool:
    """Update player record with SportsData.io ID"""
    try:
        # Update the external_player_id field
        result = supabase.table('players') \
            .update({'external_player_id': sportsdata_id}) \
            .eq('id', player_uuid) \
            .execute()
        
        if result.data:
            return True
        else:
            logger.error(f"Failed to update player {player_uuid}: {result}")
            return False
            
    except Exception as e:
        logger.error(f"Error updating player {player_uuid}: {str(e)}")
        return False

def map_player_ids():
    """Main function to map player IDs"""
    logger.info("Starting player ID mapping process...")
    
    # Get MLB players from Parley database
    try:
        result = supabase.table('players_with_headshots') \
            .select('id, name, team, sport, external_player_id') \
            .in_('sport', ['MLB', 'BASEBALL_MLB']) \
            .eq('active', True) \
            .execute()
        
        parley_players = result.data
        logger.info(f"Found {len(parley_players)} MLB players in Parley database")
        
    except Exception as e:
        logger.error(f"Error fetching Parley players: {str(e)}")
        return
    
    # Get SportsData.io players
    sportsdata_players = fetch_sportsdata_players()
    if not sportsdata_players:
        logger.error("No SportsData.io players retrieved, aborting")
        return
    
    # Map players
    matched_count = 0
    updated_count = 0
    
    for parley_player in parley_players:
        player_name = parley_player['name']
        current_external_id = parley_player.get('external_player_id')
        
        # Skip if already has a numeric SportsData.io ID
        if current_external_id and current_external_id.isdigit():
            logger.debug(f"Player {player_name} already has SportsData.io ID: {current_external_id}")
            continue
        
        # Find best match
        best_match = find_best_match(parley_player, sportsdata_players)
        
        if best_match:
            sportsdata_id = str(best_match.get('PlayerID'))
            sportsdata_name = best_match.get('Name')
            sportsdata_team = best_match.get('Team')
            
            # Calculate confidence
            name_similarity = calculate_name_similarity(player_name, sportsdata_name)
            
            logger.info(f"MATCH: {player_name} -> {sportsdata_name} ({sportsdata_team}) [ID: {sportsdata_id}, Confidence: {name_similarity:.2f}]")
            
            # Update the player record
            if update_player_sportsdata_id(parley_player['id'], sportsdata_id, name_similarity):
                updated_count += 1
            
            matched_count += 1
        else:
            logger.warning(f"NO MATCH: {player_name} ({parley_player.get('team', 'Unknown')})")
    
    # Summary
    logger.info(f"""
    Player ID mapping completed:
    - Total Parley players: {len(parley_players)}
    - Matches found: {matched_count}
    - Database updates: {updated_count}
    - Match rate: {(matched_count / len(parley_players) * 100):.1f}%
    """)

if __name__ == "__main__":
    map_player_ids()
