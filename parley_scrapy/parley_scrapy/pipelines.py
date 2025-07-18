import json
import os
from datetime import datetime
from pathlib import Path

class ParleyScrapyPipeline:
    """Pipeline for processing and storing scraped data"""
    
    def __init__(self):
        self.data_dir = Path('scraped_data')
        self.data_dir.mkdir(exist_ok=True)
        
    def open_spider(self, spider):
        """Initialize pipeline when spider opens"""
        spider_name = spider.name
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Create sport-specific directories
        sport_dirs = ['nba', 'mlb', 'nfl', 'general']
        for sport in sport_dirs:
            (self.data_dir / sport).mkdir(exist_ok=True)
        
        # Initialize output files
        self.files = {
            'sports_news': open(self.data_dir / f'sports_news_{timestamp}.jsonl', 'w'),
            'player_stats': open(self.data_dir / f'player_stats_{timestamp}.jsonl', 'w'),
            'team_performance': open(self.data_dir / f'team_performance_{timestamp}.jsonl', 'w'),
        }
        
    def close_spider(self, spider):
        """Close all open files when spider closes"""
        for file in self.files.values():
            file.close()
    
    def process_item(self, item, spider):
        """Process each scraped item"""
        category = item.get('category', 'general')
        
        # Add metadata
        processed_item = dict(item)
        processed_item['spider'] = spider.name
        processed_item['processed_at'] = datetime.now().isoformat()
        
        # Write to appropriate file
        if category in self.files:
            self.files[category].write(json.dumps(processed_item) + '\n')
        
        # Also save sport-specific data
        sport = item.get('sport', 'general')
        sport_dir = self.data_dir / sport
        sport_dir.mkdir(exist_ok=True)
        
        filename = f"{category}_{datetime.now().strftime('%Y%m%d')}.jsonl"
        with open(sport_dir / filename, 'a') as f:
            f.write(json.dumps(processed_item) + '\n')
        
        return item

class ValidationPipeline:
    """Pipeline for validating scraped data"""
    
    def process_item(self, item, spider):
        """Validate item data"""
        required_fields = ['category', 'timestamp']
        
        for field in required_fields:
            if field not in item:
                raise DropItem(f"Missing required field: {field}")
        
        # Validate category
        valid_categories = ['sports_news', 'player_stats', 'team_performance']
        if item.get('category') not in valid_categories:
            raise DropItem(f"Invalid category: {item.get('category')}")
        
        # Validate timestamp format
        try:
            datetime.fromisoformat(item['timestamp'])
        except ValueError:
            raise DropItem(f"Invalid timestamp format: {item['timestamp']}")
        
        return item

class DataCleaningPipeline:
    """Pipeline for cleaning and normalizing data"""
    
    def process_item(self, item, spider):
        """Clean and normalize data"""
        cleaned_item = {}
        
        for key, value in item.items():
            if value is None:
                continue
            
            # Clean string values
            if isinstance(value, str):
                value = value.strip()
                if not value or value == '':
                    continue
            
            # Convert numeric strings to floats
            if key in ['points_per_game', 'rebounds_per_game', 'assists_per_game', 
                      'field_goal_pct', 'three_point_pct', 'free_throw_pct',
                      'batting_average', 'on_base_pct', 'slugging_pct', 'ops',
                      'win_pct', 'yards', 'touchdowns', 'home_runs', 'rbis']:
                try:
                    value = float(value)
                except (ValueError, TypeError):
                    pass
            
            # Convert integer strings to integers
            if key in ['wins', 'losses', 'ties', 'games_played', 'runs_scored', 
                      'runs_allowed', 'points_for', 'points_against']:
                try:
                    value = int(value)
                except (ValueError, TypeError):
                    pass
            
            cleaned_item[key] = value
        
        return cleaned_item