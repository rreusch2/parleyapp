#!/usr/bin/env python3
"""
CFB ingestion via SportsDataverse (ESPN)

- Fetch 2024 full season and 2025 games to date (completed only)
- Insert per-game team results into team_recent_stats
- Optionally map/store player game stats when box scores available (graceful fallback)

Usage:
  python scripts/cfb_sdv_ingestion.py --seasons 2024,2025

Requirements:
  pip install sportsdataverse pandas pyarrow polars supabase

Notes:
  - team_trends_data is a VIEW derived from team_recent_stats; do not insert into it
  - team_recent_stats unique key: (team_id, game_date, opponent_team_id)
  - sport_key for CFB must be 'americanfootball_ncaaf'
"""

import os
import sys
import time
import json
import argparse
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from pathlib import Path

import pandas as pd
from supabase import create_client

# Try to import SportsDataverse CFB module
try:
    import sportsdataverse as sdv  # noqa: F401
    from sportsdataverse import cfb as sdv_cfb
except Exception as e:  # pragma: no cover
    print("❌ sportsdataverse is not installed. Run:\n  pip install sportsdataverse pandas polars pyarrow", file=sys.stderr)
    sys.exit(1)

# -------- Environment loading (.env) --------
# Attempt to load the project's .env before reading env vars.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"

try:
    from dotenv import load_dotenv  # type: ignore
except Exception:
    load_dotenv = None  # type: ignore

if load_dotenv is not None:
    # Do not override existing exported envs
    load_dotenv(dotenv_path=str(ENV_PATH), override=False)  # type: ignore[misc]
else:
    # Fallback: lightweight .env parser
    if ENV_PATH.exists():
        try:
            with ENV_PATH.open("r", encoding="utf-8") as f:
                for line in f:
                    s = line.strip()
                    if not s or s.startswith("#") or "=" not in s:
                        continue
                    k, v = s.split("=", 1)
                    k = k.strip()
                    v = v.strip()
                    # don't override environment values already set
                    if k and k not in os.environ:
                        os.environ[k] = v
        except Exception:
            pass

# Environment
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment. Ensure .env is present at project root or export these variables.", file=sys.stderr)
    print(f"   Looked for .env at: {ENV_PATH}")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
CFB_SPORT_KEY = "americanfootball_ncaaf"
CFB_SPORT_NAME = "College Football"

# --------------- Helpers ---------------

def to_iso_date(dt_str: str) -> str:
    try:
        # ESPN dates are often ISO, ensure we convert to YYYY-MM-DD
        dt = pd.to_datetime(dt_str, utc=True, errors="coerce")
        if pd.isna(dt):
            return datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def to_iso_ts(dt_str: str) -> str:
    """Return full ISO timestamp with timezone (UTC) for start_time."""
    try:
        dt = pd.to_datetime(dt_str, utc=True, errors="coerce")
        if pd.isna(dt):
            return datetime.now(timezone.utc).isoformat()
        return dt.isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def get_teams_cache() -> pd.DataFrame:
    res = supabase.table("teams").select("id, team_name, team_abbreviation, sport_key").eq("sport_key", CFB_SPORT_KEY).execute()
    df = pd.DataFrame(res.data or [])
    if df.empty:
        print("⚠️ No CFB teams found in teams table. Run your teams setup first.")
        return df

    # Precompute normalized fields for better matching
    df["_norm_name"] = df["team_name"].fillna("").apply(normalize_team_name)
    df["_norm_abbr"] = df["team_abbreviation"].fillna("").apply(lambda x: str(x).strip().upper())
    return df


def normalize_team_name(s: str) -> str:
    import unicodedata
    s = (s or "").lower()
    # remove diacritics
    s = unicodedata.normalize("NFKD", s)
    s = s.encode("ascii", "ignore").decode("ascii")
    # remove punctuation/apostrophes
    allowed = set("abcdefghijklmnopqrstuvwxyz 0123456789")
    s = "".join(ch if ch in allowed else " " for ch in s)
    # common noise words
    stop = {"university", "college", "the"}
    tokens = [t for t in s.split() if t and t not in stop]
    return " ".join(tokens)


