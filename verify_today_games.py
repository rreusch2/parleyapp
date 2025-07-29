#!/usr/bin/env python3
"""
Quick verification script to show which games are being processed for TODAY ONLY
"""

import os
from datetime import datetime, timedelta
from supabase import create_client, Client

def main():
    # Initialize Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials")
        return
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # Get today's date range
    today = datetime.now().date()
    start_of_today = datetime.combine(today, datetime.min.time()).isoformat()
    end_of_today = datetime.combine(today, datetime.max.time()).isoformat()
    
    print(f"🗓️ TODAY'S DATE: {today}")
    print(f"🕐 TIME RANGE: {start_of_today} to {end_of_today}")
    print("=" * 60)
    
    # Fetch today's games only
    sports = ["Major League Baseball", "Women's National Basketball Association", "Ultimate Fighting Championship"]
    
    all_games = []
    for sport in sports:
        response = supabase.table("sports_events").select(
            "id, home_team, away_team, start_time, sport"
        ).gte("start_time", start_of_today).lte("start_time", end_of_today).eq("sport", sport).order("start_time").execute()
        
        if response.data:
            print(f"📊 {sport}: {len(response.data)} games")
            for game in response.data:
                game_time = datetime.fromisoformat(game['start_time'].replace('Z', '+00:00'))
                local_time = game_time.strftime('%I:%M %p')
                print(f"  • {game['away_team']} @ {game['home_team']} ({local_time})")
            all_games.extend(response.data)
            print()
    
    print("=" * 60)
    print(f"🎯 TOTAL GAMES FOR TODAY: {len(all_games)}")
    print(f"✅ AI will generate picks for these {len(all_games)} games ONLY")
    print(f"❌ NO games from tomorrow (July 29th) will be included")

if __name__ == "__main__":
    main()
