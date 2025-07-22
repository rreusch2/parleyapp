#!/usr/bin/env python3
"""
Balanced Research Strategy for Props Enhanced Script
- WNBA: Research 8-12 players (need 3 picks)
- MLB: Research 15-20 players (need 7 picks)
- Avoid repetitive star player bias
- Focus on diverse prop types and players
"""

def create_balanced_research_plan(props, games):
    """
    Create balanced research plan:
    - More MLB research (7 picks needed)
    - Less WNBA research (3 picks needed)
    - Diverse players, not just stars
    """
    
    # Group props by sport
    sport_props = {"MLB": {}, "WNBA": {}}
    
    for prop in props:
        sport = "WNBA" if any(game["sport"] == "Women's National Basketball Association" 
                            for game in games if game.get("id") == prop.event_id) else "MLB"
        
        if prop.player_name not in sport_props[sport]:
            sport_props[sport][prop.player_name] = []
        sport_props[sport][prop.player_name].append(prop)
    
    statmuse_queries = []
    web_searches = []
    
    # WNBA RESEARCH (3 picks needed) - Research 8-12 diverse players
    wnba_players = list(sport_props["WNBA"].keys())
    research_wnba_count = min(12, len(wnba_players))
    selected_wnba_players = wnba_players[:research_wnba_count]
    
    print(f"🏀 WNBA: Researching {research_wnba_count} players for 3 picks: {selected_wnba_players}")
    
    for player in selected_wnba_players:
        player_props = sport_props["WNBA"][player]
        prop_types = set(prop.prop_type for prop in player_props)
        
        # Research key stats
        if prop_types:
            stat_types = []
            if "Points" in prop_types: stat_types.append("points")
            if "Rebounds" in prop_types: stat_types.append("rebounds")
            if "Assists" in prop_types: stat_types.append("assists")
            
            if stat_types:
                stats_query = " and ".join(stat_types[:2])  # Max 2 stats per query
                statmuse_queries.append({
                    "query": f"{player} average {stats_query} per game this season",
                    "priority": "medium",
                    "sport": "WNBA"
                })
    
    # Add injury searches for top WNBA players only
    for player in selected_wnba_players[:6]:
        web_searches.append({
            "query": f"{player} WNBA injury status recent news",
            "priority": "medium",
            "sport": "WNBA"
        })
    
    # MLB RESEARCH (7 picks needed) - Research 15-20 diverse players
    mlb_players = list(sport_props["MLB"].keys())
    research_mlb_count = min(20, len(mlb_players))
    selected_mlb_players = mlb_players[:research_mlb_count]
    
    print(f"⚾ MLB: Researching {research_mlb_count} players for 7 picks: {selected_mlb_players[:10]}...")
    
    for player in selected_mlb_players:
        player_props = sport_props["MLB"][player]
        prop_types = set(prop.prop_type for prop in player_props)
        
        # Research diverse MLB stats
        if prop_types:
            stat_types = []
            if any("Hits" in pt for pt in prop_types): stat_types.append("hits")
            if any("Home Runs" in pt for pt in prop_types): stat_types.append("home runs")
            if any("RBIs" in pt for pt in prop_types): stat_types.append("RBIs")
            if any("Runs" in pt for pt in prop_types): stat_types.append("runs")
            
            if stat_types:
                stats_query = " and ".join(stat_types[:2])  # Max 2 stats per query
                statmuse_queries.append({
                    "query": f"{player} batter {stats_query} this season",
                    "priority": "high",  # Higher priority since we need 7 MLB picks
                    "sport": "MLB"
                })
    
    # Add general context searches
    web_searches.extend([
        {"query": "MLB weather delays postponements today", "priority": "medium", "sport": "MLB"},
        {"query": "WNBA injury report lineup changes today", "priority": "low", "sport": "WNBA"}
    ])
    
    # Limit to reasonable numbers
    max_statmuse = min(18, len(statmuse_queries))  # Reasonable limit
    max_web = min(12, len(web_searches))
    
    research_plan = {
        "statmuse_queries": statmuse_queries[:max_statmuse],
        "web_searches": web_searches[:max_web],
        "total_queries": max_statmuse + max_web,
        "wnba_players_researched": research_wnba_count,
        "mlb_players_researched": research_mlb_count
    }
    
    print(f"📋 Balanced Research Plan:")
    print(f"   WNBA: {research_wnba_count} players researched → 3 picks")
    print(f"   MLB: {research_mlb_count} players researched → 7 picks")
    print(f"   Total: {max_statmuse} StatMuse + {max_web} web = {research_plan['total_queries']} queries")
    
    return research_plan

# Key improvements:
# 1. More MLB research (15-20 players) since 7 picks needed
# 2. Less WNBA research (8-12 players) since only 3 picks needed  
# 3. Diverse player selection, not just stars
# 4. Reasonable query limits to avoid excessive research time
# 5. Higher priority for MLB queries since more picks needed
