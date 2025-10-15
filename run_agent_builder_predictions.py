#!/usr/bin/env python3
"""
Daily Prediction Generation using Agent Builder Workflow
Replaces: teams_enhanced.py, props_intelligent_v3.py, props_enhanced.py
"""
import os
import sys
import asyncio
import argparse
from datetime import datetime, timedelta
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv("backend/.env")

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Your published workflow ID
WORKFLOW_ID = "wf_68edde0b32e08190b090de89bef1a0d302929051ff1c5a9a"

async def generate_predictions(target_date: str = None, sport_filter: str = "ALL", pick_count: int = 25):
    """
    Run the Agent Builder workflow to generate daily predictions
    
    Args:
        target_date: Date in YYYY-MM-DD format (default: today)
        sport_filter: Sport to filter (ALL, MLB, NFL, CFB, WNBA, NHL)
        pick_count: Number of picks to generate
    """
    if not target_date:
        target_date = datetime.now().strftime("%Y-%m-%d")
    
    print(f"🚀 Starting Agent Builder prediction generation for {target_date}")
    print(f"   Sport Filter: {sport_filter}")
    print(f"   Target Picks: {pick_count}")
    
    # Construct the input message for the agent
    input_message = f"""Generate {pick_count} betting predictions for {target_date}.
Sport filter: {sport_filter}

Requirements:
- Use Supabase to fetch available games, odds, and props for {target_date}
- Use web search for breaking news, injuries, weather updates
- Generate predictions with data-backed reasoning
- Store predictions in ai_predictions table using execute_sql tool
- NEVER hallucinate - only use real data from tools
"""
    
    try:
        # Run the Agent Builder workflow
        print(f"📡 Calling Agent Builder workflow...")
        
        response = await client.responses.create(
            model="gpt-5",
            workflow_id=WORKFLOW_ID,
            input=input_message,
            reasoning={"effort": "high"},  # Use high reasoning for better analysis
            store=True  # Store the conversation for debugging
        )
        
        print(f"✅ Workflow completed!")
        
        # Extract the response
        output = response.output
        
        # Parse the structured output
        for item in output:
            if item.type == "message":
                content = item.content[0] if item.content else None
                if content and hasattr(content, 'text'):
                    print(f"\n📊 Agent Response:\n{content.text}\n")
        
        # Check if predictions were stored
        print(f"✅ Predictions generated and stored in database!")
        print(f"🎯 Check your ai_predictions table for new entries")
        
        return True
        
    except Exception as e:
        print(f"❌ Error running Agent Builder workflow: {e}")
        import traceback
        traceback.print_exc()
        return False

def parse_arguments():
    parser = argparse.ArgumentParser(description='Generate AI predictions using Agent Builder')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD), defaults to today')
    parser.add_argument('--tomorrow', action='store_true', help='Generate for tomorrow')
    parser.add_argument('--sport', type=str, default='ALL', 
                       choices=['ALL', 'MLB', 'NFL', 'CFB', 'WNBA', 'NHL'],
                       help='Sport filter')
    parser.add_argument('--picks', type=int, default=25, help='Number of picks to generate')
    return parser.parse_args()

async def main():
    args = parse_arguments()
    
    # Determine target date
    if args.tomorrow:
        target_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    elif args.date:
        target_date = args.date
    else:
        target_date = datetime.now().strftime("%Y-%m-%d")
    
    success = await generate_predictions(
        target_date=target_date,
        sport_filter=args.sport,
        pick_count=args.picks
    )
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())

