# 📊 StatMuse MCP Server for ParleyApp

**Real MLB Statistics for All AI Systems via Model Context Protocol**

## 🎯 Overview

The StatMuse MCP Server provides **real-time MLB statistics** to all AI systems in the ParleyApp ecosystem through a standardized Model Context Protocol interface. This eliminates fake data and hallucinations by giving your AI systems access to actual StatMuse.com data.

### 🔥 Key Benefits

- **Real Data**: All AI systems use actual MLB statistics from StatMuse.com
- **Unified Interface**: One server serves all AI systems (Daily Insights, Professor Lock, Orchestrator)
- **Intelligent Caching**: Redis-backed caching with memory fallback for performance
- **Rate Limiting**: Respectful API usage with automatic rate limiting
- **Easy Integration**: Simple client library for seamless integration

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Daily Insights │    │ Professor Lock   │    │  Orchestrator   │
│      System     │    │    Chatbot       │    │     System      │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          └──────────────────────┼───────────────────────┘
                                 │
                   ┌─────────────▼─────────────┐
                   │    StatMuse MCP Server    │
                   │  (Real MLB Statistics)    │
                   └─────────────┬─────────────┘
                                 │
                   ┌─────────────▼─────────────┐
                   │      StatMuse.com         │
                   │   (Source of Truth)       │
                   └───────────────────────────┘
```

## 📦 Installation

### 1. Install Dependencies

```bash
# Install MCP server dependencies
pip install -r requirements_mcp.txt

# Optional: Install Redis for caching (recommended)
# Ubuntu/Debian:
sudo apt-get install redis-server

# macOS:
brew install redis

# Start Redis
redis-server
```

### 2. Configuration

Copy and configure the MCP configuration:

```bash
cp mcp_config.json.example mcp_config.json
```

Edit `mcp_config.json` if needed:
```json
{
  "cache": {
    "redis_url": "redis://localhost:6379",
    "ttl": 3600,
    "fallback_to_memory": true
  },
  "rate_limiting": {
    "max_requests_per_minute": 25
  }
}
```

## 🚀 Usage

### Starting the MCP Server

```bash
# Method 1: Direct execution
python statmuse_mcp_server.py

# Method 2: Using the test client (includes server startup)
python test_statmuse_mcp.py
```

### Using the Client Library

#### Option A: Async Context Manager (Recommended)

```python
from statmuse_mcp_client import StatMuseMCPClient

async def my_ai_function():
    async with StatMuseMCPClient() as client:
        # Query with natural language
        result = await client.query_statmuse("Yankees vs Red Sox last 5 meetings")
        print(result.data)
        
        # Get head-to-head data
        h2h = await client.get_head_to_head("Dodgers", "Padres", 5)
        print(h2h.data)
        
        # Get team records
        record = await client.get_team_record("Yankees", "home")
        print(record.data)
```

#### Option B: Synchronous Wrapper

```python
from statmuse_mcp_client import StatMuseSync

# Simple synchronous usage
result = StatMuseSync.query("Dodgers home record 2025")
print(result.data)

h2h = StatMuseSync.get_head_to_head("Yankees", "Red Sox", 5)
print(h2h.data)
```

## 🛠️ Available Tools

### 1. `query_statmuse`
Natural language queries to StatMuse

```python
await client.query_statmuse("Yankees vs Red Sox last 5 meetings")
await client.query_statmuse("Aaron Judge batting average last 10 games")
await client.query_statmuse("Dodgers home record 2025")
```

### 2. `get_team_head_to_head`
Head-to-head records between teams

```python
await client.get_head_to_head("Yankees", "Red Sox", games=5)
```

### 3. `get_team_record`
Team records by type

```python
await client.get_team_record("Yankees", "home")      # Home record
await client.get_team_record("Dodgers", "away")      # Away record  
await client.get_team_record("Astros", "last_10")    # Last 10 games
await client.get_team_record("Braves", "overall")    # Overall record
```

### 4. `get_team_recent_performance`
Recent team performance trends

```python
await client.get_recent_performance("Yankees", games=10)
```

### 5. `get_player_stats`
Individual player statistics

```python
await client.get_player_stats("Aaron Judge", "hitting", "season")
await client.get_player_stats("Gerrit Cole", "pitching", "last_10")
```

## 🔄 Integration Examples

### Daily Insights Integration

```python
# Replace existing StatMuse code with MCP client
async def gather_statmuse_data(self, games):
    async with StatMuseMCPClient() as client:
        for game in games[:3]:
            h2h = await client.get_head_to_head(
                game['away_team'], 
                game['home_team'], 
                5
            )
            # Use h2h.data in your insights
```

### Professor Lock Chatbot Integration

```python
# Add StatMuse capability to chatbot
async def handle_user_question(user_query):
    if "stats" in user_query or "record" in user_query:
        async with StatMuseMCPClient() as client:
            result = await client.query_statmuse(user_query)
            if result.success:
                return f"StatMuse shows: {result.data}"
