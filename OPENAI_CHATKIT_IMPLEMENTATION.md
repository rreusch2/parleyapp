# OpenAI ChatKit Implementation Guide for ParleyApp

## 🚀 Overview

I've successfully implemented OpenAI ChatKit with Agent Builder in your Professor Lock page. This replaces the previous custom chat implementation with OpenAI's powerful ChatKit framework.

## 📋 What's Been Implemented

### 1. **Core ChatKit Integration**
- ✅ Full ChatKit React component with custom dark theme
- ✅ Session management API endpoint
- ✅ Custom sports betting widgets
- ✅ Dynamic chat interface with your branding

### 2. **Files Created/Modified**

#### New Files:
- `/web-app/app/api/chatkit/session/route.ts` - ChatKit session creation endpoint
- `/web-app/components/professor-lock/ChatKitProfessorLock.tsx` - Main ChatKit component
- `/web-app/lib/chatkit-widgets.ts` - Custom sports betting widgets
- `/web-app/database/chatkit-sessions-schema.sql` - Database schema

#### Modified Files:
- `/web-app/app/professor-lock/page.tsx` - Updated to use ChatKit
- `/web-app/package.json` - Added ChatKit dependency

## 🎨 Custom Theme Applied

Your ChatKit uses your exact specifications:
```javascript
theme: {
  colorScheme: 'dark',
  radius: 'pill',
  density: 'normal',
  color: {
    accent: {
      primary: '#168aa2',  // Your brand color
      level: 1
    },
    surface: {
      background: '#242424',
      foreground: '#595654'
    }
  }
}
```

## 🏗️ Setup Instructions

### Step 1: Install Dependencies
```bash
cd /home/reid/Desktop/parleyapp/web-app
npm install @openai/chatkit-react
```

### Step 2: Environment Variables
Add these to your `.env.local`:
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_WORKFLOW_ID=your_workflow_id_from_agent_builder

# Supabase Service Role (for secure session creation)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Step 3: Create Database Table
Run the migration in Supabase:
```sql
-- Run the contents of /web-app/database/chatkit-sessions-schema.sql
```

### Step 4: Get Your Workflow ID
1. Go to OpenAI Agent Builder
2. Create or select your sports betting agent workflow
3. Copy the workflow ID (starts with `wf_`)
4. Add it to your environment variables

## 🤖 Agent Builder Configuration

Your Agent Builder workflow should have these tools configured:
- ✅ **Supabase MCP** - For database queries
- ✅ **Web Search** - For injury reports, news
- ✅ **Code Interpreter** - For running StatMuse queries

### Agent Instructions Template:
```
You are Professor Lock, an expert AI sports betting assistant for ParleyApp. 
You help users make intelligent betting decisions with data-driven analysis.

## Your Capabilities:
1. Analyze games from the sports_events table
2. Query player props and odds from player_props_odds table
3. Use StatMuse for player/team statistics
4. Search web for injuries, weather, news
5. Build smart parlays with risk assessment

## User Context:
- Subscription Tier: {metadata.tier}
- Preferred Sports: {metadata.sports}
- Risk Tolerance: {metadata.riskTolerance}
- Betting Style: {metadata.bettingStyle}

## Response Style:
- Use gambling lingo naturally (sharp, fade, juice, handle, etc.)
- Be confident but never guarantee wins
- Provide reasoning with data backing
- Keep responses concise and actionable
- End with specific recommendations
```

## 🎮 Custom Tools Available

The ChatKit interface includes these custom tools:
1. **Analyze Today's Games** - Comprehensive game analysis
2. **Build Smart Parlay** - Intelligent parlay construction
3. **Find Player Props** - Value-based prop hunting
4. **Check Injuries** - Real-time injury reports

## 📦 Custom Widgets

I've created sports-specific widgets that your agent can return:

### Player Prop Widget
```javascript
{
  playerName: "Shohei Ohtani",
  team: "Los Angeles Dodgers",
  propType: "Hits O/U",
  line: "1.5",
  odds: "+110",
  confidence: 72,
  reasoning: "Facing a lefty with .340 avg last 10 games..."
}
```

### Parlay Builder Widget
```javascript
{
  legs: [
    { match: "Dodgers @ Giants", pick: "Dodgers ML", odds: "-150" },
    { match: "Yankees @ Red Sox", pick: "Over 9.5", odds: "-110" }
  ],
  totalOdds: "+215",
  stake: 50,
  potentialPayout: 157.50
}
```

## 🚦 Testing the Implementation

1. **Start your dev server:**
```bash
npm run dev
```

2. **Navigate to Professor Lock:**
```
http://localhost:3000/professor-lock
```

3. **Test ChatKit is loading:**
- You should see the chat interface with dark theme
- Greeting should show "Let's cash in some plays! 💰"
- Starter prompts should be visible

## ⚙️ Customization Options

### To modify the greeting:
Edit line 166 in `ChatKitProfessorLock.tsx`:
```javascript
greeting: 'Let\'s cash in some plays! 💰',
```

### To add more starter prompts:
Add to the `prompts` array starting at line 167

### To change tool options:
Modify the `tools` array starting at line 130

## 🔧 Troubleshooting

### "Failed to load ChatKit"
- Check that ChatKit script is loading from CDN
- Verify no content blockers are active

### "Failed to create session"
- Verify OPENAI_API_KEY is set
- Check OPENAI_WORKFLOW_ID is correct
- Ensure Supabase auth is working

### "No access token available"
- User must be logged in
- Check Supabase authentication

## 📊 Widget Actions

When users interact with widgets, actions are sent to:
`/api/chatkit/widget-action`

You can handle these to:
- Add picks to betslip
- Track user interactions
- Execute parlays
- Store preferences

## 🎯 Next Steps

1. **Configure Agent Builder:**
   - Create your workflow
   - Add MCP tools
   - Set up agent instructions

2. **Deploy to production:**
   - Add production env variables
   - Deploy to your hosting provider
   - Test with real users

3. **Enhance widgets:**
   - Add more sports-specific widgets
   - Create live score widgets
   - Build injury report cards

## 💡 Best Practices

1. **Session Management:**
   - Sessions expire after 24 hours
   - Refresh tokens when needed
   - Clean up old sessions

2. **Rate Limiting:**
   - Implement rate limiting on session creation
   - Cache frequently requested data
   - Use Supabase RLS for security

3. **User Experience:**
   - Show loading states
   - Handle errors gracefully
   - Provide fallback content

## 🔒 Security Considerations

- ✅ Using Supabase service role only server-side
- ✅ RLS policies protect session data
- ✅ Client secrets never exposed to frontend
- ✅ User authentication required

## 📈 Analytics Integration

Track these events:
- Session starts/ends
- Tool usage
- Widget interactions
- Pick selections
- Parlay builds

## 🆘 Support

For OpenAI ChatKit issues:
- [ChatKit Documentation](https://platform.openai.com/docs/guides/chatkit)
- [Agent Builder Guide](https://platform.openai.com/docs/guides/agent-builder)

For implementation questions:
- Check the error logs in browser console
- Review the session API response
- Verify environment variables

---

## Summary

Your Professor Lock page now has:
- ✅ Full OpenAI ChatKit integration
- ✅ Custom dark theme matching your brand
- ✅ Sports betting specific tools and widgets
- ✅ Session management with Supabase
- ✅ Ready for Agent Builder workflow connection

Just add your OPENAI_API_KEY and WORKFLOW_ID to get started!
