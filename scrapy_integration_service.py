#!/usr/bin/env python3
"""
Scrapy Integration Service
Connects the Scrapy web scraping framework with the existing AI system
Provides enhanced data sources for teams.py, props.py, and the chatbot orchestrator
"""

import os
import sys
import json
import logging
import asyncio
import subprocess
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from pathlib import Path

# Add scrapy project to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'parley_scrapy'))

from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ScrapedData:
    source: str
    data_type: str
    content: Dict[str, Any]
    timestamp: datetime
    confidence: float
    sport: str
    teams: List[str]

class ScrapyIntegrationService:
    """Service to integrate Scrapy data with existing AI system"""
    
    def __init__(self):
        self.scrapy_project_path = Path(__file__).parent / 'parley_scrapy'
        self.scraped_data_path = self.scrapy_project_path / 'scraped_data'
        self.db = self._init_database()
        
    def _init_database(self) -> Optional[Client]:
        """Initialize Supabase client for storing enhanced data"""
        try:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            
            if not supabase_url or not supabase_key:
                logger.warning("Supabase credentials not found - running without database")
                return None
                
            return create_client(supabase_url, supabase_key)
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            return None
    
    async def run_scrapy_spiders(self, spiders: List[str] = None) -> Dict[str, Any]:
        """Run Scrapy spiders to collect fresh data"""
        if spiders is None:
            spiders = ['sports_news', 'player_stats', 'team_performance']
        
        logger.info(f"🕷️ Running Scrapy spiders: {spiders}")
        results = {}
        
        for spider in spiders:
            try:
                logger.info(f"🔄 Running spider: {spider}")
                
                # Determine sport and output file
                sport = 'mlb' if spider in ['player_stats', 'team_performance'] else 'general'
                output_dir = self.scraped_data_path / sport
                output_dir.mkdir(parents=True, exist_ok=True)
                
                filename = "news.json" if spider == "sports_news" else f"{spider}.json"
                output_file = output_dir / filename
                
                # Run spider with subprocess
                cmd = [
                    'scrapy', 'crawl', spider,
                    '-O', str(output_file),
                    '-s', 'FEEDS_STORE_EMPTY=False',
                    '-s', 'LOG_LEVEL=INFO'
                ]
                
                # Add sport parameter for specific spiders
                if sport != 'general':
                    cmd.extend(['-a', f'sport={sport}'])
                
                result = subprocess.run(
                    cmd,
                    cwd=self.scrapy_project_path,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )
                
                if result.returncode == 0:
                    logger.info(f"✅ Spider {spider} completed successfully")
                    results[spider] = {
                        'status': 'success',
                        'output': result.stdout,
                        'timestamp': datetime.now().isoformat()
                    }
                else:
                    logger.error(f"❌ Spider {spider} failed: {result.stderr}")
                    results[spider] = {
                        'status': 'failed',
                        'error': result.stderr,
                        'timestamp': datetime.now().isoformat()
                    }
                
                # Small delay between spiders
                await asyncio.sleep(2)
                
            except subprocess.TimeoutExpired:
                logger.error(f"❌ Spider {spider} timed out")
                results[spider] = {
                    'status': 'timeout',
                    'error': 'Spider execution timed out',
                    'timestamp': datetime.now().isoformat()
                }
            except Exception as e:
                logger.error(f"❌ Error running spider {spider}: {e}")
                results[spider] = {
                    'status': 'error',
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                }
        
        return results
    
    def load_scraped_data(self, max_age_hours: int = 24) -> List[ScrapedData]:
        """Load recent scraped data from files"""
        scraped_data = []
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        
        if not self.scraped_data_path.exists():
            logger.warning(f"Scraped data directory not found: {self.scraped_data_path}")
            return scraped_data
        
        # Load data from each sport directory
        for sport_dir in self.scraped_data_path.iterdir():
            if not sport_dir.is_dir():
                continue
                
            sport = sport_dir.name
            logger.info(f"📂 Loading {sport} data from {sport_dir}")
            
            # Load different data types
            for data_type in ['sports_news', 'player_stats', 'team_performance']:
                if data_type == 'sports_news':
                    data_file = sport_dir / "news.json"
                else:
                    data_file = sport_dir / f"{data_type}.json"
                
                if data_file.exists():
                    try:
                        # Check file modification time
                        file_time = datetime.fromtimestamp(data_file.stat().st_mtime)
                        if file_time < cutoff_time:
                            logger.info(f"⏰ Skipping old data file: {data_file}")
                            continue
                        
                        with open(data_file, 'r') as f:
                            data = json.load(f)
                        
                        # Extract teams from data
                        teams = self._extract_teams_from_data(data, data_type)
                        
                        scraped_data.append(ScrapedData(
                            source='scrapy',
                            data_type=data_type,
                            content=data,
                            timestamp=file_time,
                            confidence=0.8,  # Default confidence for scraped data
                            sport=sport,
                            teams=teams
                        ))
                        
                        logger.info(f"✅ Loaded {data_type} data for {sport}: {len(data) if isinstance(data, list) else 1} items")
                        
                    except Exception as e:
                        logger.error(f"❌ Error loading {data_file}: {e}")
        
        logger.info(f"📊 Total scraped data loaded: {len(scraped_data)} datasets")
        return scraped_data
    
    def _extract_teams_from_data(self, data: Any, data_type: str) -> List[str]:
        """Extract team names from scraped data"""
        teams = []
        
        try:
            if data_type == 'news' and isinstance(data, list):
                for item in data:
                    if 'teams' in item:
                        teams.extend(item['teams'])
                    elif 'title' in item:
                        # Extract team names from title/content
                        teams.extend(self._extract_team_names_from_text(item['title']))
            
            elif data_type == 'team_performance' and isinstance(data, list):
                for item in data:
                    if 'team' in item:
                        teams.append(item['team'])
                    elif 'home_team' in item and 'away_team' in item:
                        teams.extend([item['home_team'], item['away_team']])
            
            elif data_type == 'player_stats' and isinstance(data, list):
                for item in data:
                    if 'team' in item:
                        teams.append(item['team'])
        
        except Exception as e:
            logger.warning(f"Error extracting teams from {data_type}: {e}")
        
        return list(set(teams))  # Remove duplicates
    
    def _extract_team_names_from_text(self, text: str) -> List[str]:
        """Extract team names from text using common MLB team names"""
        mlb_teams = [
            'Yankees', 'Red Sox', 'Blue Jays', 'Rays', 'Orioles',
            'Astros', 'Angels', 'Athletics', 'Mariners', 'Rangers',
            'Guardians', 'Twins', 'White Sox', 'Tigers', 'Royals',
            'Braves', 'Marlins', 'Mets', 'Phillies', 'Nationals',
            'Cubs', 'Reds', 'Brewers', 'Pirates', 'Cardinals',
            'Diamondbacks', 'Rockies', 'Dodgers', 'Padres', 'Giants'
        ]
        
        found_teams = []
        text_lower = text.lower()
        
        for team in mlb_teams:
            if team.lower() in text_lower:
                found_teams.append(team)
        
        return found_teams
    
    def get_enhanced_insights_for_ai(self, teams: List[str] = None, data_types: List[str] = None) -> Dict[str, Any]:
        """Get enhanced insights from scraped data for AI agents"""
        scraped_data = self.load_scraped_data()
        
        # Filter by teams if specified
        if teams:
            scraped_data = [
                data for data in scraped_data 
                if any(team in data.teams for team in teams)
            ]
        
        # Filter by data types if specified
        if data_types:
            scraped_data = [
                data for data in scraped_data 
                if data.data_type in data_types
            ]
        
        # Organize data by type
        insights = {
            'news': [],
            'player_stats': [],
            'team_performance': [],
            'summary': {
                'total_sources': len(scraped_data),
                'last_updated': max([data.timestamp for data in scraped_data]) if scraped_data else None,
                'sports_covered': list(set([data.sport for data in scraped_data])),
                'teams_covered': list(set([team for data in scraped_data for team in data.teams]))
            }
        }
        
        for data in scraped_data:
            insights[data.data_type].append({
                'content': data.content,
                'timestamp': data.timestamp.isoformat(),
                'confidence': data.confidence,
                'sport': data.sport,
                'teams': data.teams,
                'source': data.source
            })
        
        return insights
    
    def store_enhanced_data_in_db(self, scraped_data: List[ScrapedData]) -> bool:
        """Store enhanced scraped data in database for AI system access"""
        if not self.db:
            logger.warning("Database not available - skipping storage")
            return False
        
        try:
            stored_count = 0
            
            for data in scraped_data:
                # Store in enhanced_data table (create if doesn't exist)
                enhanced_data = {
                    'source': data.source,
                    'data_type': data.data_type,
                    'content': data.content,
                    'timestamp': data.timestamp.isoformat(),
                    'confidence': data.confidence,
                    'sport': data.sport,
                    'teams': data.teams,
                    'created_at': datetime.now().isoformat()
                }
                
                # Try to insert (table might not exist yet)
                try:
                    self.db.table('enhanced_data').insert(enhanced_data).execute()
                    stored_count += 1
                except Exception as e:
                    if 'relation "enhanced_data" does not exist' in str(e):
                        logger.info("Enhanced data table doesn't exist - data stored in files only")
                        break
                    else:
                        logger.warning(f"Failed to store data item: {e}")
            
            if stored_count > 0:
                logger.info(f"✅ Stored {stored_count} enhanced data items in database")
            
            return stored_count > 0
            
        except Exception as e:
            logger.error(f"❌ Error storing enhanced data: {e}")
            return False
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get current status of the Scrapy integration service"""
        try:
            # Check if scrapy project exists
            scrapy_available = self.scrapy_project_path.exists()
            
            # Check if data directory exists
            data_dir_exists = self.scraped_data_path.exists()
            
            # Check database connection
            db_connected = False
            if self.db:
                try:
                    # Perform a simple query to check the connection
                    self.db.table('enhanced_data').select('id', count='exact').limit(1).execute()
                    db_connected = True
                except Exception as e:
                    if 'relation "enhanced_data" does not exist' in str(e):
                        logger.warning("Database connected, but 'enhanced_data' table not found. Service will use file storage.")
                        db_connected = True # Not a fatal error for the service itself
                    else:
                        logger.warning(f"Database connection check failed: {e}")
                        db_connected = False
            else:
                # If no DB is configured, it's not a "disconnected" state, but a configuration choice.
                logger.info("No database configured for Scrapy service.")
                db_connected = True
            
            # Count available data files
            data_files_count = 0
            if data_dir_exists:
                for sport_dir in self.scraped_data_path.iterdir():
                    if sport_dir.is_dir():
                        for data_type in ['news', 'player_stats', 'team_performance']:
                            data_file = sport_dir / f"{data_type}.json"
                            if data_file.exists():
                                data_files_count += 1
            
            # Get recent data count
            recent_data = self.load_scraped_data(max_age_hours=24)
            
            status = {
                'service_name': 'Scrapy Integration Service',
                'status': 'healthy' if scrapy_available and data_dir_exists else 'degraded',
                'scrapy_project_available': scrapy_available,
                'data_directory_exists': data_dir_exists,
                'database_connected': db_connected,
                'data_files_count': data_files_count,
                'recent_datasets_count': len(recent_data),
                'scrapy_project_path': str(self.scrapy_project_path),
                'data_path': str(self.scraped_data_path),
                'last_check': datetime.now().isoformat()
            }
            
            return status
            
        except Exception as e:
            return {
                'service_name': 'Scrapy Integration Service',
                'status': 'error',
                'error': str(e),
                'last_check': datetime.now().isoformat()
            }
    
    async def refresh_all_data(self) -> Dict[str, Any]:
        """Refresh all scraped data and make it available to AI system"""
        logger.info("🔄 Starting complete data refresh...")
        
        # Step 1: Run scrapy spiders
        spider_results = await self.run_scrapy_spiders()
        
        # Step 2: Load fresh scraped data
        scraped_data = self.load_scraped_data(max_age_hours=1)  # Very recent data
        
        # Step 3: Store in database
        db_stored = self.store_enhanced_data_in_db(scraped_data)
        
        # Step 4: Prepare insights for AI
        ai_insights = self.get_enhanced_insights_for_ai()
        
        refresh_summary = {
            'spider_results': spider_results,
            'scraped_data_count': len(scraped_data),
            'database_stored': db_stored,
            'ai_insights_summary': ai_insights['summary'],
            'refresh_timestamp': datetime.now().isoformat(),
            'success': len(scraped_data) > 0
        }
        
        logger.info(f"✅ Data refresh completed: {refresh_summary['scraped_data_count']} datasets available")
        return refresh_summary

# Singleton instance for easy import
scrapy_service = ScrapyIntegrationService()

async def main():
    """Test the integration service"""
    logger.info("🧪 Testing Scrapy Integration Service")
    
    # Test data refresh
    results = await scrapy_service.refresh_all_data()
    
    print("\n" + "="*80)
    print("SCRAPY INTEGRATION TEST RESULTS")
    print("="*80)
    print(json.dumps(results, indent=2, default=str))
    
    # Test AI insights
    insights = scrapy_service.get_enhanced_insights_for_ai()
    print(f"\n📊 AI Insights Available:")
    print(f"  News items: {len(insights['news'])}")
    print(f"  Player stats: {len(insights['player_stats'])}")
    print(f"  Team performance: {len(insights['team_performance'])}")
    print(f"  Sports covered: {insights['summary']['sports_covered']}")
    print(f"  Teams covered: {len(insights['summary']['teams_covered'])}")

if __name__ == "__main__":
    asyncio.run(main())
