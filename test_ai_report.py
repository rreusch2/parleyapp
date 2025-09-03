#!/usr/bin/env python3
"""
Test script for AI Daily Report generation
Tests the full flow with real Supabase data
"""

import os
import sys
import asyncio
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import the daily AI report module
from daily_ai_report import DailyAIReportGenerator

async def test_report_generation():
    """Test the AI report generation with real data"""
    print("=" * 60)
    print("Testing AI Daily Report Generation")
    print("=" * 60)
    
    generator = DailyAIReportGenerator()
    
    try:
        # Generate the complete AI report
        print("\n1. Generating AI Daily Report...")
        print("This will:")
        print("  - Fetch current sports context and active games")
        print("  - Retrieve trending player props and team data")
        print("  - Analyze recent predictions and betting patterns")
        print("  - Generate intelligent insights using xAI Grok")
        print("\nPlease wait (10-30 seconds)...")
        
        result = await generator.generate_report()
        
        if result and 'report' in result:
            print("✅ Report generated successfully!")
            
            # Display metadata
            if 'metadata' in result:
                meta = result['metadata']
                print(f"\n📊 Report Metadata:")
                print(f"  - Active sports: {', '.join(meta.get('active_sports', [])) if meta.get('active_sports') else 'None'}")
                print(f"  - Player props analyzed: {meta.get('player_props_count', 0)}")
                print(f"  - Team trends found: {meta.get('team_trends_count', 0)}")
                print(f"  - Predictions reviewed: {meta.get('predictions_count', 0)}")
                print(f"  - Generated at: {result.get('generated_at', 'Unknown')}")
            
            # Display report preview
            report = result['report']
            print(f"\n📝 Report Preview (length: {len(report)} characters)")
            print("-" * 50)
            # Show first 800 characters for better preview
            print(report[:800] + "..." if len(report) > 800 else report)
            print("-" * 50)
            
            # Test database storage
            print("\n2. Testing Database Storage...")
            try:
                # Try to save to database (fix async issue)
                save_result = generator.supabase.table('ai_reports').insert({
                    'report_type': 'daily_ai_analysis',
                    'content': report,
                    'metadata': result.get('metadata', {}),
                    'generated_at': result.get('generated_at', datetime.now().isoformat())
                }).execute()
                
                if save_result.data:
                    print("✅ Report saved to database successfully!")
                    print(f"   Report ID: {save_result.data[0].get('id', 'Unknown')}")
                else:
                    print("⚠️ Report saved but no ID returned")
            except Exception as e:
                print(f"⚠️ Database save failed: {str(e)}")
                print("   (This is expected if the migration hasn't been applied yet)")
        else:
            print("❌ Failed to generate report")
            if result:
                print(f"Result: {result}")
            
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Clean up
        await generator.close()
    
    print("\n" + "=" * 60)
    print("Test Complete")
    print("=" * 60)

if __name__ == "__main__":
    # Run the async test
    asyncio.run(test_report_generation())
