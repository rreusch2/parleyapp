import scrapy

class ParleyScrapyItem(scrapy.Item):
    """Base item for all scraped data"""
    title = scrapy.Field()
    url = scrapy.Field()
    source = scrapy.Field()
    timestamp = scrapy.Field()
    category = scrapy.Field()

class SportsNewsItem(ParleyScrapyItem):
    """Item for sports news articles"""
    content = scrapy.Field()
    author = scrapy.Field()
    publish_date = scrapy.Field()
    tags = scrapy.Field()

class PlayerStatsItem(ParleyScrapyItem):
    """Item for player statistics"""
    player_name = scrapy.Field()
    team = scrapy.Field()
    sport = scrapy.Field()
    games_played = scrapy.Field()
    points_per_game = scrapy.Field()
    rebounds_per_game = scrapy.Field()
    assists_per_game = scrapy.Field()
    field_goal_pct = scrapy.Field()
    three_point_pct = scrapy.Field()
    free_throw_pct = scrapy.Field()
    home_runs = scrapy.Field()
    rbis = scrapy.Field()
    batting_average = scrapy.Field()
    yards = scrapy.Field()
    touchdowns = scrapy.Field()
    interceptions = scrapy.Field()

class TeamPerformanceItem(ParleyScrapyItem):
    """Item for team performance data"""
    team_name = scrapy.Field()
    sport = scrapy.Field()
    wins = scrapy.Field()
    losses = scrapy.Field()
    ties = scrapy.Field()
    win_pct = scrapy.Field()
    points_for = scrapy.Field()
    points_against = scrapy.Field()
    point_differential = scrapy.Field()
    conference = scrapy.Field()
    division = scrapy.Field()
    home_record = scrapy.Field()
    away_record = scrapy.Field()
    runs_scored = scrapy.Field()
    runs_allowed = scrapy.Field()
    run_differential = scrapy.Field()