# Advanced Widget Examples for Agent Builder

## Search Progress Widget
```json
{
  "type": "Card",
  "size": "md",
  "background": {"dark": "#1a1a1a", "light": "#ffffff"},
  "padding": 16,
  "children": [
    {
      "type": "Row", 
      "gap": 12,
      "align": "center",
      "children": [
        {
          "type": "Text",
          "value": "🔍",
          "size": "xl"
        },
        {
          "type": "Col",
          "flex": 1,
          "gap": 4, 
          "children": [
            {
              "type": "Text",
              "value": "Analyzing injury reports...",
              "weight": "semibold",
              "color": {"dark": "#3B82F6", "light": "#3B82F6"}
            },
            {
              "type": "Text",
              "value": "Checking Lakers vs Warriors data",
              "size": "sm", 
              "color": {"dark": "#9CA3AF", "light": "#6B7280"}
            }
          ]
        }
      ]
    },
    {
      "type": "Row",
      "gap": 8,
      "margin": {"top": 8},
      "children": [
        {
          "type": "Badge",
          "label": "ESPN",
          "size": "sm",
          "variant": "soft",
          "color": "info"
        },
        {
          "type": "Badge", 
          "label": "FantasyPros",
          "size": "sm",
          "variant": "soft",
          "color": "info"
        }
      ]
    }
  ]
}
```

## Betting Pick Widget
```json
{
  "type": "Card",
  "size": "md",
  "background": {"dark": "#1E293B", "light": "#F8FAFC"},
  "padding": 16,
  "children": [
    {
      "type": "Row",
      "justify": "between", 
      "align": "center",
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
          "color": {"dark": "#00E5FF", "light": "#0284C7"}
        }
      ]
    },
    {
      "type": "Divider",
      "spacing": 12
    },
    {
      "type": "Text",
      "value": "Pick: Lakers ML",
      "weight": "bold",
      "margin": {"bottom": 8}
    },
    {
      "type": "Row",
      "gap": 8,
      "children": [
        {
          "type": "Badge",
          "label": "82% Confidence",
          "color": "success"
        },
        {
          "type": "Badge", 
          "label": "Medium Risk",
          "color": "warning"
        },
        {
          "type": "Badge",
          "label": "NBA",
          "color": "info",
          "variant": "outline"
        }
      ]
    },
    {
      "type": "Text",
      "value": "Lakers have won 7 of last 10 matchups. LeBron averaging 28 PPG vs Warriors defense.",
      "size": "sm",
      "color": {"dark": "#CBD5E1", "light": "#475569"},
      "margin": {"top": 8, "bottom": 12}
    },
    {
      "type": "Button",
      "label": "Add to Parlay",
      "style": "primary",
      "block": true,
      "onClickAction": {
        "type": "toggle_parlay_pick",
        "handler": "client", 
        "payload": {"pickId": "pick_lakers_ml_123"}
      }
    }
  ]
}
```

## Multiple Picks Widget (ListView)
```json
{
  "type": "ListView",
  "limit": 10,
  "status": {
    "text": "Today's Best Picks",
    "icon": "star-filled"
  },
  "children": [
    {
      "type": "ListViewItem",
      "gap": 12,
      "children": [
        {
          "type": "Card",
          "size": "sm", 
          "padding": 12,
          "background": {"dark": "#1E293B", "light": "#F9FAFB"},
          "children": [
            {
              "type": "Row",
              "justify": "between",
              "children": [
                {
                  "type": "Col",
                  "gap": 4,
                  "children": [
                    {
                      "type": "Text",
                      "value": "Lakers ML", 
                      "weight": "semibold"
                    },
                    {
                      "type": "Text",
                      "value": "vs Warriors",
                      "size": "sm",
                      "color": {"dark": "#9CA3AF", "light": "#6B7280"}
                    }
                  ]
                },
                {
                  "type": "Col",
                  "align": "end",
                  "gap": 4,
                  "children": [
                    {
                      "type": "Text",
                      "value": "+150",
                      "weight": "bold",
                      "color": {"dark": "#00E5FF", "light": "#0284C7"}
                    },
                    {
                      "type": "Badge",
                      "label": "85%",
                      "color": "success",
                      "size": "sm"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Player Props Widget
```json
{
  "type": "Card",
  "size": "lg",
  "background": {"dark": "#0f172a", "light": "#ffffff"},
  "padding": 16,
  "children": [
    {
      "type": "Row",
      "gap": 16,
      "margin": {"bottom": 16},
      "children": [
        {
          "type": "Image",
          "src": "https://example.com/lebron.jpg",
          "alt": "LeBron James",
          "size": 60,
          "radius": "full"
        },
        {
          "type": "Col",
          "flex": 1,
          "gap": 4,
          "children": [
            {
              "type": "Title", 
              "value": "LeBron James",
              "size": "lg",
              "weight": "bold"
            },
            {
              "type": "Row",
              "gap": 8,
              "children": [
                {
                  "type": "Badge",
                  "label": "Lakers",
                  "color": "info",
                  "variant": "soft"
                },
                {
                  "type": "Badge",
                  "label": "SF/PF", 
                  "color": "secondary",
                  "variant": "outline"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "Box",
      "padding": 12,
      "background": {"dark": "#1E293B", "light": "#F9FAFB"},
      "radius": "md",
      "children": [
        {
          "type": "Row",
          "justify": "between",
          "align": "center",
          "children": [
            {
              "type": "Col",
              "gap": 2,
              "children": [
                {
                  "type": "Text",
                  "value": "Points",
                  "weight": "semibold"
                },
                {
                  "type": "Text",
                  "value": "Line: 25.5",
                  "size": "sm",
                  "color": {"dark": "#94A3B8", "light": "#6B7280"}
                }
              ]
            },
            {
              "type": "Row", 
              "gap": 8,
              "children": [
                {
                  "type": "Button",
                  "label": "O -110",
                  "size": "sm",
                  "variant": "solid",
                  "color": "success",
                  "onClickAction": {
                    "type": "select_prop",
                    "handler": "client",
                    "payload": {
                      "player": "LeBron James",
                      "market": "Points",
                      "selection": "over",
                      "odds": "-110"
                    }
                  }
                },
                {
                  "type": "Button",
                  "label": "U -110", 
                  "size": "sm",
                  "variant": "outline",
                  "color": "secondary",
                  "onClickAction": {
                    "type": "select_prop",
                    "handler": "client",
                    "payload": {
                      "player": "LeBron James",
                      "market": "Points", 
                      "selection": "under",
                      "odds": "-110"
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Usage Instructions for Agent Builder:

1. **Copy any of these widget JSONs**
2. **Paste directly into your agent's response** 
3. **The agent should return the JSON as-is, not wrapped in code blocks**
4. **Test each widget type individually first**
5. **Customize the data (teams, odds, etc.) for real games**

## Widget Action Types You Can Use:

- `toggle_parlay_pick` - Add/remove from parlay
- `place_parlay` - Submit the parlay
- `clear_parlay` - Clear all picks
- `select_prop` - Choose player prop bet
- `view_details` - Show more information
- `refresh_odds` - Update odds data
- `test_action` - For testing buttons

Your frontend is already configured to handle all these actions!
