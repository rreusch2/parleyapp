#!/usr/bin/env python3
"""
Setup Script for Agentic Betting System
Configures OpenManus with ParleyApp betting tools and validates setup

This script:
1. Validates OpenManus configuration
2. Checks required environment variables
3. Tests database connectivity
4. Verifies StatMuse integration
5. Sets up betting-specific configurations

Run this once to set up your agentic betting system.
"""

import os
import sys
from pathlib import Path
import asyncio
from dotenv import load_dotenv

# Add OpenManus to path
openmanus_path = Path(__file__).parent / "OpenManus"
sys.path.insert(0, str(openmanus_path))

def check_openmanus_setup():
    """Check if OpenManus is properly configured"""
    print("🔍 Checking OpenManus Setup...")
    
    # Check if OpenManus directory exists
    if not openmanus_path.exists():
        print("❌ OpenManus directory not found")
        print("Please ensure OpenManus is cloned in your project root")
        return False
    
    # Check if config.toml exists
    config_path = openmanus_path / "config" / "config.toml"
    if not config_path.exists():
        print("❌ OpenManus config.toml not found")
        print("Please copy config.example.toml to config.toml and configure it")
        return False
    
    # Check if requirements are installed
    try:
        from app.agent.manus import Manus
        print("✅ OpenManus core imports working")
        return True
    except ImportError as e:
        print(f"❌ OpenManus import error: {e}")
        print("Please run: cd OpenManus && pip install -r requirements.txt")
        return False


def check_environment_variables():
    """Check required environment variables"""
    print("\n🔍 Checking Environment Variables...")
    
    # Load from backend/.env
    backend_env = Path(__file__).parent / "backend" / ".env"
    if backend_env.exists():
        load_dotenv(backend_env)
        print("✅ Loaded backend/.env file")
    else:
        print("⚠️ backend/.env file not found")
    
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY", 
        "XAI_API_KEY"
    ]
    
    optional_vars = [
        "GOOGLE_SEARCH_API_KEY",
        "GOOGLE_SEARCH_ENGINE_ID"
    ]
    
    missing_required = []
    missing_optional = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_required.append(var)
        else:
            print(f"✅ {var} configured")
    
    for var in optional_vars:
        if not os.getenv(var):
            missing_optional.append(var)
        else:
            print(f"✅ {var} configured")
    
    if missing_required:
        print(f"\n❌ Missing required environment variables: {missing_required}")
        print("Please add these to your backend/.env file")
        return False
    
    if missing_optional:
        print(f"\n⚠️ Missing optional variables: {missing_optional}")
        print("Web search will use fallback mode")
    
    return True


def test_statmuse_server():
    """Test if StatMuse server is accessible"""
    print("\n🔍 Testing StatMuse Server...")
    
    try:
        import requests
        response = requests.get("http://localhost:5001/health", timeout=5)
        if response.status_code == 200:
            print("✅ StatMuse server is running")
            return True
        else:
            print(f"⚠️ StatMuse server responded with status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to StatMuse server")
        print("Please start with: python statmuse_api_server.py")
        return False
    except Exception as e:
        print(f"❌ StatMuse test error: {e}")
        return False


async def test_database_connection():
    """Test Supabase database connectivity"""
    print("\n🔍 Testing Database Connection...")
    
    try:
        # Import after path setup
        from app.tool.supabase_betting import SupabaseBettingTool
        
        tool = SupabaseBettingTool()
        result = await tool.execute(action="get_recent_predictions", limit=1)
        
        if result.error:
            print(f"❌ Database test failed: {result.error}")
            return False
        else:
            print("✅ Database connection successful")
            return True
            
    except Exception as e:
        print(f"❌ Database test error: {e}")
        return False