def match_team(team_name: str, team_abbr: Optional[str], teams_df: pd.DataFrame) -> Optional[Dict[str, Any]]:
    if teams_df.empty:
        return None
    name_norm = normalize_team_name(team_name)
    abbr_norm = str(team_abbr).strip().upper() if team_abbr else None

    # 1) Exact normalized name match
    m = teams_df[teams_df["_norm_name"] == name_norm]
    if not m.empty:
        return m.iloc[0].to_dict()

    # 2) Abbreviation strict or contains (handles BUF vs BUFF)
    if abbr_norm:
        m2 = teams_df[teams_df["_norm_abbr"] == abbr_norm]
        if not m2.empty:
            return m2.iloc[0].to_dict()
        m2b = teams_df[teams_df["_norm_abbr"].apply(lambda x: x and (x in abbr_norm or abbr_norm in x))]
        if not m2b.empty:
            return m2b.iloc[0].to_dict()

    # 3) Loose contains (either direction) on normalized names
    m3 = teams_df[teams_df["_norm_name"].str.contains(name_norm, na=False)]
    if not m3.empty:
        return m3.iloc[0].to_dict()
    m4 = teams_df[teams_df["_norm_name"].apply(lambda x: x in name_norm)]
    if not m4.empty:
        return m4.iloc[0].to_dict()

    # 4) Try dropping final token from ESPN name (e.g., "buffalo bulls" -> "buffalo")
    parts = name_norm.split()
    if len(parts) > 1:
        base = " ".join(parts[:-1])
        m5 = teams_df[teams_df["_norm_name"] == base]
        if not m5.empty:
            return m5.iloc[0].to_dict()

    return None


def fetch_schedule_for_season(season: int) -> pd.DataFrame:
    """Fetch ESPN CFB schedule for a season using SportsDataverse (v0.0.39).
    Correct signature: espn_cfb_schedule(dates=YYYY, week=None, season_type=None, groups=None, limit=500, return_as_pandas=False)
    We request pandas output and use groups=80 (FBS) to reduce FCS mismatches.
    Returns a pandas DataFrame (possibly empty).
    """
    print(f"📅 Fetching schedule for {season} via SportsDataverse (ESPN)...")
    try:
        df = sdv_cfb.espn_cfb_schedule(
            dates=season,
            groups=80,  # FBS only to reduce unmatched FCS opponents
            limit=20000,
            return_as_pandas=True,
        )
        if df is None:
            return pd.DataFrame()
        # Convert polars if a polars DF slipped through
        try:
            import polars as pl  # type: ignore
            if isinstance(df, pl.DataFrame):
                df = df.to_pandas()
        except Exception:
            pass
        if isinstance(df, pd.DataFrame) and not df.empty:
            print(f"✅ Retrieved {len(df)} schedule rows for {season}")
            return df
    except Exception as e:
        print(f"⚠️ espn_cfb_schedule(dates=...) failed: {e}")

    # Fallback: iterate by weeks 1..20 just in case remote limits apply
    all_rows: list[pd.DataFrame] = []
    for wk in range(1, 21):
        try:
            part = sdv_cfb.espn_cfb_schedule(
                dates=season,
                week=wk,
                groups=80,
                limit=20000,
                return_as_pandas=True,
            )
            if part is None:
                continue
            try:
                import polars as pl  # type: ignore
                if isinstance(part, pl.DataFrame):
                    part = part.to_pandas()
            except Exception:
                pass
            if isinstance(part, pd.DataFrame) and not part.empty:
                all_rows.append(part)
        except Exception as e:
            print(f"⚠️ Week {wk} fetch failed: {e}")
            continue
    if all_rows:
        out = pd.concat(all_rows, ignore_index=True)
        print(f"✅ Retrieved {len(out)} schedule rows for {season} across weeks")
        return out

    print(f"⚠️ No schedule data retrieved for {season}")
    return pd.DataFrame()


def is_final_game(row: pd.Series) -> bool:
    # Heuristics across possible schemas
    for col in ["status_type_completed", "status_type_name", "status_display_name", "status_name", "game_status"]:
        if col in row:
            val = str(row[col]).lower()
            if "final" in val or "completed" in val or val == "final":
                return True
    # If scores exist and date is in past, assume final
    if "home_score" in row and "away_score" in row:
        try:
            if pd.notna(row["home_score"]) and pd.notna(row["away_score"]):
                gdate = to_iso_date(str(row.get("date") or row.get("game_date") or ""))
                if gdate <= datetime.now(timezone.utc).strftime("%Y-%m-%d"):
                    return True
        except Exception:
            pass
    return False


