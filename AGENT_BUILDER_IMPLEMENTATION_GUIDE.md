# 🤖 Agent Builder Implementation Guide for ParleyApp

## 🎯 Overview
This guide walks through implementing OpenAI Agent Builder to replace your current mechanical Python scripts with intelligent, autonomous AI agents.

## ✅ What You've Built So Far

### Agent Builder Workflow Published
- **Workflow ID**: `wf_68edde0b32e08190b090de89bef1a0d302929051ff1c5a9a`
- **Agent**: Master Sports Prediction Agent
- **Tools Configured**:
  - ✅ Supabase MCP (database access + execute_sql)
  - ✅ Web Search (injury reports, breaking news)
  - ✅ Code Interpreter (browser automation, StatMuse, calculations)

### Files Created
- `database_fixes.sql` - Player linking triggers
- `browser_automation.py` - Intelligent browser automation for Code Interpreter
- `apps/backend/src/api/chatkit.ts` - ChatKit session endpoint
- `app/components/ProfessorLockChatKit.tsx` - React Native ChatKit component
- `run_agent_builder_predictions.py` - Daily prediction generation script

---

## 🗄️ PHASE 1: Database Foundation

### 1. Run Database Fixes

```bash
# Run in Supabase SQL Editor
cat database_fixes.sql
```

This creates:
- `match_player_name_to_id()` function for player matching
- `auto_link_player_predictions()` trigger that:
  - Auto-populates `player_id` when inserting player props
  - Auto-fetches `headshot_url` from players table
  - Updates metadata with proper player info

**Result**: No more manual headshot URL fetching! Database handles it automatically.

---

## 💬 PHASE 2: ChatKit Integration

### A. Backend Setup

1. **Add OpenAI SDK to backend**:
```bash
cd apps/backend
npm install openai @openai/chatkit-react
```

2. **Add environment variable**:
```bash
# In apps/backend/.env
OPENAI_API_KEY=your-openai-api-key
```

3. **Backend already updated** with ChatKit route at `/api/chatkit/session`

### B. React Native Integration

1. **Install dependencies**:
```bash
cd /home/reid/Desktop/parleyapp
npm install react-native-webview
```

2. **Use the ProfessorLockChatKit component** in your chat screen:

```typescript
// In your ProfessorLockScreen or wherever you have the chat
import { ProfessorLockChatKit } from '../components/ProfessorLockChatKit';

export const ProfessorLockScreen = () => {
  const [showChat, setShowChat] = useState(false);
  
  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={() => setShowChat(true)}>
        <Text>Chat with Professor Lock</Text>
      </TouchableOpacity>
      
      <Modal visible={showChat} animationType="slide">
        <ProfessorLockChatKit 
          visible={showChat}
          onClose={() => setShowChat(false)}
        />
      </Modal>
    </View>
  );
};
```

### C. Elite User Theming

The ChatKit component already handles theme switching based on:
- `useColorScheme()` - Detects dark/light mode
- `subscriptionTier === 'elite'` - Changes accent color to gold for Elite users

**Automatic theme sync!** No additional code needed.

---

## 🤖 PHASE 3: Daily Prediction Generation

### Option 1: Run Agent Builder Workflow via API

```bash
# Generate predictions for today
python run_agent_builder_predictions.py

# Generate for tomorrow
python run_agent_builder_predictions.py --tomorrow

# Generate for specific date and sport
python run_agent_builder_predictions.py --date 2025-10-15 --sport NFL --picks 30
```

### Option 2: Call from Node.js (Cron Job)

```typescript
// Create apps/backend/src/cron/agentBuilderPredictions.ts
import { AsyncOpenAI } from 'openai';
import cron from 'node-cron';

const client = new AsyncOpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateDailyPredictions() {
  const today = new Date().toISOString().split('T')[0];
  
  const response = await client.responses.create({
    model: "gpt-5",
    workflow_id: "wf_68edde0b32e08190b090de89bef1a0d302929051ff1c5a9a",
    input: `Generate 25 betting predictions for ${today}. Use all available tools.`,
    reasoning: { effort: "high" }
  });
  
  console.log("✅ Predictions generated!");
}

// Run daily at 6 AM EST
export function initAgentBuilderCron() {
  cron.schedule('0 6 * * *', generateDailyPredictions, {
    timezone: "America/New_York"
  });
}
```

