# Enhanced Sports Betting AI System

## 🚀 Overview

This enhanced sports betting AI system integrates advanced web scraping capabilities with existing AI agents to provide superior betting intelligence. The system combines StatMuse API data, web search results, and exclusive Scrapy web scraping data to generate high-confidence betting picks with significant data advantages.

## 🏗️ System Architecture

### Core Components

1. **Scrapy Integration Service** (`scrapy_integration_service.py`)
   - Manages web scraping data collection and processing
   - Provides enhanced insights for AI analysis
   - Handles data caching and quality scoring

2. **Enhanced AI Agents**
   - **Enhanced Teams Agent** (`enhanced_teams_agent.py`)
   - **Enhanced Props Agent** (`enhanced_props_agent.py`)
   - Both agents leverage Scrapy data alongside traditional sources

3. **Enhanced Main Orchestrator** (`enhanced_main_orchestrator.py`)
   - Coordinates all system components
   - Manages data collection workflows
   - Provides comprehensive analytics

4. **Enhanced Chatbot Orchestrator** (`backend/src/ai/orchestrator/enhancedChatbotOrchestrator.ts`)
   - TypeScript chatbot with access to exclusive Scrapy insights
   - Enhanced tools for superior user interactions

5. **Automated Workflows** (`automated_workflows.py`)
   - Scheduled data collection and system maintenance
   - Health monitoring and alerting
   - Performance optimization

## 📊 Data Sources

### Primary Data Sources
- **StatMuse API**: Professional sports statistics and data
- **Web Search**: Real-time sports news and information
- **Scrapy Web Scraping**: Exclusive data from multiple sports websites

### Scrapy Data Types
- **News Articles**: Latest sports news with sentiment analysis
- **Player Statistics**: Real-time player performance data
- **Team Performance**: Team metrics and historical data

## 🔧 Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- PostgreSQL database
- Required API keys (Grok, StatMuse)

### Quick Start

1. **Clone and Setup Environment**
   ```bash
   cd /path/to/parleyapp
   pip install -r requirements.txt
   npm install
   ```

2. **Configure Environment Variables**
   ```bash
   # Copy and configure environment file
   cp backend/.env.example backend/.env
   
   # Required variables:
   GROK_API_KEY=your_grok_api_key
   STATMUSE_API_KEY=your_statmuse_api_key
   DATABASE_URL=your_database_url
   ```

3. **Setup Database**
   ```bash
   # Apply enhanced database schema
   psql -d your_database -f database_schema_updates.sql
   ```

4. **Deploy Enhanced System**
   ```bash
   # Run comprehensive deployment
   python deploy_enhanced_system.py --environment production
   ```

5. **Start System Components**
   ```bash
   # Start automated workflows
   python start_workflows.py
   
   # Start monitoring (if enabled)
   sudo systemctl start enhanced-betting-ai.service
   ```

## 🎯 Usage

### Generate Enhanced Picks

```python
from enhanced_main_orchestrator import EnhancedSportsBettingOrchestrator

# Initialize orchestrator
orchestrator = EnhancedSportsBettingOrchestrator()

# Generate daily picks with Scrapy enhancement
results = await orchestrator.generate_enhanced_daily_picks(
    props_count=5,
    teams_count=5,
    force_scrapy_refresh=True
)

print(f"Generated {results['total_picks']} enhanced picks")
print(f"Scrapy data used: {results['scrapy_data_used']}")
```

### Access Scrapy Insights

```python
from scrapy_integration_service import scrapy_service

# Get enhanced insights for specific teams/players
insights = scrapy_service.get_enhanced_insights_for_ai(
    teams=['Yankees', 'Lakers'],
    players=['Aaron Judge', 'LeBron James'],
    data_types=['news', 'player_stats', 'team_performance']
)

print(f"Total insights: {insights['summary']['total_insights']}")
```

### Run Individual Agents

```python
from enhanced_teams_agent import EnhancedTeamsAgent
from enhanced_props_agent import EnhancedPropsAgent

# Teams agent
teams_agent = EnhancedTeamsAgent()
team_picks = await teams_agent.generate_daily_picks(target_picks=5)

# Props agent
props_agent = EnhancedPropsAgent()
prop_picks = await props_agent.generate_daily_picks(target_picks=5)
```