def extract_team_fields(row: pd.Series) -> Tuple[str, Optional[str], str, Optional[str], int, int, str]:
    """Return (home_name, home_abbr, away_name, away_abbr, home_score, away_score, game_date, start_time_iso) with fallbacks."""
    home_name = str(row.get("home_team") or row.get("home_team_name") or row.get("home_display_name") or row.get("homeTeam", {}).get("displayName", "")).strip()
    away_name = str(row.get("away_team") or row.get("away_team_name") or row.get("away_display_name") or row.get("awayTeam", {}).get("displayName", "")).strip()
    home_abbr = row.get("home_team_abbr") or row.get("home_abbreviation") or row.get("homeTeam", {}).get("abbreviation")
    away_abbr = row.get("away_team_abbr") or row.get("away_abbreviation") or row.get("awayTeam", {}).get("abbreviation")

    # scores
    def _to_int(x):
        try:
            return int(float(x))
        except Exception:
            return 0

    home_score = _to_int(row.get("home_score") or row.get("homeTeam", {}).get("score"))
    away_score = _to_int(row.get("away_score") or row.get("awayTeam", {}).get("score"))

    raw_dt = str(row.get("date") or row.get("game_date") or row.get("start_date") or "")
    game_date = to_iso_date(raw_dt)
    start_time_iso = to_iso_ts(raw_dt)
    return home_name, home_abbr, away_name, away_abbr, home_score, away_score, game_date, start_time_iso


