#!/usr/bin/env python3
"""
Intelligent Browser Automation for Sports Research
Upload this to Code Interpreter - Agent can modify and run as needed
"""

def setup_browser():
    """Install and set up Playwright browser"""
    import subprocess
    import sys
    
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Installing Playwright...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
        from playwright.sync_api import sync_playwright
    
    return sync_playwright()

def navigate_and_extract(url, extract_type="text", selector=None):
    """
    Navigate to a website and extract information
    
    Args:
        url (str): Website URL to visit
        extract_type (str): "text", "screenshot", or "links"
        selector (str): CSS selector to target specific elements
    
    Returns:
        dict: Extracted information
    """
    playwright = setup_browser()
    
    with playwright as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            # Navigate to URL
            page.goto(url, wait_until='networkidle')
            
            result = {"url": url, "title": page.title()}
            
            if extract_type == "screenshot":
                screenshot = page.screenshot(full_page=True)
                result["screenshot_taken"] = True
                result["screenshot_size"] = len(screenshot)
                
            elif extract_type == "text":
                if selector:
                    elements = page.locator(selector)
                    texts = elements.all_text_contents()
                    result["text"] = "\n".join(texts)
                else:
                    result["text"] = page.text_content()[:5000]  # Limit size
                    
            elif extract_type == "links":
                links = page.locator("a").all()
                result["links"] = [{"text": link.text_content(), "href": link.get_attribute("href")} 
                                 for link in links[:50]]  # Limit to 50 links
                                 
            elif extract_type == "injury_report":
                # ESPN-specific injury extraction
                if "espn.com" in url:
                    injury_elements = page.locator("[data-module='InjuryReport'], .injury-status, .player-status").all()
                    injuries = []
                    for elem in injury_elements:
                        injuries.append(elem.text_content())
                    result["injuries"] = injuries
                    
            browser.close()
            return result
            
        except Exception as e:
            browser.close()
            return {"error": str(e), "url": url}

def search_espn_injuries(team_name=None, sport="mlb"):
    """Search ESPN for injury reports"""
    if sport.lower() == "mlb":
        base_url = "https://www.espn.com/mlb/injuries"
    elif sport.lower() == "nfl":
        base_url = "https://www.espn.com/nfl/injuries"
    elif sport.lower() == "nba":
        base_url = "https://www.espn.com/nba/injuries"
    else:
        base_url = f"https://www.espn.com/{sport}/injuries"
        
    return navigate_and_extract(base_url, extract_type="injury_report")

def search_twitter_sports_betting(query="MLB betting picks"):
    """Search X.com for sports betting content"""
    # Note: X.com requires login for most searches now
    search_url = f"https://x.com/search?q={query.replace(' ', '%20')}"
    return navigate_and_extract(search_url, extract_type="text", selector="[data-testid='tweetText']")

def get_weather_for_game(city="Los Angeles", date=None):
    """Get weather information for outdoor games"""
    weather_url = f"https://weather.com/weather/today/l/{city.replace(' ', '+')}"
    return navigate_and_extract(weather_url, extract_type="text", selector=".current-weather")

# Example usage functions the agent can call:
def espn_research(team_name, sport="mlb"):
    """Comprehensive ESPN research for a team"""
    results = {}
    
    # Get injury reports
    results["injuries"] = search_espn_injuries(team_name, sport)
    
    # Get team page
    if sport.lower() == "mlb":
        team_url = f"https://www.espn.com/mlb/team/_/name/{team_name.lower().replace(' ', '-')}"
        results["team_info"] = navigate_and_extract(team_url, extract_type="text")
    
    return results

# The agent can intelligently modify these functions or create new ones as needed
print("Browser automation functions ready! The agent can now:")
print("- navigate_and_extract(url, extract_type, selector)")
print("- search_espn_injuries(team_name, sport)")  
print("- search_twitter_sports_betting(query)")
print("- get_weather_for_game(city)")
print("- espn_research(team_name, sport)")
