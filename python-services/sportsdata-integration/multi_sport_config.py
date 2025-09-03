"""
Multi-Sport SportsData.io Configuration
Supports NFL, MLB, NBA, WNBA, College Football, NHL, MMA
"""

SPORTSDATA_CONFIG = {
    'NFL': {
        'base_url': 'https://api.sportsdata.io/v3/nfl',
        'sport_key': 'NFL',
        'sport_name': 'National Football League',
        'season_format': '{year}',  # 2024, 2024PRE, 2024POST
        'weeks': {
            'preseason': [0, 1, 2, 3, 4],
            'regular': list(range(1, 19)),  # Weeks 1-18
            'playoffs': [19, 20, 21, 22]    # Wild Card, Divisional, Conference, Super Bowl
        },
        'endpoints': {
            'teams': '/scores/json/AllTeams',
            'schedule': '/scores/json/Schedules/{season}',
            'scores_by_week': '/scores/json/ScoresByWeekFinal/{season}/{week}',
            'player_stats': '/stats/json/PlayerGameStatsByWeekFinal/{season}/{week}',
            'team_stats': '/scores/json/TeamGameStats/{season}/{week}',
            'current_season': '/scores/json/CurrentSeason',
            'current_week': '/scores/json/CurrentWeek'
        },
        'rate_limits': {
            'teams': 240,      # 4 hours in minutes
            'scores': 1,       # 1 minute  
            'player_stats': 5, # 5 minutes
            'schedule': 3      # 3 minutes
        }
    },
    'MLB': {
        'base_url': 'https://api.sportsdata.io/v3/mlb',
        'sport_key': 'MLB', 
        'sport_name': 'Major League Baseball',
        'season_format': '{year}',
        'endpoints': {
            'teams': '/scores/json/AllTeams',
            'schedule': '/scores/json/Games/{season}',
            'scores_by_date': '/scores/json/GamesByDate/{date}',
            'player_stats': '/stats/json/PlayerGameStatsByDate/{date}',
            'team_stats': '/scores/json/TeamGameStatsByDate/{date}',
            'current_season': '/scores/json/CurrentSeason'
        },
        'rate_limits': {
            'teams': 240,
            'scores': 1,
            'player_stats': 5,
            'schedule': 15
        }
    },
    'NBA': {
        'base_url': 'https://api.sportsdata.io/v3/nba',
        'sport_key': 'NBA',
        'sport_name': 'National Basketball Association', 
        'season_format': '{year}',
        'endpoints': {
            'teams': '/scores/json/AllTeams',
            'schedule': '/scores/json/Games/{season}',
            'scores_by_date': '/scores/json/GamesByDate/{date}',
            'player_stats': '/stats/json/PlayerGameStatsByDate/{date}',
            'team_stats': '/scores/json/TeamGameStatsByDate/{date}',
            'current_season': '/scores/json/CurrentSeason'
        },
        'rate_limits': {
            'teams': 240,
            'scores': 1, 
            'player_stats': 5,
            'schedule': 15
        }
    },
    'WNBA': {
        'base_url': 'https://api.sportsdata.io/v3/wnba',
        'sport_key': 'WNBA',
        'sport_name': "Women's National Basketball Association",
        'season_format': '{year}',
        'endpoints': {
            'teams': '/scores/json/AllTeams',
            'schedule': '/scores/json/Games/{season}',
            'scores_by_date': '/scores/json/GamesByDate/{date}',
            'player_stats': '/stats/json/PlayerGameStatsByDate/{date}', 
            'team_stats': '/scores/json/TeamGameStatsByDate/{date}',
            'current_season': '/scores/json/CurrentSeason'
        },
        'rate_limits': {
            'teams': 240,
            'scores': 1,
            'player_stats': 5,
            'schedule': 15
        }
    },
    'CFB': {
        'base_url': 'https://api.sportsdata.io/v3/cfb',
        'sport_key': 'CFB',
        'sport_name': 'College Football',
        'season_format': '{year}',
        'endpoints': {
            'teams': '/scores/json/AllTeams',
            'schedule': '/scores/json/Games/{season}',
            'scores_by_week': '/scores/json/GamesByWeek/{season}/{week}',
            'player_stats': '/stats/json/PlayerGameStatsByWeek/{season}/{week}',
            'team_stats': '/scores/json/TeamGameStatsByWeek/{season}/{week}',
            'current_season': '/scores/json/CurrentSeason'
        },
        'rate_limits': {
            'teams': 240,
            'scores': 1,
            'player_stats': 5, 
            'schedule': 15
        }
    }
}

# Priority order for data collection (most urgent first)
COLLECTION_PRIORITY = [
    'NFL',    # Season starts Sep 5th - URGENT
    'MLB',    # Currently in season
    'WNBA',   # Season ending soon
    'CFB',    # College football starting
    'NBA'     # Offseason but need historical data
]

# Data collection settings
DATA_COLLECTION_SETTINGS = {
    'max_historical_weeks': 20,  # Last 20 games per team
    'batch_size': 50,           # Process 50 records at a time
    'rate_limit_buffer': 2,     # Extra seconds between API calls
    'retry_attempts': 3,        # Retry failed requests
    'retry_delay': 5            # Seconds between retries
}
