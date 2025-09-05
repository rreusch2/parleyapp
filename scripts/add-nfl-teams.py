#!/usr/bin/env python3
"""
Add NFL Teams to Database
Adds all 32 NFL teams to the teams table
"""

import os
import sys
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# All 32 NFL teams with standard abbreviations
NFL_TEAMS = [
    {"name": "Arizona Cardinals", "abbreviation": "ARI", "city": "Arizona", "conference": "NFC", "division": "West"},
    {"name": "Atlanta Falcons", "abbreviation": "ATL", "city": "Atlanta", "conference": "NFC", "division": "South"},
    {"name": "Baltimore Ravens", "abbreviation": "BAL", "city": "Baltimore", "conference": "AFC", "division": "North"},
    {"name": "Buffalo Bills", "abbreviation": "BUF", "city": "Buffalo", "conference": "AFC", "division": "East"},
    {"name": "Carolina Panthers", "abbreviation": "CAR", "city": "Carolina", "conference": "NFC", "division": "South"},
    {"name": "Chicago Bears", "abbreviation": "CHI", "city": "Chicago", "conference": "NFC", "division": "North"},
    {"name": "Cincinnati Bengals", "abbreviation": "CIN", "city": "Cincinnati", "conference": "AFC", "division": "North"},
    {"name": "Cleveland Browns", "abbreviation": "CLE", "city": "Cleveland", "conference": "AFC", "division": "North"},
    {"name": "Dallas Cowboys", "abbreviation": "DAL", "city": "Dallas", "conference": "NFC", "division": "East"},
    {"name": "Denver Broncos", "abbreviation": "DEN", "city": "Denver", "conference": "AFC", "division": "West"},
    {"name": "Detroit Lions", "abbreviation": "DET", "city": "Detroit", "conference": "NFC", "division": "North"},
    {"name": "Green Bay Packers", "abbreviation": "GB", "city": "Green Bay", "conference": "NFC", "division": "North"},
    {"name": "Houston Texans", "abbreviation": "HOU", "city": "Houston", "conference": "AFC", "division": "South"},
    {"name": "Indianapolis Colts", "abbreviation": "IND", "city": "Indianapolis", "conference": "AFC", "division": "South"},
    {"name": "Jacksonville Jaguars", "abbreviation": "JAX", "city": "Jacksonville", "conference": "AFC", "division": "South"},
    {"name": "Kansas City Chiefs", "abbreviation": "KC", "city": "Kansas City", "conference": "AFC", "division": "West"},
    {"name": "Las Vegas Raiders", "abbreviation": "LV", "city": "Las Vegas", "conference": "AFC", "division": "West"},
    {"name": "Los Angeles Chargers", "abbreviation": "LAC", "city": "Los Angeles", "conference": "AFC", "division": "West"},
    {"name": "Los Angeles Rams", "abbreviation": "LAR", "city": "Los Angeles", "conference": "NFC", "division": "West"},
    {"name": "Miami Dolphins", "abbreviation": "MIA", "city": "Miami", "conference": "AFC", "division": "East"},
    {"name": "Minnesota Vikings", "abbreviation": "MIN", "city": "Minnesota", "conference": "NFC", "division": "North"},
    {"name": "New England Patriots", "abbreviation": "NE", "city": "New England", "conference": "AFC", "division": "East"},
    {"name": "New Orleans Saints", "abbreviation": "NO", "city": "New Orleans", "conference": "NFC", "division": "South"},
    {"name": "New York Giants", "abbreviation": "NYG", "city": "New York", "conference": "NFC", "division": "East"},
    {"name": "New York Jets", "abbreviation": "NYJ", "city": "New York", "conference": "AFC", "division": "East"},
    {"name": "Philadelphia Eagles", "abbreviation": "PHI", "city": "Philadelphia", "conference": "NFC", "division": "East"},
    {"name": "Pittsburgh Steelers", "abbreviation": "PIT", "city": "Pittsburgh", "conference": "AFC", "division": "North"},
    {"name": "San Francisco 49ers", "abbreviation": "SF", "city": "San Francisco", "conference": "NFC", "division": "West"},
    {"name": "Seattle Seahawks", "abbreviation": "SEA", "city": "Seattle", "conference": "NFC", "division": "West"},
    {"name": "Tampa Bay Buccaneers", "abbreviation": "TB", "city": "Tampa Bay", "conference": "NFC", "division": "South"},
    {"name": "Tennessee Titans", "abbreviation": "TEN", "city": "Tennessee", "conference": "AFC", "division": "South"},
    {"name": "Washington Commanders", "abbreviation": "WAS", "city": "Washington", "conference": "NFC", "division": "East"}
]

def main():
    """Add NFL teams to database"""
    try:
        # Initialize Supabase client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not supabase_key:
            logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
            return False
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Check if NFL teams already exist
        existing_response = supabase.table('teams').select('team_abbreviation').eq('sport_key', 'americanfootball_nfl').execute()
        existing_teams = {team['team_abbreviation'] for team in existing_response.data}
        
        logger.info(f"Found {len(existing_teams)} existing NFL teams")
        
        # Prepare teams to insert
        teams_to_insert = []
        for team in NFL_TEAMS:
            if team['abbreviation'] not in existing_teams:
                team_data = {
                    'sport_key': 'americanfootball_nfl',
                    'team_key': team['abbreviation'].lower(),
                    'team_name': team['name'],
                    'team_abbreviation': team['abbreviation'],
                    'city': team['city'],
                    'conference': team['conference'],
                    'division': team['division'],
                    'metadata': {
                        'sport': 'NFL',
                        'league': 'National Football League'
                    }
                }
                teams_to_insert.append(team_data)
        
        if not teams_to_insert:
            logger.info("All NFL teams already exist in database")
            return True
        
        # Insert teams
        logger.info(f"Inserting {len(teams_to_insert)} NFL teams...")
        response = supabase.table('teams').insert(teams_to_insert).execute()
        
        if response.data:
            logger.info(f"Successfully inserted {len(response.data)} NFL teams")
            
            # Print summary
            for team in response.data:
                logger.info(f"Added: {team['team_name']} ({team['team_abbreviation']})")
            
            return True
        else:
            logger.error("Failed to insert NFL teams")
            return False
            
    except Exception as e:
        logger.error(f"Error adding NFL teams: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
