"""
MLB-specific player props agent  
"""
from typing import List
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.base_props_agent import BasePropsAgent
import logging

logger = logging.getLogger(__name__)


class MLBPropsAgent(BasePropsAgent):
    """Specialized agent for MLB player props"""
    
    def get_sport_name(self) -> str:
        return "MLB"
    
    def get_sport_emoji(self) -> str:
        return "⚾"
    
    def get_prop_markets(self) -> List[str]:
        return [
            "Batter Hits O/U",
            "Home Runs O/U",
            "RBIs O/U",
            "Runs Scored O/U",
            "Total Bases O/U",
            "Stolen Bases O/U",
            "Strikeouts O/U (Pitcher)",
            "Earned Runs Allowed O/U",
            "Hits + Runs + RBIs",
            "Singles O/U",
            "Doubles O/U"
        ]
    
    def get_specialized_prompts(self) -> str:
        return """
- **Pitcher Matchups**: Analyze pitcher's ERA, WHIP, K/9, recent form
- **Lefty/Righty Splits**: Critical for batting props - some hitters crush lefties
- **Ballpark Factors**: Coors Field boosts offense, Petco Park suppresses it
- **Weather Conditions**: Wind direction, temperature affect ball flight
- **Day/Night Splits**: Some players hit better in day games
- **Lineup Position**: Batting 3-5 creates more RBI opportunities
- **Recent Form**: Hot/cold streaks very important in baseball
- **Bullpen Usage**: Tired bullpens create hitting opportunities
- **Umpire Tendencies**: Some umps have wider strike zones
- **Travel/Rest**: Cross-country flights affect performance
- **Season Trends**: Players heat up/cool down at different times
- **BvP (Batter vs Pitcher)**: Historical matchup data matters
        """
    
    def get_odds_preferences(self) -> str:
        return """
- **Preferred Range**: -150 to +120 for hits props
- **Home Runs**: +200 to +600 normal (only stars get -odds)
- **RBIs/Runs**: -130 to +150 typical range
- **Total Bases**: Look for value on 1.5 or 2.5 lines
- **Focus on**: Hits, Total Bases, RBIs (most predictable)
- **Avoid**: Stolen bases (too random), Doubles (low frequency)
        """
