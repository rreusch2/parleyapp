import scrapy
from datetime import datetime
import json

class TeamPerformanceSpider(scrapy.Spider):
    name = 'team_performance'
    allowed_domains = ['basketball-reference.com', 'baseball-reference.com', 'pro-football-reference.com']
    
    custom_settings = {
        'DOWNLOAD_DELAY': 2,
        'RANDOMIZE_DOWNLOAD_DELAY': True,
        'CONCURRENT_REQUESTS': 4,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
    }
    
    def __init__(self, sport='nba', *args, **kwargs):
        super(TeamPerformanceSpider, self).__init__(*args, **kwargs)
        self.sport = sport
        
    def start_requests(self):
        """Generate requests for team performance data"""
        if self.sport == 'nba':
            urls = [
                'https://www.basketball-reference.com/leagues/NBA_2025.html',
                'https://www.basketball-reference.com/leagues/NBA_2025_standings.html',
            ]
        elif self.sport == 'mlb':
            urls = [
                'https://www.baseball-reference.com/leagues/MLB/2024.shtml',
                'https://www.baseball-reference.com/leagues/MLB/2024-standings.shtml',
            ]
        elif self.sport == 'nfl':
            urls = [
                'https://www.pro-football-reference.com/years/2024/',
                'https://www.pro-football-reference.com/years/2024/standings.htm',
            ]
        
        for url in urls:
            yield scrapy.Request(
                url=url,
                callback=self.parse_team_performance,
                meta={'sport': self.sport}
            )
    
    def parse_team_performance(self, response):
        """Parse team performance and standings data"""
        sport = response.meta['sport']
        
        if sport == 'nba':
            yield from self.parse_nba_teams(response)
        elif sport == 'mlb':
            yield from self.parse_mlb_teams(response)
        elif sport == 'nfl':
            yield from self.parse_nfl_teams(response)
    
    def parse_nba_teams(self, response):
        """Parse NBA team performance data"""
        # Parse standings
        standings_tables = response.css('table.stats_table')
        for table in standings_tables:
            rows = table.css('tbody tr')
            for row in rows:
                team_name = row.css('td[data-stat="team_name"] a::text').get()
                if team_name:
                    yield {
                        'team_name': team_name.strip(),
                        'wins': row.css('td[data-stat="wins"]::text').get(),
                        'losses': row.css('td[data-stat="losses"]::text').get(),
                        'win_pct': row.css('td[data-stat="win_loss_pct"]::text').get(),
                        'points_per_game': row.css('td[data-stat="pts_per_g"]::text').get(),
                        'points_allowed_per_game': row.css('td[data-stat="opp_pts_per_g"]::text').get(),
                        'point_differential': row.css('td[data-stat="pts_diff_per_g"]::text').get(),
                        'home_record': row.css('td[data-stat="home_record"]::text').get(),
                        'away_record': row.css('td[data-stat="road_record"]::text').get(),
                        'conference': 'Eastern' if 'Eastern' in response.url else 'Western',
                        'sport': 'nba',
                        'timestamp': datetime.now().isoformat(),
                        'category': 'team_performance'
                    }
    
    def parse_mlb_teams(self, response):
        """Parse MLB team performance data"""
        rows = response.css('table.stats_table tbody tr')
        for row in rows:
            team_name = row.css('td[data-stat="team_name"] a::text').get()
            if team_name:
                yield {
                    'team_name': team_name.strip(),
                    'wins': row.css('td[data-stat="W"]::text').get(),
                    'losses': row.css('td[data-stat="L"]::text').get(),
                    'win_pct': row.css('td[data-stat="win_loss_perc"]::text').get(),
                    'runs_scored': row.css('td[data-stat="R"]::text').get(),
                    'runs_allowed': row.css('td[data-stat="RA"]::text').get(),
                    'run_differential': row.css('td[data-stat="run_diff"]::text').get(),
                    'league': row.css('td[data-stat="lg_ID"]::text').get(),
                    'division': row.css('td[data-stat="div_ID"]::text').get(),
                    'sport': 'mlb',
                    'timestamp': datetime.now().isoformat(),
                    'category': 'team_performance'
                }
    
    def parse_nfl_teams(self, response):
        """Parse NFL team performance data"""
        rows = response.css('table.stats_table tbody tr')
        for row in rows:
            team_name = row.css('td[data-stat="team"] a::text').get()
            if team_name:
                yield {
                    'team_name': team_name.strip(),
                    'wins': row.css('td[data-stat="wins"]::text').get(),
                    'losses': row.css('td[data-stat="losses"]::text').get(),
                    'ties': row.css('td[data-stat="ties"]::text').get(),
                    'win_pct': row.css('td[data-stat="win_loss_pct"]::text').get(),
                    'points_for': row.css('td[data-stat="points_for"]::text').get(),
                    'points_against': row.css('td[data-stat="points_against"]::text').get(),
                    'point_differential': row.css('td[data-stat="points_diff"]::text').get(),
                    'conference': row.css('td[data-stat="conference"]::text').get(),
                    'division': row.css('td[data-stat="division"]::text').get(),
                    'sport': 'nfl',
                    'timestamp': datetime.now().isoformat(),
                    'category': 'team_performance'
                }