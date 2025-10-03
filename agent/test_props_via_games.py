#!/usr/bin/env python3
"""Test the two-step pipeline: sports_events -> player_props_odds via game_ids"""

import asyncio
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv("../backend/.env")

from app.tool.supabase_betting import SupabaseBettingTool

async def main():
    date_str = datetime.now().date().isoformat()
    tool = SupabaseBettingTool()
    tool.set_forced_date(date_str)

    print("=" * 80)
    print(f"Step 1: Fetch games from sports_events for {date_str}")
    print("=" * 80)

    games_res = await tool.execute(action="get_upcoming_games", date=date_str, limit=100, exclude_past=False)
    if games_res.error:
        print("❌ get_upcoming_games error:", games_res.error)
        return
    games = json.loads(games_res.output)
    game_ids = [g["id"] for g in games.get("games", [])]

    print(f"Found {len(game_ids)} games")
    if not game_ids:
        return

    print("\n" + "=" * 80)
    print("Step 2: Fetch player props for those game_ids")
    print("=" * 80)

    props_res = await tool.execute(action="get_player_props", game_ids=game_ids, limit=200)
    if props_res.error:
        print("❌ get_player_props error:", props_res.error)
        return
    props = json.loads(props_res.output)

    print(f"Total props found: {props.get('total_props_found')}")
    for i, p in enumerate(props.get("player_props", [])[:10], 1):
        print(f"{i}. {p['player_name']} ({p['team']}) - {p['prop_type']} | line={p['line']} over={p['over_odds']} under={p['under_odds']}")

if __name__ == "__main__":
    asyncio.run(main())
