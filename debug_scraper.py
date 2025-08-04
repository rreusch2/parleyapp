#!/usr/bin/env python3
"""
Debug scraper to inspect SportsChatPlace HTML structure
"""

import requests
from bs4 import BeautifulSoup
import re

def debug_sportschatplace():
    url = "https://stats.sportschatplace.com/player-props/baseball/mlb/last-10-matches"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    try:
        print(f"Fetching: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        print(f"Status Code: {response.status_code}")
        print(f"Content Length: {len(response.content)}")
        
        if response.status_code != 200:
            print(f"Error: {response.status_code} - {response.text}")
            return
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Save HTML to file for inspection
        with open('sportschatplace_debug.html', 'w', encoding='utf-8') as f:
            f.write(soup.prettify())
        
        print("HTML saved to 'sportschatplace_debug.html'")
        
        # Look for any text that might contain player names and percentages
        print("\n=== Searching for percentage patterns ===")
        percentage_patterns = [
            r'\d+\.?\d*%',  # Any percentage
            r'\(\d+/\d+\)',  # Fraction in parentheses
            r'[A-Z]\.\s*[A-Z][a-z]+',  # Name pattern like "F. Freeman"
        ]
        
        for pattern in percentage_patterns:
            matches = soup.find_all(string=re.compile(pattern, re.IGNORECASE))
            print(f"\nPattern '{pattern}' found {len(matches)} matches:")
            for i, match in enumerate(matches[:5]):  # Show first 5
                print(f"  {i+1}. {match.strip()}")
        
        # Look for common HTML elements that might contain player data
        print("\n=== Checking common element types ===")
        elements_to_check = ['div', 'span', 'td', 'th', 'p', 'li']
        
        for elem_type in elements_to_check:
            elements = soup.find_all(elem_type)
            text_elements = [elem for elem in elements if elem.get_text(strip=True)]
            print(f"{elem_type}: {len(text_elements)} elements with text")
            
            # Show a few examples with percentages
            for elem in text_elements[:3]:
                text = elem.get_text(strip=True)
                if '%' in text and len(text) < 100:
                    print(f"  Example: {text}")
        
        # Look for specific classes or IDs that might contain player data
        print("\n=== Checking for relevant classes/IDs ===")
        common_classes = ['player', 'prop', 'stat', 'percentage', 'card', 'row', 'item']
        for class_name in common_classes:
            elements = soup.find_all(class_=re.compile(class_name, re.IGNORECASE))
            if elements:
                print(f"Found {len(elements)} elements with class containing '{class_name}'")
                for elem in elements[:2]:
                    if elem.get_text(strip=True):
                        print(f"  Example: {elem.get_text(strip=True)[:100]}...")
        
        # Check if page has JavaScript that loads content dynamically
        scripts = soup.find_all('script')
        print(f"\n=== Found {len(scripts)} script tags ===")
        for script in scripts[:3]:
            if script.string and len(script.string) > 100:
                print(f"Script content preview: {script.string[:100]}...")
        
        # Look for any API endpoints or data URLs in the HTML
        print("\n=== Looking for API endpoints ===")
        all_text = soup.get_text()
        api_patterns = [
            r'https?://[^\s"\']+api[^\s"\']*',
            r'https?://[^\s"\']+data[^\s"\']*',
            r'/api/[^\s"\']*',
            r'/data/[^\s"\']*'
        ]
        
        for pattern in api_patterns:
            matches = re.findall(pattern, all_text, re.IGNORECASE)
            if matches:
                print(f"Found API-like URLs: {matches[:3]}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_sportschatplace()