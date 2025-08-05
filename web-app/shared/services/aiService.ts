// Shared AI service (adapted from mobile app)
import { supabase } from '../../lib/supabase'
import apiClient from './apiClient'

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
  status?: 'pending' | 'won' | 'lost'
  created_at?: string
  match_teams?: string
  bet_type?: string
  actual_result?: string
  profit_loss?: number
  league?: string
}

export interface AIInsight {
  id: string
  title: string
  content: string
  sport: string
  created_at: string
  confidence?: number
}

export class AIService {
  
  // Get today's AI predictions
  async getTodaysPredictions(): Promise<AIPrediction[]> {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('ai_predictions')
        .select('*')
        .gte('created_at', today)
        .order('confidence', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Error fetching predictions:', error)
        return []
      }

      // Transform data to match mobile app format
      return data.map(prediction => ({
        id: prediction.id,
        match: prediction.match_teams || prediction.match || '',
        pick: prediction.pick || '',
        odds: prediction.odds || '',
        confidence: prediction.confidence || 0,
        sport: prediction.league || prediction.sport || 'MLB',
        eventTime: prediction.event_time || prediction.created_at,
        reasoning: prediction.reasoning || '',
        value_percentage: prediction.value_percentage,
        roi_estimate: prediction.roi_estimate,
        kelly_stake: prediction.kelly_stake,
        expected_value: prediction.expected_value,
        risk_level: prediction.risk_level,
        implied_probability: prediction.implied_probability,
        fair_odds: prediction.fair_odds,
        key_factors: prediction.key_factors,
        status: prediction.status || 'pending',
        created_at: prediction.created_at,
        match_teams: prediction.match_teams,
        bet_type: prediction.bet_type,
        actual_result: prediction.actual_result,
        profit_loss: prediction.profit_loss,
        league: prediction.league
      }))
    } catch (error) {
      console.error('Error in getTodaysPredictions:', error)
      return []
    }
  }

  // Get predictions by sport
  async getPredictionsBySport(sport: string): Promise<AIPrediction[]> {
    try {
      const { data, error } = await supabase
        .from('ai_predictions')
        .select('*')
        .eq('league', sport.toUpperCase())
        .order('confidence', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching predictions by sport:', error)
        return []
      }

      return data.map(prediction => ({
        id: prediction.id,
        match: prediction.match_teams || prediction.match || '',
        pick: prediction.pick || '',
        odds: prediction.odds || '',
        confidence: prediction.confidence || 0,
        sport: prediction.league || sport,
        eventTime: prediction.event_time || prediction.created_at,
        reasoning: prediction.reasoning || '',
        value_percentage: prediction.value_percentage,
        roi_estimate: prediction.roi_estimate,
        status: prediction.status || 'pending',
        created_at: prediction.created_at
      }))
    } catch (error) {
      console.error('Error in getPredictionsBySport:', error)
      return []
    }
  }

  // Generate new predictions (calls backend AI orchestrator)
  async generatePredictions(sport: string = 'MLB'): Promise<AIPrediction[]> {
    try {
      const response = await apiClient.post('/ai/generate-predictions', {
        sport: sport.toUpperCase(),
        count: 10
      })
      
      return response.data.predictions || []
    } catch (error) {
      console.error('Error generating predictions:', error)
      throw error
    }
  }

  // Get AI insights (Professor Lock insights)
  async getDailyInsights(sport?: string): Promise<AIInsight[]> {
    try {
      const today = new Date().toISOString().split('T')[0]
      let query = supabase
        .from('ai_insights')
        .select('*')
        .gte('created_at', today)
        .order('created_at', { ascending: false })

      if (sport) {
        query = query.eq('sport', sport.toUpperCase())
      }

      const { data, error } = await query.limit(5)

      if (error) {
        console.error('Error fetching insights:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getDailyInsights:', error)
      return []
    }
  }
}

export const aiService = new AIService()