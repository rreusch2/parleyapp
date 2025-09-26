# Professor Lock Advanced - WebSocket Service

A high-performance WebSocket microservice that powers the advanced Professor Lock AI sports betting assistant with real-time tool visualization and agent communication.

## 🚀 Features

- **Real-time WebSocket Communication** - Bidirectional streaming between frontend and AI agent
- **Live Tool Visualization** - Browser screenshots, StatMuse data, web search results, Python analysis
- **Multi-Tool Support** - Browser control, sports data queries, web search, data analysis
- **Daytona Cloud Integration** - Seamless connection to cloud-hosted OpenManus agents
- **Rate Limiting & Security** - Per-user connection limits, message throttling, burst protection
- **Subscription Tier Support** - Different limits and features based on user subscription
- **Comprehensive Logging** - Structured logging with Winston for monitoring and debugging

## 🏗 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Frontend  │◄──►│  WebSocket API   │◄──►│ Daytona Agent   │
│  (React/WS)     │    │  (Node.js/WS)    │    │ (OpenManus)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Supabase DB    │
                       │ (Auth/Analytics) │
                       └──────────────────┘
```

## 📦 Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Daytona workspace (optional)

### Local Development

1. **Clone and setup**
```bash
cd professor-lock-service
npm install
cp .env.example .env
```

2. **Configure environment variables**
```bash
# Edit .env with your values
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DAYTONA_API_KEY=your_daytona_api_key
DAYTONA_WORKSPACE_URL=https://your-workspace.daytona.io
```

3. **Start development server**
```bash
npm run dev
```

### Docker Deployment

1. **Build and run with Docker Compose**
```bash
docker-compose up -d
```

2. **Or build manually**
```bash
docker build -t professor-lock-service .
docker run -p 8080:8080 --env-file .env professor-lock-service
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | WebSocket server port | `8080` |
| `NODE_ENV` | Environment mode | `development` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `SUPABASE_URL` | Supabase project URL | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | Required |
| `DAYTONA_API_KEY` | Daytona workspace API key | Optional |
| `DAYTONA_WORKSPACE_URL` | Daytona workspace URL | Optional |
| `OPENMANUS_AGENT_URL` | OpenManus agent endpoint | `http://localhost:3000` |
| `MAX_CONNECTIONS_PER_USER` | Connection limit per user | `3` |
| `MESSAGE_RATE_LIMIT` | Messages per minute | `10` |
| `ENABLE_BROWSER_TOOL` | Enable browser automation | `true` |
| `ENABLE_STATMUSE_TOOL` | Enable StatMuse integration | `true` |
| `ENABLE_WEB_SEARCH_TOOL` | Enable web search | `true` |
| `ENABLE_PYTHON_TOOL` | Enable Python execution | `true` |

### Tool Configuration

Tools can be enabled/disabled via environment variables:

```bash
# Enable specific tools
ENABLE_BROWSER_TOOL=true
ENABLE_STATMUSE_TOOL=true
ENABLE_WEB_SEARCH_TOOL=true
ENABLE_PYTHON_TOOL=true
```

### Rate Limiting

Rate limits are applied per subscription tier:

| Tier | Messages/min | Connections | Browser Uses | StatMuse Queries |
|------|--------------|-------------|--------------|------------------|
| Free | 5 | 1 | 3/5min | 5/min |
| Pro | 20 | 3 | 15/5min | 30/min |
| Premium | 50 | 5 | 50/5min | 100/min |

## 🔌 WebSocket API

### Connection

Connect to WebSocket endpoint:
```
ws://localhost:8080/professor-lock/{userId}
```

### Message Types

#### Client → Server

**User Message**
```json
{
  "type": "user_message",
  "content": "Analyze the Yankees vs Red Sox game tonight",
  "messageId": "msg_123",
  "userTier": "pro"
}
```

**Tool Interaction**
```json
{
  "type": "tool_interaction",
  "toolName": "browser_use",
  "action": "get_screenshot",
  "data": {}
}
```

**Agent Interrupt**
```json
{
  "type": "agent_interrupt",
  "reason": "user_requested",
  "force": true
}
```

#### Server → Client

**Message Chunk** (Streaming)
```json
{
  "type": "message_chunk",
  "messageId": "msg_123",
  "chunk": "Looking at tonight's game..."
}
```

