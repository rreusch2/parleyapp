import json
from datetime import datetime, date as _date
from typing import Any, Dict, List, Optional

from app.agent.manus import Manus
from app.logger import logger
from app.tool.tool_collection import ToolCollection
from app.tool.web_search import WebSearch
from app.tool.browser_use_tool import BrowserUseTool
from app.tool.statmuse_betting import StatMuseBettingTool
from app.llm import LLM
from app.tool.base import ToolResult

# Local tool to interact with daily insights storage and sports events
from app.tool.supabase_insights import SupabaseInsightsTool


class DailyInsightsAgent(Manus):
    """Autonomous agent to research and publish daily cross-sport insights."""

    name: str = "DailyInsightsAgent"
    description: str = "Autonomous research agent for Professor Lock daily insights"

    # Enrich toolset for research and storage
    available_tools: ToolCollection = ToolCollection(
        SupabaseInsightsTool(),
        WebSearch(),
        BrowserUseTool(),
        StatMuseBettingTool(),
    )

    def __init__(self, **data):  # type: ignore[no-untyped-def]
        super().__init__(**data)
        self.llm = LLM()

    async def generate(self, target_date: Optional[str] = None) -> Dict[str, Any]:
        """Main entry: orchestrates research and storage for a given date."""
        day_str = target_date or _date.today().isoformat()
        logger.info(f"🧠 Daily insights generation for {day_str}")

        # Step 0: fetch games and sport distribution
        games = await self._get_games_for_date(day_str)
        if not games:
            return {"success": False, "error": "No games found"}

        sports_breakdown = await self._list_sports_for_date(day_str)
        predictions = await self._get_ai_predictions_for_date(day_str)

        # Step 1: propose distribution ONLY for active sports
        distribution = await self._propose_distribution(sports_breakdown, games)
        distribution = self._clamp_distribution_to_active(distribution, sports_breakdown, total=12)
        plan_text = await self._create_research_plan_text(distribution, games)

        # Step 2: execute research (StatMuse + web)
        statmuse_data = await self._derive_and_run_statmuse(plan_text)
        insights_text = await self._execute_web_research(plan_text, statmuse_data, predictions)

        # Step 3: parse and enhance insights
        raw_insights = self._parse_numbered_insights(insights_text, max_items=12)
        # Filter out insights that mention sports not active today
        allowed_sports = set(sports_breakdown.keys())
        raw_insights = [s for s in raw_insights if self._mentions_only_allowed_sports(s, allowed_sports)]
        if not raw_insights:
            return {"success": False, "error": "No insights parsed"}
        enhanced = await self._enhance_insights(raw_insights)
        if not enhanced:
            # fallback basic enhancement
            enhanced = self._fallback_enhancement(raw_insights)

        # Step 4: generate greeting AFTER research
        greeting = await self._generate_greeting(enhanced, sports_breakdown)

        # Step 5: store (clear that date, single greeting at order=1, insights 2..)
        await self._clear_date(day_str)
        await self._store_greeting(day_str, greeting)
        await self._store_insights(day_str, enhanced)

        logger.info(f"✅ Stored {len(enhanced)} insights + greeting for {day_str}")
        return {"success": True, "count": len(enhanced) + 1}

    # ---------- Supabase actions via tool ----------
    async def _tool(self, name: str, tool_input: Dict[str, Any]) -> ToolResult:
        return await self.available_tools.execute(name=name, tool_input=tool_input)

    async def _get_games_for_date(self, day_str: str) -> List[Dict[str, Any]]:
        rst = await self._tool("supabase_insights", {"action": "get_games_for_date", "date": day_str, "limit": 200})
        try:
            data = json.loads(str(rst))
            return data.get("games", [])
        except (ValueError, TypeError):
            return []

    async def _list_sports_for_date(self, day_str: str) -> Dict[str, int]:
        rst = await self._tool("supabase_insights", {"action": "list_sports_for_date", "date": day_str})
        try:
            data = json.loads(str(rst))
            return data.get("sports", {})
        except (ValueError, TypeError):
            return {}

    async def _get_ai_predictions_for_date(self, day_str: str) -> List[Dict[str, Any]]:
        rst = await self._tool("supabase_insights", {"action": "get_ai_predictions_for_date", "date": day_str, "limit": 100})
        try:
            data = json.loads(str(rst))
            return data.get("predictions", [])
        except (ValueError, TypeError):
            return []

    async def _clear_date(self, day_str: str) -> None:
        await self._tool("supabase_insights", {"action": "clear_daily_insights_for_date", "date": day_str, "full_clear": False})

    async def _store_greeting(self, day_str: str, greeting: str) -> None:
        await self._tool("supabase_insights", {"action": "store_greeting", "date": day_str, "greeting": greeting})

    async def _store_insights(self, day_str: str, enhanced: List[Dict[str, Any]]) -> None:
        # apply proper orders from 2..
        data: List[Dict[str, Any]] = []
        for idx, ins in enumerate(enhanced, start=2):
            rec = {
                "title": ins.get("title", ""),
                "description": ins.get("description", ""),
                "category": ins.get("category", "research"),
                "confidence": ins.get("confidence", 75),
                "impact": ins.get("impact", "medium"),
                "insight_order": idx,
                "research_sources": ins.get("research_sources", []),
                "game_info": ins.get("game_info"),
                "teams": ins.get("teams", []),
            }
            data.append(rec)
        await self._tool("supabase_insights", {"action": "store_insights", "date": day_str, "insights": data})

    # ---------- LLM prompts ----------
    async def _propose_distribution(self, sports_breakdown: Dict[str, int], _games: List[Dict[str, Any]]) -> Dict[str, int]:
        lines = [f"- {k}: {v} games" for k, v in sorted(sports_breakdown.items(), key=lambda x: -x[1])]
        prompt = (
            "Given the sports breakdown below, return ONLY a JSON object mapping sport short names to counts "
            "for EXACTLY 12 insights. Prioritize sports with more games today and information value; ensure variety.\n\n"
            f"SPORTS BREAKDOWN:\n{chr(10).join(lines)}\n\nJSON only:"
        )
        txt = await self.llm.ask([{"role": "user", "content": prompt}], stream=False)
        try:
            dist = json.loads(txt)
            return dist if isinstance(dist, dict) else {}
        except (ValueError, TypeError):
            # fallback evenly split
            total = 12
            keys = list(sports_breakdown.keys()) or ["Research"]
            base = total // len(keys)
            extra = total % len(keys)
            res = {k: base for k in keys}
            for i in range(extra):
                res[keys[i]] += 1
            return res

    def _clamp_distribution_to_active(self, dist: Dict[str, int], active: Dict[str, int], total: int = 12) -> Dict[str, int]:
        # Remove non-active sports and reallocate counts
        filtered = {k: v for k, v in (dist or {}).items() if k in active and active[k] > 0}
        if not filtered:
            # Even split among active
            keys = list(active.keys())
            if not keys:
                return {}
            base = total // len(keys)
            extra = total % len(keys)
            out = {k: base for k in keys}
            for i in range(extra):
                out[keys[i]] += 1
            return out
        # Normalize to total
        s = sum(max(0, int(v)) for v in filtered.values()) or 1
        out = {k: max(0, int(round(v * total / s))) for k, v in filtered.items()}
        # Fix rounding drift
        diff = total - sum(out.values())
        if diff != 0:
            for k in sorted(out, key=lambda x: -active.get(x, 0)):
                if diff == 0:
                    break
                out[k] += 1 if diff > 0 else -1
                diff += -1 if diff > 0 else 1
        return out

    async def _create_research_plan_text(self, distribution: Dict[str, int], games: List[Dict[str, Any]]) -> str:
        # show first 10 games with time
        def one(g: Dict[str, Any]) -> str:
            t = g.get("start_time", "")
            try:
                dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
                tm = dt.strftime("%I:%M %p ET")
            except (ValueError, TypeError):
                tm = t
            return f"- {g.get('away_team')} @ {g.get('home_team')} ({g.get('sport')}) {tm}"

        games_list = "\n".join(one(g) for g in games[:10])
        prompt = (
            "Propose a targeted cross-sport research plan to produce 12 insights.\n"
            f"Distribution: {json.dumps(distribution)}\n"
            "Games (sample):\n"
            f"{games_list}\n\n"
            "For each sport bucket, list 2-3 concrete research angles and exact web/stat queries."
        )
        return await self.llm.ask([{"role": "user", "content": prompt}], stream=False)

    async def _derive_and_run_statmuse(self, plan_text: str, max_q: int = 4) -> str:
        derive = (
            f"From the plan below, output a pure JSON array of up to {max_q} StatMuse-style queries (strings):\n\n{plan_text}\n\nJSON only:"
        )
        txt = await self.llm.ask([{"role": "user", "content": derive}], stream=False)
        queries: List[str] = []
        try:
            queries = json.loads(txt)
            if not isinstance(queries, list):
                queries = []
        except (ValueError, TypeError):
            queries = []

        results: List[str] = []
        for q in queries[:max_q]:
            if not isinstance(q, str) or len(q) < 4:
                continue
            sport = self._guess_sport_from_query(q)
            rst = await self._tool("statmuse_query", {"query": q, "sport": sport})
            results.append(f"Q: {q}\nA: {str(rst)}")
        return "\n\n".join(results) if results else "(no StatMuse data)"

    def _guess_sport_from_query(self, q: str) -> str:
        s = q.lower()
        # naive heuristics
        if any(k in s for k in ["batting", "home run", "pitch", "bullpen"]):
            return "MLB"
        if any(k in s for k in ["goals", "power play", "penalty kill", "goalie"]):
            return "NHL"
        if any(k in s for k in ["rushing yards", "receiving yards", "passing yards", "touchdowns"]) and "college" not in s:
            return "NFL"
        if "college" in s or "cfb" in s or "ncaaf" in s:
            return "CFB"
        if any(k in s for k in ["points", "rebounds", "assists", "3-pointers", "three-pointers"]) and "wnba" in s:
            return "WNBA"
        return "MLB"

    async def _execute_web_research(self, plan_text: str, statmuse_data: str, predictions: List[Dict[str, Any]]) -> str:
        preds_excerpt = json.dumps(predictions[:8], indent=2)
        # Fetch optional trend data using linemate_trends for supported sports
        trend_summaries: List[str] = []
        for sport_key in ["NHL", "MLB", "NFL", "CFB", "WNBA"]:
            if sport_key not in plan_text and sport_key not in statmuse_data:
                continue
            # Use the tool if available
            try:
                tr = await self.available_tools.execute(name="linemate_trends", tool_input={"sport": sport_key, "max_scroll": 2})
                trend_summaries.append(str(tr))
            except Exception:
                continue

        trends_blob = "\n\n".join(trend_summaries[:2])
        prompt = (
            "Execute targeted web research based on this plan. Use prior data and generate EXACTLY 12 insights (1–3 sentences each).\n"
            "No greetings, no conclusions. Concrete, actionable edges (injuries, pace, travel, weather if material).\n"
            "Only include sports that are active today.\n\n"
            f"PLAN:\n{plan_text}\n\n"
            f"STATMUSE:\n{statmuse_data}\n\n"
            f"TRENDS (optional):\n{trends_blob}\n\n"
            f"REFERENCE PICKS (optional context):\n{preds_excerpt}\n\n"
            "Output a numbered list 1..12 with insights only."
        )
        return await self.llm.ask([{"role": "user", "content": prompt}], stream=False)

    # ---------- Parsing and enhancement ----------
    def _parse_numbered_insights(self, text: str, max_items: int = 12) -> List[str]:
        if not text:
            return []
        insights: List[str] = []
        seen: set[str] = set()
        for raw in text.split("\n"):
            line = raw.strip()
            if not line:
                continue
            if line[0:2].isdigit() and "." in line[:3]:
                line = line.split(".", 1)[1].strip()
            lower = line.lower()
            if any(k in lower for k in ["greet", "conclusion", "summary"]) and len(line) < 60:
                continue
            if len(line) < 25:
                continue
            key = line[:100]
            if key in seen:
                continue
            seen.add(key)
            if len(line) > 400:
                line = line[:400] + "…"
            insights.append(line)
            if len(insights) >= max_items:
                break
        return insights

    def _mentions_only_allowed_sports(self, line: str, allowed: set[str]) -> bool:
        s = line.lower()
        # quick sport tokens
        sport_tokens = {
            "mlb": ["mlb", "baseball"],
            "nfl": ["nfl", "football"],
            "cfb": ["college football", "cfb", "ncaa", "ncaaf"],
            "wnba": ["wnba"],
            "nhl": ["nhl", "hockey"],
        }
        mentioned: set[str] = set()
        for key, tokens in sport_tokens.items():
            if any(t in s for t in tokens):
                mentioned.add(key.upper())
        # If no explicit mention, allow it (team names may imply sport)
        if not mentioned:
            return True
        # All mentioned must be in allowed
        return all(m in allowed for m in mentioned)

    async def _enhance_insights(self, raw: List[str]) -> List[Dict[str, Any]]:
        cats = [
            ("weather", "Material weather effects"),
            ("injury", "Injuries/returns/rotations"),
            ("pitcher", "MLB pitcher analysis"),
            ("bullpen", "MLB bullpen workloads"),
            ("trends", "Team/player trends"),
            ("matchup", "Style or H2H matchups"),
            ("pace", "Tempo and pace"),
            ("offense", "Offensive schemes"),
            ("defense", "Defensive schemes/coverage"),
            ("coaching", "Coaching/travel/rest"),
            ("line_movement", "Market/line movement"),
            ("research", "General research"),
        ]
        cat_lines = "\n".join([f"- {k}: {v}" for k, v in cats])
        listing = "\n".join([f"{i+1}. {x}" for i, x in enumerate(raw)])
        prompt = (
            "Enhance each insight with TITLE(3-8 words), CATEGORY(from list), and keep the DESCRIPTION.\n"
            f"CATEGORIES:\n{cat_lines}\n\nINSIGHTS:\n{listing}\n\n"
            "Respond in blocks:\nINSIGHT N:\nTITLE: ...\nCATEGORY: ...\nDESCRIPTION: ..."
        )
        txt = await self.llm.ask([{"role": "user", "content": prompt}], stream=False)
        return self._parse_enhanced(txt)

    def _parse_enhanced(self, text: str) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        cur: Dict[str, Any] = {}
        for raw in text.split("\n"):
            line = raw.strip()
            if not line:
                continue
            if line.startswith("INSIGHT "):
                if cur.get("title") and cur.get("category") and cur.get("description"):
                    out.append(cur)
                cur = {}
            elif line.startswith("TITLE:"):
                cur["title"] = line.replace("TITLE:", "").strip()
            elif line.startswith("CATEGORY:"):
                cur["category"] = line.replace("CATEGORY:", "").strip().lower() or "research"
            elif line.startswith("DESCRIPTION:"):
                cur["description"] = line.replace("DESCRIPTION:", "").strip()
        if cur.get("title") and cur.get("category") and cur.get("description"):
            out.append(cur)
        return out

    def _fallback_enhancement(self, raw: List[str]) -> List[Dict[str, Any]]:
        res: List[Dict[str, Any]] = []
        for x in raw:
            title = " ".join(x.split()[:6]).rstrip(".,!?")
            res.append({"title": f"{title}…", "category": self._guess_category(x), "description": x})
        return res

    def _guess_category(self, text: str) -> str:
        s = text.lower()
        if any(w in s for w in ["rain", "wind", "temperature", "snow"]):
            return "weather"
        if any(w in s for w in ["injury", "out", "return", "questionable", "doubtful"]):
            return "injury"
        if any(w in s for w in ["pitcher", "mound", "start", "relief"]):
            return "pitcher"
        if any(w in s for w in ["bullpen", "closer"]):
            return "bullpen"
        if any(w in s for w in ["trend", "streak", "momentum"]):
            return "trends"
        if any(w in s for w in ["pace", "tempo"]):
            return "pace"
        if any(w in s for w in ["coverage", "defense", "sack", "pressure"]):
            return "defense"
        if any(w in s for w in ["offense", "yards", "points per", "touchdown"]):
            return "offense"
        if any(w in s for w in ["coach", "travel", "back-to-back", "rest"]):
            return "coaching"
        if any(w in s for w in ["line move", "steam", "consensus", "market"]):
            return "line_movement"
        if any(w in s for w in ["matchup", "vs", "against", "head-to-head"]):
            return "matchup"
        return "research"

    async def _generate_greeting(self, _enhanced: List[Dict[str, Any]], sports: Dict[str, int]) -> str:
        top = ", ".join([f"{k}({v})" for k, v in sorted(sports.items(), key=lambda x: -x[1])[:3]])
        examples = (
            "Funny: 'Markets blink; we pounce. Let's steal edges today.'\n"
            "Serious: 'Today's slate reveals exploitable mismatches across key markets.'\n"
            "Witty: 'If the books nap, we don't. Fresh edges loaded.'"
        )
        prompt = (
            "Craft ONE dynamic greeting (1-2 sentences). Tone is witty or professional as fits.\n"
            "Reference today's research themes, not specific picks. No 'welcome' words.\n"
            f"Sports focus: {top if top else 'Mixed'}\n\n"
            f"Sample styles:\n{examples}\n\nJust the message:"
        )
        txt = await self.llm.ask([{"role": "user", "content": prompt}], stream=False)
        return txt.replace("**", "").strip().strip("\"'")


