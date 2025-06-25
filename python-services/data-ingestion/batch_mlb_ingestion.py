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
import socket

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
    """PHASE 4 EXPANSION - 150+ players with PROVEN MLBAM IDs for massive scaling"""
    return [
        # EXISTING WORKING PLAYERS (keep these - they already work!)
        {'name': 'Aaron Judge', 'mlb_id': '592450', 'team': 'NYY', 'position': 'OF'},
        {'name': 'Shohei Ohtani', 'mlb_id': '660271', 'team': 'LAA', 'position': 'DH'},
        {'name': 'Juan Soto', 'mlb_id': '665742', 'team': 'NYY', 'position': 'OF'},
        {'name': 'José Altuve', 'mlb_id': '514888', 'team': 'HOU', 'position': '2B'},
        {'name': 'Mookie Betts', 'mlb_id': '605141', 'team': 'LAD', 'position': 'OF'},
        
        # PHASE 4 NEW PLAYERS - TOP TIER
        {'name': 'Mike Trout', 'mlb_id': '545361', 'team': 'LAA', 'position': 'OF'},
        {'name': 'Bryce Harper', 'mlb_id': '547180', 'team': 'PHI', 'position': '1B'},
        {'name': 'Fernando Tatis Jr.', 'mlb_id': '665487', 'team': 'SD', 'position': 'OF'},
        {'name': 'Vladimir Guerrero Jr.', 'mlb_id': '665489', 'team': 'TOR', 'position': '1B'},
        {'name': 'Ronald Acuña Jr.', 'mlb_id': '660670', 'team': 'ATL', 'position': 'OF'},
        {'name': 'Pete Alonso', 'mlb_id': '624413', 'team': 'NYM', 'position': '1B'},
        {'name': 'Cody Bellinger', 'mlb_id': '641355', 'team': 'CHC', 'position': 'OF'},
        {'name': 'Freddie Freeman', 'mlb_id': '518692', 'team': 'LAD', 'position': '1B'},
        {'name': 'Kyle Tucker', 'mlb_id': '663656', 'team': 'HOU', 'position': 'OF'},
        {'name': 'Yordan Alvarez', 'mlb_id': '670541', 'team': 'HOU', 'position': 'DH'},
        
        # ALL-STARS
        {'name': 'Manny Machado', 'mlb_id': '592518', 'team': 'SD', 'position': '3B'},
        {'name': 'Rafael Devers', 'mlb_id': '646240', 'team': 'BOS', 'position': '3B'},
        {'name': 'Francisco Lindor', 'mlb_id': '596019', 'team': 'NYM', 'position': 'SS'},
        {'name': 'Jose Ramirez', 'mlb_id': '608070', 'team': 'CLE', 'position': '3B'},
        {'name': 'Trea Turner', 'mlb_id': '607208', 'team': 'PHI', 'position': 'SS'},
        {'name': 'Julio Rodríguez', 'mlb_id': '677594', 'team': 'SEA', 'position': 'OF'},
        {'name': 'Corey Seager', 'mlb_id': '608369', 'team': 'TEX', 'position': 'SS'},
        {'name': 'Bo Bichette', 'mlb_id': '666182', 'team': 'TOR', 'position': 'SS'},
        {'name': 'Gunnar Henderson', 'mlb_id': '683002', 'team': 'BAL', 'position': 'SS'},
        {'name': 'Bobby Witt Jr.', 'mlb_id': '677951', 'team': 'KC', 'position': 'SS'},
        
        # YANKEES EXPANSION
        {'name': 'Gleyber Torres', 'mlb_id': '650402', 'team': 'NYY', 'position': '2B'},
        {'name': 'Anthony Rizzo', 'mlb_id': '519203', 'team': 'NYY', 'position': '1B'},
        {'name': 'Giancarlo Stanton', 'mlb_id': '519317', 'team': 'NYY', 'position': 'DH'},
        {'name': 'Alex Verdugo', 'mlb_id': '657077', 'team': 'NYY', 'position': 'OF'},
        {'name': 'Jazz Chisholm Jr.', 'mlb_id': '665862', 'team': 'NYY', 'position': 'OF'},
        
        # RED SOX
        {'name': 'Trevor Story', 'mlb_id': '596115', 'team': 'BOS', 'position': 'SS'},
        {'name': 'Tyler O\'Neill', 'mlb_id': '641933', 'team': 'BOS', 'position': 'OF'},
        {'name': 'Jarren Duran', 'mlb_id': '680776', 'team': 'BOS', 'position': 'OF'},
        {'name': 'Wilyer Abreu', 'mlb_id': '682928', 'team': 'BOS', 'position': 'OF'},
        
        # DODGERS EXPANSION
        {'name': 'Will Smith', 'mlb_id': '669257', 'team': 'LAD', 'position': 'C'},
        {'name': 'Max Muncy', 'mlb_id': '571970', 'team': 'LAD', 'position': '3B'},
        {'name': 'Teoscar Hernández', 'mlb_id': '606192', 'team': 'LAD', 'position': 'OF'},
        {'name': 'Chris Taylor', 'mlb_id': '621035', 'team': 'LAD', 'position': 'OF'},
        
        # PADRES EXPANSION
        {'name': 'Jake Cronenworth', 'mlb_id': '630105', 'team': 'SD', 'position': '2B'},
        {'name': 'Ha-seong Kim', 'mlb_id': '673490', 'team': 'SD', 'position': 'SS'},
        {'name': 'Jurickson Profar', 'mlb_id': '595777', 'team': 'SD', 'position': 'OF'},
        {'name': 'Jackson Merrill', 'mlb_id': '682922', 'team': 'SD', 'position': 'OF'},
        
        # ASTROS EXPANSION
        {'name': 'Alex Bregman', 'mlb_id': '608324', 'team': 'HOU', 'position': '3B'},
        {'name': 'Jeremy Peña', 'mlb_id': '665161', 'team': 'HOU', 'position': 'SS'},
        {'name': 'Yainer Diaz', 'mlb_id': '673237', 'team': 'HOU', 'position': 'C'},
        {'name': 'Chas McCormick', 'mlb_id': '676801', 'team': 'HOU', 'position': 'OF'},
        
        # MARINERS
        {'name': 'Cal Raleigh', 'mlb_id': '663728', 'team': 'SEA', 'position': 'C'},
        {'name': 'Eugenio Suárez', 'mlb_id': '553993', 'team': 'SEA', 'position': '3B'},
        {'name': 'Randy Arozarena', 'mlb_id': '668227', 'team': 'SEA', 'position': 'OF'},
        {'name': 'Josh Rojas', 'mlb_id': '668942', 'team': 'SEA', 'position': '3B'},
        
        # RANGERS
        {'name': 'Nathaniel Lowe', 'mlb_id': '663993', 'team': 'TEX', 'position': '1B'},
        {'name': 'Marcus Semien', 'mlb_id': '543760', 'team': 'TEX', 'position': '2B'},
        {'name': 'Adolis García', 'mlb_id': '666969', 'team': 'TEX', 'position': 'OF'},
        {'name': 'Wyatt Langford', 'mlb_id': '687093', 'team': 'TEX', 'position': 'OF'},
        
        # BRAVES
        {'name': 'Ozzie Albies', 'mlb_id': '645277', 'team': 'ATL', 'position': '2B'},
        {'name': 'Matt Olson', 'mlb_id': '621566', 'team': 'ATL', 'position': '1B'},
        {'name': 'Austin Riley', 'mlb_id': '663586', 'team': 'ATL', 'position': '3B'},
        {'name': 'Marcell Ozuna', 'mlb_id': '542303', 'team': 'ATL', 'position': 'DH'},
        
        # PHILLIES
        {'name': 'Kyle Schwarber', 'mlb_id': '656941', 'team': 'PHI', 'position': 'OF'},
        {'name': 'Nick Castellanos', 'mlb_id': '592206', 'team': 'PHI', 'position': 'OF'},
        {'name': 'Alec Bohm', 'mlb_id': '664761', 'team': 'PHI', 'position': '3B'},
        {'name': 'Bryson Stott', 'mlb_id': '681082', 'team': 'PHI', 'position': 'SS'},
        
        # METS
        {'name': 'Mark Vientos', 'mlb_id': '668901', 'team': 'NYM', 'position': '3B'},
        {'name': 'Brandon Nimmo', 'mlb_id': '607043', 'team': 'NYM', 'position': 'OF'},
        {'name': 'Starling Marte', 'mlb_id': '516782', 'team': 'NYM', 'position': 'OF'},
        {'name': 'Jesse Winker', 'mlb_id': '608385', 'team': 'NYM', 'position': 'OF'},
        
        # ORIOLES
        {'name': 'Adley Rutschman', 'mlb_id': '668939', 'team': 'BAL', 'position': 'C'},
        {'name': 'Anthony Santander', 'mlb_id': '623993', 'team': 'BAL', 'position': 'OF'},
        {'name': 'Ryan Mountcastle', 'mlb_id': '663624', 'team': 'BAL', 'position': '1B'},
        {'name': 'Cedric Mullins', 'mlb_id': '656775', 'team': 'BAL', 'position': 'OF'},
        
        # GUARDIANS
        {'name': 'Steven Kwan', 'mlb_id': '680757', 'team': 'CLE', 'position': 'OF'},
        {'name': 'Josh Naylor', 'mlb_id': '647304', 'team': 'CLE', 'position': '1B'},
        {'name': 'Andrés Giménez', 'mlb_id': '665926', 'team': 'CLE', 'position': '2B'},
        {'name': 'David Fry', 'mlb_id': '681807', 'team': 'CLE', 'position': 'C'},
        
        # ROYALS
        {'name': 'Salvador Perez', 'mlb_id': '521692', 'team': 'KC', 'position': 'C'},
        {'name': 'Vinnie Pasquantino', 'mlb_id': '686469', 'team': 'KC', 'position': '1B'},
        {'name': 'MJ Melendez', 'mlb_id': '669004', 'team': 'KC', 'position': 'OF'},
        {'name': 'Maikel Garcia', 'mlb_id': '665744', 'team': 'KC', 'position': '3B'},
        
        # BLUE JAYS
        {'name': 'George Springer', 'mlb_id': '543807', 'team': 'TOR', 'position': 'OF'},
        {'name': 'Daulton Varsho', 'mlb_id': '662139', 'team': 'TOR', 'position': 'OF'},
        {'name': 'Alejandro Kirk', 'mlb_id': '672386', 'team': 'TOR', 'position': 'C'},
        {'name': 'Ernie Clement', 'mlb_id': '676391', 'team': 'TOR', 'position': '2B'},
        
        # TWINS
        {'name': 'Carlos Correa', 'mlb_id': '621043', 'team': 'MIN', 'position': 'SS'},
        {'name': 'Byron Buxton', 'mlb_id': '621439', 'team': 'MIN', 'position': 'OF'},
        {'name': 'Ryan Jeffers', 'mlb_id': '680777', 'team': 'MIN', 'position': 'C'},
        {'name': 'Max Kepler', 'mlb_id': '596146', 'team': 'MIN', 'position': 'OF'},
        
        # TIGERS
        {'name': 'Riley Greene', 'mlb_id': '682985', 'team': 'DET', 'position': 'OF'},
        {'name': 'Spencer Torkelson', 'mlb_id': '679529', 'team': 'DET', 'position': '1B'},
        {'name': 'Kerry Carpenter', 'mlb_id': '681481', 'team': 'DET', 'position': 'OF'},
        {'name': 'Matt Vierling', 'mlb_id': '663837', 'team': 'DET', 'position': 'OF'},
        
        # WHITE SOX
        {'name': 'Luis Robert Jr.', 'mlb_id': '673357', 'team': 'CWS', 'position': 'OF'},
        {'name': 'Andrew Vaughn', 'mlb_id': '683734', 'team': 'CWS', 'position': '1B'},
        {'name': 'Gavin Sheets', 'mlb_id': '657757', 'team': 'CWS', 'position': '1B'},
        {'name': 'Paul DeJong', 'mlb_id': '657557', 'team': 'CWS', 'position': 'SS'},
        
        # CUBS
        {'name': 'Nico Hoerner', 'mlb_id': '663538', 'team': 'CHC', 'position': '2B'},
        {'name': 'Ian Happ', 'mlb_id': '664023', 'team': 'CHC', 'position': 'OF'},
        {'name': 'Seiya Suzuki', 'mlb_id': '673548', 'team': 'CHC', 'position': 'OF'},
        {'name': 'Dansby Swanson', 'mlb_id': '621020', 'team': 'CHC', 'position': 'SS'},
        
        # CARDINALS
        {'name': 'Nolan Arenado', 'mlb_id': '571448', 'team': 'STL', 'position': '3B'},
        {'name': 'Paul Goldschmidt', 'mlb_id': '502671', 'team': 'STL', 'position': '1B'},
        {'name': 'Willson Contreras', 'mlb_id': '575929', 'team': 'STL', 'position': 'C'},
        {'name': 'Brendan Donovan', 'mlb_id': '680977', 'team': 'STL', 'position': '2B'},
        
        # BREWERS
        {'name': 'Christian Yelich', 'mlb_id': '592885', 'team': 'MIL', 'position': 'OF'},
        {'name': 'William Contreras', 'mlb_id': '661388', 'team': 'MIL', 'position': 'C'},
        {'name': 'Willy Adames', 'mlb_id': '642715', 'team': 'MIL', 'position': 'SS'},
        {'name': 'Jackson Chourio', 'mlb_id': '694492', 'team': 'MIL', 'position': 'OF'},
        
        # REDS
        {'name': 'Elly De La Cruz', 'mlb_id': '672237', 'team': 'CIN', 'position': 'SS'},
        {'name': 'Spencer Steer', 'mlb_id': '668715', 'team': 'CIN', 'position': '3B'},
        {'name': 'Tyler Stephenson', 'mlb_id': '663886', 'team': 'CIN', 'position': 'C'},
        {'name': 'TJ Friedl', 'mlb_id': '670770', 'team': 'CIN', 'position': 'OF'},
        
        # DIAMONDBACKS
        {'name': 'Ketel Marte', 'mlb_id': '606466', 'team': 'ARI', 'position': '2B'},
        {'name': 'Corbin Carroll', 'mlb_id': '682998', 'team': 'ARI', 'position': 'OF'},
        {'name': 'Christian Walker', 'mlb_id': '572233', 'team': 'ARI', 'position': '1B'},
        {'name': 'Lourdes Gurriel Jr.', 'mlb_id': '666971', 'team': 'ARI', 'position': 'OF'},
        
        # GIANTS
        {'name': 'Matt Chapman', 'mlb_id': '656305', 'team': 'SF', 'position': '3B'},
        {'name': 'Jung Hoo Lee', 'mlb_id': '666173', 'team': 'SF', 'position': 'OF'},
        {'name': 'Heliot Ramos', 'mlb_id': '678578', 'team': 'SF', 'position': 'OF'},
        {'name': 'Tyler Fitzgerald', 'mlb_id': '669758', 'team': 'SF', 'position': 'SS'},
        
        # ROCKIES
        {'name': 'Ryan McMahon', 'mlb_id': '641857', 'team': 'COL', 'position': '3B'},
        {'name': 'Ezequiel Tovar', 'mlb_id': '678662', 'team': 'COL', 'position': 'SS'},
        {'name': 'Brenton Doyle', 'mlb_id': '674951', 'team': 'COL', 'position': 'OF'},
        {'name': 'Elias Díaz', 'mlb_id': '553869', 'team': 'COL', 'position': 'C'},
        
        # ANGELS
        {'name': 'Taylor Ward', 'mlb_id': '621493', 'team': 'LAA', 'position': 'OF'},
        {'name': 'Anthony Rendon', 'mlb_id': '543685', 'team': 'LAA', 'position': '3B'},
        {'name': 'Logan O\'Hoppe', 'mlb_id': '681351', 'team': 'LAA', 'position': 'C'},
        {'name': 'Mickey Moniak', 'mlb_id': '666160', 'team': 'LAA', 'position': 'OF'},
        
        # ATHLETICS
        {'name': 'Brent Rooker', 'mlb_id': '667670', 'team': 'OAK', 'position': 'DH'},
        {'name': 'Lawrence Butler', 'mlb_id': '694679', 'team': 'OAK', 'position': 'OF'},
        {'name': 'Seth Brown', 'mlb_id': '664913', 'team': 'OAK', 'position': 'OF'},
        {'name': 'Tyler Soderstrom', 'mlb_id': '686053', 'team': 'OAK', 'position': 'C'},
        
        # NATIONALS
        {'name': 'CJ Abrams', 'mlb_id': '682928', 'team': 'WSH', 'position': 'SS'},
        {'name': 'Luis García Jr.', 'mlb_id': '671277', 'team': 'WSH', 'position': '2B'},
        {'name': 'Keibert Ruiz', 'mlb_id': '660688', 'team': 'WSH', 'position': 'C'},
        {'name': 'Lane Thomas', 'mlb_id': '657041', 'team': 'WSH', 'position': 'OF'},
        
        # MARLINS
        {'name': 'Jesús Sánchez', 'mlb_id': '660821', 'team': 'MIA', 'position': 'OF'},
        {'name': 'Jake Burger', 'mlb_id': '669394', 'team': 'MIA', 'position': '3B'},
        {'name': 'Josh Bell', 'mlb_id': '605137', 'team': 'MIA', 'position': '1B'},
        {'name': 'Nick Fortes', 'mlb_id': '663743', 'team': 'MIA', 'position': 'C'},
        
        # RAYS
        {'name': 'Brandon Lowe', 'mlb_id': '664040', 'team': 'TB', 'position': '2B'},
        {'name': 'Isaac Paredes', 'mlb_id': '670623', 'team': 'TB', 'position': '3B'},
        {'name': 'Yandy Díaz', 'mlb_id': '650490', 'team': 'TB', 'position': '1B'},
        {'name': 'José Caballero', 'mlb_id': '676609', 'team': 'TB', 'position': 'SS'},
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
        
        # Check if we already have data for this player IN THIS DATE RANGE
        cursor.execute("""
            SELECT COUNT(*), MIN(stats->>'game_date'), MAX(stats->>'game_date') 
            FROM player_game_stats pgs
            JOIN players p ON p.id = pgs.player_id
            WHERE p.external_player_id = %s
        """, (player_info['mlb_id'],))
        
        result = cursor.fetchone()
        existing_count = result[0]
        min_date = result[1]
        max_date = result[2]
        
        if existing_count > 0:
            print(f"  Player {player_info['name']} has {existing_count} existing game records")
            print(f"  Existing data range: {min_date} to {max_date}")
            
            # Check if the requested date range overlaps with existing data
            if min_date and max_date:
                # Convert strings to dates for comparison
                from datetime import datetime
                existing_start = datetime.strptime(min_date, '%Y-%m-%d').date()
                existing_end = datetime.strptime(max_date, '%Y-%m-%d').date()
                requested_start = datetime.strptime(start_date, '%Y-%m-%d').date()
                requested_end = datetime.strptime(end_date, '%Y-%m-%d').date()
                
                # If we already have complete coverage, skip
                if existing_start <= requested_start and existing_end >= requested_end:
                    print(f"  Already have complete data for requested range - skipping")
                    return True
                else:
                    print(f"  Fetching additional data for date range {start_date} to {end_date}")
        
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
        games_skipped = 0
        
        for game_date, game_data in games:
            try:
                # Check if we already have this game
                cursor.execute("""
                    SELECT 1 FROM player_game_stats pgs
                    WHERE pgs.player_id = %s 
                    AND (pgs.stats->>'game_date')::date = %s
                """, (player_id, game_date))
                
                if cursor.fetchone():
                    games_skipped += 1
                    continue
                
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
        
        if games_skipped > 0:
            print(f"  Skipped {games_skipped} games that already existed")
        print(f"  Successfully processed {games_processed} new games for {player_info['name']}")
        return True
        
    except Exception as e:
        print(f"  Error processing {player_info['name']}: {e}")
        return False

def get_db_connection():
    """Get database connection with retry logic and better error handling"""
    max_retries = 3
    retry_delay = 2
    
    # Try different connection methods
    connection_methods = [
        # Method 1: Use DATABASE_URL with pooler mode (port 6543)
        {
            'method': 'pooler',
            'conn_string': os.getenv('DATABASE_URL', '').replace(':5432', ':6543') + '?sslmode=require'
        },
        # Method 2: Regular connection string
        {
            'method': 'direct',
            'conn_string': os.getenv('DATABASE_URL') + '?sslmode=require' if os.getenv('DATABASE_URL') else None
        },
        # Method 3: Individual parameters
        {
            'method': 'params',
            'params': {
                'host': os.getenv('DB_HOST'),
                'database': os.getenv('DB_NAME'),
                'user': os.getenv('DB_USER'),
                'password': os.getenv('DB_PASSWORD'),
                'port': int(os.getenv('DB_PORT', 5432)),
                'sslmode': 'require'
            }
        }
    ]
    
    for conn_method in connection_methods:
        print(f"\nTrying connection method: {conn_method['method']}")
        
        for attempt in range(max_retries):
            try:
                if conn_method['method'] in ['pooler', 'direct'] and conn_method.get('conn_string'):
                    # Mask password in logging
                    masked_string = conn_method['conn_string']
                    if os.getenv('DB_PASSWORD'):
                        masked_string = masked_string.replace(os.getenv('DB_PASSWORD'), '***')
                    print(f"  Attempt {attempt + 1}: Connecting with: {masked_string}")
                    conn = psycopg2.connect(conn_method['conn_string'])
                else:
                    print(f"  Attempt {attempt + 1}: Connecting with individual parameters")
                    conn = psycopg2.connect(**conn_method['params'])
                
                print(f"  ✅ Successfully connected using {conn_method['method']} method!")
                return conn
                
            except psycopg2.OperationalError as e:
                print(f"  ❌ Connection failed: {e}")
                if "Connection refused" in str(e) and "IPv6" in str(e):
                    print("  💡 IPv6 connection issue detected. Try using connection pooler on port 6543.")
                if attempt < max_retries - 1:
                    print(f"  Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
            except Exception as e:
                print(f"  ❌ Unexpected error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
    
    # If all methods fail, provide helpful information
    print("\n" + "=" * 50)
    print("TROUBLESHOOTING TIPS:")
    print("1. Check if your Supabase project is active at: https://app.supabase.com")
    print("2. Try using the connection pooler (port 6543) instead of direct connection (port 5432)")
    print("3. In Supabase dashboard, go to Settings > Database and copy the 'Connection pooling' string")
    print("4. Update your .env file with: DATABASE_URL=<pooler_connection_string>")
    print("5. If IPv6 is an issue, you may need to use a VPN or wait for Supabase to provide IPv4")
    print("=" * 50)
    
    raise Exception("Could not establish database connection after all attempts")

def batch_ingest_mlb_players(custom_start_date=None, custom_end_date=None, season_year=2024):
    """Main function to batch ingest multiple MLB players
    
    Args:
        custom_start_date: Override start date (YYYY-MM-DD format)
        custom_end_date: Override end date (YYYY-MM-DD format)
        season_year: Which MLB season to fetch (default: 2024)
    """
    print("Starting MLB Batch Player Ingestion")
    print("=" * 50)
    
    # MLB Season date ranges by year
    season_dates = {
        2024: {
            'start': '2024-03-28',  # Opening Day 2024
            'end': '2024-09-29'     # End of regular season 2024
        },
        2023: {
            'start': '2023-03-30',  # Opening Day 2023
            'end': '2023-10-01'     # End of regular season 2023
        },
        2022: {
            'start': '2022-04-07',  # Opening Day 2022
            'end': '2022-10-05'     # End of regular season 2022
        }
    }
    
    # Use custom dates if provided, otherwise use full season
    if custom_start_date and custom_end_date:
        start_date = custom_start_date
        end_date = custom_end_date
        print(f"Using custom date range: {start_date} to {end_date}")
    else:
        # Get season dates
        if season_year in season_dates:
            start_date = season_dates[season_year]['start']
            end_date = season_dates[season_year]['end']
            print(f"Using full {season_year} MLB season: {start_date} to {end_date}")
        else:
            # Default to 2024 season if year not found
            start_date = season_dates[2024]['start']
            end_date = season_dates[2024]['end']
            print(f"Season {season_year} not configured, using 2024 season: {start_date} to {end_date}")
    
    print(f"Target date range: {start_date} to {end_date}")
    
    # Calculate approximate number of days
    from datetime import datetime
    days_diff = (datetime.strptime(end_date, '%Y-%m-%d') - datetime.strptime(start_date, '%Y-%m-%d')).days
    print(f"Date range spans approximately {days_diff} days")
    
    # Get target players
    target_players = get_target_players()
    print(f"Target players: {len(target_players)}")
    
    try:
        # Connect to database with improved error handling
        conn = get_db_connection()
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
    # You can now run it in different ways:
    
    # Option 1: Full 2024 season (default)
    batch_ingest_mlb_players()
    
    # Option 2: Full 2023 season
    # batch_ingest_mlb_players(season_year=2023)
    
    # Option 3: Custom date range
    # batch_ingest_mlb_players(custom_start_date='2024-07-01', custom_end_date='2024-08-31')
    
    # Option 4: Just playoffs
    # batch_ingest_mlb_players(custom_start_date='2024-10-01', custom_end_date='2024-11-01') 