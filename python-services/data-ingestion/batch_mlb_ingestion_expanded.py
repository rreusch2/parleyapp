#!/usr/bin/env python3

import psycopg2
import pybaseball
import pandas as pd
import numpy as np
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import time
import uuid
import json

# Load environment variables
load_dotenv()

def safe_value(value):
    """Convert pandas/numpy values to safe database values"""
    if pd.isna(value) or value is None or value == '':
        return None
    if isinstance(value, (np.integer, np.floating)):
        if np.isnan(value):
            return None
        return float(value) if isinstance(value, np.floating) else int(value)
    return value

def get_target_players():
    """Define target players for Phase 1 - strategic mix of star players"""
    return [
        # Power Hitters
        {'name': 'Aaron Judge', 'mlb_id': '592450', 'team': 'NYY', 'position': 'OF'},
        {'name': 'Shohei Ohtani', 'mlb_id': '660271', 'team': 'LAA', 'position': 'DH'},
        {'name': 'Vladimir Guerrero Jr.', 'mlb_id': '665489', 'team': 'TOR', 'position': '1B'},
        {'name': 'Pete Alonso', 'mlb_id': '624413', 'team': 'NYM', 'position': '1B'},
        {'name': 'Ronald Acuña Jr.', 'mlb_id': '660670', 'team': 'ATL', 'position': 'OF'},
        
        # Contact/Average Hitters  
        {'name': 'Mookie Betts', 'mlb_id': '605141', 'team': 'LAD', 'position': 'OF'},
        {'name': 'José Altuve', 'mlb_id': '514888', 'team': 'HOU', 'position': '2B'},
        {'name': 'Gleyber Torres', 'mlb_id': '650402', 'team': 'NYY', 'position': '2B'},
        {'name': 'Freddie Freeman', 'mlb_id': '518692', 'team': 'LAD', 'position': '1B'},
        {'name': 'Juan Soto', 'mlb_id': '665742', 'team': 'NYY', 'position': 'OF'},
        
        # Speed/Contact Players
        {'name': 'Trea Turner', 'mlb_id': '607208', 'team': 'PHI', 'position': 'SS'},
        {'name': 'Julio Rodríguez', 'mlb_id': '677594', 'team': 'SEA', 'position': 'OF'},
        {'name': 'Bo Bichette', 'mlb_id': '666182', 'team': 'TOR', 'position': 'SS'},
        
        # Catchers
        {'name': 'Salvador Perez', 'mlb_id': '521692', 'team': 'KC', 'position': 'C'},
        {'name': 'Will Smith', 'mlb_id': '669257', 'team': 'LAD', 'position': 'C'},
        
        # Infielders
        {'name': 'Manny Machado', 'mlb_id': '592518', 'team': 'SD', 'position': '3B'},
        {'name': 'Rafael Devers', 'mlb_id': '646240', 'team': 'BOS', 'position': '3B'},
        {'name': 'Francisco Lindor', 'mlb_id': '596019', 'team': 'NYM', 'position': 'SS'},
        {'name': 'Jose Ramirez', 'mlb_id': '608070', 'team': 'CLE', 'position': '3B'},
        {'name': 'Corey Seager', 'mlb_id': '608369', 'team': 'TEX', 'position': 'SS'},
        
        # Rising Stars
        {'name': 'Gunnar Henderson', 'mlb_id': '683002', 'team': 'BAL', 'position': 'SS'},
        {'name': 'Bobby Witt Jr.', 'mlb_id': '677951', 'team': 'KC', 'position': 'SS'},
        {'name': 'Yordan Alvarez', 'mlb_id': '670541', 'team': 'HOU', 'position': 'DH'},
    ]

def create_or_get_player(cursor, player_info):
    """Create player record or get existing one"""
    try:
        # Check if player exists
        cursor.execute("""
            SELECT id FROM players 
            WHERE external_player_id = %s OR name = %s
        """, (player_info['mlb_id'], player_info['name']))
        
        result = cursor.fetchone()
        if result:
            print(f"  Player {player_info['name']} already exists")
            return str(result[0])
        
        # Create new player
        player_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO players (
                id, external_player_id, name, position, team, sport,
                player_key, player_name, sport_key, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            player_id,
            player_info['mlb_id'],
            player_info['name'],
            player_info['position'],
            player_info['team'],
            'MLB',
            f"mlb_{player_info['mlb_id']}",
            player_info['name'],
            None,
            'active'
        ))
        
        print(f"  Created player {player_info['name']} ({player_info['mlb_id']})")
        return player_id
        
    except Exception as e:
        print(f"  Error creating player {player_info['name']}: {e}")
        return None

