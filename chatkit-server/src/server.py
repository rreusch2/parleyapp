"""
ChatKit Advanced Server Implementation for ParleyApp
Professor Lock with full widget support and visual search indicators
"""

import os
import asyncio
from typing import Any, AsyncIterator, Optional, Dict, List
from datetime import datetime
from collections.abc import AsyncGenerator
import json
import httpx
from dotenv import load_dotenv

from agents import Agent, Runner, Message, ResponseInputTextParam, function_tool, RunContextWrapper
from chatkit.server import ChatKitServer
from chatkit.agents import AgentContext, stream_agent_response, simple_to_agent_input, accumulate_text
from chatkit.widgets import (
    Card, Text, Title, Button, Row, Col, Box, Markdown,
    ListView, ListViewItem, Badge, Icon, Divider, Spacer,
    ProgressUpdateEvent, Chart, Series
)
from chatkit.actions import ActionConfig, Action
from chatkit.types import (
    ThreadMetadata, UserMessageItem, ThreadStreamEvent,
    WidgetItem, HiddenContextItem, ClientToolCall,
    AssistantMessageContent, Annotation, URLSource
)
from chatkit.store import Store
from chatkit.errors import StreamError

from .widgets.search_widget import create_search_widget, update_search_progress
from .widgets.analysis_widget import create_analysis_widget
from .widgets.parlay_widget import create_parlay_widget
from .tools.web_search import WebSearchTool
from .tools.sports_data import SportsDataTool
from .tools.betting_analysis import BettingAnalysisTool

load_dotenv()

