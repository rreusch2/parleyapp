#!/usr/bin/env python3

import psycopg2
import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def view_player_stats():
    """View all players that have game stats and what data we have"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=int(os.getenv('DB_PORT', 5432)),
            sslmode='require'
        )
        
        cursor = conn.cursor()
        
        # Get players with their stats count and sample data
        query = """
        SELECT 
            p.name,
            p.external_player_id,
            p.team,
            p.position,
            COUNT(pgs.id) as games_count,
            MIN(pgs.stats->>'game_date') as first_game,
            MAX(pgs.stats->>'game_date') as last_game,
            AVG(CAST(pgs.stats->>'at_bats' AS NUMERIC)) as avg_at_bats,
            AVG(CAST(pgs.stats->>'hits' AS NUMERIC)) as avg_hits,
            AVG(CAST(pgs.stats->>'home_runs' AS NUMERIC)) as avg_home_runs,
            AVG(CAST(pgs.stats->>'estimated_ba' AS NUMERIC)) as avg_batting_avg,
            AVG(CAST(pgs.stats->>'avg_launch_speed' AS NUMERIC)) as avg_exit_velocity
        FROM players p
        JOIN player_game_stats pgs ON p.id = pgs.player_id
        WHERE pgs.stats IS NOT NULL
        GROUP BY p.id, p.name, p.external_player_id, p.team, p.position
        ORDER BY games_count DESC, p.name;
        """
        
        cursor.execute(query)
        players = cursor.fetchall()
        
        print("PLAYERS WITH GAME STATISTICS")
        print("=" * 80)
        print(f"{'Player':<20} {'Team':<8} {'Pos':<5} {'Games':<6} {'Period':<20} {'Avg BA':<8} {'Avg HR':<7} {'Exit Vel':<8}")
        print("-" * 80)
        
        for player in players:
            name, mlb_id, team, pos, games, first, last, at_bats, hits, hrs, ba, exit_vel = player
            period = f"{first} to {last}" if first and last else "N/A"
            avg_ba = f"{ba:.3f}" if ba else "N/A"
            avg_hr = f"{hrs:.1f}" if hrs else "N/A"
            avg_exit = f"{exit_vel:.1f}" if exit_vel else "N/A"
            
            print(f"{name:<20} {team or 'N/A':<8} {pos or 'N/A':<5} {games:<6} {period:<20} {avg_ba:<8} {avg_hr:<7} {avg_exit:<8}")
        
        print(f"\nTotal Players with Stats: {len(players)}")
        
        # Show detailed stats for one player
        if players:
            print(f"\n" + "=" * 80)
            print(f"DETAILED STATS FOR: {players[0][0]}")
            print("=" * 80)
            
            cursor.execute("""
            SELECT 
                pgs.stats->>'game_date' as game_date,
                pgs.stats->>'at_bats' as at_bats,
                pgs.stats->>'hits' as hits,
                pgs.stats->>'home_runs' as home_runs,
                pgs.stats->>'strikeouts' as strikeouts,
                pgs.stats->>'estimated_ba' as batting_avg,
                pgs.stats->>'avg_launch_speed' as exit_velocity,
                pgs.stats->>'avg_launch_angle' as launch_angle,
                pgs.stats->>'max_hit_distance' as max_distance,
                pgs.stats->>'events' as events
            FROM player_game_stats pgs
            JOIN players p ON p.id = pgs.player_id
            WHERE p.name = %s
            ORDER BY pgs.stats->>'game_date'
            LIMIT 10;
            """, (players[0][0],))
            
            games = cursor.fetchall()
            
            print(f"{'Date':<12} {'AB':<3} {'H':<3} {'HR':<3} {'K':<3} {'BA':<6} {'EV':<6} {'LA':<6} {'Dist':<6} {'Events'}")
            print("-" * 80)
            
            for game in games:
                date, ab, h, hr, k, ba, ev, la, dist, events = game
                events_str = str(events)[:20] + "..." if events and len(str(events)) > 20 else str(events) or ""
                
                # Fix formatting
                ba_formatted = f"{float(ba):.3f}" if ba else "0.000"
                ev_formatted = f"{float(ev):.1f}" if ev else "0.0"
                la_formatted = f"{float(la):.1f}" if la else "0.0"
                dist_formatted = f"{float(dist):.0f}" if dist else "0"
                
                print(f"{date:<12} {ab or 0:<3} {h or 0:<3} {hr or 0:<3} {k or 0:<3} "
                      f"{ba_formatted:<6} {ev_formatted:<6} {la_formatted:<6} {dist_formatted:<6} {events_str}")
        
        # Show what types of stats are available
        print(f"\n" + "=" * 80)
        print("AVAILABLE STAT TYPES IN DATABASE:")
        print("=" * 80)
        
        cursor.execute("""
        SELECT DISTINCT jsonb_object_keys(stats) as stat_type
        FROM player_game_stats
        WHERE stats IS NOT NULL
        ORDER BY stat_type;
        """)
        
        stat_types = cursor.fetchall()
        for i, (stat_type,) in enumerate(stat_types):
            if i % 4 == 0:
                print()
            print(f"{stat_type:<20}", end="")
        
        print(f"\n\nTotal Stat Types: {len(stat_types)}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error viewing player stats: {e}")

if __name__ == "__main__":
    view_player_stats() 