"""
Base class for all sport-specific player props agents
"""
import os
import sys
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agent.manus import Manus
from app.llm import LLM
from app.tool.statmuse_betting import StatMuseBettingTool
from app.tool.supabase_betting import SupabaseBettingTool

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)s | %(name)s:%(funcName)s:%(lineno)d - %(message)s')
logger = logging.getLogger(__name__)


class BasePropsAgent(ABC):
    """Base class for sport-specific player props agents"""
    
    def __init__(self, target_date: Optional[str] = None):
        """Initialize base agent with common tools"""
        self.target_date = target_date or datetime.now().date().isoformat()
        self.agent = None
        self.statmuse_tool = StatMuseBettingTool()
        self.supabase_tool = SupabaseBettingTool()
        self.sport_name = self.get_sport_name()
        self.initialized = False
        
    @abstractmethod
    def get_sport_name(self) -> str:
        """Return the sport name (NFL, MLB, CFB, WNBA)"""
        pass
    
    @abstractmethod
    def get_sport_emoji(self) -> str:
        """Return the sport emoji"""
        pass
    
    @abstractmethod
    def get_prop_markets(self) -> List[str]:
        """Return the main prop markets for this sport"""
        pass
    
    @abstractmethod
    def get_specialized_prompts(self) -> str:
        """Return sport-specific analysis instructions"""
        pass
    
    @abstractmethod
    def get_odds_preferences(self) -> str:
        """Return sport-specific odds preferences"""
        pass
    
    async def initialize(self):
        """Initialize the agent with tools"""
        if self.initialized:
            return
            
        logger.info(f"{self.get_sport_emoji()} Initializing {self.sport_name} Props Agent for {self.target_date}")
        
        # Create LLM
        llm = LLM()
        
        # Create agent
        self.agent = Manus(llm=llm, name=f"{self.sport_name}_Props_Specialist")
        
        # Add tools
        self.agent.available_tools.add_tools(
            self.statmuse_tool,
            self.supabase_tool
        )
        
        self.initialized = True
        logger.info(f"✅ {self.sport_name} Agent initialized with {len(self.agent.available_tools.tools)} tools")
    
    async def generate_picks(self, num_picks: int = 5) -> Dict[str, Any]:
        """Generate sport-specific player prop picks"""
        
        if not self.initialized:
            await self.initialize()
            
        logger.info(f"{self.get_sport_emoji()} {self.sport_name} Agent generating {num_picks} picks for {self.target_date}")
        
        # Build mission prompt
        mission_prompt = self._build_mission_prompt(num_picks)
        
        # Run agent
        await self.agent.run(mission_prompt)
        
        # Extract results
        results = await self._extract_results()
        
        return results
    
    def _build_mission_prompt(self, num_picks: int) -> str:
        """Build sport-specific mission prompt"""
        
        return f"""
You are an **elite {self.sport_name} player props specialist** generating {num_picks} HIGH-QUALITY predictions for {self.target_date}.

## YOUR SPORT EXPERTISE: {self.sport_name}
{self.get_specialized_prompts()}

## KEY PROP MARKETS TO FOCUS ON:
{', '.join(self.get_prop_markets())}

## ODDS PREFERENCES FOR {self.sport_name}:
{self.get_odds_preferences()}

## YOUR TOOLS:

1. **supabase_betting**: 
   - Action: "get_all_props_for_date" - Get ALL {self.sport_name} props for {self.target_date}
   - Action: "store_predictions" - Store your final picks

2. **statmuse_query**: Query {self.sport_name} statistics
   - ALWAYS specify sport: "{self.sport_name}"
   - Get specific stats for players and matchups

3. **browser_use**: Navigate to trend sites
   - Extract {self.sport_name}-specific trend data
   - Use scroll_down to load more content

4. **web_search**: Get current {self.sport_name} news
   - Injuries, weather (outdoor sports), lineups

## WORKFLOW:

1. **Discovery Phase**: 
   - Use `get_all_props_for_date` to get {self.sport_name} props
   - Filter to ONLY {self.sport_name} props (sport field = "{self.sport_name}")

2. **Research Phase**:
   - Use browser for {self.sport_name} trends
   - Query StatMuse for player stats
   - Search for {self.sport_name}-specific factors

3. **Analysis Phase**:
   - Apply {self.sport_name} expertise
   - Identify best value plays
   - Focus on your specialized knowledge

4. **Store Predictions**:
   - Generate exactly {num_picks} {self.sport_name} picks
   - Include detailed, {self.sport_name}-specific reasoning
   - Store with proper formatting

## REASONING REQUIREMENTS:
Every pick MUST have INTELLIGENT {self.sport_name}-specific analysis:
- Exact statistics relevant to {self.sport_name}
- Trend percentages from data
- Matchup analysis using {self.sport_name} terminology
- Context specific to {self.sport_name} (weather, venue, rest, etc.)
- NEVER use generic phrases like "trend data supports"

## SUCCESS CRITERIA:
✅ EXACTLY {num_picks} {self.sport_name} picks
✅ Each pick has sport-specific expert analysis
✅ Odds align with {self.sport_name} preferences
✅ All picks stored successfully

BEGIN YOUR {self.sport_name} SPECIALIST MISSION NOW!
"""
    
    async def _extract_results(self) -> Dict[str, Any]:
        """Extract results from agent's execution"""
        try:
            result = await self.supabase_tool.execute(
                action="get_recent_predictions",
                limit=20
            )
            
            # Parse result - check for error first
            if result.error:
                logger.error(f"Failed to get predictions: {result.error}")
                return {
                    'success': False,
                    'predictions_stored': 0,
                    'sport': self.sport_name,
                    'error': result.error
                }
            
            # Parse successful output
            import json
            data = json.loads(result.output) if isinstance(result.output, str) else result.output
            stored_count = len(data.get('predictions', []))
            
            return {
                'success': stored_count > 0,
                'predictions_stored': stored_count,
                'sport': self.sport_name,
                'data': data
            }
        except Exception as e:
            logger.error(f"Failed to extract results: {e}")
            return {
                'success': False,
                'predictions_stored': 0,
                'sport': self.sport_name,
                'error': str(e)
            }
