#!/usr/bin/env python3
"""
Multi-Sport Daily Player Stats Automation System
===============================================
Orchestrates daily ingestion of player stats from all sports for trends UI.
Runs College Football, NFL, MLB, and WNBA stats ingestion in optimized sequence.
"""

import os
import sys
import logging
import subprocess
import time
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from supabase import create_client, Client
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load environment variables
load_dotenv("backend/.env")

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://iriaegoipkjtktitpary.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/multi-sport-daily-automation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SportStatsIngestion:
    """Manages individual sport stats ingestion"""
    
    def __init__(self, sport: str, script_path: str, args: List[str] = None):
        self.sport = sport
        self.script_path = script_path
        self.args = args or []
        self.start_time = None
        self.end_time = None
        self.records_processed = 0
        self.success = False
        self.error_message = None
    
    def run(self) -> Tuple[bool, int, str]:
        """Execute the ingestion script for this sport"""
        logger.info(f"🏃 Starting {self.sport} stats ingestion...")
        self.start_time = datetime.now()
        
        try:
            # Build command
            cmd = [sys.executable, self.script_path] + self.args
            
            # Execute script
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=3600,  # 1 hour timeout
                cwd=os.path.dirname(self.script_path)
            )
            
            self.end_time = datetime.now()
            duration = (self.end_time - self.start_time).total_seconds()
            
            if result.returncode == 0:
                self.success = True
                
                # Parse output for record count (look for "Processed X player game records")
                output_lines = result.stdout.split('\n')
                for line in output_lines:
                    if 'processed' in line.lower() and 'player' in line.lower():
                        # Extract number from line
                        import re
                        numbers = re.findall(r'\d+', line)
                        if numbers:
                            self.records_processed = int(numbers[0])
                            break
                
                logger.info(f"✅ {self.sport} completed successfully in {duration:.1f}s - {self.records_processed} records")
                return True, self.records_processed, ""
            else:
                self.success = False
                self.error_message = result.stderr or result.stdout
                logger.error(f"❌ {self.sport} failed: {self.error_message}")
                return False, 0, self.error_message
                
        except subprocess.TimeoutExpired:
            self.end_time = datetime.now()
            self.error_message = "Script timeout (> 1 hour)"
            logger.error(f"⏰ {self.sport} timed out after 1 hour")
            return False, 0, self.error_message
            
        except Exception as e:
            self.end_time = datetime.now()
            self.error_message = str(e)
            logger.error(f"💥 {self.sport} error: {self.error_message}")
            return False, 0, self.error_message

