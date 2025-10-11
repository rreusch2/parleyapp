#!/usr/bin/env python3
"""
Bet Result Checker for ParleyApp
Automatically checks if predictions won or lost using StatMuse and TheOdds API
No AI needed - just data fetching and comparison logic
"""

import os
import sys
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# API Configuration
STATMUSE_URL = os.getenv("STATMUSE_API_URL", "http://localhost:5001")
THEODDS_API_KEY = os.getenv("THEODDS_API_KEY")
THEODDS_BASE_URL = "https://api.the-odds-api.com/v4"

# Sport mappings
SPORT_MAP = {
    "MLB": "baseball_mlb",
    "WNBA": "basketball_wnba",
    "UFC": "mma_mixed_martial_arts",
    "CFB": "americanfootball_ncaaf",
    "NFL": "americanfootball_nfl",
    "NBA": "basketball_nba"
}

class BetResultChecker:
    """Main class for checking bet results"""
    
    def __init__(self):
        self.checked_count = 0
        self.won_count = 0
        self.lost_count = 0
        self.error_count = 0
        self.skipped_count = 0
    
    def check_pending_bets(self, hours_ago: int = None, silent_skip: bool = True) -> Dict:
        """
        Check all pending bets from the last N hours (or all if None)
        
        Args:
            hours_ago: How far back to check (None = all pending bets)
            silent_skip: If True, don't print warnings for unfinished games
        """
        if hours_ago:
            print(f"\n🔍 Checking pending bets from the last {hours_ago} hours...\n")
            cutoff = datetime.utcnow() - timedelta(hours=hours_ago)
            response = supabase.table("ai_predictions").select("*").eq("status", "pending").lt("event_time", datetime.utcnow().isoformat()).gte("created_at", cutoff.isoformat()).execute()
        else:
            print(f"\n🔍 Checking ALL pending bets...\n")
            response = supabase.table("ai_predictions").select("*").eq("status", "pending").execute()
        
        predictions = response.data
        print(f"📊 Found {len(predictions)} pending bets to check\n")
        
        self.silent_skip = silent_skip
        
        for pred in predictions:
            self._check_single_bet(pred)
        
        # Print summary
        self._print_summary()
        
        return {
            "checked": self.checked_count,
            "won": self.won_count,
            "lost": self.lost_count,
            "skipped": self.skipped_count,
            "errors": self.error_count
        }
    
    def _check_single_bet(self, prediction: Dict):
        """Check a single bet result"""
        try:
            bet_type = prediction.get("bet_type")
            
            if bet_type == "player_prop":
                self._check_player_prop(prediction)
            elif bet_type in ["moneyline", "spread", "total"]:
                self._check_team_bet(prediction)
            else:
                print(f"⚠️  Unknown bet type: {bet_type}")
                self.error_count += 1
        
        except Exception as e:
            print(f"❌ Error checking bet {prediction.get('id')}: {str(e)}")
            self.error_count += 1
    
    def _check_player_prop(self, prediction: Dict):
        """Check player prop bet using StatMuse"""
        
        try:
            # Extract player and stat from metadata
            metadata = prediction.get("metadata", {})
            player_name = metadata.get("player_name")
            prop_type = prediction.get("prop_market_type")
            line = metadata.get("line")
            recommendation = metadata.get("recommendation", "").upper()
            
            if not all([player_name, prop_type, line]):
                if not self.silent_skip:
                    print(f"🏃 Checking player prop: {prediction['pick']}")
                    print(f"  ⚠️  Missing data - skipping")
                self.skipped_count += 1
                return
            
            # Get game date from event_time
            event_date = prediction["event_time"].split("T")[0]
            
            # Query StatMuse for actual result
            actual_value = self._get_player_stat_from_statmuse(
                player_name, 
                prop_type, 
                prediction["sport"],
                event_date
            )
            
            if actual_value is None:
                # Game not finished yet - silently skip
                self.skipped_count += 1
                return
            
            # Only print if we have a result
            print(f"🏃 Checking player prop: {prediction['pick']}")
            
            # Determine if bet won
            won = self._evaluate_prop_result(actual_value, line, recommendation)
            
            # Update database
            self._update_bet_result(
                prediction["id"],
                "won" if won else "lost",
                actual_value
            )
            
            # Update counters
            self.checked_count += 1
            if won:
                self.won_count += 1
                print(f"  ✅ WON - {player_name} had {actual_value} (line: {line})")
            else:
                self.lost_count += 1
                print(f"  ❌ LOST - {player_name} had {actual_value} (line: {line})")
        
        except Exception as e:
            if not self.silent_skip:
                print(f"🏃 Checking player prop: {prediction['pick']}")
                print(f"  ❌ Error: {str(e)}")
    
    def _check_team_bet(self, prediction: Dict):
        """Check team bet (moneyline/spread/total) using TheOdds API or ESPN"""
        
        try:
            # Parse teams from match_teams
            teams = prediction["match_teams"]
            bet_type = prediction["bet_type"]
            metadata = prediction.get("metadata", {})
            
            # Get game result
            game_result = self._get_game_result(
                prediction["sport"],
                teams,
                prediction["event_time"]
            )
            
            if not game_result:
                # Game not finished yet - silently skip
                self.skipped_count += 1
                return
            
            # Only print if we have a result
            print(f"🏈 Checking team bet: {prediction['pick']}")
            
            # Determine if bet won based on bet type
            won = self._evaluate_team_bet(
                bet_type,
                prediction["pick"],
                metadata,
                game_result
            )
            
            # Update database
            self._update_bet_result(
                prediction["id"],
                "won" if won else "lost",
                game_result
            )
            
            # Update counters
            self.checked_count += 1
            if won:
                self.won_count += 1
                print(f"  ✅ WON - Final: {game_result['home_team']} {game_result['home_score']} - {game_result['away_score']} {game_result['away_team']}")
            else:
                self.lost_count += 1
                print(f"  ❌ LOST - Final: {game_result['home_team']} {game_result['home_score']} - {game_result['away_score']} {game_result['away_team']}")
        
        except Exception as e:
            if not self.silent_skip:
                print(f"🏈 Checking team bet: {prediction['pick']}")
                print(f"  ❌ Error: {str(e)}")
    
    def _get_player_stat_from_statmuse(
        self, 
        player_name: str, 
        prop_type: str, 
        sport: str,
        game_date: str
    ) -> Optional[float]:
        """Query StatMuse for player's actual performance"""
        try:
            # Map prop type to StatMuse query
            stat_queries = {
                "Pass Yards O/U": f"how many passing yards did {player_name} have on {game_date}",
                "Hits O/U": f"how many hits did {player_name} have on {game_date}",
                "Pass TDs O/U": f"how many passing touchdowns did {player_name} have on {game_date}",
                "Rush Yards O/U": f"how many rushing yards did {player_name} have on {game_date}",
                "Points O/U": f"how many points did {player_name} score on {game_date}",
                "Rebounds O/U": f"how many rebounds did {player_name} have on {game_date}",
                "Assists O/U": f"how many assists did {player_name} have on {game_date}",
                "Strikeouts O/U": f"how many strikeouts did {player_name} have on {game_date}",
                "Home Runs O/U": f"how many home runs did {player_name} hit on {game_date}",
            }
            
            query = stat_queries.get(prop_type, f"{player_name} {prop_type} {game_date}")
            
            # Query StatMuse
            response = requests.post(
                f"{STATMUSE_URL}/query",
                json={"query": query, "sport": sport.lower()},
                timeout=30
            )
            
            if response.status_code != 200:
                return None
            
            result = response.json()
            
            # Parse the numerical answer from StatMuse response
            answer = result.get("answer", "")
            
            # Extract number from answer (e.g., "285" from "Noah Fifita had 285 passing yards")
            import re
            numbers = re.findall(r'\d+\.?\d*', answer)
            
            if numbers:
                return float(numbers[0])
            
            return None
        
        except Exception as e:
            print(f"    StatMuse error: {str(e)}")
            return None
    
    def _get_game_result(
        self, 
        sport: str, 
        teams: str, 
        event_time: str
    ) -> Optional[Dict]:
        """Get final game score from TheOdds API or ESPN"""
        try:
            # Try TheOdds API first if available
            if THEODDS_API_KEY:
                return self._get_result_from_theodds(sport, teams, event_time)
            
            # Fallback to ESPN API (free)
            return self._get_result_from_espn(sport, teams, event_time)
        
        except Exception as e:
            print(f"    Error fetching game result: {str(e)}")
            return None
    
    def _get_result_from_theodds(
        self, 
        sport: str, 
        teams: str, 
        event_time: str
    ) -> Optional[Dict]:
        """Fetch result from TheOdds API scores endpoint"""
        try:
            sport_key = SPORT_MAP.get(sport, sport.lower())
            
            response = requests.get(
                f"{THEODDS_BASE_URL}/sports/{sport_key}/scores/",
                params={
                    "apiKey": THEODDS_API_KEY,
                    "daysFrom": 3
                },
                timeout=10
            )
            
            if response.status_code != 200:
                return None
            
            games = response.json()
            
            # Find matching game by teams
            for game in games:
                if game.get("completed") and teams in f"{game.get('home_team')} @ {game.get('away_team')}":
                    scores = game.get("scores", [])
                    if len(scores) >= 2:
                        return {
                            "home_team": game.get("home_team"),
                            "away_team": game.get("away_team"),
                            "home_score": scores[0].get("score"),
                            "away_score": scores[1].get("score"),
                            "completed": True
                        }
            
            return None
        
        except Exception:
            return None
    
    def _get_result_from_espn(
        self, 
        sport: str, 
        teams: str, 
        event_time: str
    ) -> Optional[Dict]:
        """Fallback: Fetch result from ESPN API (free)"""
        # ESPN API endpoints by sport
        espn_map = {
            "MLB": "baseball/mlb",
            "NBA": "basketball/nba",
            "WNBA": "basketball/wnba",
            "NFL": "football/nfl",
            "CFB": "football/college-football"
        }
        
        espn_sport = espn_map.get(sport)
        if not espn_sport:
            return None
        
        try:
            # Get date from event_time
            date = event_time.split("T")[0].replace("-", "")
            
            response = requests.get(
                f"https://site.api.espn.com/apis/site/v2/sports/{espn_sport}/scoreboard",
                params={"dates": date},
                timeout=10
            )
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            events = data.get("events", [])
            
            # Find matching game
            for event in events:
                competition = event.get("competitions", [{}])[0]
                competitors = competition.get("competitors", [])
                
                if len(competitors) >= 2:
                    home = competitors[0] if competitors[0].get("homeAway") == "home" else competitors[1]
                    away = competitors[1] if competitors[1].get("homeAway") == "away" else competitors[0]
                    
                    event_name = f"{away.get('team', {}).get('displayName')} @ {home.get('team', {}).get('displayName')}"
                    
                    if teams in event_name or event_name in teams:
                        if competition.get("status", {}).get("type", {}).get("completed"):
                            return {
                                "home_team": home.get("team", {}).get("displayName"),
                                "away_team": away.get("team", {}).get("displayName"),
                                "home_score": int(home.get("score", 0)),
                                "away_score": int(away.get("score", 0)),
                                "completed": True
                            }
            
            return None
        
        except Exception:
            return None
    
    def _evaluate_prop_result(
        self, 
        actual_value: float, 
        line: float, 
        recommendation: str
    ) -> bool:
        """Determine if prop bet won"""
        if recommendation == "OVER":
            return actual_value > line
        elif recommendation == "UNDER":
            return actual_value < line
        else:
            return False
    
    def _evaluate_team_bet(
        self, 
        bet_type: str, 
        pick: str, 
        metadata: Dict, 
        game_result: Dict
    ) -> bool:
        """Determine if team bet won"""
        home_score = game_result["home_score"]
        away_score = game_result["away_score"]
        
        if bet_type == "moneyline":
            # Check which team was picked
            if "home" in metadata.get("recommendation", "").lower():
                return home_score > away_score
            else:
                return away_score > home_score
        
        elif bet_type == "spread":
            line = float(metadata.get("line", 0))
            recommendation = metadata.get("recommendation", "").lower()
            
            if "home" in recommendation:
                return (home_score + line) > away_score
            else:
                return (away_score + line) > home_score
        
        elif bet_type == "total":
            line = float(metadata.get("line", 0))
            total_score = home_score + away_score
            
            if "over" in pick.lower():
                return total_score > line
            else:
                return total_score < line
        
        return False
    
    def _update_bet_result(self, prediction_id: str, status: str, result_data):
        """Update prediction with result"""
        try:
            # Prepare update data
            update_data = {
                "status": status,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Add result data to metadata
            if isinstance(result_data, dict):
                # Team bet result
                update_data["metadata"] = {
                    **self._get_existing_metadata(prediction_id),
                    "result": result_data
                }
            else:
                # Player prop result
                update_data["metadata"] = {
                    **self._get_existing_metadata(prediction_id),
                    "actual_value": result_data
                }
            
            # Update in Supabase
            supabase.table("ai_predictions").update(update_data).eq("id", prediction_id).execute()
        
        except Exception as e:
            print(f"    ⚠️  Error updating database: {str(e)}")
    
    def _get_existing_metadata(self, prediction_id: str) -> Dict:
        """Get existing metadata to preserve it"""
        try:
            response = supabase.table("ai_predictions").select("metadata").eq("id", prediction_id).single().execute()
            return response.data.get("metadata", {})
        except:
            return {}
    
    def _print_summary(self):
        """Print results summary"""
        print("\n" + "="*60)
        print("📊 BET CHECKING SUMMARY")
        print("="*60)
        print(f"✅ Won:         {self.won_count}")
        print(f"❌ Lost:        {self.lost_count}")
        print(f"📈 Total:       {self.checked_count}")
        print(f"⏭️  Skipped:     {self.skipped_count} (games not finished yet)")
        
        if self.error_count > 0:
            print(f"⚠️  Errors:      {self.error_count}")
        
        if self.checked_count > 0:
            win_rate = (self.won_count / self.checked_count) * 100
            print(f"🎯 Win Rate:    {win_rate:.1f}%")
        
        print("="*60 + "\n")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Check bet results for ParleyApp predictions")
    parser.add_argument(
        "--hours",
        type=int,
        default=None,
        help="Check bets from the last N hours (default: all pending bets)"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show warnings for unfinished games"
    )
    
    args = parser.parse_args()
    
    checker = BetResultChecker()
    
    # Check all pending bets by default, silently skip unfinished games
    checker.check_pending_bets(hours_ago=args.hours, silent_skip=not args.verbose)


if __name__ == "__main__":
    main()
