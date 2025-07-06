#!/usr/bin/env python3
"""
Setup environment variables for Player Props Agent
"""

import os

def setup_environment():
    """Setup required environment variables"""
    
    # Check if .env file exists
    env_file = '/home/reid/Desktop/parleyapp/.env'
    
    if os.path.exists(env_file):
        print("📄 Loading environment from .env file...")
        
        # Read .env file
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value
                    print(f"✅ Set {key}")
    
    # Check required variables
    required_vars = [
        'DB_HOST',
        'DB_NAME', 
        'DB_USER',
        'DB_PASSWORD',
        'OPENAI_API_KEY'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {missing_vars}")
        return False
    
    print("✅ All required environment variables are set!")
    return True

if __name__ == "__main__":
    setup_environment()
