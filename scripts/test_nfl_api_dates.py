#!/usr/bin/env python3

import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class NFLDateTester:
    def __init__(self):
        self.api_key = os.getenv('SPORTSDATA_API_KEY', '62fa3caa1fcd47eb99a2b737973a46be')
        self.base_url = "https://api.sportsdata.io/v3/nfl"
        
    def make_api_request(self, endpoint: str):
        """Make API request to SportsData.io"""
        url = f"{self.base_url}/{endpoint}"
        headers = {
            'Ocp-Apim-Subscription-Key': self.api_key
        }
        
        try:
            print(f"🔍 Testing API endpoint: {url}")
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ API Error: {e}")
            return None

    def test_player_game_logs(self, player_id: int = 4314, season: str = "2024", games: int = 3):
        """Test what data is returned for Joe Burrow's game logs"""
        print(f"🏈 Testing game logs for player ID {player_id} (Joe Burrow)")
        
        endpoint = f"stats/json/PlayerGameStatsBySeason/{season}/{player_id}/{games}"
        data = self.make_api_request(endpoint)
        
        if not data:
            return
            
        print(f"✅ Retrieved {len(data)} games")
        
        # Analyze first game data structure
        if data:
            first_game = data[0]
            print(f"\n📊 Sample game data structure:")
            print(f"Keys available: {list(first_game.keys())}")
            
            # Look for date fields
            date_fields = [key for key in first_game.keys() if 'date' in key.lower() or 'Date' in key]
            print(f"\n📅 Date-related fields: {date_fields}")
            
            for field in date_fields:
                print(f"  {field}: {first_game.get(field)}")
                
            # Check common fields
            important_fields = ['Date', 'DateTime', 'GameDate', 'Week', 'Season', 'SeasonType', 'Opponent', 'HomeOrAway']
            print(f"\n🔍 Important fields:")
            for field in important_fields:
                if field in first_game:
                    print(f"  {field}: {first_game[field]}")
            
            # Show full first game for analysis
            print(f"\n📋 Full first game data:")
            print(json.dumps(first_game, indent=2))

if __name__ == "__main__":
    tester = NFLDateTester()
    tester.test_player_game_logs()
