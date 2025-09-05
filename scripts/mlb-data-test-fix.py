#!/usr/bin/env python3
"""
MLB Data Test Fix - Small scale test of pybaseball integration

This script tests the approach with a small subset of players first.
"""

import os
import sys
import json
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    import pybaseball
    from pybaseball import playerid_lookup, statcast_batter, cache
    cache.enable()
    logger.info("✅ pybaseball imported successfully")
except ImportError:
    logger.error("❌ pybaseball not installed")
    sys.exit(1)

from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://iriaegoipkjtktitpary.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def test_pybaseball_integration():
    """Test pybaseball with a few known players"""
    logger.info("🧪 Testing pybaseball integration...")
    
    test_players = ["Aaron Judge", "Mookie Betts", "Juan Soto"]
    
    for player_name in test_players:
        logger.info(f"Testing lookup for: {player_name}")
        
        try:
            # Split name for lookup
            name_parts = player_name.split(' ')
            last_name = name_parts[-1]
            first_name = ' '.join(name_parts[:-1])
            
            # Lookup player ID
            lookup_result = playerid_lookup(last_name, first_name)
            
            if lookup_result is not None and len(lookup_result) > 0:
                player_data = lookup_result.iloc[-1]
                mlbam_id = player_data.get('key_mlbam')
                
                logger.info(f"✅ {player_name}: MLBAM ID = {mlbam_id}")
                
                # Test getting recent stats
                if pd.notna(mlbam_id):
                    end_date = datetime.now().strftime('%Y-%m-%d')
                    start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
                    
                    statcast_data = statcast_batter(start_date, end_date, int(mlbam_id))
                    
                    if statcast_data is not None and len(statcast_data) > 0:
                        logger.info(f"✅ {player_name}: Found {len(statcast_data)} at-bats in last 30 days")
                        
                        # Show sample game aggregation
                        games_by_date = statcast_data.groupby('game_date').size()
                        logger.info(f"   Games played: {len(games_by_date)}")
                        
                    else:
                        logger.warning(f"⚠️ {player_name}: No recent statcast data found")
            else:
                logger.warning(f"⚠️ Could not find {player_name} in lookup")
                
        except Exception as e:
            logger.error(f"❌ Error testing {player_name}: {str(e)}")
            
    logger.info("✅ PyBaseball test completed")

def clean_sample_fake_data():
    """Clean fake data for just a few players to test"""
    logger.info("🧹 Cleaning sample fake MLB data...")
    
    try:
        # Get a few MLB players to test with
        players_result = supabase.table('players').select('id', 'name', 'team').eq('sport', 'MLB').limit(5).execute()
        
        if not players_result.data:
            logger.error("❌ No MLB players found")
            return False
            
        test_players = players_result.data
        player_ids = [p['id'] for p in test_players]
        
        logger.info(f"🎯 Testing cleanup for {len(test_players)} players: {[p['name'] for p in test_players]}")
        
        # Delete fake records for these players
        delete_result = supabase.table('player_game_stats').delete().in_('player_id', player_ids).execute()
        
        deleted_count = len(delete_result.data) if delete_result.data else 0
        logger.info(f"✅ Deleted {deleted_count} fake records for test players")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error cleaning sample data: {str(e)}")
        return False

