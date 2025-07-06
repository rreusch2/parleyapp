#!/usr/bin/env python3
"""
StatMuse API Server
Simple HTTP API that all AI systems can query for real StatMuse data
"""

from flask import Flask, request, jsonify
import logging
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

class StatMuseAPI:
    """Simple StatMuse API - same logic as working insights"""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        # Simple in-memory cache
        self.cache = {}
        self.cache_ttl = 3600  # 1 hour
    
    def clean_statmuse_text(self, text: str) -> str:
        """Clean up StatMuse text to fix spacing and grammar issues"""
        import re
        
        # Fix missing spaces between words
        # "TheNew York Yankees" -> "The New York Yankees"  
        text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
        
        # Fix team names followed by verbs (be more specific to avoid breaking "this")
        # "Yankeeshave" -> "Yankees have", but not "this" -> "th is"
        text = re.sub(r'([A-Za-z]{3,}s)(have|has|are|were)(?=\s|$)', r'\1 \2', text)
        
        # Fix names followed by verbs (be more specific)
        # "Judgeis" -> "Judge is", but avoid breaking existing words
        text = re.sub(r'([A-Z][a-z]{3,})(is|are|has|have|was|were)(?=\s|$)', r'\1 \2', text)
        
        # Fix specific common patterns
        text = re.sub(r'([A-Z][a-z]+)([A-Z][a-z]+)', r'\1 \2', text)  # "RedSox" -> "Red Sox"
        
        # Fix common word breaks (repair what we might have broken)
        text = re.sub(r'\bth is\b', 'this', text)
        text = re.sub(r'\bthere cord\b', 'record', text)
        text = re.sub(r'\bsea son\b', 'season', text)
        
        # Fix specific team name issues
        text = re.sub(r'Red Sox(have|has|are)', r'Red Sox \1', text)
        text = re.sub(r'Blue Jays(have|has|are)', r'Blue Jays \1', text)
        text = re.sub(r'White Sox(have|has|are)', r'White Sox \1', text)
        
        # Clean up multiple spaces
        text = re.sub(r'\s+', ' ', text)
        
        # Trim whitespace
        text = text.strip()
        
        return text
    
    def query_statmuse(self, query: str) -> dict:
        """Query StatMuse with caching"""
        cache_key = query.lower()
        current_time = time.time()
        
        # Check cache
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if current_time - timestamp < self.cache_ttl:
                logger.info(f"💾 Cache hit for: {query}")
                cached_data['cached'] = True
                return cached_data
        
        try:
            logger.info(f"🔍 StatMuse Query: {query}")
            
            # Format query for URL (same as working insights)
            formatted_query = query.lower().replace(' ', '-').replace(',', '').replace('?', '')
            url = f"https://www.statmuse.com/mlb/ask/{formatted_query}"
            
            # Make request (same as working insights)
            response = requests.get(url, headers=self.headers, timeout=15)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for main answer (same as working insights)
                main_answer = soup.find('h1') or soup.find('h2')
                if main_answer:
                    answer_text = main_answer.get_text(strip=True)
                    
                    # Fix common spacing issues from StatMuse HTML
                    answer_text = self.clean_statmuse_text(answer_text)
                    
                    logger.info(f"✅ StatMuse Result: {answer_text}")
                    
                    result = {
                        'success': True,
                        'query': query,
                        'answer': answer_text,
                        'url': url,
                        'cached': False,
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    # Cache the result
                    self.cache[cache_key] = (result.copy(), current_time)
                    
                    return result
                else:
                    logger.warning(f"No answer found for: {query}")
                    return {
                        'success': False,
                        'error': 'No answer found',
                        'query': query
                    }
            else:
                logger.warning(f"StatMuse query failed: {response.status_code}")
                return {
                    'success': False,
                    'error': f'HTTP {response.status_code}',
                    'query': query
                }
                
        except Exception as e:
            logger.error(f"Error querying StatMuse: {e}")
            return {
                'success': False,
                'error': str(e),
                'query': query
            }

# Initialize the StatMuse API
statmuse_api = StatMuseAPI()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'StatMuse API Server',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/query', methods=['POST'])
def query_statmuse():
    """Main StatMuse query endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing query parameter'
            }), 400
        
        query = data['query']
        result = statmuse_api.query_statmuse(query)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/head-to-head', methods=['POST'])
def head_to_head():
    """Head-to-head matchup endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'team1' not in data or 'team2' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing team1 and team2 parameters'
            }), 400
        
        team1 = data['team1']
        team2 = data['team2']
        games = data.get('games', 5)
        
        query = f"{team1} vs {team2} last {games} meetings"
        result = statmuse_api.query_statmuse(query)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Head-to-head API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/team-record', methods=['POST'])
def team_record():
    """Team record endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'team' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing team parameter'
            }), 400
        
        team = data['team']
        record_type = data.get('record_type', 'overall')
        season = data.get('season', '2025')
        
        if record_type == 'home':
            query = f"{team} home record {season}"
        elif record_type == 'away':
            query = f"{team} road record {season}"
        else:
            query = f"{team} record {season}"
        
        result = statmuse_api.query_statmuse(query)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Team record API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/player-stats', methods=['POST'])
def player_stats():
    """Player stats endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'player' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing player parameter'
            }), 400
        
        player = data['player']
        stat_type = data.get('stat_type', 'season')
        timeframe = data.get('timeframe', '2025')
        
        query = f"{player} {stat_type} stats {timeframe}"
        result = statmuse_api.query_statmuse(query)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Player stats API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/cache-stats', methods=['GET'])
def cache_stats():
    """Get cache statistics"""
    return jsonify({
        'cached_queries': len(statmuse_api.cache),
        'cache_ttl_hours': statmuse_api.cache_ttl / 3600,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    logger.info("🚀 Starting StatMuse API Server...")
    logger.info("📊 Centralized StatMuse service for all AI systems")
    logger.info("🌐 Available endpoints:")
    logger.info("  POST /query - General StatMuse queries")
    logger.info("  POST /head-to-head - Team matchup data")
    logger.info("  POST /team-record - Team record queries")
    logger.info("  POST /player-stats - Player statistics")
    logger.info("  GET /health - Health check")
    logger.info("  GET /cache-stats - Cache statistics")
    
    app.run(host='0.0.0.0', port=5001, debug=False) 