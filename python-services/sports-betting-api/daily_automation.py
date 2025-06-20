#!/usr/bin/env python3
"""
Daily Automation Script for ParleyApp
Automatically generates daily picks and saves them to the database
Can be run as a cron job: 0 9 * * * /path/to/daily_automation.py
"""

import os
import sys
import json
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('daily_automation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class DailyAutomation:
    def __init__(self):
        self.python_api_url = 'http://localhost:5001'
        self.backend_api_url = 'http://localhost:3001'
        self.results = {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'sports_analyzed': [],
            'total_picks': 0,
            'best_picks': [],
            'errors': []
        }
    
    def run_daily_analysis(self) -> Dict[str, Any]:
        """Run the complete daily analysis workflow."""
        logger.info("🚀 Starting daily analysis automation...")
        
        try:
            # 1. Analyze all sports
            sports_to_analyze = ['NBA', 'NFL', 'MLB', 'NHL']
            for sport in sports_to_analyze:
                logger.info(f"📊 Analyzing {sport}...")
                sport_results = self.analyze_sport(sport)
                if sport_results:
                    self.results['sports_analyzed'].append(sport)
                    self.results['total_picks'] += sport_results.get('total_props', 0)
                    self.results['best_picks'].extend(sport_results.get('best_bets', []))
            
            # 2. Generate top daily picks across all sports
            logger.info("🎯 Generating top daily picks...")
            daily_picks = self.generate_top_picks()
            
            # 3. Save to database (if backend is available)
            logger.info("💾 Saving predictions to database...")
            saved_count = self.save_predictions_to_db(daily_picks)
            
            # 4. Generate summary report
            self.results['saved_to_db'] = saved_count
            self.results['top_picks'] = daily_picks[:10]
            
            # 5. Send notifications (email, Slack, etc.)
            # self.send_notifications()
            
            logger.info("✅ Daily analysis completed successfully!")
            return self.results
            
        except Exception as e:
            logger.error(f"❌ Error in daily analysis: {e}")
            self.results['errors'].append(str(e))
            return self.results
    
    def analyze_sport(self, sport: str) -> Dict[str, Any]:
        """Analyze a specific sport using the Python AI service."""
        try:
            response = requests.post(
                f'{self.python_api_url}/api/integrate/live-games',
                json={'sport': sport, 'date': datetime.now().strftime('%Y-%m-%d')},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    logger.info(f"✅ {sport}: Found {data['games_found']} games, {data['total_props_analyzed']} props analyzed")
                    return data
                else:
                    logger.warning(f"⚠️ {sport}: API returned success=False")
            else:
                logger.error(f"❌ {sport}: API returned status {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ {sport}: Request failed - {e}")
            self.results['errors'].append(f"{sport}: {str(e)}")
        
        return {}
    
    def generate_top_picks(self) -> List[Dict[str, Any]]:
        """Generate the top daily picks across all sports."""
        try:
            response = requests.post(
                f'{self.python_api_url}/api/generate/daily-picks',
                json={
                    'sports': self.results['sports_analyzed'],
                    'min_confidence': 75,
                    'max_picks': 20
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    picks = data.get('daily_picks', [])
                    logger.info(f"✅ Generated {len(picks)} top daily picks")
                    return picks
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Error generating daily picks: {e}")
            self.results['errors'].append(f"Daily picks generation: {str(e)}")
        
        return []
    
    def save_predictions_to_db(self, picks: List[Dict[str, Any]]) -> int:
        """Save predictions to the database via the backend API."""
        saved_count = 0
        
        for pick in picks:
            try:
                # Convert pick to backend format
                prediction_data = {
                    'player_id': self.get_player_id(pick.get('player')),
                    'market_type': pick.get('prop_type', pick.get('bet_type')),
                    'line_value': pick.get('line_value'),
                    'user_id': 'system-automation',  # System user for automated picks
                    'game_context': {
                        'game_time': pick.get('game_time'),
                        'opponent': pick.get('game', '').split(' @ ')[0] if ' @ ' in pick.get('game', '') else '',
                        'confidence': pick.get('confidence'),
                        'value_percentage': pick.get('value_percentage')
                    }
                }
                
                # Only save if we have a valid player_id
                if prediction_data['player_id']:
                    response = requests.post(
                        f'{self.backend_api_url}/api/player-props/prediction',
                        json=prediction_data,
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        saved_count += 1
                    else:
                        logger.warning(f"⚠️ Failed to save prediction for {pick.get('player')}: {response.status_code}")
                
            except Exception as e:
                logger.error(f"❌ Error saving prediction for {pick.get('player')}: {e}")
        
        logger.info(f"💾 Saved {saved_count}/{len(picks)} predictions to database")
        return saved_count
    
    def get_player_id(self, player_name: str) -> str:
        """Get player ID from the database (simplified implementation)."""
        if not player_name:
            return None
            
        # Map common player names to UUIDs (in production, query the database)
        player_mapping = {
            'LeBron James': '041ba9f6-6908-4308-9603-81c5b386c5d9',
            'Stephen Curry': '97fecb71-d6b4-477c-ac05-9d1782f865d4'
        }
        
        return player_mapping.get(player_name)
    
    def send_notifications(self):
        """Send notifications about daily picks (email, Slack, etc.)."""
        # Example: Send email summary
        # Example: Post to Slack channel
        # Example: Send push notifications
        logger.info("📧 Notifications sent (placeholder)")
    
    def generate_report(self) -> str:
        """Generate a formatted report of the daily analysis."""
        report = f"""
🏀 ParleyApp Daily Analysis Report - {self.results['date']}
{'='*60}

📊 Analysis Summary:
• Sports Analyzed: {', '.join(self.results['sports_analyzed'])}
• Total Props Analyzed: {self.results['total_picks']}
• Best Bets Found: {len(self.results['best_picks'])}
• Saved to Database: {self.results.get('saved_to_db', 0)}

🎯 Top Picks:
"""
        
        for i, pick in enumerate(self.results.get('top_picks', [])[:5], 1):
            report += f"""
{i}. {pick.get('player', 'Unknown')} - {pick.get('prop_type', pick.get('bet_type'))}
   Line: {pick.get('line_value')} | Prediction: {pick.get('predicted_value')}
   Recommendation: {pick.get('recommendation')} | Confidence: {pick.get('confidence')}%
   Value: {pick.get('value_percentage')}% | Game: {pick.get('game_time')}
"""
        
        if self.results['errors']:
            report += f"\n⚠️ Errors: {len(self.results['errors'])}\n"
            for error in self.results['errors'][:3]:
                report += f"• {error}\n"
        
        return report


def main():
    """Main entry point for the automation script."""
    automation = DailyAutomation()
    
    # Run the analysis
    results = automation.run_daily_analysis()
    
    # Generate and save report
    report = automation.generate_report()
    
    # Save report to file
    report_filename = f"daily_report_{datetime.now().strftime('%Y%m%d')}.txt"
    with open(report_filename, 'w') as f:
        f.write(report)
    
    # Print summary
    print(report)
    
    # Exit with appropriate code
    if results['errors']:
        sys.exit(1)  # Error occurred
    else:
        sys.exit(0)  # Success


if __name__ == '__main__':
    main() 