def get_real_stats_for_sample():
    """Get real stats for sample players"""
    logger.info("📊 Getting real stats for sample players...")
    
    try:
        # Get sample players
        players_result = supabase.table('players').select('id', 'name', 'team').eq('sport', 'MLB').limit(3).execute()
        players = players_result.data if players_result.data else []
        
        all_stats = []
        
        for player in players:
            logger.info(f"Processing: {player['name']}")
            
            # Lookup MLBAM ID
            name_parts = player['name'].split(' ')
            last_name = name_parts[-1]
            first_name = ' '.join(name_parts[:-1])
            
            try:
                lookup_result = playerid_lookup(last_name, first_name)
                
                if lookup_result is not None and len(lookup_result) > 0:
                    player_data = lookup_result.iloc[-1]
                    mlbam_id = player_data.get('key_mlbam')
                    
                    if pd.notna(mlbam_id):
                        # Get recent statcast data
                        end_date = datetime.now().strftime('%Y-%m-%d')
                        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
                        
                        statcast_data = statcast_batter(start_date, end_date, int(mlbam_id))
                        
                        if statcast_data is not None and len(statcast_data) > 0:
                            # Group by game and create game stats
                            for game_date, game_data in statcast_data.groupby('game_date'):
                                if len(all_stats) >= 10:  # Limit for testing
                                    break
                                
                                game_stat = create_game_stat_record(game_data, player['name'], player['id'], game_date)
                                if game_stat:
                                    all_stats.append(game_stat)
                        
            except Exception as e:
                logger.warning(f"⚠️ Error processing {player['name']}: {str(e)}")
                continue
        
        logger.info(f"✅ Created {len(all_stats)} real game stat records")
        
        # Insert the real stats
        if all_stats:
            insert_result = supabase.table('player_game_stats').insert(all_stats).execute()
            logger.info(f"✅ Inserted {len(insert_result.data)} real stat records")
        
        return len(all_stats)
        
    except Exception as e:
        logger.error(f"❌ Error getting real stats: {str(e)}")
        return 0

def create_game_stat_record(game_data: pd.DataFrame, player_name: str, player_id: str, game_date: str) -> Optional[Dict]:
    """Create a game stat record from statcast data"""
    try:
        if len(game_data) == 0:
            return None
        
        # Basic counting stats
        at_bats = len(game_data)
        hits = len(game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])])
        home_runs = len(game_data[game_data['events'] == 'home_run'])
        doubles = len(game_data[game_data['events'] == 'double'])
        triples = len(game_data[game_data['events'] == 'triple'])
        singles = hits - doubles - triples - home_runs
        
        # Calculate stats
        total_bases = singles + (doubles * 2) + (triples * 3) + (home_runs * 4)
        walks = len(game_data[game_data['events'] == 'walk'])
        strikeouts = len(game_data[game_data['events'] == 'strikeout'])
        hit_by_pitch = len(game_data[game_data['events'] == 'hit_by_pitch'])
        
        batting_avg = hits / at_bats if at_bats > 0 else 0
        on_base = hits + walks + hit_by_pitch
        plate_appearances = at_bats + walks + hit_by_pitch
        obp = on_base / plate_appearances if plate_appearances > 0 else 0
        slg = total_bases / at_bats if at_bats > 0 else 0
        ops = obp + slg
        
        # Get game context
        home_team = game_data.iloc[0].get('home_team', '')
        away_team = game_data.iloc[0].get('away_team', '')
        
        return {
            'player_id': player_id,
            'stats': {
                'game_date': game_date,
                'at_bats': at_bats,
                'hits': hits,
                'home_runs': home_runs,
                'doubles': doubles,
                'triples': triples,
                'singles': singles,
                'total_bases': total_bases,
                'walks': walks,
                'strikeouts': strikeouts,
                'hit_by_pitch': hit_by_pitch,
                'batting_average': round(batting_avg, 3),
                'on_base_percentage': round(obp, 3),
                'slugging_percentage': round(slg, 3),
                'ops': round(ops, 3),
                'home_team': home_team,
                'away_team': away_team,
                'opponent_team': away_team if home_team else home_team,
                'player_name': player_name,
                'is_real_data': True
            },
            'created_at': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error creating game stat: {str(e)}")
        return None

def main():
    """Main test function"""
    logger.info("🚀 Starting MLB Data Test Fix...")
    
    # Step 1: Test pybaseball integration
    test_pybaseball_integration()
    
    # Step 2: Clean sample fake data
    if clean_sample_fake_data():
        logger.info("✅ Sample cleanup successful")
        
        # Step 3: Get real stats for sample
        real_stats_count = get_real_stats_for_sample()
        logger.info(f"✅ Test completed! Created {real_stats_count} real stat records")
    else:
        logger.error("❌ Sample cleanup failed")
    
    logger.info("✅ MLB Data Test Fix completed!")

if __name__ == "__main__":
    main()
