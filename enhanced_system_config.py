#!/usr/bin/env python3
"""
Enhanced System Configuration - Correct Environment Variables
Matches the actual .env file configuration for Parley App
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

class EnhancedSystemConfig:
    """Configuration class with correct environment variable names"""
    
    # AI/ML API Keys
    XAI_API_KEY = os.getenv('XAI_API_KEY')  # xAI Grok API
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')  # Google Gemini
    DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')  # DeepSeek (backup)
    
    # Sports Data APIs
    API_SPORTS_KEY = os.getenv('API_SPORTS_KEY')
    SPORTSDATAIO_API_KEY = os.getenv('SPORTSDATAIO_API_KEY')
    SPORTRADAR_API_KEY = os.getenv('SPORTRADAR_API_KEY')
    ODDS_API_KEY = os.getenv('ODDS_API_KEY')
    THEODDS_API_KEY = os.getenv('THEODDS_API_KEY')
    THE_ODDS_API_BASE_URL = os.getenv('THE_ODDS_API_BASE_URL', 'https://api.the-odds-api.com/v4')
    SPORTS_API_KEY = os.getenv('SPORTS_API_KEY')
    SPORTMONKS_API_KEY = os.getenv('SPORTMONKS_API_KEY')
    SPORTS_GAME_ODDS_API_KEY = os.getenv('SPORTS_GAME_ODDS_API_KEY')
    
    # Database (Supabase)
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
    SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    # Expo/Frontend
    EXPO_PUBLIC_SUPABASE_URL = os.getenv('EXPO_PUBLIC_SUPABASE_URL')
    EXPO_PUBLIC_SUPABASE_ANON_KEY = os.getenv('EXPO_PUBLIC_SUPABASE_ANON_KEY')
    
    # Search APIs
    GOOGLE_SEARCH_API_KEY = os.getenv('GOOGLE_SEARCH_API_KEY')
    # SERPAPI_KEY is expired, using alternatives
    
    # Server Configuration
    PORT = os.getenv('PORT', '3001')
    NODE_ENV = os.getenv('NODE_ENV', 'production')
    BACKEND_API_URL = os.getenv('BACKEND_API_URL')
    BACKEND_URL = os.getenv('BACKEND_URL')
    
    # Push Notifications
    VAPID_PUBLIC_KEY = os.getenv('VAPID_PUBLIC_KEY')
    VAPID_PRIVATE_KEY = os.getenv('VAPID_PRIVATE_KEY')
    VAPID_SUBJECT = os.getenv('VAPID_SUBJECT')
    
    # In-App Purchases
    APPLE_SHARED_SECRET = os.getenv('APPLE_SHARED_SECRET')
    JWT_SECRET = os.getenv('JWT_SECRET')
    
    # Enhanced System Settings
    PRIMARY_AI_MODEL = 'grok-3'  # Using xAI Grok as primary
    FALLBACK_AI_MODEL = 'gemini-pro'  # Gemini as fallback
    
    @classmethod
    def validate_config(cls) -> dict:
        """Validate that required environment variables are set"""
        validation_results = {
            'missing_vars': [],
            'present_vars': [],
            'critical_missing': []
        }
        
        # Critical variables that must be present
        critical_vars = [
            'XAI_API_KEY',
            'SUPABASE_URL',
            'SUPABASE_SERVICE_KEY',
            'API_SPORTS_KEY',
            'ODDS_API_KEY'
        ]
        
        # All expected variables
        all_vars = [
            'XAI_API_KEY', 'GEMINI_API_KEY', 'DEEPSEEK_API_KEY',
            'API_SPORTS_KEY', 'SPORTSDATAIO_API_KEY', 'SPORTRADAR_API_KEY',
            'ODDS_API_KEY', 'THEODDS_API_KEY', 'SPORTS_API_KEY',
            'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY',
            'BACKEND_API_URL', 'APPLE_SHARED_SECRET'
        ]
        
        for var in all_vars:
            value = getattr(cls, var, None)
            if value:
                validation_results['present_vars'].append(var)
            else:
                validation_results['missing_vars'].append(var)
                if var in critical_vars:
                    validation_results['critical_missing'].append(var)
        
        validation_results['config_valid'] = len(validation_results['critical_missing']) == 0
        
        return validation_results
    
    @classmethod
    def get_database_url(cls) -> str:
        """Get database connection URL for Supabase"""
        if cls.SUPABASE_URL and cls.SUPABASE_SERVICE_KEY:
            # Convert Supabase URL to PostgreSQL connection string
            base_url = cls.SUPABASE_URL.replace('https://', '').replace('http://', '')
            return f"postgresql://postgres:{cls.SUPABASE_SERVICE_KEY}@db.{base_url}:5432/postgres"
        return None
    
    @classmethod
    def get_ai_config(cls) -> dict:
        """Get AI model configuration"""
        return {
            'primary_model': cls.PRIMARY_AI_MODEL,
            'primary_api_key': cls.XAI_API_KEY,
            'fallback_model': cls.FALLBACK_AI_MODEL,
            'fallback_api_key': cls.GEMINI_API_KEY,
            'max_tokens': 4000,
            'temperature': 0.1,
            'confidence_threshold': 0.7
        }
    
    @classmethod
    def get_sports_apis_config(cls) -> dict:
        """Get sports data APIs configuration"""
        return {
            'primary_odds_api': {
                'key': cls.ODDS_API_KEY,
                'name': 'The Odds API'
            },
            'primary_sports_data': {
                'key': cls.API_SPORTS_KEY,
                'name': 'API Sports'
            },
            'backup_apis': [
                {'key': cls.THEODDS_API_KEY, 'name': 'TheOdds API'},
                {'key': cls.SPORTRADAR_API_KEY, 'name': 'SportRadar'},
                {'key': cls.SPORTSDATAIO_API_KEY, 'name': 'SportsData.io'}
            ]
        }

# Create global config instance
config = EnhancedSystemConfig()

# Validation on import
validation = config.validate_config()
if not validation['config_valid']:
    print(f"⚠️ WARNING: Missing critical environment variables: {validation['critical_missing']}")
    print(f"📋 Total missing variables: {len(validation['missing_vars'])}")
else:
    print(f"✅ Enhanced system configuration validated successfully")
    print(f"🔑 Using xAI Grok as primary AI model")
    print(f"📊 {len(validation['present_vars'])} environment variables configured")