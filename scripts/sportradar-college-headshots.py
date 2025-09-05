#!/usr/bin/env python3
"""
Sportradar College Football Headshots Integration
Fetches and stores college football player headshots using Sportradar Images API
"""

import os
import requests
import xml.etree.ElementTree as ET
from urllib.parse import urljoin
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
from datetime import datetime
import logging
import time
import re
from difflib import SequenceMatcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/sportradar-headshots.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SportradarCollegeHeadshotsFetcher:
    def __init__(self):
        # Sportradar API configuration
        self.api_key = os.getenv('SPORTRADAR_COLLEGE_API_KEY')  # Your trial key
        self.base_url = "https://api.sportradar.us"
        self.access_level = "t"  # "t" for trial, "p" for production
        self.provider = "usat"   # USA Today for college football
        
        # Database configuration
        self.db_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_DB_URL')
        
        # API rate limiting (Sportradar has strict limits)
        self.request_delay = 1  # 1 second between requests
        
        # Session for connection reuse
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'ParleyApp-HeadshotFetcher/1.0'
        })
        
    def get_database_connection(self):
        """Get database connection"""
        try:
            conn = psycopg2.connect(self.db_url)
            return conn
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise
            
    def fetch_college_headshots_manifest(self):
        """
        Fetch the college football headshots manifest from Sportradar
        """
        # College Football headshots endpoint
        url = f"{self.base_url}/ncaaf-images-{self.access_level}3/{self.provider}/headshots/players/manifest.xml"
        
        logger.info(f"Fetching college headshots manifest from: {url}")
        
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Parse XML manifest
            root = ET.fromstring(response.content)
            logger.info(f"Successfully fetched manifest with {len(root.findall('.//asset'))} headshots")
            
            return root
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch manifest: {e}")
            raise
        except ET.ParseError as e:
            logger.error(f"Failed to parse XML manifest: {e}")
            raise
            
    def parse_headshot_assets(self, manifest_root):
        """
        Parse headshot assets from manifest XML
        Returns list of player headshot data
        """
        headshots = []
        
        for asset in manifest_root.findall('.//asset'):
            try:
                asset_id = asset.get('id')
                created = asset.get('created')
                updated = asset.get('updated')
                
                # Get title and description
                title_elem = asset.find('title')
                title = title_elem.text if title_elem is not None else ""
                
                description_elem = asset.find('description')
                description = description_elem.text if description_elem is not None else ""
                
                # Get image links (different sizes)
                links = {}
                for link in asset.findall('.//link'):
                    width = link.get('width')
                    height = link.get('height')
                    href = link.get('href')
                    
                    # Categorize by size
                    if width and height:
                        size_key = f"{width}x{height}"
                        links[size_key] = href
                        
                        # Standard size categories
                        if width == "250":
                            links['thumbnail'] = href
                        elif width == "500":
                            links['medium'] = href
                        elif width == "1000":
                            links['large'] = href
                        elif "original" in href:
                            links['original'] = href
                
                # Get player references (name, team, IDs)
                player_refs = []
                for ref in asset.findall('.//ref[@type="profile"]'):
                    player_name = ref.get('name', '')
                    sport = ref.get('sport', '')
                    sportradar_id = ref.get('sportradar_id', '')
                    
                    # Get entity IDs
                    entity_ids = {}
                    for entity in ref.findall('.//entity_id'):
                        origin = entity.get('origin', '')
                        entity_id = entity.get('id', '')
                        if origin and entity_id:
                            entity_ids[origin] = entity_id
                    
                    player_refs.append({
                        'name': player_name,
                        'sport': sport,
                        'sportradar_id': sportradar_id,
                        'entity_ids': entity_ids
                    })
                
                # Get team references
                team_refs = []
                for ref in asset.findall('.//ref[@type="organization"]'):
                    team_name = ref.get('name', '')
                    sportradar_id = ref.get('sportradar_id', '')
                    team_refs.append({
                        'name': team_name,
                        'sportradar_id': sportradar_id
                    })
                
                headshot_data = {
                    'asset_id': asset_id,
                    'title': title,
                    'description': description,
                    'created': created,
                    'updated': updated,
                    'links': links,
                    'player_refs': player_refs,
                    'team_refs': team_refs
                }
                
                headshots.append(headshot_data)
                
            except Exception as e:
                logger.warning(f"Failed to parse asset {asset.get('id', 'unknown')}: {e}")
                continue
                
        logger.info(f"Parsed {len(headshots)} headshot assets from manifest")
        return headshots
        
    def similarity_score(self, name1, name2):
        """Calculate similarity score between two names"""
        # Normalize names for comparison
        name1_clean = re.sub(r'[^\w\s]', '', name1.lower().strip())
        name2_clean = re.sub(r'[^\w\s]', '', name2.lower().strip())
        
        return SequenceMatcher(None, name1_clean, name2_clean).ratio()
        
    def match_players_to_headshots(self, headshots):
        """
        Match Sportradar headshots to players in database
        """
        conn = self.get_database_connection()
        matches = []
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                # Get all college football players
                cursor.execute("""
                    SELECT id, name, team, external_player_id, sport_key, metadata
                    FROM players 
                    WHERE sport = 'College Football'
                    ORDER BY name
                """)
                
                db_players = cursor.fetchall()
                logger.info(f"Found {len(db_players)} college football players in database")
                
                for headshot in headshots:
                    best_match = None
                    best_score = 0.0
                    
                    # Try to match against each player reference in the headshot
                    for player_ref in headshot['player_refs']:
                        sportradar_name = player_ref['name']
                        
                        # Skip if no name
                        if not sportradar_name:
                            continue
                            
                        # Find best matching player
                        for db_player in db_players:
                            db_name = db_player['name']
                            
                            # Calculate similarity
                            score = self.similarity_score(sportradar_name, db_name)
                            
                            # Also check if external_player_id matches any entity_id
                            external_match = False
                            if db_player['external_player_id']:
                                for origin, entity_id in player_ref['entity_ids'].items():
                                    if str(db_player['external_player_id']) == str(entity_id):
                                        external_match = True
                                        score = 1.0  # Perfect match
                                        break
                            
                            # Check for team match to boost confidence
                            team_match = False
                            if db_player['team'] and headshot['team_refs']:
                                for team_ref in headshot['team_refs']:
                                    team_score = self.similarity_score(db_player['team'], team_ref['name'])
                                    if team_score > 0.8:
                                        team_match = True
                                        score += 0.1  # Boost score for team match
                                        break
                            
                            # Update best match if this is better
                            if score > best_score and (score > 0.85 or external_match):
                                best_match = {
                                    'player_id': db_player['id'],
                                    'player_name': db_player['name'],
                                    'team': db_player['team'],
                                    'sportradar_name': sportradar_name,
                                    'match_score': score,
                                    'external_match': external_match,
                                    'team_match': team_match,
                                    'headshot': headshot
                                }
                                best_score = score
                    
                    if best_match:
                        matches.append(best_match)
                        logger.debug(f"Matched: {best_match['player_name']} → {best_match['sportradar_name']} (score: {best_match['match_score']:.3f})")
                
        finally:
            conn.close()
            
        logger.info(f"Successfully matched {len(matches)} players to headshots")
        return matches
        
    def store_headshots(self, matches):
        """
        Store headshot URLs in database
        """
        conn = self.get_database_connection()
        stored_count = 0
        
        try:
            with conn.cursor() as cursor:
                for match in matches:
                    try:
                        player_id = match['player_id']
                        headshot = match['headshot']
                        
                        # Choose best available image URL
                        headshot_url = None
                        thumbnail_url = None
                        width = None
                        height = None
                        
                        # Priority: large > medium > original > thumbnail
                        if 'large' in headshot['links']:
                            headshot_url = headshot['links']['large']
                            width, height = 1000, 750  # Typical large size
                        elif 'medium' in headshot['links']:
                            headshot_url = headshot['links']['medium']  
                            width, height = 500, 375   # Typical medium size
                        elif 'original' in headshot['links']:
                            headshot_url = headshot['links']['original']
                        elif 'thumbnail' in headshot['links']:
                            headshot_url = headshot['links']['thumbnail']
                            width, height = 250, 188   # Typical thumbnail size
                        
                        # Set thumbnail (always use smallest available)
                        if 'thumbnail' in headshot['links']:
                            thumbnail_url = headshot['links']['thumbnail']
                        
                        if not headshot_url:
                            logger.warning(f"No suitable image URL found for player {match['player_name']}")
                            continue
                            
                        # Construct full URLs
                        full_headshot_url = f"{self.base_url}/ncaaf-images-{self.access_level}3/{self.provider}/headshots/players{headshot_url}"
                        full_thumbnail_url = f"{self.base_url}/ncaaf-images-{self.access_level}3/{self.provider}/headshots/players{thumbnail_url}" if thumbnail_url else None
                        
                        # Check if headshot already exists
                        cursor.execute("""
                            SELECT id FROM player_headshots 
                            WHERE player_id = %s AND source = 'sportradar'
                        """, (player_id,))
                        
                        existing = cursor.fetchone()
                        
                        if existing:
                            # Update existing
                            cursor.execute("""
                                UPDATE player_headshots 
                                SET headshot_url = %s,
                                    thumbnail_url = %s,
                                    image_width = %s,
                                    image_height = %s,
                                    last_updated = %s
                                WHERE player_id = %s AND source = 'sportradar'
                            """, (
                                full_headshot_url,
                                full_thumbnail_url, 
                                width,
                                height,
                                datetime.utcnow(),
                                player_id
                            ))
                            logger.debug(f"Updated headshot for {match['player_name']}")
                        else:
                            # Insert new
                            cursor.execute("""
                                INSERT INTO player_headshots 
                                (id, player_id, headshot_url, thumbnail_url, source, 
                                 image_width, image_height, is_active, last_updated, created_at)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (
                                str(uuid.uuid4()),
                                player_id,
                                full_headshot_url,
                                full_thumbnail_url,
                                'sportradar',
                                width,
                                height,
                                True,
                                datetime.utcnow(),
                                datetime.utcnow()
                            ))
                            logger.debug(f"Inserted headshot for {match['player_name']}")
                        
                        stored_count += 1
                        
                        # Rate limiting
                        time.sleep(0.1)  # Small delay between database operations
                        
                    except Exception as e:
                        logger.error(f"Failed to store headshot for {match['player_name']}: {e}")
                        conn.rollback()  # Rollback this transaction, continue with others
                        continue
                
                # Commit all changes
                conn.commit()
                
        finally:
            conn.close()
            
        logger.info(f"Successfully stored {stored_count} headshots in database")
        return stored_count
        
    def run_headshot_sync(self):
        """
        Main method to run the complete headshot synchronization
        """
        logger.info("Starting Sportradar college football headshots sync...")
        
        try:
            # Validate configuration
            if not self.api_key:
                raise ValueError("SPORTRADAR_COLLEGE_API_KEY environment variable not set")
            if not self.db_url:
                raise ValueError("DATABASE_URL or SUPABASE_DB_URL environment variable not set")
            
            # Step 1: Fetch manifest
            logger.info("Step 1: Fetching headshots manifest...")
            manifest_root = self.fetch_college_headshots_manifest()
            
            # Rate limiting after API call
            time.sleep(self.request_delay)
            
            # Step 2: Parse assets
            logger.info("Step 2: Parsing headshot assets...")
            headshots = self.parse_headshot_assets(manifest_root)
            
            if not headshots:
                logger.warning("No headshots found in manifest")
                return
            
            # Step 3: Match players
            logger.info("Step 3: Matching players to headshots...")
            matches = self.match_players_to_headshots(headshots)
            
            if not matches:
                logger.warning("No player matches found")
                return
                
            # Step 4: Store headshots
            logger.info("Step 4: Storing headshots in database...")
            stored_count = self.store_headshots(matches)
            
            # Final summary
            logger.info(f"""
            ✅ SPORTRADAR HEADSHOTS SYNC COMPLETE
            
            📊 Summary:
            - Headshots in manifest: {len(headshots)}
            - Player matches found: {len(matches)}
            - Headshots stored: {stored_count}
            - Success rate: {(stored_count/len(headshots)*100):.1f}%
            
            🎯 Next steps:
            1. Test image URLs work properly
            2. Monitor for any broken links
            3. Schedule regular updates during football season
            """)
            
        except Exception as e:
            logger.error(f"Headshot sync failed: {e}")
            raise

def main():
    """Main entry point"""
    fetcher = SportradarCollegeHeadshotsFetcher()
    fetcher.run_headshot_sync()

if __name__ == "__main__":
    main()
