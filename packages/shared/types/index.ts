// Shared types for Parley App

export interface AIPrediction {
  id: string
  match: string
  pick: string
  odds: string
  confidence: number
  sport: string
  eventTime: string
  reasoning: string
  value?: number
  value_percentage?: number
  roi_estimate?: number
  kelly_stake?: number
  expected_value?: number
  risk_level?: string
  implied_probability?: number
  fair_odds?: string
  key_factors?: string[]
  status?: 'pending' | 'won' | 'lost' | 'cancelled'
  created_at?: string
  match_teams?: string
  bet_type?: string
  actual_result?: string
  profit_loss?: number
  league?: string
  game_id?: string
  metadata?: any
}

export interface UserProfile {
  id: string
  username?: string
  email: string
  subscription_tier: 'free' | 'pro' | 'elite'
  subscription_status: string
  is_active: boolean
  welcome_bonus_claimed: boolean
  admin_role: boolean
  notification_settings: any
}

export interface AIInsight {
  id: string
  title: string
  content: string
  sport: string
  created_at: string
  confidence?: number
}

export type SubscriptionTier = 'free' | 'pro' | 'elite'
