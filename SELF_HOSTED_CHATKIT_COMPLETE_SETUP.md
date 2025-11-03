# 🎯 Self-Hosted ChatKit Setup - Complete Guide

## Overview

You've successfully migrated from OpenAI's hosted ChatKit to your own self-hosted solution! This gives you:

✅ **Full Control** - Custom tools, widgets, and agent behavior  
✅ **Advanced Widgets** - Interactive cards, live updates, real-time search  
✅ **Cost Efficiency** - Pay only for OpenAI API calls, not ChatKit hosting  
✅ **Better UX** - Faster, more responsive, tailored to your users  
✅ **StatMuse Integration** - Direct access to sports statistics  

---

## 📁 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Predictive Play Web App                    │
│                    (Next.js on Vercel)                      │
│                                                             │
│  Components:                                                │
│  └── SelfHostedChatKit.tsx ─┐                              │
│      (ChatKit React Component)                              │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Python ChatKit Server (Railway)                │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │  FastAPI App (app.py)                            │     │
│  │  ├── /api/chatkit/session  (Create sessions)    │     │
│  │  └── /chatkit             (Main ChatKit endpoint)│     │
│  └──────────────────────────────────────────────────┘     │
│                              │                              │
│  ┌──────────────────────────┼─────────────────────┐       │
│  │  Professor Lock Agent (pp_server.py)            │       │
│  │  ├── web_search_visual()                        │       │
│  │  ├── get_odds_visual()                          │       │
│  │  ├── statmuse_query()                           │       │
│  │  └── build_parlay()                             │       │
│  └──────────────────────────┬─────────────────────┘       │
│                              │                              │
│  ┌──────────────────────────┼─────────────────────┐       │
│  │  Widget Generators (pp_widgets.py)              │       │
│  │  ├── create_search_progress_widget()            │       │
│  │  ├── create_odds_comparison_widget()            │       │
│  │  ├── create_parlay_builder_widget()             │       │
│  │  └── create_trends_chart_widget()               │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              │ Store threads & messages
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                      │
│                                                             │
│  Tables:                                                    │
│  ├── chatkit_threads       (Conversation threads)          │
│  ├── chatkit_thread_items  (Messages, widgets, tools)      │
│  └── chatkit_attachments   (File uploads)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 How Widgets Work

### 1. User Sends Message

```
User: "Show me odds for Lakers vs Warriors"
```

### 2. Agent Decides to Use Tool

The Professor Lock agent (GPT-4) decides to call the `get_odds_visual` tool.

### 3. Tool Executes & Streams Widget

```python
@function_tool
async def get_odds_visual(ctx, sport, market_type):
    # Fetch odds from your API
    odds_data = await sports_data.get_odds(sport, market_type)
    
    # Create widget
    odds_widget = create_odds_comparison_widget(odds_data)
    
    # Stream widget to UI
    await ctx.context.stream_widget(odds_widget)
    
    return json.dumps(odds_data)
```

### 4. Widget Appears in Chat

The ChatKit UI automatically renders:

```
┌─────────────────────────────────────────┐
│ 📊 Live Odds Board              10 Games│
│ Last Update: Just now                   │
├─────────────────────────────────────────┤
│ Lakers @ Warriors                       │
│ │ SPREAD │ O/U │ ML: LAL -140 / GSW +120│
│ │  -3.5  │ 225 │                        │
├─────────────────────────────────────────┤
│ ... more games ...                      │
└─────────────────────────────────────────┘
```

---

## 🧰 Available Widgets

### 1. Search Progress Widget

**Shows:** Live web search with streaming results

```python
widget = create_search_progress_widget("LeBron injury news", "injury")
```

**Features:**
- Live status updates
- Source badges
- Result snippets
- Completion indicator

---

### 2. Odds Comparison Widget

**Shows:** Sports odds in a clean table format

```python
widget = create_odds_comparison_widget(odds_data)
```

**Features:**
- Multiple games at once
- Spread, total, moneyline
- Color-coded badges
- Last update timestamp

---

### 3. Parlay Builder Widget

**Shows:** Interactive parlay card with calculations

```python
widget = create_parlay_builder_widget(legs, stake=100)
```

**Features:**
- Pick-by-pick breakdown
- Live odds calculation
- Confidence indicators
- Interactive stake input
- "Lock It In" button with action

---

### 4. Trends Chart Widget

**Shows:** Performance trends over time

```python
widget = create_trends_chart_widget(trends_data)
```

**Features:**
- Line/bar charts
- Multiple series
- Tooltips
- Legend

---

## 🔧 Customizing Professor Lock

### Update Agent Instructions

Edit `pykit/pp_server.py`:

```python
professor_lock_agent = Agent[AgentContext](
    model="gpt-4o",
    name="Professor Lock",
    instructions="""
    You are Professor Lock...
    
    [Add your custom instructions here]
    """
)
```

### Add New Tools

Create a new tool in `pp_server.py`:

