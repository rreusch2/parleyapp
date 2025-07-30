#!/usr/bin/env python3
"""
Fix Environment Variables in Enhanced System Files
Updates all enhanced system components to use correct xAI API keys and environment variables
"""

import os
import re
from pathlib import Path

def fix_file_env_vars(file_path: str, replacements: dict) -> bool:
    """Fix environment variables in a single file"""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        original_content = content
        
        # Apply replacements
        for old_var, new_var in replacements.items():
            # Replace environment variable references
            content = re.sub(rf'\b{old_var}\b', new_var, content)
            
        # Only write if content changed
        if content != original_content:
            with open(file_path, 'w') as f:
                f.write(content)
            print(f"✅ Fixed {file_path}")
            return True
        else:
            print(f"ℹ️  No changes needed in {file_path}")
            return False
            
    except Exception as e:
        print(f"❌ Error fixing {file_path}: {e}")
        return False

def main():
    """Main function to fix all enhanced system files"""
    print("🔧 Fixing environment variables in enhanced system files...")
    
    # Define replacements
    replacements = {
        'GROK_API_KEY': 'XAI_API_KEY',
        'STATMUSE_API_KEY': 'API_SPORTS_KEY',
        'DATABASE_URL': 'SUPABASE_URL',
        'grok-4': 'grok-3',
        'model_used.*grok-4': 'model_used": "grok-3'
    }
    
    # Files to fix
    files_to_fix = [
        'enhanced_main_orchestrator.py',
        'enhanced_teams_agent.py',
        'enhanced_props_agent.py',
        'scrapy_integration_service.py',
        'automated_workflows.py',
        'system_integration_test.py',
        'deploy_enhanced_system.py',
        'ENHANCED_SYSTEM_README.md'
    ]
    
    fixed_count = 0
    
    for file_path in files_to_fix:
        if os.path.exists(file_path):
            if fix_file_env_vars(file_path, replacements):
                fixed_count += 1
        else:
            print(f"⚠️  File not found: {file_path}")
    
    print(f"\n🎯 Fixed {fixed_count} files with correct environment variables")
    print("✅ Enhanced system now uses:")
    print("   - XAI_API_KEY for xAI Grok API")
    print("   - API_SPORTS_KEY for sports data")
    print("   - SUPABASE_URL for database connection")
    print("   - grok-3 as the AI model")
    
    # Create a summary of the correct configuration
    print("\n📋 Correct Environment Variables Summary:")
    print("=" * 50)
    print("# AI/ML APIs")
    print("XAI_API_KEY=xai-...")
    print("GEMINI_API_KEY=AIza...")
    print("")
    print("# Sports Data APIs")
    print("API_SPORTS_KEY=acb0d668...")
    print("ODDS_API_KEY=5fa4661f...")
    print("THEODDS_API_KEY=64dace9c...")
    print("")
    print("# Database (Supabase)")
    print("SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co")
    print("SUPABASE_SERVICE_KEY=eyJhbGci...")
    print("")
    print("# Backend URLs")
    print("BACKEND_API_URL=https://zooming-rebirth-production-a305.up.railway.app")
    print("=" * 50)

if __name__ == "__main__":
    main()