#!/usr/bin/env python3
"""
Simple test to verify Professor Lock is working
"""

import requests
import json
from dotenv import load_dotenv
import os

load_dotenv()

def test_professor_lock():
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:3001')
    user_id = 'f08b56d3-d4ec-4815-b502-6647d723d2a6'
    
    # Simple test message
    payload = {
        "message": "Hey Professor Lock, give me 3 simple betting insights for today.",
        "userId": user_id,
        "context": {
            "screen": "test",
            "userTier": "pro",
            "maxPicks": 10
        },
        "conversationHistory": []
    }
    
    url = f"{backend_url}/api/ai/chat"
    headers = {"Content-Type": "application/json"}
    
    print("Testing Professor Lock with simple message...")
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            message = result.get('message', '')
            print(f"✅ Success! Professor Lock responded:")
            print(f"Response: {message}")
            return True
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

if __name__ == "__main__":
    test_professor_lock() 