```

### Orchestrator Integration

```python
# Enhance pick generation with real data
async def generate_pick(game):
    async with StatMuseMCPClient() as client:
        h2h = await client.get_head_to_head(game.away, game.home, 10)
        home_record = await client.get_team_record(game.home, "home")
        away_record = await client.get_team_record(game.away, "away")
        
        # Use real data for pick generation
        return create_data_driven_pick(h2h, home_record, away_record)
```

## 📊 Caching & Performance

### Cache Hierarchy
1. **Redis Cache** (preferred): 1-hour TTL, persistent across sessions
2. **Memory Cache** (fallback): 1-hour TTL, session-specific
3. **Real-time Query**: When cache misses occur

### Cache Indicators
All responses include cache status:
```python
result = await client.query_statmuse("Yankees record")
print(f"Cached: {result.cached}")  # True if from cache
```

### Rate Limiting
- **Conservative Limits**: 25 requests per minute to be respectful to StatMuse
- **Automatic Backoff**: Client automatically waits when limits are reached
- **Burst Protection**: Prevents accidental API abuse

## 🧪 Testing

### Run All Tests
```bash
python test_statmuse_mcp.py
```

### Test Individual Tools
```bash
# Test specific functionality
python -c "
from statmuse_mcp_client import StatMuseSync
result = StatMuseSync.query('Yankees vs Red Sox last 5 meetings')
print(result.data)
"
```

## 🚀 Production Deployment

### 1. Environment Variables
```bash
export REDIS_URL="redis://your-redis-server:6379"
export STATMUSE_RATE_LIMIT=20  # Optional: custom rate limit
```

### 2. Process Management
```bash
# Using systemd, supervisord, or PM2
pm2 start statmuse_mcp_server.py --name "statmuse-mcp"
```

### 3. Health Monitoring
```python
# Health check endpoint
async def health_check():
    try:
        async with StatMuseMCPClient() as client:
            result = await client.query_statmuse("test query")
            return {"status": "healthy", "mcp_server": "running"}
    except:
        return {"status": "unhealthy", "mcp_server": "down"}
```

## 📈 Performance Metrics

### Expected Performance
- **Cache Hits**: ~80% of requests served from cache
- **Response Time**: <100ms for cached, <2s for fresh queries
- **Rate Limit**: 25 requests/minute per client
- **Availability**: 99.9% uptime with proper Redis setup

### Monitoring
```python
# Built-in metrics logging
logger.info(f"💾 Cache hit for: {query}")          # Cache performance
logger.info(f"⏱️ Rate limit reached, waiting...")  # Rate limiting
logger.info(f"✅ StatMuse success: {result}")       # Query success
```

## 🔧 Troubleshooting

### Common Issues

**1. "Redis not available, using in-memory cache"**
- Install and start Redis server
- Check Redis connection string in config

**2. "Rate limit reached, waiting..."**
- Normal behavior, client will automatically wait
- Consider implementing request queuing for high-volume usage

**3. "StatMuse query failed"**
- Check internet connectivity
- Verify StatMuse.com is accessible
- Review query format

**4. "MCP Server connection failed"**
- Ensure server is running: `python statmuse_mcp_server.py`
- Check for port conflicts
- Review server logs for errors

### Debug Mode
```python
import logging
logging.basicConfig(level=logging.DEBUG)

# This will show detailed MCP communication
async with StatMuseMCPClient() as client:
    result = await client.query_statmuse("test")
```

## 📋 Migration Guide

### From Embedded StatMuse to MCP

**Before:**
```python
def query_statmuse(self, query):
    # Direct StatMuse scraping code
    response = requests.get(statmuse_url)
    # ... parsing logic
```

**After:**
```python
async def query_statmuse(self, query):
    async with StatMuseMCPClient() as client:
        result = await client.query_statmuse(query)
        return result.data
```

### Benefits of Migration
- ✅ **Eliminates duplicate code** across systems
- ✅ **Adds caching and rate limiting** automatically
- ✅ **Centralizes StatMuse access** for easier maintenance
- ✅ **Provides consistent data** across all AI systems
- ✅ **Improves performance** with intelligent caching

## 🎯 Next Steps

1. **Test the MCP Server**: Run `python test_statmuse_mcp.py`
2. **Integrate Daily Insights**: Use `daily_insights_with_mcp.py` as example
3. **Enhance Professor Lock**: Add StatMuse tools to chatbot
4. **Upgrade Orchestrator**: Replace algorithmic guesses with real data
5. **Monitor Performance**: Track cache hits and response times

---

## 🚀 **You now have a centralized StatMuse intelligence service that can power your entire AI ecosystem with real MLB data!**

This transforms your app from "AI with sports knowledge" to "AI with real-time sports intelligence." 🎯 