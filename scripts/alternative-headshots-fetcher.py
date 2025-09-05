#!/usr/bin/env python3
"""
Alternative College Football Headshots Fetcher
Uses multiple sources when Sportradar Images API is not available
"""

import os
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
from datetime import datetime
import logging
import time
import re
from urllib.parse import quote, urljoin
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/alternative-headshots.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AlternativeHeadshotsFetcher:
    def __init__(self):
        # Database configuration - Use Supabase connection
        supabase_url = "https://iriaegoipkjtktitpary.supabase.co"
        supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0"
        
        # Construct Supabase PostgreSQL URL
        self.db_url = f"postgresql://postgres.iriaegoipkjtktitpary:{supabase_key}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
        
        # Session for connection reuse
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        # Rate limiting
        self.request_delay = 0.5  # 500ms between requests
        
    def get_database_connection(self):
        """Get database connection"""
        try:
            conn = psycopg2.connect(self.db_url)
            return conn
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    def normalize_name_for_url(self, name):
        """Normalize player name for URL construction"""
        # Remove common suffixes and clean name
        name = re.sub(r'\s+(Jr\.?|Sr\.?|III|II|IV)$', '', name, flags=re.IGNORECASE)
        name = re.sub(r'[^\w\s-]', '', name)  # Remove special characters
        name = re.sub(r'\s+', '-', name.strip())  # Replace spaces with hyphens
        return name.lower()

    def try_espn_headshot(self, player_name, team_name):
        """
        Try to find headshot on ESPN
        ESPN often has URLs like: /i/headshots/college-football/players/full/[ID].png
        But we need to search first to find the player ID
        """
        try:
            # ESPN search approach
            search_query = f"{player_name} {team_name} college football"
            search_url = f"https://site-api.espn.com/apis/site/v2/search"
            
            params = {
                'query': search_query,
                'section': 'college-football',
                'limit': 5
            }
            
            response = self.session.get(search_url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Look for player results
                if 'results' in data:
                    for result in data['results']:
                        if result.get('type') == 'athlete' and 'college' in result.get('league', '').lower():
                            # Found potential player match
                            athlete_id = result.get('id')
                            if athlete_id:
                                # Construct ESPN headshot URL
                                headshot_url = f"https://a.espncdn.com/i/headshots/college-football/players/full/{athlete_id}.png"
                                
                                # Verify image exists
                                img_response = self.session.head(headshot_url, timeout=5)
                                if img_response.status_code == 200:
                                    thumbnail_url = f"https://a.espncdn.com/i/headshots/college-football/players/full/{athlete_id}_50x50.png"
                                    return {
                                        'headshot_url': headshot_url,
                                        'thumbnail_url': thumbnail_url,
                                        'source': 'espn',
                                        'width': 400,
                                        'height': 600
                                    }
            
        except Exception as e:
            logger.debug(f"ESPN search failed for {player_name}: {e}")
        
        return None

    def try_cbs_sports_headshot(self, player_name, team_name):
        """
        Try CBS Sports headshots
        """
        try:
            # CBS Sports often uses team-based rosters
            team_normalized = self.normalize_name_for_url(team_name)
            player_normalized = self.normalize_name_for_url(player_name)
            
            # Try CBS roster page approach
            roster_url = f"https://www.cbssports.com/college-football/teams/{team_normalized}/roster/"
            
            response = self.session.get(roster_url, timeout=10)
            
            if response.status_code == 200:
                # Look for player in roster HTML (basic pattern matching)
                if player_name.lower() in response.text.lower():
                    # Extract potential image URLs from the page
                    import re
                    img_patterns = [
                        rf'https://[^"]*{player_normalized}[^"]*\.(?:jpg|jpeg|png|gif)',
                        rf'https://[^"]*headshots?[^"]*\.(?:jpg|jpeg|png|gif)',
                    ]
                    
                    for pattern in img_patterns:
                        matches = re.findall(pattern, response.text, re.IGNORECASE)
                        for match in matches:
                            # Verify image exists
                            img_response = self.session.head(match, timeout=5)
                            if img_response.status_code == 200:
                                return {
                                    'headshot_url': match,
                                    'thumbnail_url': match,  # Same URL for now
                                    'source': 'cbs_sports',
                                    'width': None,
                                    'height': None
                                }
            
        except Exception as e:
            logger.debug(f"CBS Sports failed for {player_name}: {e}")
        
        return None

    def try_sports_reference_headshot(self, player_name, team_name):
        """
        Try Sports Reference (College Football Reference)
        """
        try:
            # Sports Reference uses a different approach
            # Often has URLs like: https://www.sports-reference.com/cfb/players/[name-format].html
            
            # Create sports reference name format (first letter of last name)
            name_parts = player_name.split()
            if len(name_parts) >= 2:
                first_name = name_parts[0].lower()
                last_name = name_parts[-1].lower()
                
                # Sports Reference format: last name + first 2-3 chars of first name + number
                name_key = last_name[:8] + first_name[:2] + "01"  # Common pattern
                
                player_url = f"https://www.sports-reference.com/cfb/players/{name_key}.html"
                
                response = self.session.get(player_url, timeout=10)
                
                if response.status_code == 200:
                    # Look for headshot in the HTML
                    import re
                    img_pattern = r'<img[^>]*class="[^"]*headshot[^"]*"[^>]*src="([^"]+)"'
                    matches = re.findall(img_pattern, response.text, re.IGNORECASE)
                    
                    if matches:
                        img_url = matches[0]
                        if img_url.startswith('//'):
                            img_url = 'https:' + img_url
                        elif img_url.startswith('/'):
                            img_url = 'https://www.sports-reference.com' + img_url
                        
                        return {
                            'headshot_url': img_url,
                            'thumbnail_url': img_url,
                            'source': 'sports_reference',
                            'width': None,
                            'height': None
                        }
            
        except Exception as e:
            logger.debug(f"Sports Reference failed for {player_name}: {e}")
        
        return None

    def try_ourlads_headshot(self, player_name, team_name):
        """
        Try Ourlads.com - they have extensive college rosters with photos
        """
        try:
            # Ourlads has team rosters with photos
            team_normalized = team_name.lower().replace(' ', '').replace('state', 'st')
            
            roster_url = f"https://www.ourlads.com/ncaa-football-depth-charts/{team_normalized}/roster"
            
            response = self.session.get(roster_url, timeout=10)
            
            if response.status_code == 200 and player_name.lower() in response.text.lower():
                # Parse for image URLs
                import re
                img_pattern = r'<img[^>]*src="([^"]*(?:headshots?|players?|roster)[^"]*\.(?:jpg|jpeg|png|gif))"'
                matches = re.findall(img_pattern, response.text, re.IGNORECASE)
                
                for match in matches:
                    if not match.startswith('http'):
                        match = urljoin('https://www.ourlads.com', match)
                    
                    # Verify image exists
                    img_response = self.session.head(match, timeout=5)
                    if img_response.status_code == 200:
                        return {
                            'headshot_url': match,
                            'thumbnail_url': match,
                            'source': 'ourlads',
                            'width': None,
                            'height': None
                        }
            
        except Exception as e:
            logger.debug(f"Ourlads failed for {player_name}: {e}")
        
        return None

    def fetch_headshot_for_player(self, player_name, team_name):
        """
        Try multiple sources to find a headshot for the player
        """
        logger.debug(f"Searching for headshot: {player_name} ({team_name})")
        
        # Try sources in order of preference/reliability
        sources = [
            self.try_espn_headshot,
            self.try_cbs_sports_headshot,
            self.try_ourlads_headshot,
            self.try_sports_reference_headshot
        ]
        
        for source_func in sources:
            try:
                result = source_func(player_name, team_name)
                if result:
                    logger.info(f"Found headshot for {player_name} via {result['source']}")
                    return result
                
                # Rate limiting between attempts
                time.sleep(self.request_delay)
                
            except Exception as e:
                logger.debug(f"Source {source_func.__name__} failed for {player_name}: {e}")
                continue
        
        logger.debug(f"No headshot found for {player_name}")
        return None

    def process_college_players(self, limit=100):
        """
        Process college football players and find headshots
        """
        conn = self.get_database_connection()
        processed = 0
        found = 0
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Get college football players without headshots
                cursor.execute("""
                    SELECT p.id, p.name, p.team 
                    FROM players p
                    LEFT JOIN player_headshots ph ON p.id = ph.player_id
                    WHERE p.sport = 'College Football' 
                    AND ph.id IS NULL
                    AND p.name IS NOT NULL
                    AND p.team IS NOT NULL
                    ORDER BY p.name
                    LIMIT %s
                """, (limit,))
                
                players = cursor.fetchall()
                logger.info(f"Processing {len(players)} college football players...")
                
                for player in players:
                    processed += 1
                    player_id = player['id']
                    player_name = player['name']
                    team_name = player['team']
                    
                    logger.info(f"Processing {processed}/{len(players)}: {player_name} ({team_name})")
                    
                    # Try to find headshot
                    headshot_data = self.fetch_headshot_for_player(player_name, team_name)
                    
                    if headshot_data:
                        # Store in database
                        cursor.execute("""
                            INSERT INTO player_headshots 
                            (id, player_id, headshot_url, thumbnail_url, source, 
                             image_width, image_height, is_active, last_updated, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            str(uuid.uuid4()),
                            player_id,
                            headshot_data['headshot_url'],
                            headshot_data['thumbnail_url'],
                            headshot_data['source'],
                            headshot_data.get('width'),
                            headshot_data.get('height'),
                            True,
                            datetime.utcnow(),
                            datetime.utcnow()
                        ))
                        
                        conn.commit()
                        found += 1
                        logger.info(f"✅ Stored headshot for {player_name}")
                    
                    # Rate limiting
                    time.sleep(self.request_delay)
                
        finally:
            conn.close()
        
        logger.info(f"""
        ✅ ALTERNATIVE HEADSHOTS SYNC COMPLETE
        
        📊 Summary:
        - Players processed: {processed}
        - Headshots found: {found}
        - Success rate: {(found/processed*100):.1f}% if processed > 0 else 0
        """)
        
        return found

def main():
    """Main entry point"""
    fetcher = AlternativeHeadshotsFetcher()
    
    # Process in batches to avoid overwhelming sources
    batch_size = 50
    fetcher.process_college_players(limit=batch_size)

if __name__ == "__main__":
    main()
