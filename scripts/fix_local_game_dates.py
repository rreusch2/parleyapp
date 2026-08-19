"""Repair sports_events.local_game_date (and the copy on player_props_v2).

A timezone round-trip bug in fetchTheOddsGames.ts stamped every game starting at or
after 7pm ET with the following day's date when the ingest ran on a non-ET machine.
This recomputes the date from start_time in America/New_York.

Dry run by default; pass --apply to write.
"""
import argparse
import os
from collections import Counter
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from supabase import create_client
from zoneinfo import ZoneInfo

load_dotenv(".env")

ET = ZoneInfo("America/New_York")


def et_date(iso: str) -> str:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(ET).strftime("%Y-%m-%d")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--days-back", type=int, default=2,
                    help="also repair games that started within this many past days")
    args = ap.parse_args()

    client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY"),
    )

    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.days_back)).isoformat()

    events = []
    page = 0
    while True:
        chunk = (
            client.table("sports_events")
            .select("id,sport,home_team,away_team,start_time,local_game_date")
            .gte("start_time", cutoff)
            .order("start_time")
            .range(page * 1000, page * 1000 + 999)
            .execute()
            .data
        )
        events.extend(chunk)
        if len(chunk) < 1000:
            break
        page += 1

    print(f"Scanned {len(events)} events with start_time >= {cutoff[:16]}\n")

    wrong = []
    for e in events:
        if not e.get("start_time"):
            continue
        correct = et_date(e["start_time"])
        if e.get("local_game_date") != correct:
            wrong.append((e, correct))

    if not wrong:
        print("All local_game_date values already correct. Nothing to do.")
        return

    shifts = Counter()
    for e, correct in wrong:
        shifts[(e.get("local_game_date"), correct)] += 1

    print(f"{len(wrong)} events have an incorrect local_game_date:\n")
    for (old, new), n in sorted(shifts.items(), key=lambda kv: str(kv[0])):
        print(f"  {old} -> {new}   ({n} games)")

    print("\nExamples:")
    for e, correct in wrong[:8]:
        start = datetime.fromisoformat(e["start_time"].replace("Z", "+00:00")).astimezone(ET)
        print(f"  [{e['sport']:<5}] {e['away_team']} @ {e['home_team']}")
        print(f"          starts {start.strftime('%Y-%m-%d %I:%M %p %Z')} | "
              f"stored {e.get('local_game_date')} -> correct {correct}")

    if not args.apply:
        print(f"\nDRY RUN. Re-run with --apply to update {len(wrong)} events "
              f"and their player_props_v2 rows.")
        return

    print(f"\nApplying fixes to {len(wrong)} events...")
    events_fixed = 0
    props_fixed = 0
    for e, correct in wrong:
        client.table("sports_events").update({"local_game_date": correct}).eq("id", e["id"]).execute()
        events_fixed += 1
        res = (
            client.table("player_props_v2")
            .update({"local_game_date": correct, "game_date": correct})
            .eq("event_id", e["id"])
            .execute()
        )
        props_fixed += len(res.data or [])
        if events_fixed % 25 == 0:
            print(f"  {events_fixed}/{len(wrong)} events, {props_fixed} props updated")

    print(f"\nDone. Updated {events_fixed} events and {props_fixed} player_props_v2 rows.")


if __name__ == "__main__":
    main()
