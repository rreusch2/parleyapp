# Parley Scrapy - Web Scraping Framework for Parley App

## Overview
This is a comprehensive web scraping framework built with Scrapy to enhance the Parley app's data acquisition capabilities beyond the current StatMuse API.

## Features
- **Specialized Spiders**: Dedicated spiders for sports news, player statistics, and team performance data
- **Data Processing**: Robust data cleaning, validation, and storage pipelines
- **Error Handling**: Comprehensive error handling and monitoring
- **Scalable Architecture**: Designed for high-volume data collection
- **Integration Ready**: Easy integration with existing StatMuse API pipeline

## Project Structure
```
parley_scrapy/
├── parley_scrapy/
│   ├── spiders/
│   │   ├── sports_news_spider.py
│   │   ├── player_stats_spider.py
│   │   └── team_performance_spider.py
│   ├── items.py
│   ├── pipelines.py
│   ├── settings.py
│   ├── middlewares.py
│   └── __init__.py
├── scraped_data/
│   ├── nba/
│   ├── mlb/
│   ├── nfl/
│   └── general/
├── README.md
└── scrapy.cfg
```

## Installation
1. Install Scrapy: `pip install scrapy`
2. Navigate to project directory: `cd parley_scrapy`
3. Run spiders: `scrapy crawl sports_news`

## Usage

### Running Individual Spiders
```bash
# Sports News
scrapy crawl sports_news

# Player Statistics
scrapy crawl player_stats

# Team Performance
scrapy crawl team_performance
```

### Running with Parameters
```bash
# NBA player stats
scrapy crawl player_stats -a sport=nba

# MLB team performance
scrapy crawl team_performance -a sport=mlb
```

### Running All Spiders
```bash
# Run all spiders
scrapy crawl sports_news
scrapy crawl player_stats
scrapy crawl team_performance
```

## Configuration
Edit `settings.py` to configure:
- Download delays
- Concurrent requests
- User agents
- Retry settings
- Data storage locations

## Data Storage
All scraped data is stored in:
- `scraped_data/[sport]/` - Sport-specific data
- JSONL format for easy processing
- Automatic timestamp-based file naming

## Integration with StatMuse API
The scraped data can be easily integrated with the existing StatMuse API pipeline by:
1. Processing the JSONL files
2. Merging with existing data
3. Updating the database
4. Providing enhanced data for AI models

## Error Handling
- Automatic retry with exponential backoff
- Comprehensive logging
- Data validation
- Error monitoring and alerting

## Testing
Run tests with:
```bash
scrapy check
```

## Monitoring
Monitor scraping operations via:
- Scrapy logs
- Data quality metrics
- Error tracking
- Performance monitoring