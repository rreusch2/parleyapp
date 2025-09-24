# 🧠 Agentic Betting System Setup Guide

**Revolutionary AI-Powered Sports Betting Analysis**  
*Replacing mechanical scripts with truly intelligent, adaptive agents*

---

## 🚀 **What This Changes**

### **Before: Mechanical Approach** 
- `teams_enhanced.py` & `props_enhanced.py` followed rigid, predetermined research plans
- Fixed query patterns and research allocation
- AI only involved at the final step for pick generation
- Limited adaptability to new information or market changes

### **After: Agentic Approach**
- **Dynamic Research**: Agent decides what to research based on what it discovers
- **Adaptive Strategy**: Can pivot mid-analysis based on findings  
- **Intelligent Tool Use**: Uses tools strategically, not mechanically
- **True Investigation**: Follows interesting leads and market inefficiencies
- **Value-Focused**: Seeks genuine edge, not just likely outcomes

---

## 📁 **New System Architecture**

### **Core Components**

1. **Custom OpenManus Tools** (`OpenManus/app/tool/`)
   - `supabase_betting.py` - Database access for games, odds, props, predictions
   - `statmuse_betting.py` - Sports statistics and player performance data

2. **Specialized Agent** (`OpenManus/app/agent/`)
   - `betting_agent.py` - Elite AI analyst with betting-specific prompts and logic

3. **Agentic Scripts** (Root directory)
   - `agentic_team_picks.py` - Replaces `teams_enhanced.py`
   - `agentic_props_picks.py` - Replaces `props_enhanced.py`
   - `test_agentic_betting.py` - System validation and testing

---

## ⚙️ **Setup Instructions**

### **1. Prerequisites Verification**

Ensure you have:
- ✅ OpenManus working (`python OpenManus/main.py` should run)
- ✅ Supabase environment variables in `backend/.env`
- ✅ StatMuse server running on `localhost:5001`
- ✅ XAI API key for Grok (same as before)

### **2. Test the Integration**

```bash
# Run the test suite to validate everything works
python test_agentic_betting.py

# Should show:
# ✅ Supabase Database........ PASS
# ✅ StatMuse API............. PASS  
# ✅ BettingAgent............. PASS
# ✅ Simple Workflow.......... PASS
```

### **3. Environment Setup**

Your `backend/.env` should contain:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
XAI_API_KEY=your_xai_api_key
GOOGLE_SEARCH_API_KEY=your_google_api_key (optional)
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id (optional)
```

---

## 🎯 **Usage Examples**

### **Team Betting Picks**

```bash
# Basic usage - today's games, 15 team picks
python agentic_team_picks.py

# Tomorrow's games with 20 picks
python agentic_team_picks.py --tomorrow --picks 20

# Specific date with NFL focus
python agentic_team_picks.py --date 2025-09-23 --sport NFL --picks 10

# NFL-only mode (like your old --nfl-only flag)
python agentic_team_picks.py --nfl-only --picks 12

# Verbose mode to see the agent's thinking process
python agentic_team_picks.py --verbose --picks 8
```

### **Player Props Picks**

```bash
# Basic usage - today's props, 15 picks
python agentic_props_picks.py

# Tomorrow with more picks
python agentic_props_picks.py --tomorrow --picks 25

# Focus on specific sport
python agentic_props_picks.py --sport MLB --picks 20

