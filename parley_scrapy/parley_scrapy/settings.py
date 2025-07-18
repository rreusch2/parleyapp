BOT_NAME = 'parley_scrapy'

SPIDER_MODULES = ['parley_scrapy.spiders']
NEWSPIDER_MODULE = 'parley_scrapy.spiders'

# Obey robots.txt rules
ROBOTSTXT_OBEY = True

# Configure item pipelines
# ITEM_PIPELINES = {
#     'parley_scrapy.pipelines.ParleyScrapyPipeline': 300,
# }

# Configure download delay
DOWNLOAD_DELAY = 1

# Configure user agent
USER_AGENT = 'parley-scrapy-bot (+https://parleyapp.com)'

# Configure logging
LOG_LEVEL = 'INFO'

# Configure concurrent requests
CONCURRENT_REQUESTS = 16
CONCURRENT_REQUESTS_PER_DOMAIN = 8

# Configure cookies
COOKIES_ENABLED = False

# Configure Telnet Console
TELNETCONSOLE_ENABLED = False

# Configure retry settings
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]

# Configure download timeout
DOWNLOAD_TIMEOUT = 30

# Configure autothrottle
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1
AUTOTHROTTLE_MAX_DELAY = 60
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0
AUTOTHROTTLE_DEBUG = False

# Configure HTTP caching
HTTPCACHE_ENABLED = True
HTTPCACHE_EXPIRATION_SECS = 3600
HTTPCACHE_DIR = 'httpcache'
HTTPCACHE_IGNORE_HTTP_CODES = []
HTTPCACHE_STORAGE = 'scrapy.extensions.httpcache.FilesystemCacheStorage'