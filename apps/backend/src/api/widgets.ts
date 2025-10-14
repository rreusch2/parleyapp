/**
 * ChatKit Widget Generators for Professor Lock
 * Uses exact OpenAI ChatKit Python SDK widget structure
 */

interface BettingPick {
  id: string;
  match_teams: string;
  pick: string;
  odds: string;
  confidence: number;
  sport: string;
  reasoning: string;
  value_percentage?: number;
  roi_estimate?: number;
  league_logo_url?: string;
  risk_level?: 'Low' | 'Medium' | 'High';
}

/**
 * Generate a betting pick card widget using exact ChatKit structure
 */
export function createPickCardWidget(pick: BettingPick) {
  return {
    type: "Card",
    size: "md",
    padding: 16,
    background: { dark: "#1E293B", light: "#F8FAFC" },
    radius: "lg",
    children: [
      // Header Row: Team logos and odds
      {
        type: "Row",
        align: "center",
        justify: "between",
        gap: 12,
        children: [
          {
            type: "Row",
            align: "center",
            gap: 12,
            children: [
              ...(pick.league_logo_url ? [{
                type: "Image",
                src: pick.league_logo_url,
                alt: pick.sport,
                size: 40,
                radius: "sm"
              }] : []),
              {
                type: "Col",
                gap: 4,
                children: [
                  {
                    type: "Text",
                    value: pick.match_teams,
                    size: "sm",
                    weight: "semibold",
                    color: { dark: "#F1F5F9", light: "#0F172A" }
                  },
                  {
                    type: "Badge",
                    label: pick.sport.toUpperCase(),
                    color: "info",
                    size: "sm",
                    pill: true
                  }
                ]
              }
            ]
          },
          {
            type: "Text",
            value: pick.odds,
            size: "xl",
            weight: "bold",
            color: { dark: "#00E5FF", light: "#0284C7" }
          }
        ]
      },
      
      // Divider
      {
        type: "Divider",
        spacing: 12,
        color: { dark: "#334155", light: "#E2E8F0" }
      },
      
      // Pick details
      {
        type: "Col",
        gap: 8,
        children: [
          {
            type: "Row",
            align: "center",
            gap: 8,
            children: [
              {
                type: "Caption",
                value: "Pick:",
                size: "sm",
                weight: "semibold",
                color: { dark: "#94A3B8", light: "#64748B" }
              },
              {
                type: "Text",
                value: pick.pick,
                size: "md",
                weight: "bold",
                color: { dark: "#F1F5F9", light: "#0F172A" }
              }
            ]
          },
          
          // Badges Row
          {
            type: "Row",
            gap: 8,
            wrap: "wrap",
            children: [
              {
                type: "Badge",
                label: `${pick.confidence}% Confidence`,
                color: pick.confidence >= 75 ? "success" : pick.confidence >= 60 ? "info" : "warning",
                variant: "solid",
                size: "md"
              },
              ...(pick.risk_level ? [{
                type: "Badge",
                label: `${pick.risk_level} Risk`,
                color: pick.risk_level === 'Low' ? "success" : pick.risk_level === 'Medium' ? "warning" : "danger",
                variant: "outline",
                size: "md"
              }] : []),
              ...(pick.value_percentage ? [{
                type: "Badge",
                label: `${pick.value_percentage.toFixed(1)}% Value`,
                color: "discovery",
                variant: "soft",
                size: "md"
              }] : [])
            ]
          }
        ]
      },
      
      // Reasoning Box
      {
        type: "Box",
        padding: { x: 12, y: 12 },
        margin: { top: 12 },
        background: { dark: "rgba(0, 229, 255, 0.05)", light: "rgba(2, 132, 199, 0.05)" },
        radius: "md",
        border: {
          size: 1,
          color: { dark: "rgba(0, 229, 255, 0.2)", light: "rgba(2, 132, 199, 0.2)" }
        },
        children: [
          {
            type: "Row",
            gap: 6,
            align: "start",
            children: [
              {
                type: "Icon",
                name: "lightbulb",
                color: { dark: "#00E5FF", light: "#0284C7" },
                size: "sm"
              },
              {
                type: "Text",
                value: "Analysis",
                size: "sm",
                weight: "semibold",
                color: { dark: "#00E5FF", light: "#0284C7" }
              }
            ]
          },
          {
            type: "Text",
            value: pick.reasoning,
            size: "sm",
            color: { dark: "#CBD5E1", light: "#475569" },
            maxLines: 4
          }
        ]
      },
      
      // Action Buttons Row
      {
        type: "Row",
        gap: 8,
        margin: { top: 16 },
        children: [
          {
            type: "Button",
            label: "Add to Parlay",
            style: "primary",
            color: "primary",
            variant: "solid",
            size: "md",
            block: true,
            iconStart: "plus",
            onClickAction: {
              type: "add_to_parlay",
              payload: { pickId: pick.id },
              handler: "client"
            }
          },
          {
            type: "Button",
            label: "Details",
            style: "secondary",
            color: "secondary",
            variant: "outline",
            size: "md",
            iconStart: "info",
            onClickAction: {
              type: "view_pick_details",
              payload: { pickId: pick.id },
              handler: "client"
            }
          }
        ]
      }
    ]
  };
}

