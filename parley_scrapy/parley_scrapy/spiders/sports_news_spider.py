import scrapy
from datetime import datetime
import json

class SportsNewsSpider(scrapy.Spider):
    name = 'sports_news'
    allowed_domains = ['espn.com', 'sports.yahoo.com', 'bleacherreport.com', 'si.com']
    
    custom_settings = {
        'DOWNLOAD_DELAY': 2,
        'RANDOMIZE_DOWNLOAD_DELAY': True,
        'CONCURRENT_REQUESTS': 8,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 2,
    }
    
    def __init__(self, sport=None, *args, **kwargs):
        super(SportsNewsSpider, self).__init__(*args, **kwargs)
        self.sport = sport
        
    def start_requests(self):
        # ESPN NBA news
        urls = [
            'https://www.espn.com/nba/',
            'https://sports.yahoo.com/nba/',
            'https://bleacherreport.com/nba',
        ]
        
        for url in urls:
            yield scrapy.Request(
                url=url,
                callback=self.parse_news,
                meta={'source': url}
            )
    
    def parse_news(self, response):
        """Parse sports news articles"""
        source = response.meta['source']
        
        # ESPN parsing
        if 'espn.com' in source:
            articles = response.css('article')
            for article in articles:
                title = article.css('h1::text, h2::text').get()
                if title:
                    yield {
                        'title': title.strip(),
                        'url': response.urljoin(article.css('a::attr(href)').get()),
                        'source': 'ESPN',
                        'timestamp': datetime.now().isoformat(),
                        'category': 'sports_news'
                    }
        
        # Yahoo Sports parsing
        elif 'yahoo.com' in source:
            articles = response.css('article')
            for article in articles:
                title = article.css('h3::text, h2::text').get()
                if title:
                    yield {
                        'title': title.strip(),
                        'url': response.urljoin(article.css('a::attr(href)').get()),
                        'source': 'Yahoo Sports',
                        'timestamp': datetime.now().isoformat(),
                        'category': 'sports_news'
                    }
        
        # Bleacher Report parsing
        elif 'bleacherreport.com' in source:
            articles = response.css('article')
            for article in articles:
                title = article.css('h3::text, h2::text').get()
                if title:
                    yield {
                        'title': title.strip(),
                        'url': response.urljoin(article.css('a::attr(href)').get()),
                        'source': 'Bleacher Report',
                        'timestamp': datetime.now().isoformat(),
                        'category': 'sports_news'
                    }