```python
@function_tool
async def my_custom_tool(
    ctx: RunContextWrapper,
    param1: str,
    param2: int
) -> str:
    """Tool description for the AI"""
    
    # Your logic here
    result = await fetch_something(param1, param2)
    
    # Create widget
    widget = Card(
        size="md",
        children=[
            Title(value="Custom Result"),
            Text(value=str(result))
        ]
    )
    
    # Stream it
    await ctx.context.stream_widget(widget)
    
    return str(result)

# Add to agent tools
ProfessorLockChatKitServer.professor_lock_agent.tools.append(my_custom_tool)
```

### Create Custom Widget

Add to `pykit/pp_widgets.py`:

```python
def create_my_custom_widget(data: Dict) -> Card:
    """Create custom widget"""
    return Card(
        size="lg",
        theme="dark",
        children=[
            Title(value="🎯 My Custom Widget"),
            Text(value=data['content']),
            Button(label="Click Me", style="primary")
        ]
    )
```

---

## 🚀 Deployment Steps

### 1. Set Up Supabase

```bash
# Run in Supabase SQL Editor
cat pykit/chatkit_supabase_schema.sql
```

### 2. Deploy to Railway

```bash
cd pykit
railway init
railway variables set OPENAI_API_KEY=sk-...
railway variables set SUPABASE_URL=https://...
railway variables set SUPABASE_SERVICE_ROLE_KEY=...
railway up
```

### 3. Configure Web App

Add to Vercel environment variables:
```
NEXT_PUBLIC_CHATKIT_SERVER_URL=https://your-railway-url.railway.app
```

### 4. Deploy Web App

```bash
cd pplayweb
git push
# Vercel auto-deploys
```

---

## 🎯 Testing

### Test Server Directly

```bash
# Health check
curl https://your-railway-url.railway.app/health

# Create session
curl -X POST https://your-railway-url.railway.app/api/chatkit/session \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test"}'
```

### Test from Web App

1. Go to `predictive-play.com/professor-lock`
2. Log in
3. Try these prompts:
   - "Show me tonight's NBA odds"
   - "Build me a parlay with 3 picks"
   - "How many points is LeBron averaging?"
   - "Search for weather in Denver"

---

## 📊 Monitoring

### Railway Logs

```bash
railway logs --tail
```

Look for:
- Session creation: `✅ Created ChatKit session`
- Tool calls: Widget generation events
- Errors: Any `❌` messages

### Supabase Dashboard

Monitor:
- Row counts in `chatkit_threads` table
- Query performance
- Storage usage

---

## 💰 Cost Breakdown

### Before (OpenAI Hosted)

- ChatKit hosting fees
- OpenAI API calls
- Limited customization

### After (Self-Hosted)

- **Railway**: ~$5-20/month (depends on usage)
- **Supabase**: Free tier (or ~$25/month for Pro)
- **OpenAI API**: Pay per token only
- **Total Savings**: Potentially 40-60% lower

---

## 🎉 What You Get

✅ **Advanced Widgets** - Cards, charts, interactive forms  
✅ **Custom Tools** - Any Python function as a tool  
✅ **Real-time Updates** - Streaming widget modifications  
✅ **Full Control** - Modify agent behavior instantly  
✅ **Better Performance** - Direct server control  
✅ **StatMuse Integration** - Built-in sports stats  
✅ **Parlay Builder** - Interactive bet construction  
✅ **Live Search** - Visual progress indicators  

---

## 📚 Files Reference

| File | Purpose |
|------|---------|
| `pykit/app.py` | Main FastAPI server |
| `pykit/pp_server.py` | Professor Lock agent & tools |
| `pykit/pp_widgets.py` | Widget creators |
| `pykit/pp_tools.py` | Tool implementations |
| `pykit/parleyapp_tools.py` | External API integrations |
| `pykit/chatkit_supabase_store.py` | Supabase storage layer |
| `pplayweb/components/professor-lock/SelfHostedChatKit.tsx` | React component |
| `pplayweb/app/professor-lock/page.tsx` | Professor Lock page |

---

## 🔗 Next Steps

1. **Customize Agent Personality** - Edit instructions in `pp_server.py`
2. **Add More Tools** - Integrate Odds API, weather, injuries
3. **Create Custom Widgets** - Build unique visualizations
4. **Optimize Performance** - Add caching, rate limiting
5. **Monitor Usage** - Set up alerts in Railway

---

## 💡 Tips

- **Widget Design**: Keep widgets focused and scannable
- **Tool Functions**: Return both data (for AI) and widgets (for users)
- **Error Handling**: Always catch exceptions in tools
- **Logging**: Use `print()` for debugging (shows in Railway logs)
- **Testing**: Test tools individually before adding to agent

---

## ❓ Common Questions

**Q: Can I use different AI models?**  
A: Yes! Change `model="gpt-4o"` to any OpenAI model.

**Q: How do I add file upload support?**  
A: Implement `AttachmentStore` in your store class.

**Q: Can I use a different database?**  
A: Yes! Implement the `Store` interface for any database.

**Q: How do I add authentication?**  
A: Already handled! User context comes from headers.

**Q: Can I deploy to other platforms?**  
A: Yes! Works on Render, Fly.io, AWS, GCP, Azure.

---

## 🎊 You Did It!

Your self-hosted ChatKit is now running with full widget support. Enjoy building amazing betting experiences! 🚀💰

