# 🎨 Agent Builder Widget Instructions

## How to Use Widgets in Your Agent Builder Workflow

Add these instructions to your **Master Sports Prediction Agent** in Agent Builder to make it return beautiful, interactive betting cards:

---

## 📝 Updated Agent Instructions (Add to Agent Builder)

```
🎨 CHATKIT WIDGET USAGE:

When providing betting picks in a chat conversation, return them as interactive ChatKit widgets for better UX.

EXAMPLE: Instead of plain text, return a Card widget like this:

{
  "type": "Card",
  "size": "md",
  "padding": 16,
  "background": { "dark": "#1E293B", "light": "#F8FAFC" },
  "radius": "lg",
  "children": [
    {
      "type": "Row",
      "align": "center",
      "justify": "between",
      "children": [
        {
          "type": "Text",
          "value": "Lakers vs Warriors",
          "size": "md",
          "weight": "semibold"
        },
        {
          "type": "Text",
          "value": "+150",
          "size": "lg",
          "weight": "bold",
          "color": { "dark": "#00E5FF", "light": "#0284C7" }
        }
      ]
    },
    {
      "type": "Text",
      "value": "Pick: Lakers ML",
      "size": "md",
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
        },
        {
          "type": "Badge",
          "label": "Medium Risk",
          "color": "warning"
        }
      ]
    },
    {
      "type": "Text",
      "value": "Lakers have won 7 of last 10 matchups. LeBron averaging 28 PPG.",
      "size": "sm",
      "color": { "dark": "#CBD5E1", "light": "#475569" }
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

WIDGET BEST PRACTICES:
- Use Card containers for betting picks
- Include team logos with Image nodes when available
- Use Badges for confidence, risk level, value percentage
- Add Buttons for "Add to Parlay" or "View Details" actions
- Use Row/Col for layout structure
- Keep reasoning in expandable Text with maxLines
- Use color coding: Green for high confidence, Yellow for medium, Red for low

AVAILABLE WIDGET COMPONENTS:
- Card: Container for picks
- Row/Col: Layout structure
- Text/Title/Caption: Text display
- Badge: Confidence, risk, sport indicators
- Button: Interactive actions
- Image: Team/league logos
- Divider: Visual separation
- ListView: Multiple picks display

When user asks "Build me a parlay", return a ListView with multiple pick Cards.
When user asks for analysis, combine Text + Badge + Button widgets.
```

---

## 🔧 How Widgets Work in Agent Builder

1. **Agent generates picks** using Supabase + Web Search + Code Interpreter
2. **Agent structures output as widgets** instead of plain text
3. **ChatKit renders widgets** as beautiful, interactive cards
4. **User clicks button** (e.g., "Add to Parlay")
5. **React Native handles action** via WebView message passing
6. **Pick added to parlay** in your app state

---

## 🎯 Example Workflow in Agent Builder

### Step 1: User asks "What are your best bets today?"

### Step 2: Agent reasoning
```
1. Query Supabase for today's games and odds
2. Use web search for injury reports
3. Analyze data and generate 5 best picks
4. Format as interactive Card widgets
5. Return widgets to ChatKit
```

### Step 3: Agent Output (Structured)
```json
{
  "picks": [
    {
      "widget": { ...Card widget JSON... },
      "data": { ...pick data for database... }
    }
  ]
}
```

### Step 4: ChatKit displays beautiful cards with:
- Team logos
- Confidence badges  
- Odds highlighting
- Interactive "Add to Parlay" buttons
- Expandable reasoning

---

## 💡 Widget Templates

### Betting Pick Card
```json
{
  "type": "Card",
  "children": [
    { "type": "Row", "children": [/* Header with logos */] },
    { "type": "Divider" },
    { "type": "Text", "value": "Pick details" },
    { "type": "Row", "children": [/* Badges */] },
    { "type": "Button", "label": "Add to Parlay" }
  ]
}
```

### Parlay Builder
```json
{
  "type": "Card",
  "size": "lg",
  "children": [
    { "type": "Title", "value": "🎯 Your Parlay" },
    { "type": "ListView", "children": [/* Pick items */] },
    { "type": "Box", "children": [/* Total odds + payout */] },
    { "type": "Button", "label": "Place This Parlay", "color": "success" }
  ]
}
```

### Stats Comparison
```json
{
  "type": "Card",
  "children": [
    { "type": "Title", "value": "📊 Head-to-Head" },
    { "type": "Row", "children": [
      { "type": "Col", "children": [/* Team 1 stats */] },
      { "type": "Text", "value": "VS" },
      { "type": "Col", "children": [/* Team 2 stats */] }
    ]}
  ]
}
```

---

## 🚀 Testing Widgets

1. **Test widget endpoint**:
```bash
curl http://localhost:3000/api/chatkit/widgets/example
```

2. **In Agent Builder**, tell the agent:
```
"When I ask for picks, return them as Card widgets with the structure shown in the widget example endpoint"
```

3. **Test in React Native**:
- Open Professor Lock chat
- Ask "What's your best bet today?"
- Should see beautiful card instead of plain text

---

## ✨ Elite vs Pro Widget Differences

**Elite Users Get:**
- Gold accent colors (#FFD700)
- Crown icon instead of Brain
- "Elite Lock of the Day" badge
- Enhanced stats in widgets
- Priority picks highlighted

**Pro Users Get:**
- Blue accent colors (#00E5FF)
- Brain icon with sparkles
- Standard pick cards
- All widget functionality

**Free Users:**
- Limited to 3 picks per day
- Plain text responses (no widgets)
- Upgrade prompts in chat

Your Agent Builder workflow can check `metadata.isElite` and `metadata.isPro` to customize widget output!