class MultiSportStatsAutomation:
    """Main automation orchestrator"""
    
    def __init__(self):
        self.script_dir = "/home/reid/Desktop/parleyapp/scripts"
        self.sports_config = {
            "MLB": {
                "script": "enhanced-mlb-stats-ingestion.py",
                "args": ["--games", "10"],
                "priority": 1,  # Highest priority (daily games)
                "season_months": [3, 4, 5, 6, 7, 8, 9, 10],  # March-October
                "parallel": False  # Run MLB alone due to API limits
            },
            "NFL": {
                "script": "nfl-stats-ingestion.py", 
                "args": ["--weeks", "4"],
                "priority": 2,
                "season_months": [9, 10, 11, 12, 1, 2],  # September-February
                "parallel": True
            },
            "CFB": {
                "script": "college-football-stats-ingestion.py",
                "args": ["--weeks", "4"], 
                "priority": 3,
                "season_months": [8, 9, 10, 11, 12, 1],  # August-January
                "parallel": True
            },
            "WNBA": {
                "script": "wnba-stats-ingestion.py",
                "args": ["--games", "10"],
                "priority": 4,
                "season_months": [5, 6, 7, 8, 9, 10],  # May-October
                "parallel": True
            }
        }
        
        self.execution_results = {}
        self.total_start_time = None
        self.total_end_time = None
    
    def is_sport_in_season(self, sport: str) -> bool:
        """Check if sport is currently in season"""
        current_month = datetime.now().month
        season_months = self.sports_config[sport]["season_months"]
        return current_month in season_months
    
    def get_active_sports(self) -> List[str]:
        """Get sports that are currently in season"""
        active = []
        for sport in self.sports_config.keys():
            if self.is_sport_in_season(sport):
                active.append(sport)
        
        # Sort by priority
        active.sort(key=lambda s: self.sports_config[s]["priority"])
        return active
    
    def run_sports_sequential(self, sports: List[str]) -> Dict[str, Dict]:
        """Run sports ingestion sequentially (for high-priority or API-limited sports)"""
        results = {}
        
        for sport in sports:
            config = self.sports_config[sport]
            script_path = os.path.join(self.script_dir, config["script"])
            
            ingestion = SportStatsIngestion(sport, script_path, config["args"])
            success, records, error = ingestion.run()
            
            results[sport] = {
                "success": success,
                "records_processed": records,
                "duration": (ingestion.end_time - ingestion.start_time).total_seconds() if ingestion.end_time else 0,
                "error": error,
                "start_time": ingestion.start_time.isoformat() if ingestion.start_time else None,
                "end_time": ingestion.end_time.isoformat() if ingestion.end_time else None
            }
            
            # Small delay between sequential sports
            if sport != sports[-1]:  # Not last sport
                time.sleep(30)
        
        return results
    
    def run_sports_parallel(self, sports: List[str]) -> Dict[str, Dict]:
        """Run sports ingestion in parallel (for non-API-limited sports)"""
        results = {}
        
        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_sport = {}
            
            for sport in sports:
                config = self.sports_config[sport]
                script_path = os.path.join(self.script_dir, config["script"])
                
                ingestion = SportStatsIngestion(sport, script_path, config["args"])
                future = executor.submit(ingestion.run)
                future_to_sport[future] = (sport, ingestion)
            
            for future in as_completed(future_to_sport):
                sport, ingestion = future_to_sport[future]
                try:
                    success, records, error = future.result()
                    
                    results[sport] = {
                        "success": success,
                        "records_processed": records,
                        "duration": (ingestion.end_time - ingestion.start_time).total_seconds() if ingestion.end_time else 0,
                        "error": error,
                        "start_time": ingestion.start_time.isoformat() if ingestion.start_time else None,
                        "end_time": ingestion.end_time.isoformat() if ingestion.end_time else None
                    }
                    
                except Exception as e:
                    logger.error(f"Parallel execution error for {sport}: {str(e)}")
                    results[sport] = {
                        "success": False,
                        "records_processed": 0,
                        "duration": 0,
                        "error": str(e),
                        "start_time": None,
                        "end_time": None
                    }
        
        return results
    
    def update_player_trends_data(self):
        """Update aggregated player trends data table after ingestion"""
        logger.info("📊 Updating player trends data aggregations...")
        
        try:
            # This could run a separate aggregation script or SQL procedures
            # For now, we'll log the intent - you can expand this later
            
            # Get count of recent player_game_stats records
            recent_cutoff = (datetime.now() - timedelta(days=30)).isoformat()
            
            result = supabase.table('player_game_stats').select('id', count='exact').gte('created_at', recent_cutoff).execute()
            
            recent_records = result.count if hasattr(result, 'count') else 0
            logger.info(f"📈 Found {recent_records} recent player game stats records (last 30 days)")
            
            # Here you could run additional aggregation queries to populate player_trends_data
            # or call another script that does statistical analysis
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating player trends data: {str(e)}")
            return False
    
    def generate_report(self) -> str:
        """Generate execution report"""
        if not self.execution_results:
            return "No execution results available."
        
        total_duration = (self.total_end_time - self.total_start_time).total_seconds()
        total_records = sum(result.get("records_processed", 0) for result in self.execution_results.values())
        successful_sports = sum(1 for result in self.execution_results.values() if result.get("success"))
        total_sports = len(self.execution_results)
        
        report = f"""
🏈 Multi-Sport Daily Stats Ingestion Report
===========================================
Execution Time: {self.total_start_time.strftime('%Y-%m-%d %H:%M:%S')} - {self.total_end_time.strftime('%H:%M:%S')}
Total Duration: {total_duration/60:.1f} minutes
Total Records Processed: {total_records:,}
Sports Success Rate: {successful_sports}/{total_sports}

📊 Individual Sport Results:
"""
        
        for sport, result in self.execution_results.items():
            status = "✅ SUCCESS" if result["success"] else "❌ FAILED"
            duration = result["duration"] / 60  # Convert to minutes
            records = result["records_processed"]
            
            report += f"""
{sport}:
  Status: {status}
  Records: {records:,}
  Duration: {duration:.1f} minutes
"""
            
            if not result["success"] and result["error"]:
                report += f"  Error: {result['error'][:100]}...\n"
        
        return report
    
    def run_daily_automation(self, force_all: bool = False):
        """Main entry point for daily automation"""
        logger.info("🚀 Starting Multi-Sport Daily Stats Automation")
        self.total_start_time = datetime.now()
        
        try:
            # Determine which sports to run
            if force_all:
                active_sports = list(self.sports_config.keys())
                logger.info("🔧 FORCE MODE: Running all sports regardless of season")
            else:
                active_sports = self.get_active_sports()
            
            if not active_sports:
                logger.info("🛌 No sports currently in season. Exiting.")
                return
            
            logger.info(f"🏟️ Active sports for today: {', '.join(active_sports)}")
            
            # Separate sports by execution strategy
            sequential_sports = [s for s in active_sports if not self.sports_config[s]["parallel"]]
            parallel_sports = [s for s in active_sports if self.sports_config[s]["parallel"]]
            
            # Run sequential sports first (usually MLB due to API limits)
            if sequential_sports:
                logger.info(f"⏭️ Running sequential sports: {', '.join(sequential_sports)}")
                sequential_results = self.run_sports_sequential(sequential_sports)
                self.execution_results.update(sequential_results)
            
            # Run parallel sports
            if parallel_sports:
                logger.info(f"⚡ Running parallel sports: {', '.join(parallel_sports)}")
                parallel_results = self.run_sports_parallel(parallel_sports)
                self.execution_results.update(parallel_results)
            
            # Update aggregated trends data
            self.update_player_trends_data()
            
            self.total_end_time = datetime.now()
            
            # Generate and log report
            report = self.generate_report()
            logger.info(report)
            
            # Log summary
            successful_sports = sum(1 for result in self.execution_results.values() if result.get("success"))
            total_records = sum(result.get("records_processed", 0) for result in self.execution_results.values())
            
            logger.info(f"🎯 AUTOMATION COMPLETE: {successful_sports}/{len(self.execution_results)} sports successful, {total_records:,} total records processed")
            
        except Exception as e:
            logger.error(f"💥 Automation failed: {str(e)}")
            self.total_end_time = datetime.now()
            raise

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Multi-Sport Daily Player Stats Automation")
    parser.add_argument("--force-all", action="store_true", help="Force run all sports regardless of season")
    parser.add_argument("--sports", nargs="+", choices=["MLB", "NFL", "CFB", "WNBA"], help="Run specific sports only")
    
    args = parser.parse_args()
    
    try:
        automation = MultiSportStatsAutomation()
        
        if args.sports:
            # Override active sports with user selection
            automation.sports_config = {k: v for k, v in automation.sports_config.items() if k in args.sports}
            logger.info(f"🎯 User selected sports: {', '.join(args.sports)}")
        
        automation.run_daily_automation(force_all=args.force_all)
        
        logger.info("✨ Multi-sport automation completed successfully")
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"🔥 Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