def ingest_player_data(cursor, player_info, start_date, end_date):
    """Ingest game-by-game data for a specific player"""
    try:
        print(f"\nProcessing {player_info['name']} ({player_info['mlb_id']})...")
        
        # Create or get player
        player_id = create_or_get_player(cursor, player_info)
        if not player_id:
            return False
        
        # Check if we already have data for this player
        cursor.execute("""
            SELECT COUNT(*) FROM player_game_stats pgs
            JOIN players p ON p.id = pgs.player_id
            WHERE p.external_player_id = %s
        """, (player_info['mlb_id'],))
        
        existing_count = cursor.fetchone()[0]
        if existing_count > 0:
            print(f"  Player {player_info['name']} already has {existing_count} game records - skipping")
            return True
        
        # Get player data from pybaseball
        print(f"  Fetching Statcast data from {start_date} to {end_date}...")
        
        # Rate limiting
        time.sleep(1)
        
        # Get player's game log data
        player_id_int = int(player_info['mlb_id'])
        statcast_data = pybaseball.statcast_batter(start_date, end_date, player_id=player_id_int)
        
        if statcast_data.empty:
            print(f"  No Statcast data found for {player_info['name']}")
            return True
        
        print(f"  Found {len(statcast_data)} plate appearances")
        
        # Group by game date
        statcast_data['game_date'] = pd.to_datetime(statcast_data['game_date']).dt.date
        games = statcast_data.groupby('game_date')
        
        # Process each game
        games_processed = 0
        for game_date, game_data in games:
            try:
                # Get events for this game
                events = game_data['events'].dropna().tolist()
                
                # Calculate game statistics
                at_bats = len(game_data[game_data['events'].notna()])
                hits = len(game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])])
                home_runs = len(game_data[game_data['events'] == 'home_run'])
                strikeouts = len(game_data[game_data['events'] == 'strikeout'])
                walks = len(game_data[game_data['events'] == 'walk'])
                
                # Advanced metrics from Statcast
                hit_data = game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])]
                avg_launch_speed = safe_value(hit_data['launch_speed'].mean()) if not hit_data.empty else None
                avg_launch_angle = safe_value(hit_data['launch_angle'].mean()) if not hit_data.empty else None
                max_hit_distance = safe_value(hit_data['hit_distance_sc'].max()) if not hit_data.empty else None
                
                # Estimate batting average and wOBA for this game
                estimated_ba = hits / at_bats if at_bats > 0 else 0
                estimated_woba = (walks * 0.69 + hits * 0.888 + home_runs * 1.271) / at_bats if at_bats > 0 else 0
                
                # Create comprehensive stats JSON
                game_stats = {
                    'type': 'batting',
                    'game_date': str(game_date),
                    'at_bats': safe_value(at_bats),
                    'hits': safe_value(hits),
                    'home_runs': safe_value(home_runs),
                    'strikeouts': safe_value(strikeouts),
                    'walks': safe_value(walks),
                    'events': events,
                    'pitch_count': safe_value(len(game_data)),
                    'avg_launch_speed': avg_launch_speed,
                    'avg_launch_angle': avg_launch_angle,
                    'max_hit_distance': max_hit_distance,
                    'estimated_ba': safe_value(estimated_ba),
                    'estimated_woba': safe_value(estimated_woba)
                }
                
                # Find matching sports_event 
                event_id = None
                cursor.execute("""
                    SELECT id FROM sports_events 
                    WHERE sport = 'baseball' 
                    AND DATE(start_time) = %s
                    LIMIT 1
                """, (game_date,))
                
                result = cursor.fetchone()
                if result:
                    event_id = str(result[0])
                
                # Insert player game stats
                stats_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO player_game_stats (
                        id, event_id, player_id, stats
                    ) VALUES (%s, %s, %s, %s)
                """, (
                    stats_id,
                    event_id,
                    player_id,
                    json.dumps(game_stats)
                ))
                
                games_processed += 1
                
            except Exception as e:
                print(f"    Error processing game {game_date}: {e}")
                continue
        
        print(f"  Successfully processed {games_processed} games for {player_info['name']}")
        return True
        
    except Exception as e:
        print(f"  Error processing {player_info['name']}: {e}")
        return False

def batch_ingest_mlb_players():
    """Main function to batch ingest multiple MLB players"""
    print("Starting MLB Batch Player Ingestion")
    print("=" * 50)
    
    # Date range for data collection
    start_date = '2025-05-22'  # Same as Aaron Judge
    end_date = '2025-06-19'
    
    print(f"Target date range: {start_date} to {end_date}")
    
    # Get target players
    target_players = get_target_players()
    print(f"Target players: {len(target_players)}")
    
    try:
        # Connect to database
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=int(os.getenv('DB_PORT', 5432)),
            sslmode='require'
        )
        
        cursor = conn.cursor()
        
        # Process each player
        successful = 0
        failed = 0
        
        for player_info in target_players:
            try:
                success = ingest_player_data(cursor, player_info, start_date, end_date)
                if success:
                    successful += 1
                    conn.commit()  # Commit after each successful player
                else:
                    failed += 1
                    conn.rollback()
                    
            except Exception as e:
                print(f"Error processing {player_info['name']}: {e}")
                failed += 1
                conn.rollback()
                
            # Rate limiting between players
            time.sleep(2)
        
        cursor.close()
        conn.close()
        
        print(f"\n" + "=" * 50)
        print(f"BATCH INGESTION COMPLETE")
        print(f"Successful: {successful}")
        print(f"Failed: {failed}")
        print(f"Total: {len(target_players)}")
        
    except Exception as e:
        print(f"Database connection error: {e}")

if __name__ == "__main__":
    batch_ingest_mlb_players() 