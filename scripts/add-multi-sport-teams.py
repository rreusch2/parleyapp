#!/usr/bin/env python3
"""
Multi-Sport Teams Data Ingestion Script
Adds WNBA and CFB teams to complete multi-sport coverage in Trends tab
"""

import os
import sys
import uuid
import logging
from datetime import datetime
from supabase import create_client, Client

# Configuration
SUPABASE_URL = "https://iriaegoipkjtktitpary.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_wnba_teams():
    """WNBA teams for 2025 season"""
    return [
        {"name": "Atlanta Dream", "abbreviation": "ATL_W", "city": "Atlanta", "sport_key": "basketball_wnba"},
        {"name": "Chicago Sky", "abbreviation": "CHI_W", "city": "Chicago", "sport_key": "basketball_wnba"},
        {"name": "Connecticut Sun", "abbreviation": "CONN_W", "city": "Uncasville", "sport_key": "basketball_wnba"},
        {"name": "Dallas Wings", "abbreviation": "DAL_W", "city": "Dallas", "sport_key": "basketball_wnba"},
        {"name": "Indiana Fever", "abbreviation": "IND_W", "city": "Indianapolis", "sport_key": "basketball_wnba"},
        {"name": "Las Vegas Aces", "abbreviation": "LV_W", "city": "Las Vegas", "sport_key": "basketball_wnba"},
        {"name": "Minnesota Lynx", "abbreviation": "MIN_W", "city": "Minneapolis", "sport_key": "basketball_wnba"},
        {"name": "New York Liberty", "abbreviation": "NY_W", "city": "New York", "sport_key": "basketball_wnba"},
        {"name": "Phoenix Mercury", "abbreviation": "PHX_W", "city": "Phoenix", "sport_key": "basketball_wnba"},
        {"name": "Seattle Storm", "abbreviation": "SEA_W", "city": "Seattle", "sport_key": "basketball_wnba"},
        {"name": "Washington Mystics", "abbreviation": "WAS_W", "city": "Washington", "sport_key": "basketball_wnba"},
        {"name": "Golden State Valkyries", "abbreviation": "GS_W", "city": "San Francisco", "sport_key": "basketball_wnba"}
    ]

def get_top_cfb_teams():
    """Top 25 CFB teams for college football coverage"""
    return [
        {"name": "Alabama Crimson Tide", "abbreviation": "ALA_CFB", "city": "Tuscaloosa", "sport_key": "americanfootball_ncaaf"},
        {"name": "Georgia Bulldogs", "abbreviation": "UGA_CFB", "city": "Athens", "sport_key": "americanfootball_ncaaf"},
        {"name": "Michigan Wolverines", "abbreviation": "MICH_CFB", "city": "Ann Arbor", "sport_key": "americanfootball_ncaaf"},
        {"name": "Texas Longhorns", "abbreviation": "TEX_CFB", "city": "Austin", "sport_key": "americanfootball_ncaaf"},
        {"name": "Ohio State Buckeyes", "abbreviation": "OSU_CFB", "city": "Columbus", "sport_key": "americanfootball_ncaaf"},
        {"name": "Notre Dame Fighting Irish", "abbreviation": "ND_CFB", "city": "South Bend", "sport_key": "americanfootball_ncaaf"},
        {"name": "Oregon Ducks", "abbreviation": "ORE_CFB", "city": "Eugene", "sport_key": "americanfootball_ncaaf"},
        {"name": "Florida State Seminoles", "abbreviation": "FSU_CFB", "city": "Tallahassee", "sport_key": "americanfootball_ncaaf"},
        {"name": "Penn State Nittany Lions", "abbreviation": "PSU_CFB", "city": "University Park", "sport_key": "americanfootball_ncaaf"},
        {"name": "USC Trojans", "abbreviation": "USC_CFB", "city": "Los Angeles", "sport_key": "americanfootball_ncaaf"},
        {"name": "LSU Tigers", "abbreviation": "LSU_CFB", "city": "Baton Rouge", "sport_key": "americanfootball_ncaaf"},
        {"name": "Florida Gators", "abbreviation": "FLA_CFB", "city": "Gainesville", "sport_key": "americanfootball_ncaaf"},
        {"name": "Tennessee Volunteers", "abbreviation": "TENN_CFB", "city": "Knoxville", "sport_key": "americanfootball_ncaaf"},
        {"name": "Oklahoma Sooners", "abbreviation": "OU_CFB", "city": "Norman", "sport_key": "americanfootball_ncaaf"},
        {"name": "Clemson Tigers", "abbreviation": "CLEM_CFB", "city": "Clemson", "sport_key": "americanfootball_ncaaf"},
        {"name": "Auburn Tigers", "abbreviation": "AUB_CFB", "city": "Auburn", "sport_key": "americanfootball_ncaaf"},
        {"name": "Washington Huskies", "abbreviation": "WASH_CFB", "city": "Seattle", "sport_key": "americanfootball_ncaaf"},
        {"name": "Miami Hurricanes", "abbreviation": "MIA_CFB", "city": "Coral Gables", "sport_key": "americanfootball_ncaaf"},
        {"name": "Wisconsin Badgers", "abbreviation": "WIS_CFB", "city": "Madison", "sport_key": "americanfootball_ncaaf"},
        {"name": "Utah Utes", "abbreviation": "UTAH_CFB", "city": "Salt Lake City", "sport_key": "americanfootball_ncaaf"},
        {"name": "Texas A&M Aggies", "abbreviation": "TAMU_CFB", "city": "College Station", "sport_key": "americanfootball_ncaaf"},
        {"name": "Arkansas Razorbacks", "abbreviation": "ARK_CFB", "city": "Fayetteville", "sport_key": "americanfootball_ncaaf"},
        {"name": "Ole Miss Rebels", "abbreviation": "MISS_CFB", "city": "Oxford", "sport_key": "americanfootball_ncaaf"},
        {"name": "Kentucky Wildcats", "abbreviation": "UK_CFB", "city": "Lexington", "sport_key": "americanfootball_ncaaf"},
        {"name": "Iowa Hawkeyes", "abbreviation": "IOWA_CFB", "city": "Iowa City", "sport_key": "americanfootball_ncaaf"}
    ]

