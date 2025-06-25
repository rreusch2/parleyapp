#!/usr/bin/env python3
"""
Player Props Odds Ingestor
Fetches real player prop lines and odds from TheOdds API Premium
and stores them in the normalized database structure.
"""

import os
import sys
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone, timedelta
import json
import logging
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PlayerPropsIngestor:
    def __init__(self):
        self.api_key = os.getenv('THEODDS_API_KEY')
        if not self.api_key:
            raise ValueError("THEODDS_API_KEY not found in environment variables")
        
        self.base_url = "https://api.the-odds-api.com/v4"
        self.db_config = {
            'host': os.getenv('DB_HOST'),
            'database': os.getenv('DB_NAME'), 
            'user': os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD'),
            'port': int(os.getenv('DB_PORT', 5432))
        }
        
        # Focus on MLB only as requested
        self.sports = ['baseball_mlb']
        
        # Bookmakers we want odds from
        self.bookmakers = ['fanduel', 'draftkings', 'betmgm', 'caesars']
        
    def get_db_connection(self):
        """Get database connection"""
        return psycopg2.connect(**self.db_config)
    
    def fetch_player_props_from_api(self, sport: str) -> List[Dict]:
        """Fetch MLB player props using correct TheOdds API Premium approach"""
        try:
            # Step 1: Get all MLB events first
            events_url = f"{self.base_url}/sports/{sport}/odds"
            events_params = {
                'apiKey': self.api_key,
                'regions': 'us',
                'markets': 'h2h',  # Just get basic info first
                'oddsFormat': 'american'
            }
            
            logger.info(f"🔗 Step 1: Getting MLB events...")
            events_response = requests.get(events_url, params=events_params, timeout=30)
            events_response.raise_for_status()
            events = events_response.json()
            
            logger.info(f"✅ Found {len(events)} MLB events")
            
            # Filter for upcoming games only
            current_time = datetime.now(timezone.utc)
            upcoming_events = []
            
            for event in events:
                game_time = datetime.fromisoformat(event['commence_time'].replace('Z', '+00:00'))
                time_diff = (game_time - current_time).total_seconds() / 3600
                
                if time_diff > 0:  # Game hasn't started yet
                    upcoming_events.append(event)
                    logger.info(f"✅ Upcoming: {event['away_team']} @ {event['home_team']} starts in {time_diff:.1f} hours")
                else:
                    logger.info(f"❌ Already started: {event['away_team']} @ {event['home_team']}")
            
            logger.info(f"📊 Found {len(upcoming_events)} upcoming games out of {len(events)} total")
            
            if not upcoming_events:
                logger.warning("⚠️ No upcoming games found! All games may have already started.")
                return []
            
            # Step 2: For each upcoming event, try to get player props
            all_prop_data = []
            mlb_prop_markets = [
                'batter_hits',              # Changed from player_hits_pitched
                'pitcher_strikeouts',       # Changed from player_strikeouts_pitched
                'batter_home_runs',         # Changed from player_home_runs
                'batter_rbis',              # Changed from player_rbis
                'batter_total_bases',       # Changed from player_total_bases
                'pitcher_earned_runs',      # Added additional pitcher prop
                'pitcher_hits_allowed',     # Added additional pitcher prop
                'batter_runs_scored',       # Added additional batter prop
                'batter_singles',           # Added additional batter prop
                'batter_stolen_bases'       # Added additional batter prop
            ]
            
            # Limit to first 5 upcoming events to conserve API calls
            for event in upcoming_events[:5]:
                event_id = event['id']
                logger.info(f"🎯 Fetching props for: {event['away_team']} @ {event['home_team']}")
                
                # Use event-specific endpoint for player props
                props_url = f"{self.base_url}/sports/{sport}/events/{event_id}/odds"
                
                # Try to get all prop markets at once
                try:
                    props_params = {
                        'apiKey': self.api_key,
                        'regions': 'us',
                        'markets': ','.join(mlb_prop_markets[:5]),  # Try first 5 markets
                        'oddsFormat': 'american',
                        'bookmakers': ','.join(self.bookmakers)
                    }
                    
                    logger.info(f"  📊 Trying markets: {','.join(mlb_prop_markets[:5])}")
                    logger.info(f"     URL: {props_url}")
                    props_response = requests.get(props_url, params=props_params, timeout=30)
                    
                    if props_response.status_code == 200:
                        props_data = props_response.json()
                        if props_data and 'bookmakers' in props_data and props_data['bookmakers']:
                            # Check if any bookmakers actually have prop markets
                            has_props = False
                            for bm in props_data['bookmakers']:
                                for mkt in bm.get('markets', []):
                                    if mkt['key'] in mlb_prop_markets:
                                        has_props = True
                                        break
                                if has_props:
                                    break
                            
                            if has_props:
                                logger.info(f"  ✅ SUCCESS! Found player prop markets")
                                # Add event info to the props data for later processing
                                props_data['event_info'] = {
                                    'home_team': event['home_team'],
                                    'away_team': event['away_team'],
                                    'commence_time': event['commence_time']
                                }
                                all_prop_data.append(props_data)
                            else:
                                logger.info(f"  ⚠️ No player prop markets in response - only standard markets")
                        else:
                            logger.info(f"  ⚠️ Empty response - no bookmakers/props")
                    else:
                        error_msg = props_response.text[:200] if props_response.text else "No error message"
                        logger.info(f"  ❌ Request failed: {props_response.status_code} - {error_msg}")
                        
                except Exception as e:
                    logger.info(f"  ❌ Error: {str(e)[:100]}")
                    continue
            
            logger.info(f"🎉 Total player prop events found: {len(all_prop_data)}")
            return all_prop_data
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ API request failed for {sport}: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Unexpected error fetching {sport} props: {e}")
            return []
    
    def ensure_prop_types_exist(self, conn):
        """Ensure all required prop types exist in player_prop_types table"""
        prop_types = [
            # MLB prop types - using correct API market keys
            ('batter_hits', 'Batter Hits O/U', 'baseball_mlb', 'batting'),
            ('batter_home_runs', 'Batter Home Runs O/U', 'baseball_mlb', 'power'),
            ('batter_rbis', 'Batter RBIs O/U', 'baseball_mlb', 'batting'),
            ('batter_total_bases', 'Batter Total Bases O/U', 'baseball_mlb', 'batting'),
            ('batter_runs_scored', 'Batter Runs Scored O/U', 'baseball_mlb', 'batting'),
            ('batter_singles', 'Batter Singles O/U', 'baseball_mlb', 'batting'),
            ('batter_stolen_bases', 'Batter Stolen Bases O/U', 'baseball_mlb', 'batting'),
            ('pitcher_strikeouts', 'Pitcher Strikeouts O/U', 'baseball_mlb', 'pitching'),
            ('pitcher_earned_runs', 'Pitcher Earned Runs O/U', 'baseball_mlb', 'pitching'),
            ('pitcher_hits_allowed', 'Pitcher Hits Allowed O/U', 'baseball_mlb', 'pitching'),
            # Legacy prop types for backward compatibility
            ('player_hits_o_u', 'Hits O/U', 'baseball_mlb', 'batting'),
            ('player_hits', 'Hits', 'baseball_mlb', 'batting'),
            ('player_home_runs', 'Home Runs', 'baseball_mlb', 'power'),
            ('player_strikeouts_pitched', 'Strikeouts Pitched', 'baseball_mlb', 'pitching'),
            ('player_strikeouts', 'Strikeouts', 'baseball_mlb', 'pitching'),
            ('player_rbis', 'RBIs', 'baseball_mlb', 'batting'),
            ('player_total_bases', 'Total Bases', 'baseball_mlb', 'batting'),
        ]
        
        cursor = conn.cursor()
        
        for prop_key, prop_name, sport_key, stat_category in prop_types:
            cursor.execute("""
                INSERT INTO player_prop_types (prop_key, prop_name, sport_key, stat_category)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (prop_key) DO NOTHING
            """, (prop_key, prop_name, sport_key, stat_category))
        
        conn.commit()
        cursor.close()
        logger.info("✅ Ensured prop types exist")
    
    def ensure_bookmakers_exist(self, conn):
        """Ensure all bookmakers exist in bookmakers table"""
        bookmaker_data = [
            ('fanduel', 'FanDuel'),
            ('draftkings', 'DraftKings'),
            ('betmgm', 'BetMGM'),
            ('caesars', 'Caesars'),
            ('lowvig', 'LowVig.ag'),
            ('betonlineag', 'BetOnline.ag'),
            ('williamhill_us', 'Caesars')
        ]
        
        cursor = conn.cursor()
        
        for bookmaker_key, bookmaker_name in bookmaker_data:
            cursor.execute("""
                INSERT INTO bookmakers (bookmaker_key, bookmaker_name, is_active)
                VALUES (%s, %s, true)
                ON CONFLICT (bookmaker_key) DO NOTHING
            """, (bookmaker_key, bookmaker_name))
        
        conn.commit()
        cursor.close()
        logger.info("✅ Ensured bookmakers exist")
    
    def get_or_create_player(self, conn, player_name: str, team: str, sport: str) -> Optional[str]:
        """Get existing player or create new one"""
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Try to find existing player
        cursor.execute("""
            SELECT id FROM players 
            WHERE name ILIKE %s AND team ILIKE %s AND sport = %s
            LIMIT 1
        """, (player_name, team, sport.upper()))
        
        result = cursor.fetchone()
        if result:
            cursor.close()
            return result['id']
        
        # Create new player with conflict handling
        external_id = f"{sport}_{player_name.replace(' ', '_')}"
        player_key = f"{sport}_{player_name.replace(' ', '_').lower()}"
        
        cursor.execute("""
            INSERT INTO players (
                external_player_id, name, team, sport, player_key, player_name, active
            ) VALUES (%s, %s, %s, %s, %s, %s, true)
            ON CONFLICT (external_player_id) 
            DO UPDATE SET 
                name = EXCLUDED.name,
                team = EXCLUDED.team,
                active = true
            RETURNING id
        """, (external_id, player_name, team, sport.upper(), player_key, player_name))
        
        new_player = cursor.fetchone()
        conn.commit()
        cursor.close()
        
        if new_player:
            logger.info(f"➕ Created new player: {player_name} ({team})")
            return new_player['id']
        
        return None
    
    def store_player_prop_odds(self, conn, events: List[Dict], sport: str):
        """Store player prop odds in database"""
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        total_props_stored = 0
        
        # Get lookup data
        cursor.execute("SELECT id, prop_key FROM player_prop_types")
        prop_types = {row['prop_key']: row['id'] for row in cursor.fetchall()}
        
        cursor.execute("SELECT id, bookmaker_key FROM bookmakers")
        bookmakers = {row['bookmaker_key']: row['id'] for row in cursor.fetchall()}
        
        for event in events:
            # Extract event info
            event_info = event.get('event_info', {})
            home_team = event_info.get('home_team', event.get('home_team'))
            away_team = event_info.get('away_team', event.get('away_team'))
            commence_time = event_info.get('commence_time', event.get('commence_time'))
            
            # Get or find corresponding sports_event
            cursor.execute("""
                SELECT id FROM sports_events 
                WHERE home_team = %s AND away_team = %s 
                AND DATE(start_time) = DATE(%s)
                LIMIT 1
            """, (home_team, away_team, commence_time))
            
            sports_event = cursor.fetchone()
            if not sports_event:
                logger.warning(f"⚠️ No matching sports_event found for {away_team} @ {home_team}")
                continue
                
            event_id = sports_event['id']
            
            # Process each bookmaker's odds
            for bookmaker in event.get('bookmakers', []):
                bookmaker_key = bookmaker['key']
                bookmaker_id = bookmakers.get(bookmaker_key)
                
                if not bookmaker_id:
                    logger.warning(f"⚠️ Unknown bookmaker: {bookmaker_key}")
                    continue
                
                # Process each market (prop type)
                for market in bookmaker.get('markets', []):
                    market_key = market['key']
                    prop_type_id = prop_types.get(market_key)
                    
                    if not prop_type_id:
                        continue  # Skip unsupported prop types
                    
                    # Group outcomes by player to combine over/under odds
                    player_outcomes = {}
                    
                    # Process each outcome (player)
                    for outcome in market.get('outcomes', []):
                        outcome_name = outcome['name']  # "Over" or "Under"
                        player_name = outcome.get('description', '')  # Actual player name
                        line = outcome.get('point', 0)
                        
                        # Skip if no player name in description
                        if not player_name or not player_name.strip():
                            logger.warning(f"  ⚠️ Skipping outcome with no player name: {outcome}")
                            continue
                        
                        # Determine outcome type from name field
                        if outcome_name == 'Over':
                            outcome_type = 'over'
                        elif outcome_name == 'Under':
                            outcome_type = 'under'
                        else:
                            logger.warning(f"  ⚠️ Skipping unknown outcome type: {outcome_name}")
                            continue
                        
                        player_name = player_name.strip()
                        
                        # Initialize player data if not exists
                        if player_name not in player_outcomes:
                            player_outcomes[player_name] = {
                                'line': line,
                                'over_odds': None,
                                'under_odds': None
                            }
                        
                        # Store the odds based on outcome type
                        if outcome_type == 'over':
                            player_outcomes[player_name]['over_odds'] = outcome.get('price')
                        else:  # under
                            player_outcomes[player_name]['under_odds'] = outcome.get('price')
                        
                        # Update line if not set (should be same for over/under)
                        if player_outcomes[player_name]['line'] is None or player_outcomes[player_name]['line'] == 0:
                            player_outcomes[player_name]['line'] = line
                    
                    # Now store grouped outcomes in database
                    for player_name, outcome_data in player_outcomes.items():
                        # Extract team from event context - try to determine player's team
                        # For now, we'll try both teams and let the player creation logic handle it
                        possible_teams = [home_team, away_team]
                        player_id = None
                        
                        for team in possible_teams:
                            player_id = self.get_or_create_player(conn, player_name, team, sport)
                            if player_id:
                                break
                        
                        if not player_id:
                            logger.warning(f"  ⚠️ Could not create/find player: {player_name}")
                            continue
                        
                        # Store the prop odds
                        cursor.execute("""
                            INSERT INTO player_props_odds (
                                event_id, player_id, prop_type_id, bookmaker_id,
                                line, over_odds, under_odds, last_update
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (event_id, player_id, prop_type_id, bookmaker_id)
                            DO UPDATE SET 
                                line = EXCLUDED.line,
                                over_odds = EXCLUDED.over_odds,
                                under_odds = EXCLUDED.under_odds,
                                last_update = EXCLUDED.last_update
                        """, (
                            event_id, player_id, prop_type_id, bookmaker_id,
                            outcome_data['line'], outcome_data['over_odds'], outcome_data['under_odds'], 
                            datetime.now(timezone.utc)
                        ))
                        
                        total_props_stored += 1
        
        conn.commit()
        cursor.close()
        logger.info(f"💾 Stored {total_props_stored} player prop odds for {sport}")
    
    def run_ingestion(self):
        """Main ingestion process"""
        logger.info("🚀 Starting Player Props Ingestion...")
        
        try:
            # Test available markets first
            self.test_available_markets()
            
            conn = self.get_db_connection()
            
            # Ensure required reference data exists
            self.ensure_prop_types_exist(conn)
            self.ensure_bookmakers_exist(conn)
            
            total_props = 0
            
            for sport in self.sports:
                logger.info(f"📊 Processing {sport}...")
                
                # Fetch from API
                events = self.fetch_player_props_from_api(sport)
                
                if events:
                    # Store in database
                    self.store_player_prop_odds(conn, events, sport)
                    total_props += len(events)
                
            conn.close()
            
            logger.info(f"🎉 INGESTION COMPLETE! Processed {total_props} total prop markets")
            
        except Exception as e:
            logger.error(f"❌ Ingestion failed: {e}")
            raise

    def test_available_markets(self):
        """Test what markets are available for MLB events"""
        try:
            # Get MLB events
            events_url = f"{self.base_url}/sports/baseball_mlb/odds"
            events_params = {
                'apiKey': self.api_key,
                'regions': 'us',
                'markets': 'h2h',
                'oddsFormat': 'american'
            }
            
            logger.info("🧪 Testing available MLB markets...")
            events_response = requests.get(events_url, params=events_params, timeout=30)
            events_response.raise_for_status()
            events = events_response.json()
            
            if events:
                # Test first event
                event = events[0]
                event_id = event['id']
                logger.info(f"📋 Testing event: {event['away_team']} @ {event['home_team']}")
                
                # Try to get all available markets
                props_url = f"{self.base_url}/sports/baseball_mlb/events/{event_id}/odds"
                test_params = {
                    'apiKey': self.api_key,
                    'regions': 'us',
                    'oddsFormat': 'american'
                }
                
                test_response = requests.get(props_url, params=test_params, timeout=30)
                if test_response.status_code == 200:
                    test_data = test_response.json()
                    if test_data and 'bookmakers' in test_data:
                        all_markets = set()
                        for bm in test_data['bookmakers']:
                            for mkt in bm.get('markets', []):
                                all_markets.add(mkt['key'])
                        logger.info(f"📊 Available markets for MLB: {', '.join(sorted(all_markets))}")
                        
                        # Show specific player prop markets
                        prop_markets = [m for m in all_markets if 'batter' in m or 'pitcher' in m or 'player' in m]
                        if prop_markets:
                            logger.info(f"⚾ Player prop markets found: {', '.join(sorted(prop_markets))}")
                        else:
                            logger.warning("⚠️ No player prop markets found!")
                else:
                    logger.error(f"❌ Test request failed: {test_response.status_code}")
                    logger.error(f"   Response: {test_response.text[:500]}")
                    
        except Exception as e:
            logger.error(f"❌ Market test failed: {e}")

if __name__ == "__main__":
    try:
        ingestor = PlayerPropsIngestor()
        ingestor.run_ingestion()
    except Exception as e:
        logger.error(f"❌ Script failed: {e}")
        sys.exit(1) 