## 🧪 Testing

### Run System Integration Tests

```bash
# Run all integration tests
python system_integration_test.py --test all

# Run specific component tests
python system_integration_test.py --test scrapy
python system_integration_test.py --test teams
python system_integration_test.py --test props
python system_integration_test.py --test orchestrator
python system_integration_test.py --test workflows
python system_integration_test.py --test e2e

# Save test results
python system_integration_test.py --test all --output test_results.json
```

### Test Individual Components

```bash
# Test Scrapy service
python -c "import asyncio; from scrapy_integration_service import scrapy_service; asyncio.run(scrapy_service.get_service_status())"

# Test enhanced orchestrator
python -c "import asyncio; from enhanced_main_orchestrator import EnhancedSportsBettingOrchestrator; asyncio.run(EnhancedSportsBettingOrchestrator().refresh_scrapy_data())"
```

## 📈 Monitoring & Analytics

### System Health Monitoring

The system includes comprehensive monitoring capabilities:

- **Real-time Health Checks**: Every 6 hours
- **Performance Metrics**: Processing times, success rates, data quality
- **Automated Alerts**: Email and Slack notifications
- **Data Freshness Tracking**: Scrapy data age and quality monitoring

### View System Status

```python
from automated_workflows import AutomatedWorkflowManager

workflow_manager = AutomatedWorkflowManager()

# Get workflow summary
summary = workflow_manager.get_workflow_summary(hours=24)
print(f"Workflows executed: {summary['total_executions']}")
print(f"Success rate: {summary['success_rate']:.1%}")

# Run health check
health_result = await workflow_manager.workflow_system_health_check()
print(f"System health: {'✅ Healthy' if health_result.success else '❌ Issues detected'}")
```

### Database Analytics

Access enhanced analytics through database views:

```sql
-- View prediction analytics
SELECT * FROM enhanced_prediction_analytics 
WHERE prediction_date >= CURRENT_DATE - INTERVAL '7 days';

-- Check Scrapy data freshness
SELECT * FROM scrapy_data_freshness;

-- System health dashboard
SELECT * FROM system_health_dashboard;
```

## 🔄 Automated Workflows

The system includes several automated workflows:

### Scheduled Workflows

1. **Scrapy Data Refresh** (Every 2 hours)
   - Refreshes all web scraping data
   - Updates news, player stats, and team performance

2. **Daily Picks Generation** (6 AM daily)
   - Generates enhanced daily picks
   - Stores results in database with metadata

3. **System Health Check** (Every 6 hours)
   - Monitors component health
   - Checks data quality and freshness
   - Sends alerts if issues detected

4. **Data Cleanup** (2 AM daily)
   - Removes old scrapy data
   - Optimizes database performance
   - Maintains system efficiency

### Manual Workflow Execution

```python
from automated_workflows import AutomatedWorkflowManager

workflow_manager = AutomatedWorkflowManager()

# Execute specific workflows
await workflow_manager.workflow_scrapy_data_refresh()
await workflow_manager.workflow_daily_picks_generation()
await workflow_manager.workflow_system_health_check()
await workflow_manager.workflow_data_cleanup()
```

## 🎛️ Configuration

### System Configuration (`config/system_config.json`)

```json
{
  "environment": "production",
  "scrapy_settings": {
    "refresh_interval_hours": 2,
    "concurrent_requests": 16,
    "download_delay": 1
  },
  "ai_settings": {
    "model": "grok-4",
    "max_tokens": 4000,
    "temperature": 0.1,
    "confidence_threshold": 0.7
  },
  "monitoring": {
    "enabled": true,
    "health_check_interval_hours": 6,
    "alert_email": "admin@parleyapp.com"
  }
}
```

### Environment Variables

```bash
# Required API Keys
GROK_API_KEY=your_grok_api_key
STATMUSE_API_KEY=your_statmuse_api_key

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/parley_db

# Optional Monitoring
ALERT_EMAIL=admin@parleyapp.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Scrapy Configuration
SCRAPY_USER_AGENT="ParleyApp Enhanced Sports Betting AI 1.0"
SCRAPY_CONCURRENT_REQUESTS=16
SCRAPY_DOWNLOAD_DELAY=1
```

## 📊 Database Schema

### Enhanced Tables

