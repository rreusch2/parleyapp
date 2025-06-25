#!/usr/bin/env python3
"""
MLB Player-Game Linking Script
Links MLB players in `players` table to MLB games in `historical_games` table
Focused on the 25,000 MLB records from 2015-2025
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

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MLBPlayerGameLinker:
    """Links MLB players to MLB historical games"""
    
    def __init__(self):
        self.conn = None
        self.connect()
        self.mlb_team_mappings = {}
        self.mlb_players = {}
        
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
    
    def analyze_mlb_teams(self):
        """Analyze MLB team names in both tables"""
        logger.info("⚾ Analyzing MLB team names...")
        
        # Get MLB players and their teams
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT DISTINCT team, COUNT(*) as player_count
                FROM players 
                WHERE sport = 'MLB' AND team IS NOT NULL
                GROUP BY team
                ORDER BY player_count DESC;
            """)
            player_teams = cursor.fetchall()
        
        # Get MLB teams from historical games
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT DISTINCT home_team as team, COUNT(*) as game_count
                FROM historical_games
                WHERE sport = 'MLB'
                GROUP BY home_team
                UNION
                SELECT DISTINCT away_team as team, COUNT(*) as game_count
                FROM historical_games
                WHERE sport = 'MLB'
                GROUP BY away_team
                ORDER BY game_count DESC;
            """)
            game_teams = cursor.fetchall()
        
        logger.info("📊 MLB TEAM ANALYSIS:")
        logger.info("=" * 40)
        
        logger.info(f"\n🧑‍⚾ PLAYERS TABLE ({len(player_teams)} unique teams):")
        for team in player_teams[:10]:  # Top 10
            logger.info(f"  {team['team']}: {team['player_count']} players")
        
        logger.info(f"\n🏟️ HISTORICAL_GAMES ({len(game_teams)} unique teams):")
        for team in game_teams[:10]:  # Top 10
            logger.info(f"  {team['team']}: {team['game_count']} games")
        
        return {
            'player_teams': player_teams,
            'game_teams': game_teams
        }
    
    def create_mlb_team_mappings(self):
        """Create MLB team name standardization mappings"""
        logger.info("🗺️ Creating MLB team name mappings...")
        
        # MLB team mappings - historical_games uses full names
        mlb_mappings = {
            # Full team names (from historical_games) to abbreviations
            'Arizona Diamondbacks': 'ARI',
            'Atlanta Braves': 'ATL',
            'Baltimore Orioles': 'BAL',
            'Boston Red Sox': 'BOS',
            'Chicago Cubs': 'CHC',
            'Chicago White Sox': 'CWS',
            'Cincinnati Reds': 'CIN',
            'Cleveland Guardians': 'CLE',
            'Cleveland Indians': 'CLE',  # Legacy name
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
            
            # Shortened versions that might appear
            'Athletics': 'OAK',
            'Guardians': 'CLE',
            'White Sox': 'CWS',
            'Red Sox': 'BOS',
            'Blue Jays': 'TOR',
            
            # Abbreviations to abbreviations (for consistency)
            'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BOS': 'BOS',
            'CHC': 'CHC', 'CWS': 'CWS', 'CIN': 'CIN', 'CLE': 'CLE',
            'COL': 'COL', 'DET': 'DET', 'HOU': 'HOU', 'KC': 'KC',
            'LAA': 'LAA', 'LAD': 'LAD', 'MIA': 'MIA', 'MIL': 'MIL',
            'MIN': 'MIN', 'NYM': 'NYM', 'NYY': 'NYY', 'OAK': 'OAK',
            'PHI': 'PHI', 'PIT': 'PIT', 'SD': 'SD', 'SF': 'SF',
            'SEA': 'SEA', 'STL': 'STL', 'TB': 'TB', 'TEX': 'TEX',
            'TOR': 'TOR', 'WSN': 'WSN'
        }
        
        self.mlb_team_mappings = mlb_mappings
        logger.info(f"✅ Created mappings for {len(mlb_mappings)} MLB team variations")
        
        return mlb_mappings
    
    def standardize_mlb_team(self, team_name: str) -> Optional[str]:
        """Standardize an MLB team name"""
        if not team_name:
            return None
            
        # Direct mapping
        if team_name in self.mlb_team_mappings:
            return self.mlb_team_mappings[team_name]
        
        # Fuzzy matching
        team_lower = team_name.lower()
        for full_name, abbrev in self.mlb_team_mappings.items():
            if full_name.lower() in team_lower or team_lower in full_name.lower():
                return abbrev
        
        # Return original if no mapping found
        logger.warning(f"⚠️ No MLB mapping found for: {team_name}")
        return team_name
    
    def load_mlb_players(self):
        """Load all MLB players and standardize their teams"""
        logger.info("👥 Loading MLB players...")
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT id, name, team, position
                FROM players
                WHERE sport = 'MLB' AND team IS NOT NULL
                ORDER BY team, name;
            """)
            players = cursor.fetchall()
        
        mlb_rosters = {}
        player_lookup = {}
        
        for player in players:
            original_team = player['team']
            standardized_team = self.standardize_mlb_team(original_team)
            
            player_info = {
                'id': player['id'],
                'name': player['name'],
                'original_team': original_team,
                'standardized_team': standardized_team,
                'position': player['position']
            }
            
            # Player lookup by ID
            player_lookup[player['id']] = player_info
            
            # Team rosters
            if standardized_team not in mlb_rosters:
                mlb_rosters[standardized_team] = []
            mlb_rosters[standardized_team].append(player_info)
        
        self.mlb_players = {
            'lookup': player_lookup,
            'rosters': mlb_rosters
        }
        
        logger.info(f"✅ Loaded {len(player_lookup)} MLB players across {len(mlb_rosters)} teams")
        
        # Show roster sizes
        for team, roster in list(mlb_rosters.items())[:5]:
            logger.info(f"  {team}: {len(roster)} players")
        
        return self.mlb_players
    
    def create_mlb_game_player_table(self):
        """Create table for MLB game-player combinations"""
        logger.info("📊 Creating mlb_game_players table...")
        
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS mlb_game_players (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            game_id UUID REFERENCES historical_games(id),
            player_id UUID REFERENCES players(id),
            is_home_team BOOLEAN NOT NULL,
            game_date TIMESTAMPTZ NOT NULL,
            home_team VARCHAR(100) NOT NULL,
            away_team VARCHAR(100) NOT NULL,
            home_team_abbrev VARCHAR(10),
            away_team_abbrev VARCHAR(10),
            player_team_abbrev VARCHAR(10),
            
            -- Prediction columns for future use
            predicted_hits FLOAT,
            predicted_home_runs FLOAT,
            predicted_rbis FLOAT,
            predicted_strikeouts FLOAT,
            confidence_score FLOAT,
            
            -- Actual results (to be filled in later)
            actual_hits INTEGER,
            actual_home_runs INTEGER,
            actual_rbis INTEGER,
            actual_strikeouts INTEGER,
            
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            
            UNIQUE(game_id, player_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_mlb_game_players_date 
        ON mlb_game_players(game_date);
        
        CREATE INDEX IF NOT EXISTS idx_mlb_game_players_player 
        ON mlb_game_players(player_id);
        
        CREATE INDEX IF NOT EXISTS idx_mlb_game_players_team 
        ON mlb_game_players(player_team_abbrev);
        """
        
        with self.conn.cursor() as cursor:
            cursor.execute(create_table_sql)
            self.conn.commit()
        
        logger.info("✅ Created mlb_game_players table with prediction columns")
    
    def link_players_to_recent_games(self, days_back: int = 30):
        """Link MLB players to recent MLB games"""
        logger.info(f"🔗 Linking players to MLB games from last {days_back} days...")
        
        # Get recent MLB games
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT id, external_game_id, home_team, away_team, game_date, home_score, away_score
                FROM historical_games
                WHERE sport = 'MLB' 
                AND game_date >= %s
                ORDER BY game_date DESC
                LIMIT 500;
            """, (datetime.now() - timedelta(days=days_back),))
            recent_games = cursor.fetchall()
        
        logger.info(f"📋 Found {len(recent_games)} recent MLB games")
        
        # Clear existing recent data
        with self.conn.cursor() as cursor:
            cursor.execute("""
                DELETE FROM mlb_game_players 
                WHERE game_date >= %s;
            """, (datetime.now() - timedelta(days=days_back),))
            self.conn.commit()
        
        # Link players to games
        insert_sql = """
        INSERT INTO mlb_game_players 
        (game_id, player_id, is_home_team, game_date, home_team, away_team, 
         home_team_abbrev, away_team_abbrev, player_team_abbrev)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (game_id, player_id) DO NOTHING;
        """
        
        records_to_insert = []
        games_with_players = 0
        
        for game in recent_games:
            home_team_full = game['home_team']
            away_team_full = game['away_team']
            home_team_abbrev = self.standardize_mlb_team(home_team_full)
            away_team_abbrev = self.standardize_mlb_team(away_team_full)
            
            game_has_players = False
            
            # Home team players
            if home_team_abbrev in self.mlb_players['rosters']:
                for player in self.mlb_players['rosters'][home_team_abbrev]:
                    records_to_insert.append((
                        game['id'],
                        player['id'],
                        True,  # is_home_team
                        game['game_date'],
                        home_team_full,
                        away_team_full,
                        home_team_abbrev,
                        away_team_abbrev,
                        home_team_abbrev
                    ))
                    game_has_players = True
            
            # Away team players
            if away_team_abbrev in self.mlb_players['rosters']:
                for player in self.mlb_players['rosters'][away_team_abbrev]:
                    records_to_insert.append((
                        game['id'],
                        player['id'],
                        False,  # is_home_team
                        game['game_date'],
                        home_team_full,
                        away_team_full,
                        home_team_abbrev,
                        away_team_abbrev,
                        away_team_abbrev
                    ))
                    game_has_players = True
            
            if game_has_players:
                games_with_players += 1
        
        # Insert the records
        if records_to_insert:
            with self.conn.cursor() as cursor:
                cursor.executemany(insert_sql, records_to_insert)
                self.conn.commit()
            
            logger.info(f"✅ Linked {len(records_to_insert):,} player-game combinations")
            logger.info(f"📊 {games_with_players}/{len(recent_games)} games have linked players")
        else:
            logger.warning("⚠️ No player-game links created")
        
        return len(records_to_insert)
    
    def create_mlb_team_lookup_table(self):
        """Create MLB team standardization lookup table"""
        logger.info("🏟️ Creating mlb_team_lookup table...")
        
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS mlb_team_lookup (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_name_original VARCHAR(100) NOT NULL UNIQUE,
            team_name_abbrev VARCHAR(10) NOT NULL,
            team_name_full VARCHAR(100),
            city VARCHAR(50),
            mascot VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_mlb_team_lookup_abbrev 
        ON mlb_team_lookup(team_name_abbrev);
        """
        
        with self.conn.cursor() as cursor:
            cursor.execute(create_table_sql)
            self.conn.commit()
        
        # Populate with mappings
        insert_sql = """
        INSERT INTO mlb_team_lookup 
        (team_name_original, team_name_abbrev, team_name_full)
        VALUES (%s, %s, %s)
        ON CONFLICT (team_name_original) DO UPDATE SET
        team_name_abbrev = EXCLUDED.team_name_abbrev,
        team_name_full = EXCLUDED.team_name_full;
        """
        
        records = []
        for original, abbrev in self.mlb_team_mappings.items():
            # Skip abbreviations mapping to themselves
            if original != abbrev:
                records.append((original, abbrev, original))
        
        with self.conn.cursor() as cursor:
            cursor.executemany(insert_sql, records)
            self.conn.commit()
        
        logger.info(f"✅ Created mlb_team_lookup with {len(records)} team mappings")
    
    def generate_sample_predictions(self):
        """Generate sample predictions for testing the orchestrator"""
        logger.info("🎯 Generating sample predictions...")
        
        # Get some recent player-game combinations
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT mgp.*, p.name as player_name, p.position
                FROM mlb_game_players mgp
                JOIN players p ON mgp.player_id = p.id
                WHERE mgp.game_date >= %s
                AND mgp.predicted_hits IS NULL
                ORDER BY mgp.game_date DESC
                LIMIT 100;
            """, (datetime.now() - timedelta(days=7),))
            recent_records = cursor.fetchall()
        
        if not recent_records:
            logger.warning("⚠️ No recent player-game records found for predictions")
            return
        
        # Generate mock predictions (in real use, this would call your ML models)
        import random
        
        update_sql = """
        UPDATE mlb_game_players 
        SET predicted_hits = %s,
            predicted_home_runs = %s,
            predicted_rbis = %s,
            predicted_strikeouts = %s,
            confidence_score = %s,
            updated_at = NOW()
        WHERE id = %s;
        """
        
        updates = []
        for record in recent_records:
            # Mock predictions based on position
            if record['position'] in ['OF', 'Outfield']:  # Outfielders
                hits = round(random.uniform(0.8, 2.2), 2)
                hrs = round(random.uniform(0.0, 0.8), 2)
                rbis = round(random.uniform(0.5, 1.8), 2)
                ks = round(random.uniform(0.8, 2.0), 2)
            elif record['position'] in ['IF', 'Infield']:  # Infielders
                hits = round(random.uniform(0.7, 2.0), 2)
                hrs = round(random.uniform(0.0, 0.6), 2)
                rbis = round(random.uniform(0.4, 1.6), 2)
                ks = round(random.uniform(0.9, 2.2), 2)
            else:  # Default
                hits = round(random.uniform(0.6, 1.8), 2)
                hrs = round(random.uniform(0.0, 0.5), 2)
                rbis = round(random.uniform(0.3, 1.4), 2)
                ks = round(random.uniform(1.0, 2.5), 2)
            
            confidence = round(random.uniform(0.65, 0.85), 3)
            
            updates.append((hits, hrs, rbis, ks, confidence, record['id']))
        
        with self.conn.cursor() as cursor:
            cursor.executemany(update_sql, updates)
            self.conn.commit()
        
        logger.info(f"✅ Generated sample predictions for {len(updates)} player-game combinations")
        
        # Show sample predictions
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT p.name, mgp.home_team, mgp.away_team, mgp.is_home_team,
                       mgp.predicted_hits, mgp.predicted_home_runs, mgp.confidence_score
                FROM mlb_game_players mgp
                JOIN players p ON mgp.player_id = p.id
                WHERE mgp.predicted_hits IS NOT NULL
                ORDER BY mgp.confidence_score DESC
                LIMIT 5;
            """)
            sample_predictions = cursor.fetchall()
        
        logger.info("🎯 Sample predictions:")
        for pred in sample_predictions:
            team_side = "Home" if pred['is_home_team'] else "Away"
            logger.info(f"  {pred['name']} ({team_side}): {pred['predicted_hits']} hits, "
                       f"{pred['predicted_home_runs']} HRs (confidence: {pred['confidence_score']})")

def main():
    """Main function to run MLB player-game linking"""
    logger.info("⚾ Starting MLB Player-Game Linking Process")
    logger.info("=" * 50)
    logger.info("📊 Working with 25,000+ MLB games from 2015-2025")
    
    linker = MLBPlayerGameLinker()
    
    # Step 1: Analyze MLB teams
    logger.info("\n📊 Step 1: Analyzing MLB team names...")
    team_analysis = linker.analyze_mlb_teams()
    
    # Step 2: Create team mappings
    logger.info("\n🗺️ Step 2: Creating MLB team standardization...")
    mappings = linker.create_mlb_team_mappings()
    
    # Step 3: Load MLB players
    logger.info("\n👥 Step 3: Loading MLB players...")
    players = linker.load_mlb_players()
    
    # Step 4: Create database tables
    logger.info("\n📊 Step 4: Creating database tables...")
    linker.create_mlb_game_player_table()
    linker.create_mlb_team_lookup_table()
    
    # Step 5: Link players to recent games
    logger.info("\n🔗 Step 5: Linking players to recent games...")
    linked_count = linker.link_players_to_recent_games(days_back=30)
    
    # Step 6: Generate sample predictions
    logger.info("\n🎯 Step 6: Generating sample predictions...")
    linker.generate_sample_predictions()
    
    # Final summary
    logger.info("\n" + "=" * 50)
    logger.info("⚾ MLB PLAYER-GAME LINKING COMPLETE!")
    logger.info("=" * 50)
    
    # Show final stats
    with linker.conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT COUNT(*) as count FROM mlb_game_players;")
        total_links = cursor.fetchone()['count']
    
    with linker.conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT COUNT(*) as count FROM mlb_team_lookup;")
        team_mappings = cursor.fetchone()['count']
    
    with linker.conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT COUNT(*) as count FROM mlb_game_players WHERE predicted_hits IS NOT NULL;")
        predictions = cursor.fetchone()['count']
    
    logger.info(f"📊 Results:")
    logger.info(f"  mlb_game_players: {total_links:,} player-game links")
    logger.info(f"  mlb_team_lookup: {team_mappings} team mappings")
    logger.info(f"  predictions generated: {predictions:,}")
    
    logger.info(f"\n🚀 Next steps:")
    logger.info(f"  1. Update orchestrator to query mlb_game_players table")
    logger.info(f"  2. Connect your trained MLB models to generate real predictions")
    logger.info(f"  3. Test predictions with upcoming MLB games")
    logger.info(f"  4. Set up automated daily linking for new games")
    
    linker.conn.close()

if __name__ == "__main__":
    main() 