class ProfessorLockServer(ChatKitServer):
    """Advanced ChatKit server for Professor Lock betting assistant"""
    
    def __init__(self, data_store: Store, attachment_store=None):
        super().__init__(data_store, attachment_store)
        self.web_search = WebSearchTool()
        self.sports_data = SportsDataTool()
        self.betting_analysis = BettingAnalysisTool()
    
    # Main Professor Lock Agent with personality
    professor_lock_agent = Agent[AgentContext](
        model="gpt-4o",  # Using GPT-4o for best performance
        name="Professor Lock",
        instructions="""You are Professor Lock, the sharpest AI sports betting analyst in the game.

PERSONALITY:
- Confident, sharp, and witty with gambling slang
- Professional yet entertaining
- Data-driven with brutal honesty
- Always hunting for value and edges

EXPERTISE:
- MLB, WNBA, UFC, NFL, CFB sports analysis
- Player props, spreads, totals, moneylines
- Parlay construction and bankroll management
- Real-time odds analysis and line movement

COMMUNICATION STYLE:
- Keep responses 2-3 sentences max unless analyzing
- Bold all picks, odds, and key numbers
- Use emojis strategically 🎯 💰 🔥 ⚡
- Address users as "champ", "sharp", "ace"
- End with specific action items

When analyzing:
1. Show live search progress with visual widgets
2. Display odds comparisons in tables
3. Build interactive parlay cards
4. Stream analysis updates in real-time
""",
        tools=[],  # We'll add tools below
        parallel_tool_calls=True,
    )
    
    @function_tool(description="Search the web for sports news, injuries, weather, and betting insights")
    async def web_search_with_widget(
        self, 
        ctx: RunContextWrapper[AgentContext], 
        query: str,
        search_type: str = "general"  # general, injury, weather, news
    ) -> str:
        """Web search with live progress widget"""
        
        # Create initial search widget
        search_widget = create_search_widget(query, search_type)
        widget_item = await ctx.context.stream_widget(search_widget)
        
        # Stream progress updates
        await ctx.context.stream(
            ProgressUpdateEvent(
                text=f"🔍 Searching: {query}",
                icon="search"
            )
        )
        
        # Perform actual search
        results = []
        async for update in self.web_search.search_with_progress(query):
            if update["type"] == "snippet":
                # Update widget with new snippet
                updated_widget = update_search_progress(
                    search_widget, 
                    update["snippet"],
                    update["source"]
                )
                await ctx.context.update_widget(widget_item.id, updated_widget)
                results.append(update["snippet"])
            
            elif update["type"] == "complete":
                # Final update with all results
                await ctx.context.stream(
                    ProgressUpdateEvent(
                        text=f"✅ Found {len(results)} results",
                        icon="check"
                    )
                )
        
        return "\n".join(results)
    
    @function_tool(description="Get live sports data, odds, and player props")
    async def get_sports_data_with_visualization(
        self,
        ctx: RunContextWrapper[AgentContext],
        sport: str,
        data_type: str  # "games", "odds", "props", "trends"
    ) -> str:
        """Fetch sports data with visual representation"""
        
        # Create analysis widget
        analysis_widget = create_analysis_widget(sport, data_type)
        await ctx.context.stream_widget(analysis_widget)
        
        # Stream data fetching progress
        await ctx.context.stream(
            ProgressUpdateEvent(
                text=f"📊 Loading {sport} {data_type}...",
                icon="chart"
            )
        )
        
        # Get data from your existing backend
        data = await self.sports_data.fetch_data(sport, data_type)
        
        # Create visualization based on data type
        if data_type == "odds":
            odds_widget = self._create_odds_comparison_widget(data)
            await ctx.context.stream_widget(odds_widget)
        
        elif data_type == "trends":
            trends_chart = self._create_trends_chart(data)
            await ctx.context.stream_widget(trends_chart)
        
        return json.dumps(data, indent=2)
    
    @function_tool(description="Build and analyze parlays with interactive cards")
    async def build_parlay_with_card(
        self,
        ctx: RunContextWrapper[AgentContext],
        picks: List[Dict[str, Any]],
        risk_amount: float = 100
    ) -> str:
        """Create interactive parlay card"""
        
        parlay_widget = create_parlay_widget(picks, risk_amount)
        await ctx.context.stream_widget(parlay_widget)
        
        # Calculate parlay odds and payout
        total_odds = 1
        for pick in picks:
            total_odds *= (pick.get("decimal_odds", 2.0))
        
        potential_payout = risk_amount * total_odds
        
        # Add summary card
        summary = Card(
            size="md",
            children=[
                Title(value="🎯 Parlay Summary", size="lg"),
                Divider(),
                Row(children=[
                    Col(children=[
                        Text(value="Total Legs:", weight="bold"),
                        Text(value=str(len(picks)))
                    ]),
                    Col(children=[
                        Text(value="Combined Odds:", weight="bold"),
                        Text(value=f"+{int((total_odds - 1) * 100)}")
                    ]),
                ]),
                Row(children=[
                    Col(children=[
                        Text(value="Risk:", weight="bold"),
                        Text(value=f"${risk_amount}")
                    ]),
                    Col(children=[
                        Text(value="To Win:", weight="bold", color="green"),
                        Text(value=f"${potential_payout:.2f}")
                    ]),
                ]),
                Spacer(minSize="16px"),
                Button(
                    label="Lock It In 🔒",
                    style="primary",
                    onClickAction=ActionConfig(
                        type="submit_parlay",
                        payload={"picks": picks, "amount": risk_amount}
                    )
                )
            ]
        )
        await ctx.context.stream_widget(summary)
        
        return f"Parlay built: {len(picks)} legs, +{int((total_odds - 1) * 100)} odds, ${potential_payout:.2f} potential payout"
    
    # Add tools to agent
    professor_lock_agent.tools = [
        web_search_with_widget,
        get_sports_data_with_visualization,
        build_parlay_with_card
    ]
    
    def _create_odds_comparison_widget(self, odds_data: Dict) -> Card:
        """Create visual odds comparison table"""
        rows = []
        for game in odds_data.get("games", []):
            rows.append(
                ListViewItem(children=[
                    Row(gap="12px", children=[
                        Text(value=game["teams"], weight="bold"),
                        Badge(label=f"{game['spread']}", color="info"),
                        Badge(label=f"O/U {game['total']}", color="secondary"),
                        Text(value=f"ML: {game['moneyline']}", color="gray")
                    ])
                ])
            )
        
        return Card(
            size="lg",
            children=[
                Title(value="📊 Live Odds Board", size="md"),
                ListView(children=rows)
            ]
        )
    
    def _create_trends_chart(self, trends_data: Dict) -> Card:
        """Create trends visualization chart"""
        # Convert trends to chart data
        chart_data = []
        series = []
        
        for trend in trends_data.get("trends", []):
            chart_data.append({
                "date": trend["date"],
                "value": trend["hit_rate"],
                "line": trend["prop_line"]
            })
        
        return Card(
            size="full",
            children=[
                Title(value="📈 Performance Trends", size="md"),
                Chart(
                    data=chart_data,
                    series=[
                        Series(key="value", name="Hit Rate", color="green"),
                        Series(key="line", name="Prop Line", color="blue", type="line")
                    ],
                    xAxis="date",
                    showYAxis=True,
                    showLegend=True,
                    height="300px"
                )
            ]
        )
    
    async def respond(
        self,
        thread: ThreadMetadata,
        input_user_message: UserMessageItem | None,
        context: Any
    ) -> AsyncIterator[ThreadStreamEvent]:
        """Main response handler with streaming widgets"""
        
        # Convert input to agent format
        agent_context = AgentContext(
            thread=thread,
            store=self.store,
            request_context=context
        )
        
        # Run the agent
        result = Runner.run_streamed(
            self.professor_lock_agent,
            await simple_to_agent_input(input_user_message) if input_user_message else [],
            context=agent_context
        )
        
        # Stream the response with widgets
        async for event in stream_agent_response(agent_context, result):
            yield event
    
    async def action(
        self,
        thread: ThreadMetadata,
        action: Action[str, Any],
        sender: WidgetItem | None,
        context: Any
    ) -> AsyncIterator[ThreadStreamEvent]:
        """Handle widget actions"""
        
        if action.type == "submit_parlay":
            # Handle parlay submission
            picks = action.payload.get("picks", [])
            amount = action.payload.get("amount", 100)
            
            # Create confirmation widget
            confirmation = Card(
                size="sm",
                status={"text": "✅ Parlay Submitted", "icon": "check"},
                children=[
                    Text(value=f"Your {len(picks)}-leg parlay has been locked in!"),
                    Text(value=f"Good luck, champ! 🎯", weight="bold")
                ]
            )
            
            # Stream the widget
            async for event in self.stream_widget(thread, confirmation, context):
                yield event
            
            # Add to thread context
            hidden = HiddenContextItem(
                id=self.store.generate_item_id("message", thread, context),
                thread_id=thread.id,
                created_at=datetime.now(),
                content=[f"User submitted parlay: {picks}"]
            )
            await self.store.add_thread_item(thread.id, hidden, context)
        
        elif action.type == "refresh_odds":
            # Handle odds refresh
            await self.stream(
                ProgressUpdateEvent(text="🔄 Refreshing odds...", icon="refresh")
            )
            # Trigger new analysis
            async for event in self.respond(thread, None, context):
                yield event