---

## 🎨 PHASE 4: Widget Integration (Optional Enhancement)

### Custom Sports Bet Widgets

You can create custom widgets for the ChatKit interface using the Widget Builder:

```typescript
// Example: Bet Card Widget
const BetCardWidget = {
  type: "Card",
  size: "md",
  children: [
    {
      type: "Row",
      align: "center",
      gap: 12,
      children: [
        {
          type: "Image",
          src: leagueLogoUrl,
          alt: sport,
          size: 40,
          radius: "sm"
        },
        {
          type: "Col",
          gap: 4,
          children: [
            {
              type: "Title",
              value: pick,
              size: "sm",
              weight: "semibold"
            },
            {
              type: "Text",
              value: matchTeams,
              size: "sm",
              color: "secondary"
            }
          ]
        }
      ]
    },
    {
      type: "Divider",
      spacing: 12
    },
    {
      type: "Row",
      justify: "between",
      children: [
        {
          type: "Badge",
          label: `${confidence}% confidence`,
          color: confidence >= 70 ? "success" : "info"
        },
        {
          type: "Text",
          value: odds,
          weight: "bold",
          color: "primary"
        }
      ]
    },
    {
      type: "Text",
      value: reasoning,
      size: "sm",
      maxLines: 3
    },
    {
      type: "Button",
      label: "Add to Parlay",
      style: "primary",
      onClickAction: {
        type: "add_to_parlay",
        payload: { predictionId: id }
      }
    }
  ]
};
```

---

## 🚀 PHASE 5: Migration Strategy

### Replace Current Python Scripts Gradually

**Week 1: Database + ChatKit**
- ✅ Run `database_fixes.sql` in Supabase
- ✅ Deploy backend with ChatKit endpoint
- ✅ Test ChatKit in React Native app
- ✅ Monitor database player_id linking works

**Week 2: Test Agent Builder Predictions**
- Run `python run_agent_builder_predictions.py` manually
- Verify predictions match ai_predictions table format
- Check frontend displays new predictions correctly
- Compare quality vs old Python scripts

**Week 3: Replace One Script**
- Disable `props_intelligent_v3.py` cron job
- Enable Agent Builder cron instead
- Monitor for 3-5 days
- Fix any issues

**Week 4: Full Migration**
- Replace all remaining Python prediction scripts
- Keep old scripts as backup for 1 month
- Monitor system performance with 2000+ users

---

## 🛠️ Key Improvements Over Current System

### Intelligence
- **Before**: Hardcoded research plans, mechanical execution
- **After**: Agent intelligently decides what to research based on available data

### Coordination  
- **Before**: Separate scripts for teams/props, potential conflicts
- **After**: Single agent coordinates all predictions, prevents conflicts

### Database
- **Before**: Manual player_id lookups, missing headshots
- **After**: Automatic player linking and headshot population

### Chat Experience
- **Before**: Custom TypeScript orchestrator, basic UI
- **After**: Professional ChatKit UI with custom theming for Elite users

### Maintenance
- **Before**: Maintain 5+ complex Python scripts
- **After**: Visual workflow editor, easy to modify

---

## 🎯 Next Steps

1. **Run database_fixes.sql** in Supabase SQL Editor
2. **Test ChatKit integration** in your React Native app
3. **Run test prediction generation**:
   ```bash
   python run_agent_builder_predictions.py --picks 5
   ```
4. **Verify predictions** appear correctly in app
5. **Gradually migrate** from Python scripts to Agent Builder

---

## 📞 Testing Checklist

- [ ] Database triggers working (player_id auto-populated)
- [ ] ChatKit loads in React Native WebView
- [ ] ChatKit theme changes for Elite users  
- [ ] Agent Builder generates predictions with reasoning
- [ ] Predictions stored in correct ai_predictions format
- [ ] Frontend displays new predictions properly
- [ ] No conflicts between team/prop picks
- [ ] Headshots populate automatically

**You're ready to deploy! 🚀**