def upsert_sports_event(
    external_event_id: str,
    home_team: Optional[Dict[str, Any]],
    away_team: Optional[Dict[str, Any]],
    home_team_name: str,
    away_team_name: str,
    start_time_iso: str,
    final: bool,
    home_score: int,
    away_score: int,
) -> Optional[str]:
    """Upsert a sports_events row and return its id if available."""
    payload = {
        "sport": "Football",
        "league": "NCAAF",
        "home_team": home_team_name,
        "away_team": away_team_name,
        "start_time": start_time_iso,
        "status": "completed" if final else "scheduled",
        "external_event_id": external_event_id,
        "source": "espn",
        "sport_key": CFB_SPORT_KEY,
        "final_home_score": home_score if final else None,
        "final_away_score": away_score if final else None,
        "home_team_id": home_team.get("id") if home_team else None,
        "away_team_id": away_team.get("id") if away_team else None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Upsert on external_event_id
    try:
        resp = supabase.table("sports_events").upsert(
            payload, on_conflict="external_event_id", ignore_duplicates=False
        ).execute()
        # Fetch id
        if resp.data:
            return resp.data[0].get("id")
        # If upsert returns empty, try select
        sel = supabase.table("sports_events").select("id").eq("external_event_id", external_event_id).limit(1).execute()
        if sel.data:
            return sel.data[0].get("id")
    except Exception as e:
        print(f"   ⚠️ sports_events upsert failed for {external_event_id}: {e}")
    return None


def upsert_team_results_for_game(
    teams_df: pd.DataFrame,
    home_team: Optional[Dict[str, Any]],
    away_team: Optional[Dict[str, Any]],
    home_team_name: str,
    away_team_name: str,
    home_score: int,
    away_score: int,
    game_date: str,
    external_game_id: str,
) -> None:
    records = []

    def mk_row(team_id, team_name, is_home, team_score, opp_score, opp_name, opp_id):
        return {
            "team_id": team_id,
            "team_name": team_name,
            "sport": CFB_SPORT_NAME,
            "sport_key": CFB_SPORT_KEY,
            "game_date": game_date,
            "opponent_team": opp_name,
            "opponent_team_id": opp_id,
            "is_home": is_home,
            "team_score": team_score,
            "opponent_score": opp_score,
            "game_result": "W" if team_score > opp_score else ("L" if team_score < opp_score else "T"),
            "margin": team_score - opp_score,
            "external_game_id": external_game_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    if home_team and away_team:
        # If any previous one-sided rows exist for this external_game_id, attach opponent_team_id now
        try:
            supabase.table("team_recent_stats").update({"opponent_team_id": away_team["id"]}).eq("external_game_id", external_game_id).eq("team_id", home_team["id"]).is_("opponent_team_id", None).execute()
            supabase.table("team_recent_stats").update({"opponent_team_id": home_team["id"]}).eq("external_game_id", external_game_id).eq("team_id", away_team["id"]).is_("opponent_team_id", None).execute()
        except Exception:
            pass

        # Two-sided insert
        records.append(mk_row(home_team["id"], home_team["team_name"], True, home_score, away_score, away_team["team_name"], away_team["id"]))
        records.append(mk_row(away_team["id"], away_team["team_name"], False, away_score, home_score, home_team["team_name"], home_team["id"]))
    elif home_team and not away_team:
        # Only home matched
        records.append(mk_row(home_team["id"], home_team["team_name"], True, home_score, away_score, away_team_name, None))
    elif away_team and not home_team:
        # Only away matched
        records.append(mk_row(away_team["id"], away_team["team_name"], False, away_score, home_score, home_team_name, None))
    else:
        # Neither matched
        print(f"   ⚠️ Skipping game {external_game_id}: neither team matched database")
        return

    # Skip rows that already exist for (team_id, external_game_id)
    to_insert = []
    for rec in records:
        try:
            exists = supabase.table("team_recent_stats").select("id").eq("team_id", rec["team_id"]).eq("external_game_id", rec["external_game_id"]).limit(1).execute()
            if exists.data:
                continue
        except Exception:
            # If existence check fails, attempt insert anyway
            pass
        to_insert.append(rec)

    if not to_insert:
        print(f"   ⏭️ Skipped existing rows for {external_game_id}")
        return

    resp = supabase.table("team_recent_stats").upsert(
        to_insert,
        on_conflict="team_id,game_date,opponent_team_id",
        ignore_duplicates=False,
    ).execute()
    stored = len(resp.data or [])
    print(f"   ✅ Stored {stored} team_recent_stats rows for {external_game_id}")


# --------------- Main flow ---------------

def ingest_cfb(seasons: list[int]) -> None:
    teams_df = get_teams_cache()
    if teams_df.empty:
        print("❌ Aborting: no teams in 'teams' table for CFB.")
        return

    total_games = 0
    stored_games = 0
    unmatched = 0

    for season in seasons:
        sched = fetch_schedule_for_season(season)
        if sched.empty:
            continue

        # Normalize columns: ensure 'id' exists as string
        if "id" not in sched.columns:
            # ESPN sometimes uses 'game_id'
            if "game_id" in sched.columns:
                sched["id"] = sched["game_id"]
            else:
                # Try 'event_id'
                if "event_id" in sched.columns:
                    sched["id"] = sched["event_id"]

        # Iterate completed games only
        for _, row in sched.iterrows():
            if not is_final_game(row):
                continue
            total_games += 1

            home_name, home_abbr, away_name, away_abbr, home_score, away_score, game_date, start_time_iso = extract_team_fields(row)
            game_id = str(row.get("id") or row.get("game_id") or row.get("event_id") or "").strip()
            if not game_id:
                # Construct synthetic id
                game_id = f"{season}-{home_name}-{away_name}-{game_date}"
            external_game_id = f"espn:{game_id}"

            home = match_team(home_name, home_abbr, teams_df)
            away = match_team(away_name, away_abbr, teams_df)

            if not home or not away:
                unmatched += 1
                print(f"   ⚠️ Unmatched teams: home='{home_name}'/{home_abbr} away='{away_name}'/{away_abbr}")

            # Upsert/anchor sports_event for this game (for props linking)
            try:
                _event_id = upsert_sports_event(
                    external_event_id=external_game_id,
                    home_team=home,
                    away_team=away,
                    home_team_name=home_name,
                    away_team_name=away_name,
                    start_time_iso=start_time_iso,
                    final=is_final_game(row),
                    home_score=home_score,
                    away_score=away_score,
                )
            except Exception as e:
                print(f"   ⚠️ sports_events upsert error for {external_game_id}: {e}")

            try:
                upsert_team_results_for_game(
                    teams_df, home, away, home_name, away_name, home_score, away_score, game_date, external_game_id
                )
                stored_games += 1
            except Exception as e:
                print(f"   ❌ Failed to store game {external_game_id}: {e}")
                continue

        print(f"📊 Season {season}: stored {stored_games} of {total_games} completed games (unmatched {unmatched}).")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", type=str, default="2024,2025", help="Comma-separated seasons, e.g., 2024,2025")
    args = parser.parse_args()

    seasons = [int(s.strip()) for s in args.seasons.split(",") if s.strip()]
    print("🚀 Starting CFB ingestion via SportsDataverse (ESPN)\n")
    ingest_cfb(seasons)
    print("\n🎉 Done.")


if __name__ == "__main__":
    main()
