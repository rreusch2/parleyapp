import scrapy
from datetime import datetime
import json

class PlayerStatsSpider(scrapy.Spider):
    name = 'player_stats'
    allowed_domains = ['basketball-reference.com', 'baseball-reference.com', 'pro-football-reference.com']
    
    custom_settings = {
        'DOWNLOAD_DELAY': 3,
        'RANDOMIZE_DOWNLOAD_DELAY': True,
        'CONCURRENT_REQUESTS': 4,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
    }
    
    def __init__(self, sport='nba', *args, **kwargs):
        super(PlayerStatsSpider, self).__init__(*args, **kwargs)
        self.sport = sport
        
    def start_requests(self):
        """Generate requests for player statistics"""
        if self.sport == 'nba':
            urls = [
                'https://www.basketball-reference.com/leagues/NBA_2025_totals.html',
                'https://www.basketball-reference.com/leagues/NBA_2025_per_game.html',
            ]
        elif self.sport == 'mlb':
            urls = [
                'https://www.baseball-reference.com/leagues/MLB/2024-batting.shtml',
                'https://www.baseball-reference.com/leagues/MLB/2024-pitching.shtml',
            ]
        elif self.sport == 'nfl':
            urls = [
                'https://www.pro-football-reference.com/years/2024/passing.htm',
                'https://www.pro-football-reference.com/years/2024/rushing.htm',
                'https://www.pro-football-reference.com/years/2024/receiving.htm',
            ]
        
        for url in urls:
            yield scrapy.Request(
                url=url,
                callback=self.parse_stats,
                meta={'sport': self.sport}
            )
    
    def parse_stats(self, response):
        """Parse player statistics tables"""
        sport = response.meta['sport']
        
        if sport == 'nba':
            yield from self.parse_nba_stats(response)
        elif sport == 'mlb':
            yield from self.parse_mlb_stats(response)
        elif sport == 'nfl':
            yield from self.parse_nfl_stats(response)
    
    def parse_nba_stats(self, response):
        """Parse NBA player statistics"""
        rows = response.css('table.stats_table tbody tr')
        for row in rows:
            player_name = row.css('td[data-stat="player"] a::text').get()
            if player_name:
                yield {
                    'player_name': player_name.strip(),
                    'team': row.css('td[data-stat="team_id"] a::text').get(),
                    'games_played': row.css('td[data-stat="g"]::text').get(),
                    'points_per_game': row.css('td[data-stat="pts_per_g"]::text').get(),
                    'rebounds_per_game': row.css('td[data-stat="trb_per_g"]::text').get(),
                    'assists_per_game': row.css('td[data-stat="ast_per_g"]::text').get(),
                    'field_goal_pct': row.css('td[data-stat="fg_pct"]::text').get(),
                    'three_point_pct': row.css('td[data-stat="fg3_pct"]::text').get(),
                    'free_throw_pct': row.css('td[data-stat="ft_pct"]::text').get(),
                    'sport': 'nba',
                    'timestamp': datetime.now().isoformat(),
                    'category': 'player_stats'
                }
    
    def parse_mlb_stats(self, response):
        """Parse MLB player statistics"""
        rows = response.css('table.stats_table tbody tr')
        for row in rows:
            player_name = row.css('td[data-stat="player"] a::text').get()
            if player_name:
                yield {
                    'player_name': player_name.strip(),
                    'team': row.css('td[data-stat="team_ID"] a::text').get(),
                    'games_played': row.css('td[data-stat="G"]::text').get(),
                    'batting_average': row.css('td[data-stat="batting_avg"]::text').get(),
                    'home_runs': row.css('td[data-stat="HR"]::text').get(),
                    'rbis': row.css('td[data-stat="RBI"]::text').get(),
                    'on_base_pct': row.css('td[data-stat="onbase_perc"]::text').get(),
                    'slugging_pct': row.css('td[data-stat="slugging_perc"]::text').get(),
                    'ops': row.css('td[data-stat="onbase_plus_slugging"]::text').get(),
                    'sport': 'mlb',
                    'timestamp': datetime.now().isoformat(),
                    'category': 'player_stats'
                }
    
    def parse_nfl_stats(self, response):
        """Parse NFL player statistics"""
        rows = response.css('table.stats_table tbody tr')
        for row in rows:
            player_name = row.css('td[data-stat="player"] a::text').get()
            if player_name:
                yield {
                    'player_name': player_name.strip(),
                    'team': row.css('td[data-stat="team"] a::text').get(),
                    'games_played': row.css('td[data-stat="g"]::text').get(),
                    'yards': row.css('td[data-stat="yds"]::text').get(),
                    'touchdowns': row.css('td[data-stat="td"]::text').get(),
                    'interceptions': row.css('td[data-stat="int"]::text').get(),
                    'fumbles': row.css('td[data-stat="fmb"]::text').get(),
                    'sport': 'nfl',
                    'timestamp': datetime.now().isoformat(),
                    'category': 'player_stats'
                }