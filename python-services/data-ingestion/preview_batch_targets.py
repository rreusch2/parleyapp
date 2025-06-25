#!/usr/bin/env python3

from batch_mlb_ingestion import get_target_players

def preview_batch_targets():
    """Preview the players we're targeting for AI training dataset"""
    
    players = get_target_players()
    
    print("AI TRAINING DATASET - PHASE 1 TARGET PLAYERS")
    print("=" * 80)
    print(f"Total Players: {len(players)}")
    print(f"Estimated Games: {len(players) * 20} (assuming ~20 games each)")
    print(f"Expected Records: {len(players) * 20} player-game records")
    
    # Group by player type for AI diversity
    categories = {
        'Power Hitters': ['Aaron Judge', 'Shohei Ohtani', 'Vladimir Guerrero Jr.', 'Pete Alonso', 'Ronald Acuña Jr.'],
        'Contact/Average': ['Mookie Betts', 'José Altuve', 'Gleyber Torres', 'Freddie Freeman', 'Juan Soto'],
        'Speed/Contact': ['Trea Turner', 'Julio Rodríguez', 'Bo Bichette'],
        'Catchers': ['Salvador Perez', 'Will Smith'],
        'Infielders': ['Manny Machado', 'Rafael Devers', 'Francisco Lindor', 'Jose Ramirez', 'Corey Seager'],
        'Rising Stars': ['Gunnar Henderson', 'Bobby Witt Jr.', 'Yordan Alvarez']
    }
    
    print(f"\nAI TRAINING DIVERSITY BREAKDOWN:")
    print("-" * 50)
    
    for category, player_names in categories.items():
        print(f"\n{category} ({len(player_names)} players):")
        category_players = [p for p in players if p['name'] in player_names]
        
        for player in category_players:
            print(f"  {player['name']:<20} {player['team']:<4} {player['position']:<3} (ID: {player['mlb_id']})")
    
    # Show what data types we'll have for AI training
    print(f"\n\nAI TRAINING DATA FEATURES:")
    print("-" * 50)
    print("✅ Basic Performance: At-bats, hits, home runs, strikeouts, walks")
    print("✅ Advanced Metrics: Batting average, wOBA estimates") 
    print("✅ Statcast Data: Exit velocity, launch angle, hit distance")
    print("✅ Game Context: Individual plate appearance outcomes")
    print("✅ Player Diversity: All positions, performance levels, player types")
    
    print(f"\n\nWHY THIS IS PERFECT FOR AI TRAINING:")
    print("-" * 50)
    print("🎯 Volume: ~600 game records for robust model training")
    print("🎯 Quality: Professional-grade Statcast data (same as Aaron Judge)")
    print("🎯 Diversity: Power hitters, contact hitters, speed players, all positions")
    print("🎯 Features: 14+ statistical features per game record")
    print("🎯 Real Data: No more sample/fake data - actual MLB performance")
    
    print(f"\n\nNEXT STEPS:")
    print("-" * 50)
    print("1. Run: python batch_mlb_ingestion.py")
    print("2. This will scale from 1 to 23 players with same data quality")
    print("3. Then we can train AI models on real MLB performance data")
    print("4. Models will predict player props with actual statistical foundation")
    
    # Show database impact
    print(f"\n\nDATABASE IMPACT:")
    print("-" * 50)
    print("✅ Same table structure (player_game_stats)")
    print("✅ Same data format (JSON stats)")
    print("✅ Scales horizontally - no schema changes needed")
    print("✅ Ready for AI model consumption")

if __name__ == "__main__":
    preview_batch_targets() 