- **`scrapy_news`**: Scraped news articles with sentiment analysis
- **`scrapy_player_stats`**: Real-time player statistics
- **`scrapy_team_performance`**: Team performance metrics
- **`enhanced_predictions`**: AI predictions with Scrapy metadata
- **`system_health_metrics`**: System performance monitoring
- **`workflow_executions`**: Automated workflow tracking

### Key Features

- **JSONB metadata fields** for flexible data storage
- **GIN indexes** for array and JSON queries
- **Automated triggers** for timestamp updates
- **Data quality scoring** functions
- **Cleanup utilities** for maintenance

## 🚨 Troubleshooting

### Common Issues

1. **Scrapy Service Not Ready**
   ```bash
   # Check service status
   python -c "import asyncio; from scrapy_integration_service import scrapy_service; print(asyncio.run(scrapy_service.get_service_status()))"
   
   # Restart service
   python -c "import asyncio; from scrapy_integration_service import scrapy_service; asyncio.run(scrapy_service.refresh_all_data())"
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connection
   psql $DATABASE_URL -c "SELECT version();"
   
   # Apply schema updates
   psql $DATABASE_URL -f database_schema_updates.sql
   ```

3. **API Rate Limits**
   - Check API key validity
   - Monitor request rates in logs
   - Adjust delay settings in configuration

4. **Memory Issues**
   ```bash
   # Check system resources
   python -c "import psutil; print(f'Memory: {psutil.virtual_memory().percent}%')"
   
   # Restart workflows if needed
   pkill -f "automated_workflows"
   python start_workflows.py
   ```

### Log Files

- **System logs**: `logs/enhanced_system.log`
- **Deployment logs**: `deployment.log`
- **Workflow logs**: `logs/workflows.log`
- **Test results**: `test_results.json`

## 🔐 Security Considerations

1. **API Key Management**
   - Store API keys in environment variables
   - Use secure key rotation practices
   - Monitor API usage and limits

2. **Database Security**
   - Use strong database passwords
   - Implement proper user permissions
   - Regular security updates

3. **Web Scraping Ethics**
   - Respect robots.txt files
   - Implement appropriate delays
   - Monitor for rate limiting

## 📈 Performance Optimization

### Recommended Settings

- **Scrapy Concurrent Requests**: 16 (adjust based on target sites)
- **Download Delay**: 1 second (respect rate limits)
- **Database Connection Pool**: 10-20 connections
- **Memory Allocation**: Minimum 4GB RAM recommended

### Monitoring Metrics

- **Data Freshness**: Scrapy data age < 24 hours
- **Success Rate**: > 95% for all workflows
- **Response Time**: < 30 seconds for pick generation
- **System Resources**: CPU < 80%, Memory < 85%

## 🤝 Contributing

### Development Workflow

1. **Setup Development Environment**
   ```bash
   python deploy_enhanced_system.py --environment development
   ```

2. **Run Tests Before Changes**
   ```bash
   python system_integration_test.py --test all
   ```

3. **Make Changes and Test**
   ```bash
   # Test specific components
   python system_integration_test.py --test [component]
   ```

4. **Deploy to Staging**
   ```bash
   python deploy_enhanced_system.py --environment staging
   ```

### Code Standards

- Follow PEP 8 for Python code
- Use type hints for all functions
- Include comprehensive docstrings
- Add unit tests for new features

## 📞 Support

For technical support or questions:

1. **Check logs** for error details
2. **Run integration tests** to identify issues
3. **Review configuration** settings
4. **Monitor system health** metrics

## 🎉 Success Metrics

The enhanced system provides significant advantages:

- **Data Advantage**: Exclusive web scraping insights
- **Higher Accuracy**: Multi-source data fusion
- **Real-time Intelligence**: Fresh data every 2 hours
- **Automated Operations**: Minimal manual intervention
- **Comprehensive Monitoring**: Full system visibility

## 📝 Version History

- **v1.0**: Initial enhanced system with Scrapy integration
- **v1.1**: Added automated workflows and monitoring
- **v1.2**: Enhanced database schema and analytics
- **v1.3**: Comprehensive deployment and testing framework

---

**🎯 The enhanced sports betting AI system is now ready to provide superior betting intelligence with exclusive data advantages!**