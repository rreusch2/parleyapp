from scrapy import signals
from scrapy.downloadermiddlewares.useragent import UserAgentMiddleware
import random

class RotateUserAgentMiddleware(UserAgentMiddleware):
    """Middleware to rotate user agents"""
    
    def __init__(self, user_agent_list):
        self.user_agent_list = user_agent_list
    
    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            user_agent_list=crawler.settings.get('USER_AGENT_LIST', [])
        )
    
    def process_request(self, request, spider):
        ua = random.choice(self.user_agent_list)
        request.headers['User-Agent'] = ua

class RetryMiddleware:
    """Custom retry middleware with exponential backoff"""
    
    def __init__(self, max_retries=3, backoff_factor=1):
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
    
    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            max_retries=crawler.settings.getint('RETRY_TIMES', 3),
            backoff_factor=crawler.settings.getfloat('RETRY_BACKOFF', 1)
        )
    
    def process_exception(self, request, exception, spider):
        retries = request.meta.get('retry_times', 0)
        
        if retries < self.max_retries:
            retry_times = retries + 1
            request.meta['retry_times'] = retry_times
            
            # Calculate backoff delay
            delay = self.backoff_factor * (2 ** (retry_times - 1))
            request.meta['download_delay'] = delay
            
            spider.logger.info(f"Retrying {request.url} (attempt {retry_times})")
            return request
        
        spider.logger.error(f"Failed to fetch {request.url} after {self.max_retries} attempts")
        return None

class ProxyMiddleware:
    """Middleware to handle proxy rotation"""
    
    def __init__(self, proxy_list=None):
        self.proxy_list = proxy_list or []
    
    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            proxy_list=crawler.settings.get('PROXY_LIST', [])
        )
    
    def process_request(self, request, spider):
        if self.proxy_list:
            proxy = random.choice(self.proxy_list)
            request.meta['proxy'] = proxy