def check_existing_team(team_name, sport_key):
    """Check if team already exists"""
    try:
        result = supabase.table('teams').select('id').eq('team_name', team_name).eq('sport_key', sport_key).execute()
        return len(result.data) > 0
    except Exception as e:
        logger.error(f"Error checking existing team {team_name}: {e}")
        return False

def insert_teams(teams_data, sport_name):
    """Insert teams into database"""
    inserted_count = 0
    skipped_count = 0
    
    logger.info(f"Processing {len(teams_data)} {sport_name} teams...")
    
    for team in teams_data:
        try:
            # Check if team already exists
            if check_existing_team(team['name'], team['sport_key']):
                logger.info(f"Team {team['name']} already exists, skipping...")
                skipped_count += 1
                continue
            
            # Create team record
            team_data = {
                'id': str(uuid.uuid4()),
                'team_key': team['abbreviation'],  # Required field
                'team_name': team['name'],
                'team_abbreviation': team['abbreviation'],
                'city': team['city'],
                'sport_key': team['sport_key'],
                'logo_url': None,  # Can be populated later
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            result = supabase.table('teams').insert(team_data).execute()
            
            if result.data:
                logger.info(f"✅ Inserted {team['name']} ({team['abbreviation']})")
                inserted_count += 1
            else:
                logger.error(f"❌ Failed to insert {team['name']}")
                
        except Exception as e:
            logger.error(f"Error inserting team {team['name']}: {e}")
            continue
    
    logger.info(f"📊 {sport_name} Results: {inserted_count} inserted, {skipped_count} already existed")
    return inserted_count

def show_teams_summary():
    """Show summary of all teams by sport"""
    try:
        result = supabase.table('teams').select('sport_key').execute()
        
        # Count teams by sport
        sport_counts = {}
        for team in result.data:
            sport = team['sport_key']
            sport_counts[sport] = sport_counts.get(sport, 0) + 1
        
        logger.info("\n" + "="*50)
        logger.info("TEAMS DATABASE SUMMARY")
        logger.info("="*50)
        
        total_teams = 0
        for sport, count in sorted(sport_counts.items()):
            logger.info(f"{sport}: {count} teams")
            total_teams += count
        
        logger.info(f"\nTotal teams: {total_teams}")
        logger.info("="*50)
        
    except Exception as e:
        logger.error(f"Error showing teams summary: {e}")

def main():
    """Main execution function"""
    logger.info("Starting multi-sport teams data ingestion...")
    
    total_inserted = 0
    
    # Add WNBA teams
    logger.info("\n🏀 Adding WNBA teams...")
    wnba_teams = get_wnba_teams()
    wnba_inserted = insert_teams(wnba_teams, "WNBA")
    total_inserted += wnba_inserted
    
    # Add CFB teams
    logger.info("\n🏈 Adding CFB teams...")
    cfb_teams = get_top_cfb_teams()
    cfb_inserted = insert_teams(cfb_teams, "CFB")
    total_inserted += cfb_inserted
    
    # Show final summary
    logger.info(f"\n✅ Multi-sport teams ingestion completed!")
    logger.info(f"Total new teams added: {total_inserted}")
    
    # Show updated teams summary
    show_teams_summary()

if __name__ == "__main__":
    main()