def create_betting_agent_config():
    """Create betting-specific configuration for OpenManus"""
    print("\n🔧 Setting up Betting Agent Configuration...")
    
    config_path = openmanus_path / "config" / "config.toml"
    
    # Read current config
    try:
        with open(config_path, 'r') as f:
            config_content = f.read()
        
        # Check if betting configuration already exists
        if "[betting]" in config_content:
            print("✅ Betting configuration already exists in config.toml")
            return True
        
        # Add betting configuration
        betting_config = """

# ParleyApp Betting Agent Configuration
[betting]
# Sports betting analysis settings
default_picks_count = 15
max_research_steps = 50
confidence_range_min = 55
confidence_range_max = 85
target_roi_min = 5.0

# Risk management
max_odds_positive = 350  # Don't bet on long shots above +350
max_odds_negative = -300  # Don't bet on heavy favorites below -300
kelly_criterion_max = 10.0  # Max Kelly stake percentage

# Tool preferences  
prefer_fanduel_odds = true
enable_web_search = true
enable_injury_research = true
enable_weather_research = true

# Database settings
ai_user_id = "c19a5e12-4297-4b0f-8d21-39d2bb1a2c08"
store_research_metadata = true
"""
        
        # Append betting configuration
        with open(config_path, 'a') as f:
            f.write(betting_config)
        
        print("✅ Added betting configuration to config.toml")
        return True
        
    except Exception as e:
        print(f"❌ Error updating config: {e}")
        return False


async def run_setup_validation():
    """Run complete setup validation"""
    print("🎯 ParleyApp Agentic Betting System Setup")
    print("=" * 60)
    print("Setting up truly intelligent, adaptive betting analysis")
    print()
    
    steps = [
        ("OpenManus Setup", check_openmanus_setup),
        ("Environment Variables", check_environment_variables),
        ("StatMuse Server", test_statmuse_server),
        ("Database Connection", test_database_connection),
        ("Betting Configuration", create_betting_agent_config)
    ]
    
    results = {}
    
    for step_name, step_func in steps:
        print(f"\n{'='*20} {step_name} {'='*20}")
        try:
            if asyncio.iscoroutinefunction(step_func):
                success = await step_func()
            else:
                success = step_func()
            results[step_name] = success
        except Exception as e:
            print(f"❌ {step_name} failed: {str(e)}")
            results[step_name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("SETUP VALIDATION SUMMARY")
    print("=" * 60)
    
    passed = sum(results.values())
    total = len(results)
    
    for step_name, success in results.items():
        status = "✅ READY" if success else "❌ NEEDS ATTENTION"
        print(f"{step_name:.<40} {status}")
    
    print()
    print(f"Overall Setup Status: {passed}/{total} components ready")
    
    if passed == total:
        print("\n🎉 SETUP COMPLETE!")
        print("Your agentic betting system is ready for action.")
        print()
        print("🚀 Quick Start Commands:")
        print("   python test_agentic_betting.py          # Test system")
        print("   python agentic_team_picks.py --picks 5  # Generate 5 team picks")
        print("   python agentic_props_picks.py --picks 5 # Generate 5 prop picks")
        print()
        print("🎯 What's Different:")
        print("   • Dynamic research that adapts to findings")
        print("   • Intelligent tool usage and strategy pivoting") 
        print("   • Value-focused analysis seeking market edge")
        print("   • Professional-level reasoning and investigation")
        print()
        print("Your old teams_enhanced.py and props_enhanced.py are now obsolete!")
        print("The agentic approach is far superior for finding betting value.")
        
    else:
        print("\n⚠️ SETUP INCOMPLETE")
        print("Please fix the failing components before proceeding.")
        
        failing_steps = [name for name, success in results.items() if not success]
        print(f"\nComponents needing attention: {', '.join(failing_steps)}")
        
        print("\n🔧 Quick Fixes:")
        if "StatMuse Server" in failing_steps:
            print("   • Start StatMuse: python statmuse_api_server.py")
        if "Environment Variables" in failing_steps:
            print("   • Check backend/.env file has all required variables")
        if "Database Connection" in failing_steps:
            print("   • Verify Supabase credentials and network access")
        if "OpenManus Setup" in failing_steps:
            print("   • Ensure OpenManus is cloned and configured properly")


def main():
    """Main setup function"""
    asyncio.run(run_setup_validation())


if __name__ == "__main__":
    main()

