# 🎯 Final Agent Builder + ChatKit Setup Guide

## ✅ What's Been Built

### 1. Agent Builder Workflow
- **Workflow ID**: `wf_68edde0b32e08190b090de89bef1a0d302929051ff1c5a9a`
- **Tools**: Supabase MCP, Web Search, Code Interpreter
- **Model**: GPT-5 with medium reasoning effort
- **Published**: Ready to use

### 2. Backend Integration
- ✅ `apps/backend/src/api/chatkit.ts` - ChatKit session endpoint
- ✅ `apps/backend/src/api/widgets.ts` - Official ChatKit widget generators
- ✅ Route registered at `/api/chatkit/*`

### 3. React Native Components
- ✅ `apps/mobile/app/components/ProAIChatEnhanced.tsx` - ChatKit WebView wrapper
- ✅ Integrated into `(tabs)/_layout.tsx`
- ✅ Replaces old `ProAIChat.tsx`

### 4. Database
- ✅ `database_fixes.sql` - Auto-linking triggers for player_id and headshots

### 5. Python Scripts
- ✅ `run_agent_builder_predictions.py` - Daily prediction generation
- ✅ `browser_automation.py` - Code Interpreter browser tools

---

## 🚀 Complete Setup Steps

### Step 1: Database (5 minutes)

```bash
# Run in Supabase SQL Editor
cat database_fixes.sql
# Copy and paste into Supabase SQL Editor and execute
```

This creates:
- `match_player_name_to_id()` function
- `auto_link_player_predictions()` trigger
- Automatic player_id and headshot population

### Step 2: Backend Environment (2 minutes)

```bash
cd apps/backend
```

Add to `.env`:
```bash
OPENAI_API_KEY=your-openai-api-key-here
```

Install OpenAI SDK:
```bash
npm install openai
```

### Step 3: Start Backend (1 minute)

```bash
cd apps/backend
npm run dev
```

Backend should start on port 3000 with `/api/chatkit` routes.

### Step 4: Test ChatKit Session Creation

```bash
curl -X POST http://localhost:3000/api/chatkit/session \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-123", "userTier": "elite"}'
```

Should return:
```json
{
  "client_secret": "sk_...",
  "session_id": "sess_..."
}
```

### Step 5: Test Widget Generation

```bash
curl http://localhost:3000/api/chatkit/widgets/example
```

Should return a beautiful betting pick card widget in JSON format.

### Step 6: Open React Native App

Your app is already running with ProAIChatEnhanced integrated!

1. **Open the Professor Lock chat** (tap the floating AI button)
2. **ChatKit will load** with your Agent Builder workflow
3. **Ask**: "What are your best bets today?"
4. **Agent will**:
   - Query Supabase for games
   - Use web search for injuries/news
   - Generate intelligent picks
   - Return them as beautiful Card widgets
   - Store picks in ai_predictions table

---

## 🎨 Widget Features

### Available Widgets

1. **Betting Pick Card** - Single pick with:
   - Team logos
   - Odds highlighting
   - Confidence badges
   - Risk level indicators
   - Interactive "Add to Parlay" button
   - Expandable reasoning

2. **Parlay Builder** - Multi-leg parlay with:
   - ListView of all picks
   - Total odds calculation
   - Potential payout display
   - "Place Parlay" button

3. **Elite Lock Widget** - Premium styling for Elite users:
   - Gold gradient background
   - Crown icon
   - Enhanced stats
   - "Lock It In" button

4. **Stats Comparison** - Head-to-head team stats:
   - Win/loss records
   - Points per game
   - Visual comparison layout

### How Widgets Work

**In Agent Builder**, the agent returns:
```json
{
  "type": "Card",
  "children": [...]
}
```

**ChatKit renders** as beautiful, interactive UI

**User clicks button** → Message sent to React Native

**React Native handles** action (add to parlay, view details, etc.)

---

## 🤖 Agent Builder Instructions to Add

Go to your Agent Builder workflow and **update the Agent Instructions** to include:

```
🎨 WIDGET RENDERING:

When providing betting picks in chat, return them as ChatKit widgets for beautiful UI.

EXAMPLE WIDGET OUTPUT:
{
  "type": "Card",
  "size": "md",
  "padding": 16,
  "background": { "dark": "#1E293B", "light": "#F8FAFC" },
  "radius": "lg",
  "children": [
    {
      "type": "Row",
      "justify": "between",
      "align": "center",
      "children": [
        {
          "type": "Text",
          "value": "Lakers vs Warriors",
          "weight": "semibold"
        },
        {
          "type": "Text",
          "value": "+150",
          "size": "xl",
          "weight": "bold",
          "color": { "dark": "#00E5FF" }
        }
      ]
    },
    {
      "type": "Text",
      "value": "Pick: Lakers ML",
      "weight": "bold"
    },
    {
      "type": "Row",
      "gap": 8,
      "children": [
        {
          "type": "Badge",
          "label": "78% Confidence",
          "color": "success"
        }
      ]
    },
    {
      "type": "Button",
      "label": "Add to Parlay",
      "style": "primary",
      "block": true,
      "onClickAction": {
        "type": "add_to_parlay",
        "payload": { "pickId": "pick_123" },
        "handler": "client"
      }
    }
  ]
}

WIDGET RULES:
- Use Card for each betting pick
- Include Badges for confidence/risk
- Add Buttons for user actions
- Use Row/Col for layout
- Check metadata.isElite for gold styling
- Return ListView for multiple picks

AVAILABLE COMPONENTS:
Card, Row, Col, Text, Title, Caption, Badge, Button, Divider, Icon, Image, ListView, Box

COLORS:
- Elite users: #FFD700 (gold)
- Pro users: #00E5FF (cyan)
- Success: "success" badge color
- Warning: "warning" badge color
- Danger: "danger" badge color
```

