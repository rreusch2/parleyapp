#!/usr/bin/env python3
"""
AlphaPy Training Data Collection Script
=====================================

This script collects massive amounts of structured sports data for training AlphaPy models.
Run this to get 100k+ historical games for FREE!

Usage:
    python collect_training_data.py --sport mlb --years 5
    python collect_training_data.py --sport nfl --years 10
    python collect_training_data.py --all
"""

import os
import sys
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import argparse
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

class SportsDataCollector:
    """Collect massive amounts of historical sports data for AlphaPy training"""
    
    def __init__(self, data_dir="data/training"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # ESPN API endpoints (you already have access!)
        self.espn_base = "https://site.api.espn.com/apis/site/v2/sports"
        
        print(f"🎯 AlphaPy Data Collector Initialized")
        print(f"📁 Data directory: {self.data_dir}")
        
    def collect_kaggle_datasets(self):
        """Download massive FREE datasets from Kaggle"""
        print("\n📥 DOWNLOADING KAGGLE DATASETS (FREE)")
        print("=" * 50)
        
        # Check if kaggle is installed
        try:
            import kaggle
        except ImportError:
            print("❌ Kaggle not installed. Installing...")
            os.system("pip install kaggle")
            import kaggle
        
        datasets = [
            {
                'name': 'maxhorowitz/nflplaybyplay2009to2016',
                'description': '500k+ NFL plays with outcomes',
                'file': 'nfl_plays.csv'
            },
            {
                'name': 'seanlahman/the-history-of-baseball',
                'description': '100k+ MLB games (1871-2015)',
                'file': 'mlb_history.csv'
            },
            {
                'name': 'hugomathien/soccer',
                'description': '25k+ European soccer matches',
                'file': 'soccer_matches.csv'
            },
            {
                'name': 'sportradar/baseball',
                'description': 'Professional baseball data',
                'file': 'baseball_sportradar.csv'
            }
        ]
        
        for dataset in datasets:
            print(f"\n📦 Downloading: {dataset['description']}")
            try:
                # Download to data directory
                download_path = self.data_dir / "kaggle" / dataset['name'].split('/')[-1]
                download_path.mkdir(parents=True, exist_ok=True)
                
                os.system(f"kaggle datasets download -d {dataset['name']} -p {download_path} --unzip")
                print(f"✅ Downloaded: {dataset['name']}")
                
            except Exception as e:
                print(f"⚠️ Error downloading {dataset['name']}: {e}")
                print("💡 Make sure you have Kaggle API credentials set up")
                print("   Visit: https://www.kaggle.com/account")
        
        print(f"\n🎉 Kaggle datasets downloaded to: {self.data_dir}/kaggle/")
        return True
    
    def collect_espn_historical(self, sport="mlb", years=5):
        """Collect historical data from ESPN API (you already have access!)"""
        print(f"\n📊 COLLECTING ESPN HISTORICAL DATA: {sport.upper()}")
        print("=" * 50)
        
        sport_configs = {
            'mlb': {'espn_sport': 'baseball/mlb', 'season_start': 3, 'season_end': 10},
            'nba': {'espn_sport': 'basketball/nba', 'season_start': 10, 'season_end': 6},
            'nfl': {'espn_sport': 'football/nfl', 'season_start': 9, 'season_end': 2},
            'nhl': {'espn_sport': 'hockey/nhl', 'season_start': 10, 'season_end': 6}
        }
        
        if sport not in sport_configs:
            print(f"❌ Sport {sport} not supported")
            return False
        
        config = sport_configs[sport]
        current_year = datetime.now().year
        
        all_games = []
        
        for year in range(current_year - years, current_year + 1):
            print(f"\n📅 Collecting {year} season...")
            
            try:
                # Get season schedule
                url = f"{self.espn_base}/{config['espn_sport']}/scoreboard"
                params = {
                    'dates': f"{year}0101-{year}1231",
                    'limit': 1000
                }
                
                response = requests.get(url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    
                    if 'events' in data:
                        games = data['events']
                        print(f"   Found {len(games)} games")
                        
                        for game in games:
                            game_data = self.extract_game_features(game, sport)
                            if game_data:
                                all_games.append(game_data)
                        
                        # Rate limiting
                        time.sleep(1)
                    
            except Exception as e:
                print(f"   ⚠️ Error collecting {year}: {e}")
        
        # Save to CSV
        if all_games:
            df = pd.DataFrame(all_games)
            output_file = self.data_dir / f"{sport}_historical_{years}years.csv"
            df.to_csv(output_file, index=False)
            
            print(f"\n✅ Collected {len(all_games)} games")
            print(f"💾 Saved to: {output_file}")
            print(f"📊 Features per game: {len(df.columns)}")
            
            return df
        
        return None
    
    def extract_game_features(self, game, sport):
        """Extract features from ESPN game data for AlphaPy training"""
        try:
            # Basic game info
            features = {
                'game_id': game.get('id'),
                'date': game.get('date'),
                'sport': sport,
                'season_type': game.get('season', {}).get('type'),
                'week': game.get('week', {}).get('number', 0),
            }
            
            # Teams
            if 'competitions' in game and len(game['competitions']) > 0:
                competition = game['competitions'][0]
                competitors = competition.get('competitors', [])
                
                if len(competitors) >= 2:
                    home_team = next((c for c in competitors if c.get('homeAway') == 'home'), None)
                    away_team = next((c for c in competitors if c.get('homeAway') == 'away'), None)
                    
                    if home_team and away_team:
                        # Team info
                        features.update({
                            'home_team': home_team.get('team', {}).get('displayName'),
                            'away_team': away_team.get('team', {}).get('displayName'),
                            'home_team_id': home_team.get('team', {}).get('id'),
                            'away_team_id': away_team.get('team', {}).get('id'),
                        })
                        
                        # Scores (if game is completed)
                        if competition.get('status', {}).get('type', {}).get('completed'):
                            features.update({
                                'home_score': int(home_team.get('score', 0)),
                                'away_score': int(away_team.get('score', 0)),
                                'home_win': 1 if int(home_team.get('score', 0)) > int(away_team.get('score', 0)) else 0,
                                'total_points': int(home_team.get('score', 0)) + int(away_team.get('score', 0)),
                                'point_spread': int(home_team.get('score', 0)) - int(away_team.get('score', 0))
                            })
                        
                        # Team records
                        if 'records' in home_team:
                            for record in home_team['records']:
                                if record.get('type') == 'total':
                                    features['home_wins'] = record.get('wins', 0)
                                    features['home_losses'] = record.get('losses', 0)
                        
                        if 'records' in away_team:
                            for record in away_team['records']:
                                if record.get('type') == 'total':
                                    features['away_wins'] = record.get('wins', 0)
                                    features['away_losses'] = record.get('losses', 0)
                        
                        # Odds (if available)
                        if 'odds' in competition:
                            odds = competition['odds'][0] if competition['odds'] else {}
                            features.update({
                                'spread_line': odds.get('spread'),
                                'total_line': odds.get('overUnder'),
                                'home_moneyline': odds.get('homeTeamOdds', {}).get('moneyLine'),
                                'away_moneyline': odds.get('awayTeamOdds', {}).get('moneyLine')
                            })
            
            return features
            
        except Exception as e:
            print(f"   ⚠️ Error extracting features: {e}")
            return None
    
    def collect_sports_reference_data(self, sport="mlb", years=5):
        """Scrape historical data from Sports-Reference (FREE)"""
        print(f"\n🕷️ SCRAPING SPORTS-REFERENCE: {sport.upper()}")
        print("=" * 50)
        
        base_urls = {
            'mlb': 'https://www.baseball-reference.com/years/{}-schedule.shtml',
            'nba': 'https://www.basketball-reference.com/leagues/NBA_{}_games.html',
            'nfl': 'https://www.pro-football-reference.com/years/{}/games.htm',
            'nhl': 'https://www.hockey-reference.com/leagues/NHL_{}_games.html'
        }
        
        if sport not in base_urls:
            print(f"❌ Sport {sport} not supported for scraping")
            return False
        
        current_year = datetime.now().year
        all_games = []
        
        for year in range(current_year - years, current_year + 1):
            print(f"\n📅 Scraping {year} season...")
            
            try:
                url = base_urls[sport].format(year)
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
                
                response = requests.get(url, headers=headers)
                if response.status_code == 200:
                    # Parse HTML with pandas (works great for sports-reference tables)
                    tables = pd.read_html(response.content)
                    
                    if tables:
                        games_df = tables[0]  # Usually the first table
                        games_df['season'] = year
                        games_df['sport'] = sport
                        
                        print(f"   Found {len(games_df)} games")
                        all_games.append(games_df)
                
                # Be respectful with rate limiting
                time.sleep(2)
                
            except Exception as e:
                print(f"   ⚠️ Error scraping {year}: {e}")
        
        # Combine all years
        if all_games:
            combined_df = pd.concat(all_games, ignore_index=True)
            output_file = self.data_dir / f"{sport}_reference_{years}years.csv"
            combined_df.to_csv(output_file, index=False)
            
            print(f"\n✅ Scraped {len(combined_df)} games")
            print(f"💾 Saved to: {output_file}")
            
            return combined_df
        
        return None
    
    def prepare_alphapy_format(self, sport="mlb"):
        """Convert collected data to AlphaPy SportFlow format"""
        print(f"\n🔧 PREPARING ALPHAPY FORMAT: {sport.upper()}")
        print("=" * 50)
        
        # Find all data files for this sport
        data_files = list(self.data_dir.glob(f"{sport}_*.csv"))
        
        if not data_files:
            print(f"❌ No data files found for {sport}")
            return False
        
        all_data = []
        for file in data_files:
            print(f"📁 Loading: {file.name}")
            df = pd.read_csv(file)
            all_data.append(df)
        
        # Combine all data
        combined_df = pd.concat(all_data, ignore_index=True)
        print(f"📊 Combined dataset: {len(combined_df)} games")
        
        # Create AlphaPy directory structure
        alphapy_dir = self.data_dir / "alphapy" / sport
        alphapy_dir.mkdir(parents=True, exist_ok=True)
        
        # Split features and targets
        feature_columns = [col for col in combined_df.columns 
                          if col not in ['home_win', 'home_score', 'away_score', 'total_points', 'point_spread']]
        
        target_columns = ['home_win', 'home_score', 'away_score', 'total_points', 'point_spread']
        target_columns = [col for col in target_columns if col in combined_df.columns]
        
        # Save in AlphaPy format
        features_df = combined_df[feature_columns].fillna(0)
        targets_df = combined_df[target_columns].fillna(0)
        
        features_file = alphapy_dir / f"{sport}_features.csv"
        targets_file = alphapy_dir / f"{sport}_targets.csv"
        
        features_df.to_csv(features_file, index=False)
        targets_df.to_csv(targets_file, index=False)
        
        print(f"✅ AlphaPy format ready!")
        print(f"📊 Features: {len(feature_columns)} columns")
        print(f"🎯 Targets: {len(target_columns)} columns")
        print(f"💾 Saved to: {alphapy_dir}")
        
        return True
    
    def collect_all_sports(self, years=5):
        """Collect data for all major sports"""
        print("\n🚀 COLLECTING ALL SPORTS DATA")
        print("=" * 50)
        
        sports = ['mlb', 'nba', 'nfl', 'nhl']
        
        # Start with Kaggle datasets
        self.collect_kaggle_datasets()
        
        # Collect ESPN data for each sport
        for sport in sports:
            print(f"\n🏈 Processing {sport.upper()}...")
            
            # ESPN historical data
            self.collect_espn_historical(sport, years)
            
            # Sports-Reference data
            self.collect_sports_reference_data(sport, years)
            
            # Prepare AlphaPy format
            self.prepare_alphapy_format(sport)
        
        print(f"\n🎉 DATA COLLECTION COMPLETE!")
        print(f"📁 All data saved to: {self.data_dir}")
        print(f"🤖 Ready for AlphaPy training!")

def main():
    parser = argparse.ArgumentParser(description='Collect massive sports data for AlphaPy training')
    parser.add_argument('--sport', choices=['mlb', 'nba', 'nfl', 'nhl'], help='Specific sport to collect')
    parser.add_argument('--years', type=int, default=5, help='Number of years of historical data')
    parser.add_argument('--all', action='store_true', help='Collect data for all sports')
    parser.add_argument('--kaggle-only', action='store_true', help='Only download Kaggle datasets')
    
    args = parser.parse_args()
    
    collector = SportsDataCollector()
    
    if args.kaggle_only:
        collector.collect_kaggle_datasets()
    elif args.all:
        collector.collect_all_sports(args.years)
    elif args.sport:
        collector.collect_espn_historical(args.sport, args.years)
        collector.collect_sports_reference_data(args.sport, args.years)
        collector.prepare_alphapy_format(args.sport)
    else:
        print("❌ Please specify --sport, --all, or --kaggle-only")
        parser.print_help()

if __name__ == "__main__":
    main() 