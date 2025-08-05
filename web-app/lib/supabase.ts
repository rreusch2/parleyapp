import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables', { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey });
  // Don't throw error, just log it - we don't want to crash the app
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use localStorage for web instead of AsyncStorage
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

console.log("Main supabase client initialized with URL:", supabaseUrl);

// Types matching your existing React Native app
export interface UserProfile {
  id: string
  username?: string
  email?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  risk_tolerance: 'low' | 'medium' | 'high'
  favorite_teams: string[]
  favorite_players: string[]
  preferred_bet_types: string[]
  preferred_sports: string[]
  preferred_bookmakers: string[]
  subscription_tier: 'free' | 'pro' | 'elite'
  is_active: boolean
  welcome_bonus_claimed: boolean
  welcome_bonus_expires_at?: string
  push_token?: string
  admin_role: boolean
  notification_settings: any
  subscription_status: 'active' | 'inactive' | 'cancelled' | 'expired' | 'past_due'
  subscription_expires_at?: string
  apple_receipt_data?: string
  google_purchase_token?: string
  sport_preferences: any
  subscription_plan_type?: 'weekly' | 'monthly' | 'yearly' | 'lifetime'
  revenuecat_customer_id?: string
  subscription_product_id?: string
  subscription_started_at?: string
}

export interface AIPrediction {
  id: string
  user_id: string
  match_teams: string
  pick: string
  odds: string
  confidence?: number
  sport: string
  event_time: string
  reasoning?: string
  value_percentage?: number
  roi_estimate?: number
  status: 'pending' | 'won' | 'lost' | 'cancelled'
  game_id?: string
  metadata?: any
  created_at: string
  updated_at: string
  bet_type: string
  player_id?: string
  prop_market_type?: string
  line_value?: number
  prediction_value?: number
  is_parlay_leg: boolean
  parlay_id?: string
  kelly_stake?: number
  expected_value?: number
  risk_level?: string
  implied_probability?: number
  fair_odds?: string
  key_factors?: any
}

export interface UserStats {
  todayPicks: number
  winRate: string
  roi: string
  streak: number
  totalBets: number
  profitLoss: string
}
