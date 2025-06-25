#!/usr/bin/env python3
"""
Link Players to Games Script
Connects players in `players` table to games in `sports_events` and `historical_games` tables
Handles team name standardization and creates lookup tables for player prop predictions
"""

import os
import sys
import logging
import json
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import re

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PlayerGameLinker:
    """Links players to games across different table formats"""
    
    def __init__(self):
        self.conn = None
        self.connect()
        self.team_name_mappings = {}
        self.player_team_cache = {}
        
    def connect(self):
        """Connect to Supabase PostgreSQL"""
        try:
            self.conn = psycopg2.connect(
                host=os.getenv('DB_HOST'),
                database=os.getenv('DB_NAME'),
                user=os.getenv('DB_USER'),
                password=os.getenv('DB_PASSWORD'),
                port=int(os.getenv('DB_PORT', 5432)),
                sslmode='require'
            )
            logger.info("✅ Connected to Supabase successfully")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Supabase: {e}")
            raise
    
    def analyze_team_name_formats(self):
        """Analyze team name formats across all tables"""
        logger.info("🔍 Analyzing team name formats across tables...")
        
        # Get team names from players table
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT DISTINCT team, sport, COUNT(*) as player_count
                FROM players 
                WHERE team IS NOT NULL
                GROUP BY team, sport
                ORDER BY sport, player_count DESC;
            """)
            player_teams = cursor.fetchall()
        
        # Get team names from historical_games
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT DISTINCT home_team as team, sport, COUNT(*) as game_count
                FROM historical_games
                GROUP BY home_team, sport
                UNION
                SELECT DISTINCT away_team as team, sport, COUNT(*) as game_count
                FROM historical_games
                GROUP BY away_team, sport
                ORDER BY sport, game_count DESC;
            """)
            game_teams = cursor.fetchall()
        
        # Get team names from sports_events (if any)
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT DISTINCT home_team as team, sport, COUNT(*) as event_count
                FROM sports_events
                WHERE home_team IS NOT NULL
                GROUP BY home_team, sport
                UNION
                SELECT DISTINCT away_team as team, sport, COUNT(*) as event_count
                FROM sports_events
                WHERE away_team IS NOT NULL
                GROUP BY away_team, sport
                ORDER BY sport, event_count DESC;
            """)
            event_teams = cursor.fetchall()
        
        logger.info("📊 TEAM NAME ANALYSIS:")
        logger.info("=" * 50)
        
        # Analyze by sport
        for sport in ['NBA', 'MLB', 'NFL', 'NHL']:
            logger.info(f"\n🏀 {sport} TEAMS:")
            
            # Players table teams
            player_sport_teams = [t for t in player_teams if t['sport'] == sport]
            if player_sport_teams:
                logger.info(f"  Players table ({len(player_sport_teams)} teams):")
                for team in player_sport_teams[:5]:  # Show top 5
                    logger.info(f"    {team['team']} ({team['player_count']} players)")
            
            # Historical games teams
            game_sport_teams = [t for t in game_teams if t['sport'] == sport]
            if game_sport_teams:
                logger.info(f"  Historical games ({len(game_sport_teams)} teams):")
                for team in game_sport_teams[:5]:  # Show top 5
                    logger.info(f"    {team['team']} ({team['game_count']} games)")
            
            # Sports events teams
            event_sport_teams = [t for t in event_teams if t['sport'] == sport]
            if event_sport_teams:
                logger.info(f"  Sports events ({len(event_sport_teams)} teams):")
                for team in event_sport_teams[:5]:  # Show top 5
                    logger.info(f"    {team['team']} ({team['event_count']} events)")
        
        return {
            'player_teams': player_teams,
            'game_teams': game_teams,
            'event_teams': event_teams
        }
    
    def create_team_name_mappings(self):
        """Create standardized team name mappings"""
        logger.info("🔧 Creating team name standardization mappings...")
        
        # NBA team mappings (players table uses various formats)
        nba_mappings = {
            # Full names to abbreviations
            'Los Angeles Lakers': 'LAL',
            'Golden State Warriors': 'GSW',
            'Boston Celtics': 'BOS',
            'Miami Heat': 'MIA',
            'Milwaukee Bucks': 'MIL',
            'Phoenix Suns': 'PHX',
            'Philadelphia 76ers': 'PHI',
            'Brooklyn Nets': 'BKN',
            'Denver Nuggets': 'DEN',
            'Memphis Grizzlies': 'MEM',
            'Dallas Mavericks': 'DAL',
            'New Orleans Pelicans': 'NOP',
            'Sacramento Kings': 'SAC',
            'Portland Trail Blazers': 'POR',
            'Utah Jazz': 'UTA',
            'Oklahoma City Thunder': 'OKC',
            'San Antonio Spurs': 'SAS',
            'Minnesota Timberwolves': 'MIN',
            'Los Angeles Clippers': 'LAC',
            'Houston Rockets': 'HOU',
            'Atlanta Hawks': 'ATL',
            'Charlotte Hornets': 'CHA',
            'Chicago Bulls': 'CHI',
            'Cleveland Cavaliers': 'CLE',
            'Detroit Pistons': 'DET',
            'Indiana Pacers': 'IND',
            'New York Knicks': 'NYK',
            'Orlando Magic': 'ORL',
            'Toronto Raptors': 'TOR',
            'Washington Wizards': 'WAS',
            
            # Abbreviations to abbreviations (standardize)
            'PHX': 'PHX',
            'LAL': 'LAL',
            'GSW': 'GSW',
            'BOS': 'BOS',
            'MIA': 'MIA',
            'MIL': 'MIL',
            'PHI': 'PHI',
            'BKN': 'BKN',
            'DEN': 'DEN',
            'MEM': 'MEM',
            'DAL': 'DAL',
            'NOP': 'NOP',
            'SAC': 'SAC',
            'POR': 'POR',
            'UTA': 'UTA',
            'OKC': 'OKC',
            'SAS': 'SAS',
            'MIN': 'MIN',
            'LAC': 'LAC',
            'HOU': 'HOU',
            'ATL': 'ATL',
            'CHA': 'CHA',
            'CHI': 'CHI',
            'CLE': 'CLE',
            'DET': 'DET',
            'IND': 'IND',
            'NYK': 'NYK',
            'ORL': 'ORL',
            'TOR': 'TOR',
            'WAS': 'WAS'
        }
        
        # MLB team mappings (historical_games uses full names)
        mlb_mappings = {
            # Full names to abbreviations
            'Arizona Diamondbacks': 'ARI',
            'Atlanta Braves': 'ATL',
            'Baltimore Orioles': 'BAL',
            'Boston Red Sox': 'BOS',
            'Chicago Cubs': 'CHC',
            'Chicago White Sox': 'CWS',
            'Cincinnati Reds': 'CIN',
            'Cleveland Guardians': 'CLE',
            'Colorado Rockies': 'COL',
            'Detroit Tigers': 'DET',
            'Houston Astros': 'HOU',
            'Kansas City Royals': 'KC',
            'Los Angeles Angels': 'LAA',
            'Los Angeles Dodgers': 'LAD',
            'Miami Marlins': 'MIA',
            'Milwaukee Brewers': 'MIL',
            'Minnesota Twins': 'MIN',
            'New York Mets': 'NYM',
            'New York Yankees': 'NYY',
            'Oakland Athletics': 'OAK',
            'Philadelphia Phillies': 'PHI',
            'Pittsburgh Pirates': 'PIT',
            'San Diego Padres': 'SD',
            'San Francisco Giants': 'SF',
            'Seattle Mariners': 'SEA',
            'St. Louis Cardinals': 'STL',
            'Tampa Bay Rays': 'TB',
            'Texas Rangers': 'TEX',
            'Toronto Blue Jays': 'TOR',
            'Washington Nationals': 'WSN',
            
            # Alternative names
            'Athletics': 'OAK',
            'Guardians': 'CLE',
            'White Sox': 'CWS'
        }
        
        self.team_name_mappings = {
            'NBA': nba_mappings,
            'MLB': mlb_mappings
        }
        
        logger.info(f"✅ Created mappings for {len(nba_mappings)} NBA teams and {len(mlb_mappings)} MLB teams")
        
        return self.team_name_mappings
    
    def standardize_team_name(self, team_name: str, sport: str) -> Optional[str]:
        """Standardize a team name using the mappings"""
        if not team_name or sport not in self.team_name_mappings:
            return None
        
        # Direct mapping
        if team_name in self.team_name_mappings[sport]:
            return self.team_name_mappings[sport][team_name]
        
        # Fuzzy matching for edge cases
        team_lower = team_name.lower()
        for full_name, abbrev in self.team_name_mappings[sport].items():
            if full_name.lower() in team_lower or team_lower in full_name.lower():
                return abbrev
        
        # Return original if no mapping found
        logger.warning(f"⚠️ No mapping found for {sport} team: {team_name}")
        return team_name
    
    def create_player_team_lookup(self):
        """Create a lookup table for players and their current teams"""
        logger.info("📋 Creating player-team lookup table...")
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT id, name, team, sport, position
                FROM players
                WHERE team IS NOT NULL
                ORDER BY sport, team, name;
            """)
            players = cursor.fetchall()
        
        player_lookup = {}
        team_rosters = {}
        
        for player in players:
            sport = player['sport']
            original_team = player['team']
            standardized_team = self.standardize_team_name(original_team, sport)
            
            player_info = {
                'id': player['id'],
                'name': player['name'],
                'original_team': original_team,
                'standardized_team': standardized_team,
                'sport': sport,
                'position': player['position']
            }
            
            # Player lookup by ID
            player_lookup[player['id']] = player_info
            
            # Team rosters
            if sport not in team_rosters:
                team_rosters[sport] = {}
            if standardized_team not in team_rosters[sport]:
                team_rosters[sport][standardized_team] = []
            team_rosters[sport][standardized_team].append(player_info)
        
        self.player_team_cache = {
            'players': player_lookup,
            'rosters': team_rosters
        }
        
        logger.info(f"✅ Created lookup for {len(player_lookup)} players across {len(team_rosters)} sports")
        
        # Show roster sizes
        for sport, teams in team_rosters.items():
            logger.info(f"  {sport}: {len(teams)} teams")
            for team, roster in list(teams.items())[:3]:  # Show 3 teams
                logger.info(f"    {team}: {len(roster)} players")
        
        return self.player_team_cache
    
    def link_players_to_historical_games(self):
        """Link players to historical games based on team matchups"""
        logger.info("🔗 Linking players to historical games...")
        
        if not self.player_team_cache:
            self.create_player_team_lookup()
        
        # Get recent historical games
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT id, external_game_id, sport, home_team, away_team, game_date
                FROM historical_games
                WHERE game_date >= %s
                ORDER BY game_date DESC
                LIMIT 100;
            """, (datetime.now() - timedelta(days=30),))
            recent_games = cursor.fetchall()
        
        linked_games = []
        
        for game in recent_games:
            sport = game['sport']
            home_team = self.standardize_team_name(game['home_team'], sport)
            away_team = self.standardize_team_name(game['away_team'], sport)
            
            game_info = {
                'game_id': game['id'],
                'external_game_id': game['external_game_id'],
                'sport': sport,
                'home_team': game['home_team'],
                'away_team': game['away_team'],
                'home_team_std': home_team,
                'away_team_std': away_team,
                'game_date': game['game_date'],
                'players': {
                    'home': [],
                    'away': []
                }
            }
            
            # Link players to this game
            if sport in self.player_team_cache['rosters']:
                rosters = self.player_team_cache['rosters'][sport]
                
                # Home team players
                if home_team in rosters:
                    game_info['players']['home'] = rosters[home_team]
                
                # Away team players
                if away_team in rosters:
                    game_info['players']['away'] = rosters[away_team]
            
            linked_games.append(game_info)
        
        logger.info(f"✅ Linked {len(recent_games)} recent games to player rosters")
        
        # Show sample linkage
        for game in linked_games[:3]:
            home_count = len(game['players']['home'])
            away_count = len(game['players']['away'])
            logger.info(f"  {game['home_team']} ({home_count} players) vs {game['away_team']} ({away_count} players)")
        
        return linked_games
    
    def create_game_player_predictions_table(self):
        """Create a table to store game-player combinations for predictions"""
        logger.info("📊 Creating game_player_predictions table...")
        
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS game_player_predictions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            game_id UUID REFERENCES historical_games(id),
            player_id UUID REFERENCES players(id),
            sport VARCHAR(10) NOT NULL,
            is_home_team BOOLEAN NOT NULL,
            game_date TIMESTAMPTZ NOT NULL,
            predictions JSONB, -- Store model predictions
            actual_stats JSONB, -- Store actual performance if available
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            
            UNIQUE(game_id, player_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_game_player_predictions_game_date 
        ON game_player_predictions(game_date);
        
        CREATE INDEX IF NOT EXISTS idx_game_player_predictions_sport 
        ON game_player_predictions(sport);
        
        CREATE INDEX IF NOT EXISTS idx_game_player_predictions_player 
        ON game_player_predictions(player_id);
        """
        
        with self.conn.cursor() as cursor:
            cursor.execute(create_table_sql)
            self.conn.commit()
        
        logger.info("✅ Created game_player_predictions table with indexes")
    
    def populate_game_player_predictions(self, linked_games: List[Dict]):
        """Populate the game_player_predictions table"""
        logger.info("📥 Populating game_player_predictions table...")
        
        # Clear existing recent data
        with self.conn.cursor() as cursor:
            cursor.execute("""
                DELETE FROM game_player_predictions 
                WHERE game_date >= %s;
            """, (datetime.now() - timedelta(days=30),))
            self.conn.commit()
        
        insert_sql = """
        INSERT INTO game_player_predictions 
        (game_id, player_id, sport, is_home_team, game_date)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (game_id, player_id) DO NOTHING;
        """
        
        records_to_insert = []
        
        for game in linked_games:
            # Home team players
            for player in game['players']['home']:
                records_to_insert.append((
                    game['game_id'],
                    player['id'],
                    game['sport'],
                    True,  # is_home_team
                    game['game_date']
                ))
            
            # Away team players
            for player in game['players']['away']:
                records_to_insert.append((
                    game['game_id'],
                    player['id'],
                    game['sport'],
                    False,  # is_home_team
                    game['game_date']
                ))
        
        if records_to_insert:
            with self.conn.cursor() as cursor:
                cursor.executemany(insert_sql, records_to_insert)
                self.conn.commit()
            
            logger.info(f"✅ Inserted {len(records_to_insert)} game-player combinations")
        else:
            logger.warning("⚠️ No records to insert")
    
    def create_team_lookup_table(self):
        """Create a standardized team lookup table"""
        logger.info("🏟️ Creating team_lookup table...")
        
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS team_lookup (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sport VARCHAR(10) NOT NULL,
            team_name_original VARCHAR(100) NOT NULL,
            team_name_standardized VARCHAR(10) NOT NULL,
            team_name_full VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            
            UNIQUE(sport, team_name_original)
        );
        
        CREATE INDEX IF NOT EXISTS idx_team_lookup_sport 
        ON team_lookup(sport);
        
        CREATE INDEX IF NOT EXISTS idx_team_lookup_standardized 
        ON team_lookup(team_name_standardized);
        """
        
        with self.conn.cursor() as cursor:
            cursor.execute(create_table_sql)
            self.conn.commit()
        
        # Populate with mappings
        insert_sql = """
        INSERT INTO team_lookup 
        (sport, team_name_original, team_name_standardized, team_name_full)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (sport, team_name_original) DO UPDATE SET
        team_name_standardized = EXCLUDED.team_name_standardized,
        team_name_full = EXCLUDED.team_name_full;
        """
        
        records = []
        for sport, mappings in self.team_name_mappings.items():
            for original, standardized in mappings.items():
                records.append((sport, original, standardized, original))
        
        with self.conn.cursor() as cursor:
            cursor.executemany(insert_sql, records)
            self.conn.commit()
        
        logger.info(f"✅ Created team_lookup table with {len(records)} team mappings")

def main():
    """Main function to run the player-game linking process"""
    logger.info("🚀 Starting Player-Game Linking Process")
    logger.info("=" * 60)
    
    linker = PlayerGameLinker()
    
    # Step 1: Analyze current team name formats
    logger.info("\n📊 Step 1: Analyzing team name formats...")
    team_analysis = linker.analyze_team_name_formats()
    
    # Step 2: Create team name mappings
    logger.info("\n🔧 Step 2: Creating team name standardization...")
    mappings = linker.create_team_name_mappings()
    
    # Step 3: Create player-team lookup
    logger.info("\n📋 Step 3: Creating player-team lookup...")
    player_cache = linker.create_player_team_lookup()
    
    # Step 4: Link players to recent games
    logger.info("\n🔗 Step 4: Linking players to historical games...")
    linked_games = linker.link_players_to_historical_games()
    
    # Step 5: Create database tables
    logger.info("\n📊 Step 5: Creating database tables...")
    linker.create_game_player_predictions_table()
    linker.create_team_lookup_table()
    
    # Step 6: Populate game-player predictions
    logger.info("\n📥 Step 6: Populating game-player predictions...")
    linker.populate_game_player_predictions(linked_games)
    
    # Final summary
    logger.info("\n" + "=" * 60)
    logger.info("🎉 PLAYER-GAME LINKING COMPLETE!")
    logger.info("=" * 60)
    logger.info("✅ Created team name standardization mappings")
    logger.info("✅ Created player-team lookup cache")
    logger.info("✅ Linked players to recent historical games")
    logger.info("✅ Created game_player_predictions table")
    logger.info("✅ Created team_lookup table")
    
    logger.info("\n📋 Next steps:")
    logger.info("  1. Use game_player_predictions for ML predictions")
    logger.info("  2. Update orchestrator to query this table")
    logger.info("  3. Generate player prop predictions for upcoming games")
    logger.info("  4. Monitor and update team rosters periodically")
    
    # Show final stats
    with linker.conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT COUNT(*) as count FROM game_player_predictions;")
        prediction_count = cursor.fetchone()['count']
    
    with linker.conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT COUNT(*) as count FROM team_lookup;")
        team_count = cursor.fetchone()['count']
    
    logger.info(f"\n📊 Database populated:")
    logger.info(f"  game_player_predictions: {prediction_count:,} records")
    logger.info(f"  team_lookup: {team_count} team mappings")
    
    linker.conn.close()

if __name__ == "__main__":
    main() 