/**
 * Generate a parlay builder widget
 */
export function createParlayBuilderWidget(picks: BettingPick[], totalOdds: string, potentialPayout: number) {
  return {
    type: "Card",
    size: "lg",
    padding: 20,
    background: { dark: "#1E293B", light: "#F8FAFC" },
    radius: "xl",
    children: [
      // Header
      {
        type: "Row",
        align: "center",
        justify: "between",
        children: [
          {
            type: "Row",
            align: "center",
            gap: 8,
            children: [
              {
                type: "Icon",
                name: "sparkle",
                color: { dark: "#FFD700", light: "#F59E0B" },
                size: "lg"
              },
              {
                type: "Title",
                value: "Your Parlay",
                size: "lg",
                weight: "bold",
                color: { dark: "#F1F5F9", light: "#0F172A" }
              }
            ]
          },
          {
            type: "Badge",
            label: `${picks.length}-Leg`,
            color: "discovery",
            variant: "solid",
            size: "lg"
          }
        ]
      },
      
      {
        type: "Divider",
        spacing: 16
      },
      
      // Picks ListView
      {
        type: "ListView",
        children: picks.map((pick, index) => ({
          type: "ListViewItem",
          gap: 12,
          children: [
            {
              type: "Row",
              align: "center",
              justify: "between",
              children: [
                {
                  type: "Col",
                  gap: 4,
                  flex: 1,
                  children: [
                    {
                      type: "Text",
                      value: `${index + 1}. ${pick.pick}`,
                      size: "md",
                      weight: "semibold",
                      color: { dark: "#F1F5F9", light: "#0F172A" }
                    },
                    {
                      type: "Caption",
                      value: pick.match_teams,
                      size: "sm",
                      color: { dark: "#94A3B8", light: "#64748B" }
                    }
                  ]
                },
                {
                  type: "Text",
                  value: pick.odds,
                  size: "md",
                  weight: "bold",
                  color: { dark: "#00E5FF", light: "#0284C7" }
                }
              ]
            }
          ]
        }))
      },
      
      {
        type: "Divider",
        spacing: 16
      },
      
      // Total odds and payout box
      {
        type: "Box",
        padding: 16,
        background: { dark: "rgba(0, 229, 255, 0.1)", light: "rgba(2, 132, 199, 0.1)" },
        radius: "lg",
        border: {
          size: 1,
          color: { dark: "rgba(0, 229, 255, 0.3)", light: "rgba(2, 132, 199, 0.3)" }
        },
        children: [
          {
            type: "Row",
            justify: "between",
            align: "center",
            children: [
              {
                type: "Col",
                gap: 4,
                children: [
                  {
                    type: "Caption",
                    value: "Total Odds",
                    size: "sm",
                    weight: "medium",
                    color: { dark: "#94A3B8", light: "#64748B" }
                  },
                  {
                    type: "Title",
                    value: totalOdds,
                    size: "2xl",
                    weight: "bold",
                    color: { dark: "#00E5FF", light: "#0284C7" }
                  }
                ]
              },
              {
                type: "Col",
                gap: 4,
                align: "end",
                children: [
                  {
                    type: "Caption",
                    value: "$10 Bet Wins",
                    size: "sm",
                    weight: "medium",
                    color: { dark: "#94A3B8", light: "#64748B" }
                  },
                  {
                    type: "Title",
                    value: `$${potentialPayout.toFixed(2)}`,
                    size: "2xl",
                    weight: "bold",
                    color: { dark: "#10B981", light: "#059669" }
                  }
                ]
              }
            ]
          }
        ]
      },
      
      // Place Parlay Button
      {
        type: "Button",
        label: "Place This Parlay",
        style: "primary",
        color: "success",
        variant: "solid",
        size: "lg",
        block: true,
        iconStart: "check-circle",
        onClickAction: {
          type: "place_parlay",
          payload: { 
            picks: picks.map(p => p.id),
            totalOdds,
            potentialPayout
          },
          handler: "client"
        }
      }
    ]
  };
}

