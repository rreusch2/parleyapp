#!/usr/bin/env python3
"""
Player Stats Service Setup Script
Installs dependencies and configures the player stats automation system
"""

import os
import sys
import subprocess
import json
from pathlib import Path

class PlayerStatsServiceSetup:
    def __init__(self):
        self.service_dir = Path(__file__).parent
        self.root_dir = Path('/home/reid/Desktop/parleyapp')
        self.env_file = self.root_dir / '.env'
        
    def check_python_version(self):
        """Check Python version compatibility"""
        print("🐍 Checking Python version...")
        
        if sys.version_info < (3, 8):
            print("❌ Python 3.8+ is required")
            return False
        
        print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")
        return True
    
    def install_dependencies(self):
        """Install required Python packages"""
        print("📦 Installing Python dependencies...")
        
        requirements_file = self.service_dir / 'requirements.txt'
        
        try:
            subprocess.run([
                sys.executable, '-m', 'pip', 'install', '-r', str(requirements_file)
            ], check=True, capture_output=True, text=True)
            
            print("✅ Dependencies installed successfully")
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to install dependencies: {e}")
            print(f"Error output: {e.stderr}")
            return False
    
    def verify_environment_variables(self):
        """Verify required environment variables are set"""
        print("🔐 Checking environment variables...")
        
        required_vars = [
            'SPORTSDATA_API_KEY',
            'SUPABASE_URL', 
            'SUPABASE_SERVICE_KEY'
        ]
        
        missing_vars = []
        
        # Load .env file if it exists
        if self.env_file.exists():
            with open(self.env_file, 'r') as f:
                for line in f:
                    if '=' in line and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        if key not in os.environ and value:
                            os.environ[key] = value
        
        for var in required_vars:
            if not os.getenv(var):
                missing_vars.append(var)
        
        if missing_vars:
            print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
            print("Please check your .env file in the project root")
            return False
        
        print("✅ All required environment variables found")
        return True
    
    def test_api_connectivity(self):
        """Test SportsData.io API connectivity"""
        print("🔌 Testing SportsData.io API connectivity...")
        
        try:
            # Import our service modules
            sys.path.append(str(self.service_dir))
            from sportsdata_service import SportsDataService
            
            service = SportsDataService()
            
            # Test with a simple call
            recent_dates = service.get_recent_dates(1)
            if recent_dates:
                print(f"✅ SportsData.io API working - recent date: {recent_dates[0]}")
                return True
            else:
                print("❌ SportsData.io API test failed - no recent dates")
                return False
                
        except Exception as e:
            print(f"❌ SportsData.io API test failed: {e}")
            return False
    
    def test_supabase_connectivity(self):
        """Test Supabase database connectivity"""
        print("🗄️ Testing Supabase connectivity...")
        
        try:
            sys.path.append(str(self.service_dir))
            from supabase_client import SupabasePlayerStatsClient
            
            client = SupabasePlayerStatsClient()
            
            # Test with a simple query
            mlb_players = client.get_all_active_players('MLB')
            print(f"✅ Supabase working - found {len(mlb_players)} MLB players")
            return True
            
        except Exception as e:
            print(f"❌ Supabase connectivity test failed: {e}")
            return False
    
    def create_log_directories(self):
        """Create necessary log directories"""
        print("📁 Creating log directories...")
        
        log_dir = self.root_dir / 'logs'
        log_dir.mkdir(exist_ok=True)
        
        # Create specific log files
        log_files = [
            'daily-player-stats.log',
            'player-stats-automation.log'
        ]
        
        for log_file in log_files:
            log_path = log_dir / log_file
            if not log_path.exists():
                log_path.touch()
        
        print("✅ Log directories created")
        return True
    
    def create_cron_job(self):
        """Create cron job for daily automation"""
        print("⏰ Setting up daily automation cron job...")
        
        cron_command = f"0 6 * * * cd {self.service_dir} && /usr/bin/python3 daily_player_stats_automation.py >> {self.root_dir}/logs/daily-player-stats-cron.log 2>&1"
        
        print(f"📝 Add this to your crontab (crontab -e):")
        print(f"   {cron_command}")
        print("   This will run daily at 6:00 AM")
        
        return True
    
    def create_service_config(self):
        """Create service configuration file"""
        print("⚙️ Creating service configuration...")
        
        config = {
            "service_name": "player_stats_service",
            "version": "1.0.0",
            "description": "Automated player game stats collection for ParleyApp trends tab",
            "sports_supported": ["MLB", "WNBA"],
            "api_provider": "SportsData.io",
            "database": "Supabase",
            "automation_schedule": "Daily at 6:00 AM",
            "scripts": {
                "populate_mlb": "populate_mlb_recent_games.py",
                "populate_wnba": "populate_wnba_players.py", 
                "daily_automation": "daily_player_stats_automation.py",
                "test_connectivity": "daily_player_stats_automation.py --test"
            }
        }
        
        config_file = self.service_dir / 'service_config.json'
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        
        print("✅ Service configuration created")
        return True
    
    def run_setup(self):
        """Run complete setup process"""
        print("🚀 Starting Player Stats Service Setup")
        print("=" * 50)
        
        setup_steps = [
            ("Python Version", self.check_python_version),
            ("Dependencies", self.install_dependencies),
            ("Environment Variables", self.verify_environment_variables),
            ("Log Directories", self.create_log_directories),
            ("Service Config", self.create_service_config),
            ("SportsData.io API", self.test_api_connectivity),
            ("Supabase Database", self.test_supabase_connectivity),
            ("Cron Job Setup", self.create_cron_job),
        ]
        
        success_count = 0
        
        for step_name, step_func in setup_steps:
            print(f"\n📋 {step_name}...")
            if step_func():
                success_count += 1
            else:
                print(f"❌ {step_name} failed")
        
        print(f"\n🎯 Setup Complete: {success_count}/{len(setup_steps)} steps successful")
        
        if success_count == len(setup_steps):
            print("\n✅ Player Stats Service is ready!")
            print("\n🚀 Next Steps:")
            print("1. Run initial data population:")
            print(f"   cd {self.service_dir}")
            print("   python3 populate_mlb_recent_games.py --days 10")
            print("   python3 populate_wnba_players.py")
            print("\n2. Test daily automation:")
            print("   python3 daily_player_stats_automation.py --test")
            print("\n3. Add cron job for daily updates (see above)")
            
        else:
            print("\n⚠️ Setup incomplete. Please fix the failed steps above.")
        
        return success_count == len(setup_steps)


def main():
    setup = PlayerStatsServiceSetup()
    setup.run_setup()


if __name__ == "__main__":
    main()
