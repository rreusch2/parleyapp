#!/usr/bin/env python3
"""
Smart Pick Distribution Helper
Handles intelligent pick distribution for tiered subscriptions and sport preferences
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

class SmartPickDistributor:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Tier limits
        self.TIER_LIMITS = {
            'elite': 30,
            'pro': 20,
            'free': 10
        }

    def get_available_sports_for_date(self, target_date: str) -> Dict[str, int]:
        """Get count of games available by sport for a specific date"""
        try:
            start_date = f"{target_date} 00:00:00+00"
            end_date = f"{target_date} 23:59:59+00"
            
            result = self.supabase.table("sports_events").select(
                "sport"
            ).gte("start_time", start_date).lte("start_time", end_date).execute()
            
            sports_count = {}
            for game in result.data:
                sport = game['sport']
                # Map to abbreviations
                if sport == "Major League Baseball":
                    sports_count['MLB'] = sports_count.get('MLB', 0) + 1
                elif sport == "Women's National Basketball Association":
                    sports_count['WNBA'] = sports_count.get('WNBA', 0) + 1
                elif sport == "Ultimate Fighting Championship":
                    sports_count['UFC'] = sports_count.get('UFC', 0) + 1
                    
            return sports_count
            
        except Exception as e:
            logging.error(f"Error getting sports for date {target_date}: {e}")
            return {}

    def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get user's subscription tier and sport preferences"""
        try:
            result = self.supabase.table("profiles").select(
                "subscription_tier, max_daily_picks, sport_preferences"
            ).eq("id", user_id).single().execute()
            
            return result.data
        except Exception as e:
            logging.error(f"Error getting user preferences for {user_id}: {e}")
            return {
                'subscription_tier': 'free',
                'max_daily_picks': 10,
                'sport_preferences': {'mlb': True, 'wnba': True, 'ufc': True}
            }

    def calculate_smart_distribution(self, 
                                   user_preferences: Dict[str, Any],
                                   available_sports: Dict[str, int],
                                   target_date: str) -> Dict[str, Dict[str, int]]:
        """
        Calculate intelligent pick distribution based on:
        - User's subscription tier limits
        - User's sport preferences  
        - Available games for the date
        - Fallback logic for insufficient preferred sports
        """
        
        tier = user_preferences.get('subscription_tier', 'free')
        max_picks = self.TIER_LIMITS.get(tier, 10)
        sport_prefs = user_preferences.get('sport_preferences', {})
        
        # Convert sport preferences to list of preferred sports
        preferred_sports = []
        for sport, enabled in sport_prefs.items():
            if enabled:
                preferred_sports.append(sport.upper())
        
        # If no preferences set, include all available sports
        if not preferred_sports:
            preferred_sports = list(available_sports.keys())
        
        logging.info(f"User tier: {tier}, Max picks: {max_picks}")
        logging.info(f"Preferred sports: {preferred_sports}")
        logging.info(f"Available sports: {available_sports}")
        
        # Calculate picks distribution
        distribution = {
            'teams': {},
            'props': {},
            'total_allocated': 0,
            'fallback_used': False
        }
        
        # First, try to allocate from preferred sports only
        preferred_available = {
            sport: count for sport, count in available_sports.items() 
            if sport in preferred_sports
        }
        
        # Calculate total preferred games available
        total_preferred_games = sum(preferred_available.values())
        
        if total_preferred_games == 0:
            # No preferred sports have games - use all available sports
            distribution['fallback_used'] = True
            preferred_available = available_sports.copy()
            logging.warning(f"No games in preferred sports, using all available: {list(available_sports.keys())}")
        
        # Distribute picks across available preferred sports
        picks_per_sport = {}
        remaining_picks = max_picks
        
        for sport, game_count in preferred_available.items():
            if remaining_picks <= 0:
                break
                
            # Maximum picks per sport is 15 teams + 15 props = 30
            # But limit based on available games (assume ~3 picks per game max)
            max_sport_picks = min(30, game_count * 3)
            
            # Calculate fair distribution
            if len(preferred_available) == 1:
                # Only one sport available - give it all remaining picks
                sport_picks = min(remaining_picks, max_sport_picks)
            else:
                # Multiple sports - distribute evenly with minimum 5 per sport
                base_allocation = max(5, remaining_picks // len(preferred_available))
                sport_picks = min(base_allocation, max_sport_picks)
            
            picks_per_sport[sport] = sport_picks
            remaining_picks -= sport_picks
        
        # Distribute any remaining picks to sports that can handle more
        while remaining_picks > 0:
            allocated = False
            for sport in preferred_available:
                if remaining_picks <= 0:
                    break
                    
                current_picks = picks_per_sport.get(sport, 0)
                max_sport_picks = min(30, preferred_available[sport] * 3)
                
                if current_picks < max_sport_picks:
                    picks_per_sport[sport] += 1
                    remaining_picks -= 1
                    allocated = True
            
            if not allocated:
                # Can't allocate more picks anywhere
                break
        
        # Split each sport's picks between teams and props
        for sport, total_picks in picks_per_sport.items():
            team_picks = total_picks // 2
            prop_picks = total_picks - team_picks
            
            distribution['teams'][sport] = team_picks
            distribution['props'][sport] = prop_picks
            distribution['total_allocated'] += total_picks
        
        logging.info(f"Final distribution: Teams={distribution['teams']}, Props={distribution['props']}")
        logging.info(f"Total allocated: {distribution['total_allocated']}/{max_picks}")
        
        return distribution

# Usage example and testing
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    distributor = SmartPickDistributor()
    
    # Test with different user scenarios
    test_scenarios = [
        {
            'name': 'Elite user prefers only WNBA',
            'user_prefs': {
                'subscription_tier': 'elite',
                'max_daily_picks': 30,
                'sport_preferences': {'mlb': False, 'wnba': True, 'ufc': False}
            }
        },
        {
            'name': 'Pro user prefers MLB and UFC',
            'user_prefs': {
                'subscription_tier': 'pro', 
                'max_daily_picks': 20,
                'sport_preferences': {'mlb': True, 'wnba': False, 'ufc': True}
            }
        },
        {
            'name': 'Free user likes all sports',
            'user_prefs': {
                'subscription_tier': 'free',
                'max_daily_picks': 10,
                'sport_preferences': {'mlb': True, 'wnba': True, 'ufc': True}
            }
        }
    ]
    
    # Get today's available sports
    today = datetime.now().strftime('%Y-%m-%d')
    available_sports = distributor.get_available_sports_for_date(today)
    
    print(f"\n🗓️ Testing for {today}")
    print(f"📊 Available sports: {available_sports}")
    print("=" * 60)
    
    for scenario in test_scenarios:
        print(f"\n🧪 {scenario['name']}")
        distribution = distributor.calculate_smart_distribution(
            scenario['user_prefs'], 
            available_sports, 
            today
        )
        print(f"   Teams: {distribution['teams']}")
        print(f"   Props: {distribution['props']}")
        print(f"   Total: {distribution['total_allocated']}")
        if distribution['fallback_used']:
            print("   ⚠️  Fallback used (preferred sports had no games)")