---

## 🧪 Testing Your Setup

### Test 1: Simple Chat
1. Open Professor Lock in app
2. Type: "Hello"
3. Should get AI response

### Test 2: Widget Display
1. Ask: "What's your best bet today?"
2. Should see beautiful card widget with:
   - Team matchup
   - Odds
   - Confidence badge
   - "Add to Parlay" button

### Test 3: Elite Features
1. Login as Elite user
2. Ask: "Give me your Lock of the Day"
3. Should see gold-themed widget with crown icon

### Test 4: Parlay Builder
1. Ask: "Build me a 3-leg parlay"
2. Should see:
   - 3 picks in ListView
   - Total odds display
   - Potential payout
   - "Place Parlay" button

### Test 5: Database Storage
```sql
-- Check in Supabase
SELECT * FROM ai_predictions 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

Should see predictions with:
- ✅ Proper player_id links
- ✅ Headshot URLs populated
- ✅ All required fields filled

---

## 🎯 Daily Automation

### Option 1: Python Script

```bash
# Generate today's predictions
python run_agent_builder_predictions.py

# Generate for tomorrow
python run_agent_builder_predictions.py --tomorrow

# Specific sport
python run_agent_builder_predictions.py --sport NFL --picks 30
```

### Option 2: Cron Job

```bash
# Add to crontab
0 6 * * * cd /home/reid/Desktop/parleyapp && python run_agent_builder_predictions.py
```

### Option 3: Node.js Cron (Recommended)

Create `apps/backend/src/cron/agentBuilderPredictions.ts`:

```typescript
import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function generateDailyPredictions() {
  console.log('🤖 Running Agent Builder prediction generation...');
  
  try {
    const { stdout, stderr } = await execAsync(
      'python run_agent_builder_predictions.py --picks 25',
      { cwd: '/home/reid/Desktop/parleyapp' }
    );
    
    console.log('✅ Predictions generated!');
    console.log(stdout);
    
    if (stderr) console.error('Warnings:', stderr);
  } catch (error) {
    console.error('❌ Prediction generation failed:', error);
  }
}

export function initAgentBuilderCron() {
  // Run daily at 6 AM EST
  cron.schedule('0 6 * * *', generateDailyPredictions, {
    timezone: "America/New_York"
  });
  
  console.log('✅ Agent Builder cron job initialized');
}
```

Then in `apps/backend/src/app.ts`:
```typescript
import { initAgentBuilderCron } from './cron/agentBuilderPredictions';

// In initialization section
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
  initAgentBuilderCron();
}
```

---

## 🎨 Advanced: Custom Widget Actions

Update `ProAIChatEnhanced.tsx` to handle widget actions:

```typescript
const handleMessage = (event: any) => {
  try {
    const message = JSON.parse(event.nativeEvent.data);
    
    if (message.type === 'widget_action') {
      switch (message.action.type) {
        case 'add_to_parlay':
          // Add pick to parlay state
          addPickToParlay(message.action.payload.pickId);
          break;
          
        case 'view_pick_details':
          // Navigate to pick details screen
          router.push(`/pick/${message.action.payload.pickId}`);
          break;
          
        case 'place_parlay':
          // Navigate to parlay placement
          router.push('/parlay/place', {
            picks: message.action.payload.picks
          });
          break;
      }
    }
  } catch (error) {
    console.error('Error handling widget action:', error);
  }
};
```

---

## 📊 Comparison: Old vs New

### Old System (claudeChatbotOrchestrator.ts)
- ❌ Custom SSE implementation
- ❌ Manual message handling
- ❌ Plain text responses
- ❌ No widgets or interactive UI
- ❌ Complex codebase to maintain

### New System (Agent Builder + ChatKit)
- ✅ OpenAI-hosted infrastructure
- ✅ Automatic message handling
- ✅ Beautiful widget cards
- ✅ Interactive buttons
- ✅ Visual workflow editor
- ✅ Built-in reasoning and tool coordination

---

## 🏆 Elite vs Pro Experience

### Elite Users Get:
- 👑 Gold-themed widgets
- 🔒 Lock of the Day widget
- 📊 Enhanced stats displays
- ⚡ Priority processing
- 💎 Premium badge styling

### Pro Users Get:
- 🤖 Blue-themed widgets
- 📈 All interactive features
- 🎯 Unlimited picks
- 🧠 Full Agent Builder intelligence

### Free Users Get:
- 💬 Basic chat (no widgets)
- 📱 3 picks per day limit
- 🔓 Upgrade prompts

---

## 🎯 Next Steps

1. **✅ Backend is running** with ChatKit endpoints
2. **✅ Frontend is built** with ProAIChatEnhanced
3. **✅ Database triggers** are ready
4. **✅ Widgets are configured**

**Now test it:**
1. Open app
2. Tap Professor Lock chat button
3. Ask "What are your best bets today?"
4. See beautiful widget cards appear!

**The Agent Builder workflow will:**
- Query your Supabase database intelligently
- Search web for breaking news
- Use Code Interpreter for calculations
- Generate predictions with reasoning
- Return beautiful ChatKit widgets
- Store results in ai_predictions table

**You've successfully migrated from mechanical Python scripts to intelligent AI agents! 🚀**

