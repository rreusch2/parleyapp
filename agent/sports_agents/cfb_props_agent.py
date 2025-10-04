"""
College Football-specific player props agent
"""
from typing import List
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.base_props_agent import BasePropsAgent
import logging

logger = logging.getLogger(__name__)


class CFBPropsAgent(BasePropsAgent):
    """Specialized agent for College Football player props"""
    
    def get_sport_name(self) -> str:
        return "CFB"
    
    def get_sport_emoji(self) -> str:
        return "🏈"
    
    def get_prop_markets(self) -> List[str]:
        return [
            "Passing Yards O/U",
            "Passing TDs O/U",
            "Rushing Yards O/U",
            "Receiving Yards O/U",
            "Anytime TD Scorer",
            "First TD Scorer",
            "Receptions O/U",
            "Completions O/U",
            "Total TDs O/U",
            "Longest Reception O/U"
        ]
    
    def get_specialized_prompts(self) -> str:
        return """
- **Conference Matchups**: Big 12 high-scoring, SEC defensive, Pac-12 balanced
- **Pace of Play**: Up-tempo offenses create 80+ plays per game
- **Rivalry Games**: Often unpredictable, emotions run high
- **Talent Gaps**: Mismatches create blowout potential (affects game script)
- **System Fits**: Air Raid QBs rack up yards, Triple Option limits passing
- **Weather (Outdoor)**: November games in Midwest can be brutal
- **Motivation Factors**: Bowl eligibility, conference title implications
- **Travel Distance**: West Coast to East Coast trips matter
- **Quarterback Mobility**: Dual-threat QBs add rushing upside
- **Defensive Scheme**: 3-3-5 vs 4-3 affects run/pass success
- **True Freshman**: High variance, boom or bust performances
- **Coaching Tendencies**: Some coaches love to run up scores
        """
    
    def get_odds_preferences(self) -> str:
        return """
- **Preferred Range**: -140 to +200 for yardage props
- **Anytime TD**: -200 to +400 depending on player role
- **First TD**: +500 to +1500 common range
- **QB Props**: Focus on passing yards, TDs (most volume)
- **Focus on**: Star players, high-tempo offenses
- **Avoid**: Defensive players, kickers, backup RBs
        """
