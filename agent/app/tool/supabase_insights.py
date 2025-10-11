import os
from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional

from pydantic import PrivateAttr
import importlib

from app.tool.base import BaseTool, ToolResult


class SupabaseInsightsTool(BaseTool):
    """Tool to fetch games and store daily Professor Lock insights in Supabase."""

    name: str = "supabase_insights"
    description: str = (
        "Fetch games for a date, list sports, read ai_predictions, and store"
        " daily insights/greeting in the daily_professor_insights table."
    )

    parameters: dict = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "get_games_for_date",
                    "list_sports_for_date",
                    "get_ai_predictions_for_date",
                    "clear_daily_insights_for_date",
                    "store_greeting",
                    "store_insights",
                    "get_recent_insights",
                ],
                "description": "Action to perform",
            },
            "date": {
                "type": "string",
                "pattern": r"^\d{4}-\d{2}-\d{2}$",
                "description": "Target date (YYYY-MM-DD)",
            },
            "greeting": {"type": "string", "description": "Greeting text"},
            "insights": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "category": {"type": "string"},
                        "confidence": {"type": "integer"},
                        "impact": {"type": "string"},
                        "insight_order": {"type": "integer"},
                        "research_sources": {"type": "array", "items": {"type": "string"}},
                        "game_info": {"type": "string"},
                        "teams": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["title", "description", "category", "insight_order"],
                },
                "description": "Array of insights to store (orders should start at 2)",
            },
            "limit": {"type": "integer", "default": 50},
            "full_clear": {"type": "boolean", "default": False},
        },
        "required": ["action"],
    }

    _supabase: Any = PrivateAttr(default=None)

    def __init__(self, **data):  # type: ignore[no-untyped-def]
        super().__init__(**data)
        url = os.getenv("SUPABASE_URL", "")
        # Prefer service role key if available for writes, fall back to anon
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
        create_client = None
        if url and key:
            try:
                supa_mod = importlib.import_module("supabase")
                create_client = getattr(supa_mod, "create_client", None)
            except Exception:
                create_client = None

        if not url or not key or create_client is None:
            self._supabase = None
        else:
            self._supabase = create_client(url, key)

    async def execute(self, **kwargs: Any) -> ToolResult:
        action: str = kwargs.get("action")
        date_str: Optional[str] = kwargs.get("date")
        greeting: Optional[str] = kwargs.get("greeting")
        insights: Optional[List[Dict[str, Any]]] = kwargs.get("insights")
        limit: int = int(kwargs.get("limit", 50))
        full_clear: bool = bool(kwargs.get("full_clear", False))
        if self._supabase is None:
            return self.fail_response("Supabase client not initialized. Check SUPABASE env vars.")

        try:
            if action == "get_games_for_date":
                if not date_str:
                    return self.fail_response("'date' is required for get_games_for_date")
                games = self._get_games_for_date(date_str, limit)
                return self.success_response({"date": date_str, "games": games})

            if action == "list_sports_for_date":
                if not date_str:
                    return self.fail_response("'date' is required for list_sports_for_date")
                games = self._get_games_for_date(date_str, 500)
                counts: Dict[str, int] = {}
                for g in games:
                    s = g.get("sport") or "Unknown"
                    counts[s] = counts.get(s, 0) + 1
                return self.success_response({"date": date_str, "sports": counts})

            if action == "get_ai_predictions_for_date":
                if not date_str:
                    return self.fail_response("'date' is required for get_ai_predictions_for_date")
                preds = self._get_ai_predictions_for_date(date_str, limit)
                return self.success_response({"date": date_str, "predictions": preds})

            if action == "clear_daily_insights_for_date":
                if not date_str:
                    return self.fail_response("'date' is required for clear_daily_insights_for_date")
                deleted = self._clear_daily_insights_for_date(date_str, full_clear)
                return self.success_response({"date": date_str, "deleted": deleted})

            if action == "store_greeting":
                if not date_str or not greeting:
                    return self.fail_response("'date' and 'greeting' are required for store_greeting")
                rec = self._store_greeting(date_str, greeting)
                return self.success_response({"stored": rec})

            if action == "store_insights":
                if not date_str or not insights:
                    return self.fail_response("'date' and 'insights' are required for store_insights")
                stored = self._store_insights(date_str, insights)
                return self.success_response({"stored": stored})

            if action == "get_recent_insights":
                data = (
                    self._supabase.table("daily_professor_insights")
                    .select("id, title, category, insight_order, date_generated, created_at")
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                return self.success_response({"recent": data.data or []})

            return self.fail_response(f"Unknown action: {action}")

        except Exception as e:  # pragma: no cover
            return self.fail_response(f"SupabaseInsightsTool error: {e}")

    # ----- helpers -----
    def _date_window(self, day_str: str) -> tuple[str, str]:
        day = datetime.strptime(day_str, "%Y-%m-%d").date()
        start_dt = datetime.combine(day, time(0, 0, tzinfo=timezone.utc))
        end_dt = start_dt + timedelta(days=1)
        return start_dt.isoformat(), end_dt.isoformat()

    def _get_games_for_date(self, day_str: str, limit: int) -> List[Dict[str, Any]]:
        start_iso, end_iso = self._date_window(day_str)
        q = (
            self._supabase.table("sports_events")
            .select("id, home_team, away_team, start_time, sport, league, sport_key, metadata, status")
            .gte("start_time", start_iso)
            .lt("start_time", end_iso)
            .eq("status", "scheduled")
            .order("start_time")
            .limit(limit)
            .execute()
        )
        return q.data or []

    def _get_ai_predictions_for_date(self, day_str: str, limit: int) -> List[Dict[str, Any]]:
        # Try event_time first, fall back to created_at window
        start_iso, end_iso = self._date_window(day_str)
        try:
            q = (
                self._supabase.table("ai_predictions")
                .select("id, match_teams, pick, odds, sport, bet_type, event_time, created_at")
                .gte("event_time", start_iso)
                .lt("event_time", end_iso)
                .order("event_time")
                .limit(limit)
                .execute()
            )
            data = q.data or []
            if data:
                return data
        except Exception:
            pass
        q2 = (
            self._supabase.table("ai_predictions")
            .select("id, match_teams, pick, odds, sport, bet_type, event_time, created_at")
            .gte("created_at", start_iso)
            .lt("created_at", end_iso)
            .order("created_at")
            .limit(limit)
            .execute()
        )
        return q2.data or []

    def _clear_daily_insights_for_date(self, day_str: str, full_clear: bool) -> int:
        if full_clear:
            resp = self._supabase.table("daily_professor_insights").delete().gte("insight_order", 0).execute()
            return len(resp.data or [])
        resp = (
            self._supabase.table("daily_professor_insights")
            .delete()
            .eq("date_generated", day_str)
            .execute()
        )
        return len(resp.data or [])

    def _store_greeting(self, day_str: str, greeting: str) -> Dict[str, Any]:
        record = {
            "insight_text": greeting,
            "title": "Professor Lock",
            "description": greeting,
            "category": "intro",
            "confidence": 100,
            "impact": "high",
            "insight_order": 1,
            "date_generated": day_str,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._supabase.table("daily_professor_insights").insert(record).execute()
        return record

    def _store_insights(self, day_str: str, insights: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        stored: List[Dict[str, Any]] = []
        for ins in insights:
            record = {
                "insight_text": ins.get("description", ""),
                "title": ins.get("title", ""),
                "description": ins.get("description", ""),
                "category": (ins.get("category") or "research").lower(),
                "confidence": ins.get("confidence", 75),
                "impact": ins.get("impact", "medium"),
                "insight_order": max(2, int(ins.get("insight_order", 2))),
                "date_generated": day_str,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "research_sources": ins.get("research_sources", []),
                "game_info": ins.get("game_info"),
                "teams": ins.get("teams", []),
            }
            self._supabase.table("daily_professor_insights").insert(record).execute()
            stored.append(record)
        return stored