**Tool Start**
```json
{
  "type": "tool_start",
  "tool": {
    "name": "browser_use",
    "status": "running",
    "startTime": "2024-01-20T10:30:00Z"
  }
}
```

**Tool Screenshot**
```json
{
  "type": "tool_screenshot",
  "toolName": "browser_use",
  "screenshot": "base64_encoded_image_data"
}
```

**Agent Status**
```json
{
  "type": "agent_status",
  "status": {
    "isActive": true,
    "currentTask": "Analyzing StatMuse data",
    "toolsInUse": ["statmuse_query"],
    "progress": 75
  }
}
```

## 🛠 Available Tools

### Browser Control (`browser_use`)
- Navigate to websites
- Take live screenshots  
- Click elements and fill forms
- Extract page content
- Monitor page changes

### StatMuse Sports Data (`statmuse_query`)
- Historical player statistics
- Team performance data
- Betting trend analysis
- Head-to-head comparisons
- Season averages and splits

### Web Search (`web_search`)
- News and injury reports
- Line movement tracking
- Expert predictions
- Weather conditions
- Roster updates

### Data Analysis (`python_execute`)
- Statistical modeling
- Data visualization
- Probability calculations
- Trend analysis
- Performance backtesting

### Database Query (`supabase_query`)
- Historical betting data
- User preferences
- Past predictions
- Performance analytics

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:8080/health
```

### Status Endpoint
```bash
curl http://localhost:8080/status/{sessionId}
```

### Tools Endpoint
```bash
curl http://localhost:8080/tools
```

### Logs
- Console output in development
- File logging in production (`logs/combined.log`, `logs/error.log`)
- Structured JSON format for log aggregation

## 🔒 Security

- **Rate Limiting** - Per-user message and connection limits
- **Input Sanitization** - XSS protection on message content
- **Authentication** - Supabase user validation
- **Resource Limits** - Docker memory and CPU constraints
- **Non-root User** - Container runs as limited user

## 🧪 Testing

```bash
# Run tests
npm test

# Test WebSocket connection
node test/websocket-client.js

# Load testing
npm run test:load
```

## 📈 Scaling

### Horizontal Scaling
- Deploy multiple service instances behind load balancer
- Use Redis for shared session storage
- Implement WebSocket sticky sessions

### Vertical Scaling
- Adjust Docker resource limits
- Increase rate limits for high-traffic users
- Optimize tool execution timeouts

## 🐛 Troubleshooting

### Common Issues

**Connection Refused**
- Check if service is running on correct port
- Verify firewall settings
- Ensure WebSocket upgrade headers are present

**Rate Limit Errors**
- Check user subscription tier
- Verify rate limit configuration
- Monitor burst limits

**Agent Communication Failures**
- Verify Daytona API credentials
- Check OpenManus agent status
- Review network connectivity

**Tool Execution Timeouts**
- Increase tool timeout limits
- Check cloud sandbox resource limits
- Monitor tool queue status

### Debug Mode
```bash
LOG_LEVEL=debug npm run dev
```

### Health Monitoring
```bash
# Check service health
docker-compose ps
docker-compose logs professor-lock-service

# Monitor WebSocket connections
curl http://localhost:8080/health | jq .connections
```

## 🤝 Integration

### Frontend Integration

```typescript
// Connect to WebSocket
const ws = new WebSocket(`ws://localhost:8080/professor-lock/${userId}`);

// Handle messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'message_chunk':
      updateStreamingMessage(data);
      break;
    case 'tool_screenshot':
      displayScreenshot(data);
      break;
    // ... handle other message types
  }
};

// Send user message
ws.send(JSON.stringify({
  type: 'user_message',
  content: 'Analyze the Lakers game tonight',
  messageId: 'msg_' + Date.now(),
  userTier: 'pro'
}));
```

### Backend Integration

The service integrates with:
- **Supabase** - User authentication and data storage
- **Daytona** - Cloud sandbox agent hosting
- **OpenManus** - AI agent framework
- **StatMuse API** - Sports data provider

## 📝 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check troubleshooting section
2. Review logs for error details
3. Open GitHub issue with reproduction steps
4. Contact development team

---

**Professor Lock Advanced** - Powered by OpenManus AI Agent Framework
