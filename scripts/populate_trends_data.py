#!/usr/bin/env python3
"""
Script to populate player_trend_patterns table from existing AI predictions and game stats
This creates the enhanced trends data for the mobile app
"""

import os
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import asyncio
import asyncpg
import numpy as np
from statistics import median, stdev

# Database connection details
DB_HOST = "db.iriaegoipkjtktitpary.supabase.co"
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD")  # Set in environment

class TrendsDataPopulator:
    def __init__(self):
        self.conn = None
        
    async def connect(self):
        """Connect to Supabase Postgres database"""
        if not DB_PASSWORD:
            raise ValueError("SUPABASE_DB_PASSWORD environment variable not set")
            
        self.conn = await asyncpg.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=5432,
            ssl='require'
        )
        print("Connected to Supabase database")

    async def close(self):
        """Close database connection"""
        if self.conn:
            await self.conn.close()

    async def get_active_players_with_predictions(self) -> List[Dict]:
        """Get players who have AI predictions"""
        query = """
        SELECT DISTINCT 
            p.id,
            p.name,
            p.team,
            p.sport,
            p.position,
            COUNT(ap.id) as prediction_count
        FROM players p
        INNER JOIN ai_predictions ap ON p.id = ap.player_id
        WHERE p.active = true
            AND ap.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.id, p.name, p.team, p.sport, p.position
        HAVING COUNT(ap.id) >= 3
        ORDER BY prediction_count DESC
        """
        
        rows = await self.conn.fetch(query)
        return [dict(row) for row in rows]

    async def get_player_prop_types(self, player_id: str) -> List[Dict]:
        """Get distinct prop types for a player from AI predictions"""
        query = """
        SELECT DISTINCT 
            ap.prop_market_type,
            COUNT(*) as frequency,
            AVG(ap.confidence) as avg_confidence,
            AVG(ap.line_value) as avg_line_value
        FROM ai_predictions ap
        WHERE ap.player_id = $1
            AND ap.prop_market_type IS NOT NULL
            AND ap.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY ap.prop_market_type
        HAVING COUNT(*) >= 3
        ORDER BY frequency DESC
        """
        
        rows = await self.conn.fetch(query, player_id)
        return [dict(row) for row in rows]

    async def get_player_game_stats(self, player_id: str, stat_type: str, days: int = 90) -> List[Dict]:
        """Get recent game stats for a player and stat type"""
        # Map prop market types to stat types
        stat_mapping = {
            'passing_yards': 'passing_yards',
            'rushing_yards': 'rushing_yards', 
            'receiving_yards': 'receiving_yards',
            'receptions': 'receptions',
            'points': 'points',
            'assists': 'assists',
            'rebounds': 'rebounds',
            'hits': 'hits',
            'runs': 'runs',
            'rbis': 'rbis'
        }
        
        db_stat_type = stat_mapping.get(stat_type.lower(), stat_type.lower())
        
        query = f"""
        SELECT 
            pgs.game_date,
            pgs.stat_value,
            pgs.is_home,
            se.home_team_id,
            se.away_team_id,
            t_home.abbreviation as home_team,
            t_away.abbreviation as away_team
        FROM player_game_stats pgs
        LEFT JOIN sports_events se ON pgs.event_id = se.id
        LEFT JOIN teams t_home ON se.home_team_id = t_home.id
        LEFT JOIN teams t_away ON se.away_team_id = t_away.id
        WHERE pgs.player_id = $1
            AND pgs.stat_type = $2
            AND pgs.game_date >= $3
            AND pgs.stat_value IS NOT NULL
        ORDER BY pgs.game_date DESC
        LIMIT 50
        """
        
        cutoff_date = datetime.now() - timedelta(days=days)
        rows = await self.conn.fetch(query, player_id, db_stat_type, cutoff_date)
        return [dict(row) for row in rows]

    async def calculate_trend_metrics(self, game_stats: List[Dict], line_value: float) -> Dict[str, Any]:
        """Calculate trend pattern metrics from game stats"""
        if not game_stats:
            return {}

        values = [float(stat['stat_value']) for stat in game_stats if stat['stat_value'] is not None]
        
        if len(values) < 3:
            return {}

        # Basic statistics
        avg_value = np.mean(values)
        median_value = median(values)
        std_dev = stdev(values) if len(values) > 1 else 0
        
        # Hit rate calculation (over the line)
        overs = sum(1 for v in values if v > line_value)
        hit_rate = (overs / len(values)) * 100
        
        # Current streak calculation
        current_streak = 0
        streak_type = 'over'
        
        if values:
            recent_results = ['over' if v > line_value else 'under' for v in values[:10]]
            if recent_results:
                streak_type = recent_results[0]
                for result in recent_results:
                    if result == streak_type:
                        current_streak += 1
                    else:
                        break

        # Last 10 games analysis
        last_10_games = []
        for i, stat in enumerate(game_stats[:10]):
            opponent = stat['away_team'] if stat['is_home'] else stat['home_team']
            result = 'over' if stat['stat_value'] > line_value else 'under'
            
            last_10_games.append({
                'game_date': stat['game_date'].isoformat() if stat['game_date'] else None,
                'opponent': opponent or 'Unknown',
                'value': float(stat['stat_value']),
                'line_value': line_value,
                'result': result,
                'is_home': stat['is_home']
            })

        # Confidence score based on consistency and sample size
        consistency_factor = 1 - (std_dev / avg_value) if avg_value > 0 else 0
        sample_size_factor = min(len(values) / 20, 1.0)  # Max factor at 20+ games
        hit_rate_factor = abs(hit_rate - 50) / 50  # Higher for extreme hit rates
        
        confidence_score = (consistency_factor * 0.4 + sample_size_factor * 0.3 + hit_rate_factor * 0.3) * 100
        confidence_score = max(0, min(100, confidence_score))

        # Key factors analysis
        key_factors = []
        
        if hit_rate > 70:
            key_factors.append('Strong over trend')
        elif hit_rate < 30:
            key_factors.append('Strong under trend')
            
        if current_streak >= 5:
            key_factors.append(f'{current_streak}-game {streak_type} streak')
            
        home_stats = [v for i, v in enumerate(values) if i < len(game_stats) and game_stats[i]['is_home']]
        away_stats = [v for i, v in enumerate(values) if i < len(game_stats) and not game_stats[i]['is_home']]
        
        if len(home_stats) >= 3 and len(away_stats) >= 3:
            home_avg = np.mean(home_stats)
            away_avg = np.mean(away_stats)
            if home_avg > away_avg * 1.15:
                key_factors.append('Strong home performance')
            elif away_avg > home_avg * 1.15:
                key_factors.append('Better road performance')

        return {
            'sample_size': len(values),
            'hit_rate': round(hit_rate, 1),
            'avg_value': round(avg_value, 2),
            'median_value': round(median_value, 2),
            'std_dev': round(std_dev, 2),
            'current_streak': current_streak,
            'streak_type': streak_type,
            'confidence_score': round(confidence_score, 1),
            'last_10_games': last_10_games,
            'key_factors': key_factors
        }

    async def create_trend_pattern(self, player_id: str, prop_data: Dict, metrics: Dict) -> bool:
        """Create or update a trend pattern record"""
        try:
            # Get or create prop type
            prop_type_query = """
            SELECT id FROM player_prop_types 
            WHERE prop_name = $1 AND category = $2
            """
            
            prop_name = prop_data['prop_market_type']
            category = self.get_prop_category(prop_name)
            
            prop_type_row = await self.conn.fetchrow(prop_type_query, prop_name, category)
            
            if not prop_type_row:
                # Create new prop type
                create_prop_type_query = """
                INSERT INTO player_prop_types (prop_name, category, sport, unit)
                VALUES ($1, $2, $3, $4)
                RETURNING id
                """
                
                sport = await self.conn.fetchval(
                    "SELECT sport FROM players WHERE id = $1", player_id
                )
                
                prop_type_row = await self.conn.fetchrow(
                    create_prop_type_query, 
                    prop_name, 
                    category, 
                    sport,
                    self.get_prop_unit(prop_name)
                )
            
            prop_type_id = prop_type_row['id']

            # Create trend pattern
            insert_query = """
            INSERT INTO player_trend_patterns (
                player_id,
                prop_type_id, 
                pattern_type,
                pattern_name,
                sample_size,
                hit_rate,
                avg_value,
                median_value,
                std_dev,
                current_streak,
                streak_type,
                confidence_score,
                last_10_games,
                key_factors,
                conditions,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (player_id, prop_type_id) 
            DO UPDATE SET
                sample_size = $5,
                hit_rate = $6,
                avg_value = $7,
                median_value = $8,
                std_dev = $9,
                current_streak = $10,
                streak_type = $11,
                confidence_score = $12,
                last_10_games = $13,
                key_factors = $14,
                last_updated = NOW(),
                is_active = $16
            """
            
            await self.conn.execute(
                insert_query,
                player_id,
                prop_type_id,
                'statistical',
                f'{prop_name.title()} Trend',
                metrics['sample_size'],
                metrics['hit_rate'],
                metrics['avg_value'],
                metrics['median_value'],
                metrics['std_dev'],
                metrics['current_streak'],
                metrics['streak_type'],
                metrics['confidence_score'],
                json.dumps(metrics['last_10_games']),
                metrics['key_factors'],
                json.dumps({}),  # conditions
                True  # is_active
            )
            
            return True
            
        except Exception as e:
            print(f"Error creating trend pattern for player {player_id}: {e}")
            return False

    def get_prop_category(self, prop_name: str) -> str:
        """Map prop name to category"""
        passing_props = ['passing_yards', 'passing_tds', 'completions', 'pass_attempts']
        rushing_props = ['rushing_yards', 'rushing_tds', 'rushing_attempts']
        receiving_props = ['receiving_yards', 'receptions', 'receiving_tds']
        scoring_props = ['points', 'touchdowns', 'field_goals']
        basketball_props = ['points', 'assists', 'rebounds', 'steals', 'blocks']
        baseball_props = ['hits', 'runs', 'rbis', 'home_runs', 'strikeouts']
        
        prop_lower = prop_name.lower()
        
        if any(p in prop_lower for p in passing_props):
            return 'passing'
        elif any(p in prop_lower for p in rushing_props):
            return 'rushing'
        elif any(p in prop_lower for p in receiving_props):
            return 'receiving'
        elif any(p in prop_lower for p in scoring_props):
            return 'scoring'
        elif any(p in prop_lower for p in basketball_props):
            return 'basketball'
        elif any(p in prop_lower for p in baseball_props):
            return 'baseball'
        else:
            return 'other'

    def get_prop_unit(self, prop_name: str) -> str:
        """Get unit for prop type"""
        if 'yards' in prop_name.lower():
            return 'yards'
        elif any(word in prop_name.lower() for word in ['points', 'runs', 'hits', 'rbis']):
            return 'count'
        elif 'receptions' in prop_name.lower():
            return 'receptions'
        else:
            return 'count'

    async def populate_all_trends(self):
        """Main function to populate all trend patterns"""
        print("Starting trends data population...")
        
        # Get all active players with predictions
        players = await self.get_active_players_with_predictions()
        print(f"Found {len(players)} players with AI predictions")
        
        total_trends = 0
        successful_trends = 0
        
        for player in players:
            player_id = player['id']
            player_name = player['name']
            
            print(f"\nProcessing {player_name} ({player['sport']})...")
            
            # Get prop types for this player
            prop_types = await self.get_player_prop_types(player_id)
            
            for prop_data in prop_types:
                prop_market_type = prop_data['prop_market_type']
                avg_line_value = prop_data['avg_line_value'] or 0
                
                print(f"  - {prop_market_type} (line: {avg_line_value})")
                
                # Get game stats
                game_stats = await self.get_player_game_stats(
                    player_id, 
                    prop_market_type,
                    days=90
                )
                
                if not game_stats:
                    print(f"    No game stats found")
                    continue
                
                # Calculate metrics
                metrics = await self.calculate_trend_metrics(game_stats, avg_line_value)
                
                if not metrics:
                    print(f"    Could not calculate metrics")
                    continue
                
                # Create trend pattern
                success = await self.create_trend_pattern(player_id, prop_data, metrics)
                
                total_trends += 1
                if success:
                    successful_trends += 1
                    print(f"    ✅ Created trend pattern (confidence: {metrics['confidence_score']}%)")
                else:
                    print(f"    ❌ Failed to create trend pattern")
        
        print(f"\nCompleted! Created {successful_trends}/{total_trends} trend patterns")

async def main():
    """Main execution function"""
    try:
        populator = TrendsDataPopulator()
        await populator.connect()
        await populator.populate_all_trends()
        await populator.close()
        
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
