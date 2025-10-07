import asyncio
import argparse
import logging
from typing import List, Dict, Any, Optional

# Reuse the existing agent and DB logic
from props_enhanced import (
    IntelligentPlayerPropsAgent,
    DatabaseClient,
)

logger = logging.getLogger(__name__)


def _parse_american_odds(value: Any) -> Optional[int]:
    """Parse odds that may be int or string like "+120" or "-150" into int."""
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            return int(value)
        s = str(value).strip()
        if s.startswith("+"):
            s = s[1:]
        return int(s)
    except Exception:
        return None


class SaferDatabaseClient(DatabaseClient):
    """Wraps base DatabaseClient to apply safer MLB filtering before insert."""

    # MLB-specific constraints
    MLB_MAX_POSITIVE = 220   # cap for positive odds (e.g., +220)
    MLB_MAX_NEGATIVE = -275  # cap for heavy juice (reject < -275)
    MLB_MIN_CONFIDENCE = 55  # minimum confidence for MLB picks
    MLB_MAX_HR_TOTAL = 2     # total MLB HR props allowed
    MLB_MAX_HR_OVER = 1      # at most one HR OVER pick

    SAFE_MLB_PROP_KEYWORDS = (
        "hits", "total bases", "rbis", "runs", "stolen bases",
        "strikeouts", "walks allowed", "hits allowed", "innings pitched"
    )

    def _is_mlb(self, pick: Dict[str, Any]) -> bool:
        return (pick or {}).get("sport") == "MLB"

    def _is_hr_prop(self, pick: Dict[str, Any]) -> bool:
        meta = (pick or {}).get("metadata", {})
        prop = str(meta.get("prop_type", "")).lower()
        return ("home run" in prop) or ("home_runs" in prop)

    def _is_safer_mlb_market(self, pick: Dict[str, Any]) -> bool:
        meta = (pick or {}).get("metadata", {})
        prop = str(meta.get("prop_type", "")).lower()
        return any(k in prop for k in self.SAFE_MLB_PROP_KEYWORDS)

    def _research_supported(self, pick: Dict[str, Any]) -> bool:
        meta = (pick or {}).get("metadata", {})
        insights = int(meta.get("research_insights_count", 0) or 0)
        key_factors = meta.get("key_factors", []) or []
        return insights >= 1 and len(key_factors) >= 1

    def _within_mlb_odds_window(self, odds: Optional[int]) -> bool:
        if odds is None:
            return False
        return (self.MLB_MAX_NEGATIVE <= odds <= self.MLB_MAX_POSITIVE)

    def _apply_safer_mlb_to_predictions(self, predictions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not predictions:
            return predictions

        # Sort by confidence first so that trimming keeps the best
        preds_sorted = sorted(predictions, key=lambda p: p.get("confidence", 0), reverse=True)

        hr_total = 0
        hr_over = 0
        kept: List[Dict[str, Any]] = []

        for p in preds_sorted:
            if not self._is_mlb(p):
                kept.append(p)
                continue

            # Odds window enforcement for MLB
            odds = _parse_american_odds(p.get("odds"))
            if not self._within_mlb_odds_window(odds):
                logger.info(f"🚫 Drop MLB pick (odds window): {p.get('pick')} [odds={p.get('odds')}]")
                continue

            # Confidence floor for MLB
            conf = int(p.get("confidence", 0) or 0)
            if conf < self.MLB_MIN_CONFIDENCE:
                logger.info(f"🚫 Drop MLB pick (confidence<{self.MLB_MIN_CONFIDENCE}%): {p.get('pick')} [{conf}%]")
                continue

            # Require research support
            if not self._research_supported(p):
                logger.info(f"🚫 Drop MLB pick (insufficient research support): {p.get('pick')}")
                continue

            # Limit HR props volume and HR OVER count
            if self._is_hr_prop(p):
                if hr_total >= self.MLB_MAX_HR_TOTAL:
                    logger.info(f"🚫 Drop MLB HR pick (max total {self.MLB_MAX_HR_TOTAL}): {p.get('pick')}")
                    continue
                rec = str(p.get("metadata", {}).get("recommendation", "")).lower()
                if rec == "over" and hr_over >= self.MLB_MAX_HR_OVER:
                    logger.info(f"🚫 Drop MLB HR OVER pick (max over {self.MLB_MAX_HR_OVER}): {p.get('pick')}")
                    continue
                # Passed HR limits -> keep and bump counters
                hr_total += 1
                if rec == "over":
                    hr_over += 1
            else:
                # Prefer safer MLB markets; if it's not a safer market but still MLB, allow but it's already odds/confidence gated.
                pass

            # Optionally annotate lower risk for qualifying MLB picks
            meta = p.setdefault("metadata", {})
            if self._is_safer_mlb_market(p) and conf >= 60:
                meta["risk_level"] = "Low"
            else:
                meta.setdefault("risk_level", "Medium")

            kept.append(p)

        # Log summary changes
        mlb_in = sum(1 for p in predictions if p.get("sport") == "MLB")
        mlb_out = sum(1 for p in kept if p.get("sport") == "MLB")
        logger.info(f"✅ Safer MLB filter: {mlb_in} MLB picks → {mlb_out} kept | HR kept={hr_total} (OVER={hr_over})")
        return kept

    def store_ai_predictions(self, predictions: List[Dict[str, Any]]):
        try:
            filtered = self._apply_safer_mlb_to_predictions(predictions)
            super().store_ai_predictions(filtered)
        except Exception as e:
            logger.error(f"Failed to store predictions with safer MLB filter: {e}")


class SaferMLBPropsAgent(IntelligentPlayerPropsAgent):
    """Agent that uses the safer DatabaseClient to enforce MLB safety at save time."""
    def __init__(self):
        super().__init__()
        # Replace DB with safer version so that base flow stays intact
        self.db = SaferDatabaseClient()


def parse_arguments():
    parser = argparse.ArgumentParser(description='Generate AI player prop betting picks (safer MLB)')
    parser.add_argument('--tomorrow', action='store_true', help='Generate picks for tomorrow instead of today')
    parser.add_argument('--date', type=str, help='Specific date to generate picks for (YYYY-MM-DD)')
    parser.add_argument('--picks', type=int, default=15, help='Target number of total props to generate (default: 15)')
    parser.add_argument('--wnba', action='store_true', help='Generate 5 best WNBA picks only (overrides --picks)')
    parser.add_argument('--nfl-week', action='store_true', help='Generate 5 best NFL picks for the entire week ahead (Thu-Sun)')
    parser.add_argument('--nfl-only', action='store_true', help='Generate picks for NFL games only (ignore other sports)')
    parser.add_argument('--sport', type=str, choices=['NFL', 'MLB', 'WNBA', 'CFB'], help='Limit props to a single sport (overrides multi-sport distribution)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    return parser.parse_args()


async def main():
    args = parse_arguments()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Determine target date
    from datetime import datetime, timedelta
    if args.date:
        try:
            target_date = datetime.strptime(args.date, '%Y-%m-%d').date()
        except ValueError:
            logger.error("Invalid date format. Use YYYY-MM-DD")
            return
    elif args.tomorrow:
        target_date = datetime.now().date() + timedelta(days=1)
    else:
        target_date = datetime.now().date()

    logger.info(f"🤖 Starting Safer MLB Intelligent Player Props Agent for {target_date}")

    agent = SaferMLBPropsAgent()

    # Apply sport filters to agent and DB similar to base script
    try:
        if hasattr(agent, 'db'):
            # NFL-only flag
            setattr(agent, 'nfl_only_mode', bool(args.nfl_only))
            setattr(agent.db, 'nfl_only_mode', bool(args.nfl_only))
            # Generic sport filter via --sport
            if args.sport:
                sport_map = {
                    'NFL': 'National Football League',
                    'MLB': 'Major League Baseball',
                    'WNBA': "Women's National Basketball Association",
                    'CFB': 'College Football'
                }
                full = sport_map.get(args.sport.upper())
                if full:
                    setattr(agent.db, 'sport_filter', [full])
                    logger.info(f"🎯 Sport filter enabled (props): only '{full}' games will be used")
                if args.sport.upper() == 'NFL':
                    setattr(agent, 'nfl_only_mode', True)
                    setattr(agent.db, 'nfl_only_mode', True)
    except Exception as e:
        logger.warning(f"Could not apply sport filters to props DB client: {e}")

    picks = await agent.generate_daily_picks(
        target_date=target_date,
        target_picks=args.picks
    )

    if picks:
        logger.info(f"✅ Successfully generated {len(picks)} intelligent picks (safer MLB) for {target_date}!")
        # Simple sport summary
        by_sport: Dict[str, int] = {}
        for p in picks:
            by_sport[p.get('sport', 'Unknown')] = by_sport.get(p.get('sport', 'Unknown'), 0) + 1
        logger.info(f"📊 Picks by sport: {by_sport}")
    else:
        logger.warning(f"❌ No picks generated for {target_date}")


if __name__ == "__main__":
    asyncio.run(main())
