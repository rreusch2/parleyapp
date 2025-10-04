"""
WNBA-specific player props agent
"""
from typing import List
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.base_props_agent import BasePropsAgent
import logging

logger = logging.getLogger(__name__)


class WNBAPropsAgent(BasePropsAgent):
    """Specialized agent for WNBA player props"""
    
    def get_sport_name(self) -> str:
        return "WNBA"
    
    def get_sport_emoji(self) -> str:
        return "🏀"
    
    def get_prop_markets(self) -> List[str]:
        return [
            "Points O/U",
            "Rebounds O/U",
            "Assists O/U",
            "3-Pointers Made O/U",
            "Steals O/U",
            "Blocks O/U",
            "Points + Rebounds + Assists",
            "Double-Double",
            "Points + Rebounds",
            "Points + Assists"
        ]
    
    def get_specialized_prompts(self) -> str:
        return """
- **Pace Factors**: Fast-paced teams create more scoring opportunities
- **Rest Days**: Back-to-backs rare but impactful, 2+ days rest helps
- **Home/Road Splits**: Travel affects WNBA teams more (commercial flights)
- **Matchup Specific**: Post players vs weak interior D, guards vs poor perimeter D
- **Usage Rate**: With smaller rosters, star usage often 30%+
- **Defensive Ratings**: Team defensive efficiency crucial for unders
- **Three-Point Variance**: High variance in 3PM, prefer O/U 2.5 or lower
- **Injury Impact**: Thin rosters mean injuries create huge opportunities
- **Playoff Positioning**: Late season motivation varies greatly
- **International Players**: Olympic years affect rest/performance
- **Rookie Progression**: Rookies improve dramatically through season
- **Commissioner's Cup**: Mid-season tournament affects effort levels
        """
    
    def get_odds_preferences(self) -> str:
        return """
- **Preferred Range**: -130 to +130 for points props
- **Rebounds/Assists**: -150 to +150 acceptable
- **3-Pointers**: Focus on O/U 1.5 or 2.5 (better value)
- **PRA (Points+Reb+Ast)**: Popular combo prop, good value
- **Focus on**: Points, rebounds (most consistent)
- **Avoid**: Steals/blocks (too volatile), double-doubles (rare)
        """
