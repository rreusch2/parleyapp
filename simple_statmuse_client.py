#!/usr/bin/env python3
"""
Super Simple StatMuse Client
Just uses the working insights approach directly - no MCP complications
"""

import logging
import requests
from bs4 import BeautifulSoup
from typing import Optional
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class StatMuseResponse:
    """Simple response from StatMuse"""
    success: bool
    data: str
    error: Optional[str] = None

class SimpleStatMuseClient:
    """Simple StatMuse client - just like the working insights code"""
    
    def __init__(self):
        # Headers (same as working insights code)
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
    
    def query(self, query: str) -> StatMuseResponse:
        """Query StatMuse - exactly like the working insights code"""
        try:
            logger.info(f"🔍 StatMuse Query: {query}")
            
            # Format the query for URL (same as working insights code)
            formatted_query = query.lower().replace(' ', '-').replace(',', '').replace('?', '')
            url = f"https://www.statmuse.com/mlb/ask/{formatted_query}"
            
            # Simple requests call (same as working insights code)
            response = requests.get(url, headers=self.headers, timeout=15)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for the main answer (same as working insights code)
                main_answer = soup.find('h1') or soup.find('h2')
                if main_answer:
                    answer_text = main_answer.get_text(strip=True)
                    logger.info(f"✅ StatMuse Result: {answer_text[:100]}...")
                    
                    # Format response like MCP would
                    formatted_response = f"**StatMuse Query:** {query}\n\n"
                    formatted_response += f"**Answer:** {answer_text}\n\n"
                    formatted_response += f"**Source:** {url}"
                    
                    return StatMuseResponse(
                        success=True,
                        data=formatted_response
                    )
                else:
                    logger.warning(f"No answer found for: {query}")
                    return StatMuseResponse(
                        success=False,
                        data="",
                        error="No answer found"
                    )
            else:
                logger.warning(f"StatMuse query failed: {response.status_code}")
                return StatMuseResponse(
                    success=False,
                    data="",
                    error=f"HTTP {response.status_code}"
                )
                
        except Exception as e:
            logger.error(f"Error querying StatMuse: {e}")
            return StatMuseResponse(
                success=False,
                data="",
                error=str(e)
            )
    
    def get_head_to_head(self, team1: str, team2: str, games: int = 5) -> StatMuseResponse:
        """Get head-to-head record"""
        query = f"{team1} vs {team2} last {games} meetings"
        return self.query(query)
    
    def get_team_record(self, team: str, record_type: str = "overall") -> StatMuseResponse:
        """Get team record"""
        if record_type == "home":
            query = f"{team} home record 2025"
        elif record_type == "away":
            query = f"{team} road record 2025"
        else:
            query = f"{team} record 2025"
        
        return self.query(query)
    
    def get_player_stats(self, player: str, stat_type: str = "season") -> StatMuseResponse:
        """Get player stats"""
        query = f"{player} {stat_type} stats 2025"
        return self.query(query)

# Simple test function
def test_simple_client():
    """Test the simple client"""
    print("🧪 Testing Simple StatMuse Client...")
    print("=" * 60)
    
    client = SimpleStatMuseClient()
    
    # Test 1: Basic query
    result1 = client.query("Yankees record 2025")
    print(f"✅ Test 1 - Basic Query:")
    print(f"Success: {result1.success}")
    if result1.success:
        print(f"Data: {result1.data}")
    else:
        print(f"Error: {result1.error}")
    print("-" * 60)
    
    # Test 2: Head-to-head
    result2 = client.get_head_to_head("Dodgers", "Padres", 5)
    print(f"✅ Test 2 - Head-to-Head:")
    print(f"Success: {result2.success}")
    if result2.success:
        print(f"Data: {result2.data}")
    else:
        print(f"Error: {result2.error}")
    print("-" * 60)
    
    # Test 3: Player stats
    result3 = client.get_player_stats("Aaron Judge", "hitting")
    print(f"✅ Test 3 - Player Stats:")
    print(f"Success: {result3.success}")
    if result3.success:
        print(f"Data: {result3.data}")
    else:
        print(f"Error: {result3.error}")
    
    print("=" * 60)
    
    if all([result1.success, result2.success, result3.success]):
        print("🎉 ALL TESTS PASSED! Simple StatMuse client is working!")
        print("🎯 Ready for integration into your AI systems!")
    else:
        print("❌ Some tests failed")

if __name__ == "__main__":
    test_simple_client() 