/**
 * Generate stats comparison widget
 */
export function createStatsComparisonWidget(team1: any, team2: any) {
  return {
    type: "Card",
    size: "md",
    padding: 16,
    background: { dark: "#1E293B", light: "#F8FAFC" },
    radius: "lg",
    children: [
      {
        type: "Row",
        align: "center",
        gap: 8,
        children: [
          {
            type: "Icon",
            name: "chart",
            color: { dark: "#00E5FF", light: "#0284C7" },
            size: "md"
          },
          {
            type: "Title",
            value: "Head-to-Head Stats",
            size: "md",
            weight: "bold",
            color: { dark: "#F1F5F9", light: "#0F172A" }
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
            type: "Col",
            align: "center",
            gap: 8,
            flex: 1,
            children: [
              {
                type: "Title",
                value: team1.name,
                size: "sm",
                textAlign: "center",
                color: { dark: "#F1F5F9", light: "#0F172A" }
              },
              {
                type: "Text",
                value: `${team1.wins}-${team1.losses}`,
                size: "lg",
                weight: "bold",
                color: { dark: "#10B981", light: "#059669" }
              },
              {
                type: "Caption",
                value: `${team1.pointsPerGame} PPG`,
                size: "sm",
                color: { dark: "#94A3B8", light: "#64748B" }
              }
            ]
          },
          {
            type: "Text",
            value: "VS",
            size: "lg",
            weight: "bold",
            color: { dark: "#94A3B8", light: "#64748B" }
          },
          {
            type: "Col",
            align: "center",
            gap: 8,
            flex: 1,
            children: [
              {
                type: "Title",
                value: team2.name,
                size: "sm",
                textAlign: "center",
                color: { dark: "#F1F5F9", light: "#0F172A" }
              },
              {
                type: "Text",
                value: `${team2.wins}-${team2.losses}`,
                size: "lg",
                weight: "bold",
                color: { dark: "#10B981", light: "#059669" }
              },
              {
                type: "Caption",
                value: `${team2.pointsPerGame} PPG`,
                size: "sm",
                color: { dark: "#94A3B8", light: "#64748B" }
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * Elite Lock of the Day widget (for Elite users only)
 */
export function createEliteLockWidget(pick: BettingPick) {
  return {
    type: "Card",
    size: "lg",
    padding: 20,
    background: { 
      dark: "linear-gradient(135deg, #1E293B 0%, #312E81 100%)", 
      light: "#FEF3C7" 
    },
    radius: "xl",
    children: [
      // Elite Header
      {
        type: "Row",
        align: "center",
        justify: "center",
        gap: 8,
        margin: { bottom: 16 },
        children: [
          {
            type: "Icon",
            name: "wreath",
            color: { dark: "#FFD700", light: "#F59E0B" },
            size: "xl"
          },
          {
            type: "Title",
            value: "🔒 Elite Lock of the Day",
            size: "xl",
            weight: "bold",
            color: { dark: "#FFD700", light: "#92400E" }
          }
        ]
      },
      
      {
        type: "Divider",
        spacing: 12,
        color: { dark: "#FFD700", light: "#F59E0B" },
        size: 2
      },
      
      // Pick content
      {
        type: "Col",
        gap: 12,
        children: [
          {
            type: "Row",
            justify: "between",
            align: "center",
            children: [
              {
                type: "Text",
                value: pick.match_teams,
                size: "lg",
                weight: "bold",
                color: { dark: "#F1F5F9", light: "#0F172A" }
              },
              {
                type: "Text",
                value: pick.odds,
                size: "2xl",
                weight: "bold",
                color: { dark: "#FFD700", light: "#F59E0B" }
              }
            ]
          },
          {
            type: "Text",
            value: pick.pick,
            size: "xl",
            weight: "bold",
            color: { dark: "#00E5FF", light: "#0284C7" }
          },
          {
            type: "Row",
            gap: 8,
            children: [
              {
                type: "Badge",
                label: `${pick.confidence}% Confidence`,
                color: "success",
                variant: "solid",
                size: "lg"
              },
              {
                type: "Badge",
                label: "Elite Pick",
                color: "warning",
                variant: "solid",
                size: "lg"
              }
            ]
          }
        ]
      },
      
      // Analysis
      {
        type: "Box",
        padding: 16,
        margin: { top: 12 },
        background: { dark: "rgba(255, 215, 0, 0.1)", light: "rgba(245, 158, 11, 0.1)" },
        radius: "md",
        children: [
          {
            type: "Text",
            value: "🎯 Elite Analysis",
            size: "sm",
            weight: "bold",
            color: { dark: "#FFD700", light: "#92400E" }
          },
          {
            type: "Text",
            value: pick.reasoning,
            size: "sm",
            color: { dark: "#E2E8F0", light: "#57534E" }
          }
        ]
      },
      
      // Action button
      {
        type: "Button",
        label: "Lock It In",
        style: "primary",
        color: "warning",
        variant: "solid",
        size: "xl",
        block: true,
        iconStart: "check-circle-filled",
        onClickAction: {
          type: "add_elite_lock",
          payload: { pickId: pick.id },
          handler: "client"
        }
      }
    ]
  };
}

/**
 * Multiple picks display widget (ListView)
 */
export function createMultiplePicksWidget(picks: BettingPick[], title: string = "Today's Top Picks") {
  return {
    type: "Card",
    size: "lg",
    padding: 16,
    background: { dark: "#1E293B", light: "#F8FAFC" },
    radius: "lg",
    children: [
      {
        type: "Title",
        value: title,
        size: "lg",
        weight: "bold",
        color: { dark: "#F1F5F9", light: "#0F172A" }
      },
      {
        type: "Divider",
        spacing: 12
      },
      {
        type: "ListView",
        limit: 10,
        children: picks.map((pick, index) => ({
          type: "ListViewItem",
          gap: 8,
          onClickAction: {
            type: "view_pick_details",
            payload: { pickId: pick.id }
          },
          children: [
            {
              type: "Row",
              justify: "between",
              align: "center",
              children: [
                {
                  type: "Col",
                  gap: 4,
                  flex: 1,
                  children: [
                    {
                      type: "Text",
                      value: `${index + 1}. ${pick.pick}`,
                      size: "md",
                      weight: "semibold",
                      color: { dark: "#F1F5F9", light: "#0F172A" }
                    },
                    {
                      type: "Caption",
                      value: pick.match_teams,
                      size: "sm",
                      color: { dark: "#94A3B8", light: "#64748B" }
                    }
                  ]
                },
                {
                  type: "Col",
                  align: "end",
                  gap: 4,
                  children: [
                    {
                      type: "Text",
                      value: pick.odds,
                      size: "md",
                      weight: "bold",
                      color: { dark: "#00E5FF", light: "#0284C7" }
                    },
                    {
                      type: "Badge",
                      label: `${pick.confidence}%`,
                      color: pick.confidence >= 75 ? "success" : pick.confidence >= 60 ? "info" : "warning",
                      size: "sm",
                      pill: true
                    }
                  ]
                }
              ]
            }
          ]
        }))
      }
    ]
  };
}

export { 
  createPickCardWidget, 
  createParlayBuilderWidget, 
  createStatsComparisonWidget,
  createEliteLockWidget,
  createMultiplePicksWidget
};