# Specific date with debugging
python agentic_props_picks.py --date 2025-09-23 --verbose --picks 15
```

---

## 🧠 **How the Agentic Approach Works**

### **Dynamic Research Process**

1. **Initial Reconnaissance**
   - Agent examines available games and betting markets
   - Identifies potentially interesting opportunities
   - Notes suspicious line movements or value spots

2. **Intelligent Investigation**  
   - Researches promising opportunities using:
     - **StatMuse**: Historical stats, recent performance, matchup data
     - **Web Search**: Breaking news, injuries, weather, lineup changes
   - **Adapts** based on findings - follows interesting leads
   - **Pivots** strategy if new information changes assessment

3. **Value Assessment**
   - Calculates implied vs. assessed probability
   - Identifies genuine market inefficiencies
   - Focuses on sustainable profit opportunities

4. **Quality Selection**
   - Generates only picks with clear analytical edge
   - Includes detailed reasoning and supporting factors
   - Stores in exact database format with full metadata

### **Example Agent Thinking Process**

```
Agent discovers: "Detroit Lions +5.5 at -115 vs Ravens"
↓
Researches: "Detroit Lions recent performance" via StatMuse  
↓
Finds: Lions have covered 7 of last 10 games as underdogs
↓
Searches web: "Baltimore Ravens injury report"
↓
Discovers: Key Ravens defensive players questionable
↓
Conclusion: Lions +5.5 offers value - line should be closer to +3
↓
Generates pick with detailed reasoning
```

---

## 📊 **Key Advantages**

### **Intelligence**
- **Adaptive Research**: Changes strategy based on discoveries
- **Curiosity-Driven**: Follows interesting leads and anomalies
- **Context-Aware**: Considers situational factors dynamically

### **Quality**
- **Value-Focused**: Seeks market inefficiencies, not just likely outcomes
- **Professional Reasoning**: Each pick includes comprehensive analysis
- **Risk-Aware**: Realistic confidence levels and bankroll considerations

### **Efficiency** 
- **Focused Research**: Only investigates promising opportunities deeply
- **Tool Optimization**: Uses right tool for each research need
- **No Wasted Queries**: Research allocation based on actual value potential

---

## 🔧 **Troubleshooting**

### **Common Issues & Solutions**

**"Could not connect to StatMuse service"**
```bash
# Ensure StatMuse server is running
python statmuse_api_server.py
# Should show: StatMuse server running on localhost:5001
```

**"SUPABASE_URL environment variables are required"**
```bash
# Check your backend/.env file exists and has correct values
cat backend/.env | grep SUPABASE
```

**"Import errors for OpenManus"**
```bash
# Ensure OpenManus is in the correct directory
ls OpenManus/main.py  # Should exist
cd OpenManus && python main.py  # Should start OpenManus
```

**"No games/props found"**
- Check if your odds data is up to date
- Verify the target date has scheduled games
- Try `--tomorrow` if today's games already finished

### **Debugging Mode**

Run with `--verbose` to see detailed agent thinking:
```bash
python agentic_team_picks.py --verbose --picks 3
```

This shows:
- Tool execution details
- Agent's research decisions  
- StatMuse query results
- Web search findings
- Pick generation reasoning

---

## 📋 **Comparison: Old vs New**

| Aspect | teams_enhanced.py | agentic_team_picks.py |
|--------|-------------------|----------------------|
| **Research** | Fixed 15 StatMuse + 6 web queries | Dynamic based on opportunities |
| **Adaptability** | Rigid plan execution | Pivots based on findings |
| **Intelligence** | AI only for final picks | AI throughout entire process |
| **Efficiency** | Wastes queries on uninteresting games | Focuses on valuable opportunities |
| **Quality** | Mechanical reasoning | Genuine analytical investigation |
| **Market Edge** | Limited market analysis | Seeks true market inefficiencies |

---

## 🎯 **Next Steps**

1. **Run Tests**: `python test_agentic_betting.py`
2. **Small Test Run**: `python agentic_team_picks.py --picks 5`
3. **Check Results**: Look at `ai_predictions` table for stored picks
4. **Compare Quality**: Note the improved reasoning and analysis depth
5. **Scale Up**: Once satisfied, use with your target pick counts

### **Integration with Existing Workflow**

- **Replace** your current cron jobs that call `teams_enhanced.py` and `props_enhanced.py`
- **Update** to call `agentic_team_picks.py` and `agentic_props_picks.py`
- **Same database format** - no frontend changes needed
- **Better picks** - more intelligent, value-focused selections

---

## 🏆 **Expected Improvements**

### **Research Quality**
- Follows interesting leads and anomalies
- Adapts research depth based on opportunity quality
- Discovers market inefficiencies through investigation

### **Pick Quality**  
- Focuses on genuine value, not just likely outcomes
- Better risk assessment and confidence calibration
- Improved reasoning with supporting factor analysis

### **Efficiency**
- No wasted research on uninteresting games
- Optimized tool usage based on actual needs
- Faster execution for high-value opportunities

### **Adaptability**
- Can handle market changes and breaking news
- Adjusts strategy based on data quality and availability
- Responds to line movements and market signals

---

*The future of sports betting analysis is agentic. Welcome to the next level!* 🚀

