"""
Supabase Betting Database Tool for OpenManus
Provides access to ParleyApp's sports betting database for dynamic analysis
"""
import os
import json
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timedelta, date, timezone
from supabase import create_client, Client
from pydantic import PrivateAttr
from dotenv import load_dotenv

from app.tool.base import BaseTool, ToolResult
from app.logger import logger

# Load environment variables
load_dotenv("backend/.env")


class SupabaseBettingTool(BaseTool):
    """Tool for accessing ParleyApp's Supabase database for sports betting data"""
    
    name: str = "supabase_betting"
    description: str = """Access ParleyApp's sports betting database to get games, odds, player props, and store predictions.
    
    Key capabilities:
    - Get upcoming games with odds for any date and sport
    - Fetch team betting odds (moneyline, spread, totals)  
    - Get player prop bets and lines
    - Store AI predictions in the correct database format
    - Query recent predictions for analysis
    """
    
    parameters: dict = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "get_upcoming_games", 
                    "get_team_odds", 
                    "get_player_props",
                    "get_player_props_by_date",
                    "store_predictions",
                    "get_recent_predictions",
                    "get_games_by_sport"
                ],
                "description": "Database action to perform"
            },
            "date": {
                "type": "string",
                "pattern": r"^\d{4}-\d{2}-\d{2}$",
                "description": "Date in YYYY-MM-DD format (optional, defaults to today)"
            },
            "sport_filter": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": ["Major League Baseball", "National Football League", "Women's National Basketball Association", "College Football", "Ultimate Fighting Championship"]
                },
                "description": "Filter by specific sports using full database names"
            },
            "game_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Specific game IDs for odds/props lookup"
            },
            "predictions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "match_teams": {"type": "string"},
                        "pick": {"type": "string"},
                        "odds": {"type": "string"},
                        "confidence": {"type": "integer"},
                        "sport": {"type": "string"},
                        "bet_type": {"type": "string"},
                        "prop_market_type": {"type": "string"},
                        "event_time": {"type": "string"},
                        "reasoning": {"type": "string"},
                        "value_percentage": {"type": "number"},
                        "roi_estimate": {"type": "number"},
                        "metadata": {"type": "object"}
                    },
                    "required": ["match_teams", "pick", "odds", "confidence", "sport"]
                },
                "description": "Array of prediction objects to store in ai_predictions table"
            },
            "limit": {
                "type": "integer",
                "minimum": 1,
                "maximum": 100,
                "default": 20,
                "description": "Limit number of results returned"
            },
            "exclude_past": {
                "type": "boolean",
                "default": True,
                "description": "Exclude games that have already started (start_time < now)"
            }
        },
        "required": ["action"]
    }

    # runtime-only attribute for the Supabase client
    _supabase: Client = PrivateAttr()
    _forced_date: Optional[date] = PrivateAttr(default=None)

    def __init__(self):
        super().__init__()

        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")

        self._supabase = create_client(supabase_url, supabase_key)
        logger.info("SupabaseBettingTool initialized successfully")

    def set_forced_date(self, date_str: Optional[str]) -> None:
        """Optionally force a specific target date (YYYY-MM-DD). None clears the override."""
        if not date_str:
            self._forced_date = None
            return
        try:
            self._forced_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            logger.info(f"SupabaseBettingTool forced_date set to {self._forced_date}")
        except ValueError:
            logger.warning(f"Invalid forced date provided: {date_str}. Ignoring.")
            self._forced_date = None

    async def execute(self, **kwargs) -> ToolResult:
        """Execute the database action"""
        action = kwargs.get("action")
        
        logger.info(f"Executing Supabase action: {action}")
        
        try:
            if action == "get_upcoming_games":
                return await self._get_upcoming_games(kwargs)
            elif action == "get_team_odds":
                return await self._get_team_odds(kwargs)
            elif action == "get_player_props":
                return await self._get_player_props(kwargs)
            elif action == "get_player_props_by_date":
                return await self._get_player_props_by_date(kwargs)
            elif action == "get_all_props_for_date":
                return await self._get_all_props_for_date(kwargs)
            elif action == "store_predictions":
                return await self._store_predictions(kwargs)
            elif action == "get_recent_predictions":
                return await self._get_recent_predictions(kwargs)
            elif action == "get_games_by_sport":
                return await self._get_games_by_sport(kwargs)
            else:
                return self.fail_response(f"Unknown action: {action}")
                
        except Exception as e:
            logger.error(f"Database error in action {action}: {str(e)}")
            return self.fail_response(f"Database error: {str(e)}")

    async def _get_upcoming_games(self, params: Dict) -> ToolResult:
        """Get upcoming games for a specific date"""
        
        # Determine target date with safety: prefer forced date; otherwise
        # use provided date when near today; else use today.
        provided_date_str = params.get("date")
        today_local = datetime.now().date()
        target_date: date
        if self._forced_date:
            target_date = self._forced_date
        elif provided_date_str:
            try:
                parsed = datetime.strptime(provided_date_str, "%Y-%m-%d").date()
                # If provided date is far from today (>3 days), ignore and use today
                if abs((parsed - today_local).days) > 3:
                    logger.warning(
                        f"Provided date {parsed} far from today; using today {today_local} instead"
                    )
                    target_date = today_local
                else:
                    target_date = parsed
            except ValueError:
                return self.fail_response("Invalid date format. Use YYYY-MM-DD")
        else:
            target_date = today_local
        
        sport_filter = params.get("sport_filter", [])
        limit = params.get("limit", 20)
        exclude_past = params.get("exclude_past", True)
        
        try:
            # Calculate local midnight window for the target date and convert to UTC
            local_tz = datetime.now().astimezone().tzinfo
            start_local = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=local_tz)
            end_local = start_local + timedelta(days=1)
            start_utc = start_local.astimezone(timezone.utc)
            end_utc = end_local.astimezone(timezone.utc)
            start_iso = start_utc.isoformat()
            end_iso = end_utc.isoformat()
            
            # Build base query
            base_select = "id, home_team, away_team, start_time, sport, league, metadata, status"
            query = self._supabase.table("sports_events").select(base_select).gte("start_time", start_iso).lt("start_time", end_iso).order("start_time")

            games = []
            # Try filtering by sport first
            if sport_filter:
                logger.info(f"Applying sport filter on sport column: {sport_filter}")
                response = query.in_("sport", sport_filter).limit(limit).execute()
                games = response.data or []

                # If no results, try filtering on league column
                if not games:
                    logger.info(f"No results with sport filter; trying league filter: {sport_filter}")
                    query_league = self._supabase.table("sports_events").select(base_select).gte("start_time", start_iso).lt("start_time", end_iso).order("start_time")
                    response2 = query_league.in_("league", sport_filter).limit(limit).execute()
                    games2 = response2.data or []
                    # Merge unique by id
                    merged = {g["id"]: g for g in games + games2}
                    games = list(merged.values())

                # If still no results, fallback to no sport filter
                if not games:
                    logger.info("Still no results after league filter; falling back to no sport filter")
                    query_nofilter = self._supabase.table("sports_events").select(base_select).gte("start_time", start_iso).lt("start_time", end_iso).order("start_time")
                    response3 = query_nofilter.limit(limit).execute()
                    games = response3.data or []
            else:
                response = query.limit(limit).execute()
                games = response.data or []
            
            # Optionally exclude games that already started (compare to now UTC)
            if exclude_past:
                now_utc = datetime.utcnow().replace(tzinfo=timezone.utc)
                filtered = []
                for g in games:
                    try:
                        gdt = datetime.fromisoformat(g["start_time"].replace("Z", "+00:00"))
                        if gdt >= now_utc:
                            filtered.append(g)
                    except Exception:
                        # keep if parse fails
                        filtered.append(g)
                games = filtered

            # Extract sports available
            sports_available = list({game.get("sport") for game in games})
            
            result = {
                "query_date": target_date.isoformat(),
                "games_found": len(games),
                "sports_available": sports_available,
                "games": games
            }
            
            logger.info(f"Found {len(games)} games for {target_date} (local window {start_local.isoformat()} to {end_local.isoformat()}, UTC {start_iso} to {end_iso})")
            return self.success_response(result)
            
        except Exception as e:
            return self.fail_response(f"Error fetching games: {str(e)}")

    async def _get_team_odds(self, params: Dict) -> ToolResult:
        """Get team betting odds for specific games"""
        
        game_ids = params.get("game_ids", [])
        if not game_ids:
            return self.fail_response("game_ids parameter is required for get_team_odds action")
        
        try:
            # Get games with their metadata (contains odds)
            response = self._supabase.table("sports_events").select(
                "id, home_team, away_team, sport, start_time, metadata"
            ).in_("id", game_ids).execute()
            
            games_with_odds = []
            
            for game in response.data:
                if not game.get("metadata") or not isinstance(game["metadata"], dict):
                    continue
                
                metadata = game["metadata"]
                full_data = metadata.get("full_data", {})
                bookmakers_data = full_data.get("bookmakers", [])
                
                if not bookmakers_data:
                    continue
                
                # Extract available bet types and odds
                game_odds = {
                    "game_id": game["id"],
                    "home_team": game["home_team"],
                    "away_team": game["away_team"], 
                    "sport": game["sport"],
                    "start_time": game["start_time"],
                    "available_bets": []
                }
                
                # Process each bookmaker
                for bookmaker in bookmakers_data:
                    bookmaker_key = bookmaker.get("key", "unknown")
                    markets = bookmaker.get("markets", [])
                    
                    for market in markets:
                        market_key = market.get("key")
                        outcomes = market.get("outcomes", [])
                        
                        if market_key == "h2h":  # Moneyline
                            for outcome in outcomes:
                                team_name = outcome.get("name")
                                price = outcome.get("price")
                                if team_name and price is not None:
                                    game_odds["available_bets"].append({
                                        "bet_type": "moneyline",
                                        "team": team_name,
                                        "odds": price,
                                        "bookmaker": bookmaker_key
                                    })
                        
                        elif market_key == "spreads":  # Point spread
                            for outcome in outcomes:
                                team_name = outcome.get("name")
                                point = outcome.get("point")
                                price = outcome.get("price")
                                if team_name and point is not None and price is not None:
                                    game_odds["available_bets"].append({
                                        "bet_type": "spread",
                                        "team": team_name,
                                        "line": point,
                                        "odds": price,
                                        "bookmaker": bookmaker_key
                                    })
                        
                        elif market_key == "totals":  # Over/Under
                            for outcome in outcomes:
                                bet_type = outcome.get("name", "").lower()
                                point = outcome.get("point")
                                price = outcome.get("price")
                                if bet_type and point is not None and price is not None:
                                    game_odds["available_bets"].append({
                                        "bet_type": "total",
                                        "selection": bet_type,
                                        "line": point,
                                        "odds": price,
                                        "bookmaker": bookmaker_key
                                    })
                
                if game_odds["available_bets"]:
                    games_with_odds.append(game_odds)
            
            result = {
                "games_requested": len(game_ids),
                "games_with_odds": len(games_with_odds),
                "total_bets_available": sum(len(game["available_bets"]) for game in games_with_odds),
                "odds_data": games_with_odds
            }
            
            logger.info(f"Retrieved odds for {len(games_with_odds)} games with {result['total_bets_available']} total bets")
            return self.success_response(result)
            
        except Exception as e:
            return self.fail_response(f"Error fetching team odds: {str(e)}")

    async def _get_player_props(self, params: Dict) -> ToolResult:
        """Get player prop bets for specific games"""
        
        game_ids = params.get("game_ids", [])
        if not game_ids:
            return self.fail_response("game_ids parameter is required for get_player_props action")
        
        limit = params.get("limit", 50)
        
        try:
            # Query player props with joins including event details
            response = self._supabase.table("player_props_odds").select(
                "id, line, over_odds, under_odds, event_id, "
                "players(name, player_name, team), "
                "player_prop_types(prop_name), "
                "sports_events!inner(home_team, away_team, sport, start_time)"
            ).in_("event_id", game_ids).limit(limit).execute()
            
            props = []
            for row in response.data:
                if row.get("players") and row.get("player_prop_types") and row.get("sports_events"):
                    # Use full name if available, fallback to player_name
                    player_name = row["players"].get("name") or row["players"].get("player_name")
                    if not player_name:
                        continue
                    
                    event = row["sports_events"]
                    prop_data = {
                        "prop_id": row.get("id"),
                        "event_id": row["event_id"],
                        "player_name": player_name,
                        "team": row["players"].get("team", "Unknown"),
                        "prop_type": row["player_prop_types"]["prop_name"],
                        "line": float(row["line"]) if row["line"] else None,
                        "over_odds": int(float(row["over_odds"])) if row["over_odds"] else None,
                        "under_odds": int(float(row["under_odds"])) if row["under_odds"] else None,
                        "bookmaker": "Unknown",
                        # Add event details for proper formatting
                        "home_team": event.get("home_team"),
                        "away_team": event.get("away_team"),
                        "sport": event.get("sport"),
                        "event_time": event.get("start_time")
                    }
                    props.append(prop_data)
            
            # Group props by sport for analysis
            props_by_sport = {}
            for prop in props:
                sport = prop.get("sport", "Unknown")
                if sport not in props_by_sport:
                    props_by_sport[sport] = []
                props_by_sport[sport].append(prop)
            
            result = {
                "games_requested": len(game_ids),
                "total_props_found": len(props),
                "props_by_sport": {sport: len(sport_props) for sport, sport_props in props_by_sport.items()},
                "player_props": props
            }
            
            logger.info(f"Retrieved {len(props)} player props across {len(props_by_sport)} sports")
            return self.success_response(result)
            
        except Exception as e:
            return self.fail_response(f"Error fetching player props: {str(e)}")

    async def _get_player_props_by_date(self, params: Dict) -> ToolResult:
        """Get player props directly by date (queries player_props_odds table)"""
        
        # Determine target date
        date_str = params.get("date")
        target_date = None
        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return self.fail_response(f"Invalid date format: {date_str}. Expected YYYY-MM-DD")
        elif self._forced_date:
            target_date = self._forced_date
        else:
            target_date = date.today()
        
        limit = params.get("limit", 100)
        
        try:
            # Query player props updated recently (within last 24 hours of target date)
            # Since player_props_odds.last_update is when the prop was last updated,
            # we look for props updated on or after the target date
            target_datetime_start = datetime.combine(target_date, datetime.min.time())
            start_iso = target_datetime_start.isoformat() + "Z"
            
            logger.info(f"Querying player props with last_update >= {start_iso}")
            
            # Query player props with joins
            response = self._supabase.table("player_props_odds").select(
                """
                id, line, over_odds, under_odds, event_id, last_update,
                players!inner(name, player_name, team),
                player_prop_types!inner(prop_name),
                bookmakers(bookmaker_name)
                """
            ).gte("last_update", start_iso).order("last_update", desc=True).limit(limit).execute()
            
            props = []
            for row in response.data:
                if row.get("players") and row.get("player_prop_types"):
                    # Use full name if available, fallback to player_name
                    player_name = row["players"].get("name") or row["players"].get("player_name")
                    if not player_name:
                        continue
                    
                    prop_data = {
                        "prop_id": row["id"],
                        "event_id": row["event_id"],
                        "player_name": player_name,
                        "team": row["players"].get("team", "Unknown"),
                        "prop_type": row["player_prop_types"]["prop_name"],
                        "line": float(row["line"]) if row["line"] else None,
                        "over_odds": int(float(row["over_odds"])) if row["over_odds"] else None,
                        "under_odds": int(float(row["under_odds"])) if row["under_odds"] else None,
                        "bookmaker": row["bookmakers"]["bookmaker_name"] if row.get("bookmakers") else "FanDuel",
                        "last_update": row.get("last_update")
                    }
                    props.append(prop_data)
            
            # Group props by sport and prop type for analysis
            props_by_sport = {}
            props_by_type = {}
            for prop in props:
                # Infer sport from team
                sport = self._infer_sport_from_team(prop["team"])
                if sport not in props_by_sport:
                    props_by_sport[sport] = []
                props_by_sport[sport].append(prop)
                
                prop_type = prop["prop_type"]
                if prop_type not in props_by_type:
                    props_by_type[prop_type] = 0
                props_by_type[prop_type] += 1
            
            result = {
                "query_date": target_date.isoformat(),
                "total_props_found": len(props),
                "props_by_sport": {sport: len(sport_props) for sport, sport_props in props_by_sport.items()},
                "props_by_type": props_by_type,
                "player_props": props
            }
            
            logger.info(f"Retrieved {len(props)} player props for {target_date} across {len(props_by_sport)} sports")
            return self.success_response(result)
            
        except Exception as e:
            logger.error(f"Error fetching player props by date: {str(e)}")
            return self.fail_response(f"Error fetching player props by date: {str(e)}")

    async def _get_all_props_for_date(self, params: Dict) -> ToolResult:
        """Get ALL player props for a date by automatically fetching games first, then props"""
        
        date_str = params.get("date")
        limit = params.get("limit", 500)
        
        try:
            # Step 1: Get all games for the date
            games_result = await self._get_upcoming_games({"date": date_str, "limit": 100, "exclude_past": False})
            if games_result.error:
                return games_result
            
            # Parse games response
            import json
            games_data = json.loads(games_result.output) if isinstance(games_result.output, str) else games_result.output
            games = games_data.get("games", [])
            
            if not games:
                return self.success_response({
                    "query_date": date_str,
                    "games_found": 0,
                    "total_props_found": 0,
                    "player_props": [],
                    "message": "No games found for this date"
                })
            
            # Step 2: Extract ALL game IDs
            game_ids = [g["id"] for g in games]
            logger.info(f"Fetching props for {len(game_ids)} games on {date_str}")
            
            # Step 3: Get all props for those games
            props_result = await self._get_player_props({"game_ids": game_ids, "limit": limit})
            if props_result.error:
                return props_result
            
            # Parse props response and add date context
            props_data = json.loads(props_result.output) if isinstance(props_result.output, str) else props_result.output
            props_data["query_date"] = date_str
            props_data["games_found"] = len(games)
            
            logger.info(f"Successfully fetched {props_data.get('total_props_found', 0)} props for {date_str}")
            return self.success_response(props_data)
            
        except Exception as e:
            logger.error(f"Error in get_all_props_for_date: {str(e)}")
            return self.fail_response(f"Error fetching all props for date: {str(e)}")

    async def _store_predictions(self, params: Dict) -> ToolResult:
        """Store AI predictions in the database"""
        
        predictions = params.get("predictions", [])
        if not predictions:
            return self.fail_response("predictions parameter is required and must be a non-empty array")
        
        # Validation: Check for sport/team mismatches
        for pred in predictions:
            sport = pred.get("sport", "")
            teams = pred.get("match_teams", "")
            
            # CFB validation
            if sport == "CFB" and any(mlb in teams.lower() for mlb in ["brewers", "cubs", "yankees", "dodgers", "mariners", "tigers", "phillies"]):
                return self.fail_response(f"Sport/team mismatch: CFB player cannot have MLB teams ({teams}). Use the actual CFB teams from the prop data!")
            
            # MLB validation  
            if sport == "MLB" and any(cfb in teams.lower() for cfb in ["eagles", "panthers", "wolfpack", "fighting", "college"]):
                return self.fail_response(f"Sport/team mismatch: MLB player cannot have CFB teams ({teams}). Use the actual MLB teams from the prop data!")
            
            # Name validation
            pick = pred.get("pick", "")
            if ". " in pick[:5]:  # Abbreviated name like "J. Smith"
                return self.fail_response(f"Use full player names from props data, not abbreviations: {pick}")
        
        stored_predictions = []
        errors = []
        
        try:
            for i, pred in enumerate(predictions):
                try:
                    # Brand-safety scrubber: never mention Linemate in user-visible text
                    def _scrub_brand(val):
                        if isinstance(val, str):
                            txt = val
                            for bad in ["linemate.io", "linemate", "Linemate.io", "Linemate"]:
                                txt = txt.replace(bad, "trend data")
                            return txt
                        return val

                    # Validate required fields
                    required_fields = ["match_teams", "pick", "odds", "confidence", "sport"]
                    missing_fields = [field for field in required_fields if field not in pred]
                    if missing_fields:
                        errors.append(f"Prediction {i+1}: Missing required fields: {missing_fields}")
                        continue
                    
                    # Normalize and derive values
                    # Accept confidence as 0-1.0 or 0-100
                    raw_conf = pred.get("confidence", 70)
                    try:
                        conf_float = float(raw_conf)
                    except Exception:
                        conf_float = 70.0
                    if 0.0 <= conf_float <= 1.0:
                        conf_float *= 100.0
                    confidence = max(0, min(100, int(round(conf_float))))
                    # Fallback event_time if not provided (8 hours from now)
                    event_time = pred.get("event_time")
                    if not event_time:
                        event_time = (datetime.utcnow() + timedelta(hours=8)).isoformat() + "Z"
                    
                    # Scrub reasoning and any brand mentions
                    reasoning = _scrub_brand(pred.get("reasoning", "AI-generated prediction"))
                    pick_text = _scrub_brand(pred.get("pick", ""))
                    match_teams = _scrub_brand(pred.get("match_teams", ""))

                    # Scrub research_sources if present in metadata
                    metadata = pred.get("metadata", {}) or {}
                    if isinstance(metadata, dict) and "research_sources" in metadata and isinstance(metadata["research_sources"], list):
                        metadata["research_sources"] = [
                            ("trend data" if isinstance(s, str) and "linemate" in s.lower() else s)
                            for s in metadata["research_sources"]
                        ]

                    # Prepare prediction data for database
                    prediction_data = {
                        "user_id": "c19a5e12-4297-4b0f-8d21-39d2bb1a2c08",  # AI user ID
                        "match_teams": match_teams,
                        "pick": pick_text,
                        "odds": str(pred.get("odds", 0)),
                        "confidence": confidence,
                        "sport": pred.get("sport", ""),
                        "event_time": event_time,
                        "reasoning": reasoning,
                        "bet_type": pred.get("bet_type", "moneyline"),
                        "game_id": str(pred.get("game_id", "")),
                        "status": "pending",
                        # Optional columns that exist in ai_predictions
                        "metadata": metadata,
                        "value_percentage": pred.get("value_percentage"),
                        "roi_estimate": pred.get("roi_estimate"),
                        "line_value": pred.get("line_value"),
                        "prop_market_type": pred.get("prop_market_type"),
                        # Advanced analytics (store directly if provided)
                        "implied_probability": pred.get("implied_probability"),
                        "expected_value": pred.get("expected_value"),
                        "kelly_stake": pred.get("kelly_stake"),
                        "risk_level": pred.get("risk_level"),
                        "fair_odds": pred.get("fair_odds"),
                        # Parlay support
                        "is_parlay_leg": pred.get("is_parlay_leg"),
                        "parlay_id": pred.get("parlay_id"),
                    }

                    # Move extra analytical fields into metadata to avoid unknown columns
                    extra_meta = {}
                    for k in [
                        "key_factors",
                    ]:
                        if pred.get(k) is not None:
                            extra_meta[k] = pred.get(k)

                    if extra_meta:
                        # merge with existing metadata
                        base_meta = prediction_data.get("metadata") or {}
                        if isinstance(base_meta, dict):
                            base_meta.update(extra_meta)
                            prediction_data["metadata"] = base_meta
                        else:
                            prediction_data["metadata"] = extra_meta

                    
                    # Remove None values
                    prediction_data = {k: v for k, v in prediction_data.items() if v is not None}
                    
                    # Insert into database
                    result = self._supabase.table("ai_predictions").insert(prediction_data).execute()
                    
                    if result.data:
                        stored_predictions.append(result.data[0])
                        logger.info(f"Stored prediction: {pred.get('pick', 'Unknown')} (ID: {result.data[0]['id']})")
                    
                except Exception as e:
                    errors.append(f"Prediction {i+1}: {str(e)}")
                    continue
            
            result = {
                "total_submitted": len(predictions),
                "successfully_stored": len(stored_predictions),
                "errors": len(errors),
                "error_details": errors if errors else None,
                "stored_prediction_ids": [p["id"] for p in stored_predictions]
            }
            
            if len(stored_predictions) == len(predictions):
                logger.info(f"Successfully stored all {len(predictions)} predictions")
                return self.success_response(result)
            elif stored_predictions:
                logger.warning(f"Stored {len(stored_predictions)}/{len(predictions)} predictions with {len(errors)} errors")
                return self.success_response(result)
            else:
                return self.fail_response(f"Failed to store any predictions. Errors: {errors}")
                
        except Exception as e:
            return self.fail_response(f"Error storing predictions: {str(e)}")

    async def _get_recent_predictions(self, params: Dict) -> ToolResult:
        """Get recent AI predictions for analysis"""
        
        limit = params.get("limit", 10)
        
        try:
            response = self._supabase.table("ai_predictions").select(
                "id, match_teams, pick, odds, confidence, sport, reasoning, bet_type, status, created_at, metadata"
            ).eq("user_id", "c19a5e12-4297-4b0f-8d21-39d2bb1a2c08").order("created_at", desc=True).limit(limit).execute()
            
            predictions = response.data
            
            # Group by sport for summary
            by_sport = {}
            for pred in predictions:
                sport = pred.get("sport", "Unknown")
                if sport not in by_sport:
                    by_sport[sport] = []
                by_sport[sport].append(pred)
            
            result = {
                "total_recent_predictions": len(predictions),
                "predictions_by_sport": {sport: len(preds) for sport, preds in by_sport.items()},
                "predictions": predictions
            }
            
            logger.info(f"Retrieved {len(predictions)} recent predictions")
            return self.success_response(result)
            
        except Exception as e:
            return self.fail_response(f"Error fetching recent predictions: {str(e)}")

    async def _get_games_by_sport(self, params: Dict) -> ToolResult:
        """Get games filtered by specific sport"""
        
        sport_filter = params.get("sport_filter", [])
        if not sport_filter:
            return self.fail_response("sport_filter parameter is required for get_games_by_sport action")
        
        date_str = params.get("date")
        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return self.fail_response("Invalid date format. Use YYYY-MM-DD")
        else:
            target_date = datetime.now().date()

        limit = params.get("limit", 20)
        exclude_past = params.get("exclude_past", True)

        try:
            # Calculate local-day window and convert to UTC
            local_tz = datetime.now().astimezone().tzinfo
            start_local = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=local_tz)
            end_local = start_local + timedelta(days=1)
            start_iso = start_local.astimezone(timezone.utc).isoformat()
            end_iso = end_local.astimezone(timezone.utc).isoformat()

            # Query with sport or league fallback
            base_select = "id, home_team, away_team, start_time, sport, league, status"
            query = self._supabase.table("sports_events").select(base_select).gte("start_time", start_iso).lt("start_time", end_iso).order("start_time")
            games = []
            resp = query.in_("sport", sport_filter).limit(limit).execute()
            games = resp.data or []
            if not games:
                resp2 = self._supabase.table("sports_events").select(base_select).gte("start_time", start_iso).lt("start_time", end_iso).in_("league", sport_filter).order("start_time").limit(limit).execute()
                games2 = resp2.data or []
                merged = {g["id"]: g for g in games + games2}
                games = list(merged.values())

            # Optionally exclude past games
            if exclude_past:
                now_utc = datetime.utcnow().replace(tzinfo=timezone.utc)
                filtered = []
                for g in games:
                    try:
                        gdt = datetime.fromisoformat(g["start_time"].replace("Z", "+00:00"))
                        if gdt >= now_utc:
                            filtered.append(g)
                    except Exception:
                        filtered.append(g)
                games = filtered
            
            result = {
                "date": target_date.isoformat(),
                "sports_requested": sport_filter,
                "games_found": len(games),
                "games": games
            }
            
            logger.info(f"Found {len(games)} games for sports {sport_filter} on {target_date} (local window {start_local.isoformat()} to {end_local.isoformat()})")
            return self.success_response(result)
            
        except Exception as e:
            return self.fail_response(f"Error fetching games by sport: {str(e)}")

    def _infer_sport_from_team(self, team_name: str) -> str:
        """Infer sport from team name patterns"""
        team_lower = team_name.lower() if team_name else ""
        
        # MLB team patterns
        mlb_teams = ["yankees", "dodgers", "giants", "mets", "red sox", "phillies", "braves", "cubs", "cardinals"]
        if any(mlb_team in team_lower for mlb_team in mlb_teams):
            return "MLB"
        
        # WNBA team patterns  
        wnba_teams = ["liberty", "wings", "storm", "aces", "mystics", "sun", "fever", "sky", "dream", "lynx", "mercury", "sparks"]
        if any(wnba_team in team_lower for wnba_team in wnba_teams):
            return "WNBA"
        
        # NFL team patterns
        nfl_teams = ["ravens", "lions", "chiefs", "bills", "patriots", "steelers", "cowboys"]
        if any(nfl_team in team_lower for nfl_team in nfl_teams):
            return "NFL"
        
        return "Unknown"
