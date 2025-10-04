"""
NFL-specific player props agent
"""
from typing import List
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.base_props_agent import BasePropsAgent
import logging

logger = logging.getLogger(__name__)


class NFLPropsAgent(BasePropsAgent):
    """Specialized agent for NFL player props"""
    
    def get_sport_name(self) -> str:
        return "NFL"
    
    def get_sport_emoji(self) -> str:
        return "🏈"
    
    def get_prop_markets(self) -> List[str]:
        return [
            "Passing Yards O/U",
            "Passing TDs O/U", 
            "Rushing Yards O/U",
            "Receiving Yards O/U",
            "Receptions O/U",
            "Anytime TD Scorer",
            "First TD Scorer",
            "Interceptions O/U",
            "Total TDs O/U",
            "Rush + Rec Yards"
        ]
    
    def get_specialized_prompts(self) -> str:
        return """
- **Defensive Rankings**: Analyze pass defense DVOA, run defense rankings, yards allowed per game
- **Weather Impact**: Wind over 15mph affects passing, rain affects ball security, cold affects kicking
- **Game Script**: Leading teams run more, trailing teams pass more
- **Injury Reports**: Check Wednesday/Thursday practice participation
- **Pace of Play**: Fast-paced teams create more opportunities
- **Home/Road Splits**: Some QBs perform significantly better at home
- **Prime Time Performance**: MNF/SNF/TNF trends matter
- **Division Games**: Often lower scoring, more defensive
- **Red Zone Usage**: Critical for TD props
- **Target Share**: Key for reception and yardage props
- **Defensive Injuries**: Backup CBs can create opportunities
- **Rest Advantage**: Teams off bye vs short week
        """
    
    def get_odds_preferences(self) -> str:
        return """
- **Preferred Range**: -150 to +150 for most props
- **Anytime TD**: +100 to +300 acceptable for value plays  
- **First TD**: +400 to +1200 normal range
- **Alt Lines**: Consider alternate yardage lines for better value
- **Focus on**: Pass/Rush/Rec yards, TDs, Receptions
- **Avoid**: Kicking props, defensive props (too volatile)
        """
