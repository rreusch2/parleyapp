// Shared AI service (adapted from mobile app)
import { supabase } from '../config/supabase'
import apiClient from './apiClient'
import type { AIPrediction, AIInsight } from '../types'

// Types are now imported from shared/types

export class AIService {
  private lastRequestTime = 0
  private readonly MIN_REQUEST_INTERVAL = 500 // 500ms between requests

  // Throttle requests to prevent rate limiting
  private async throttleRequest<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const delay = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest
      console.log(`⏳ Throttling request for ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    this.lastRequestTime = Date.now()
    return fn()
  }

  // Get today's AI predictions (using backend API like mobile app)
  async getTodaysPredictions(userId?: string, userTier?: string): Promise<AIPrediction[]> {
    return this.throttleRequest(async () => {
      try {
        console.log('🎯 Fetching predictions from backend API...', { userId, userTier })
        const params = new URLSearchParams()
        if (userId) params.append('userId', userId)
        if (userTier) params.append('userTier', userTier)
        const response = await apiClient.get(`/api/ai/daily-picks-combined?${params.toString()}`)
        const data = response.data || {}

        console.log('📊 Received response data:', data)

        // Combine team picks and player props picks like iOS app does
        const allPicks = [
          ...(data.team_picks || []),
          ...(data.player_props_picks || [])
        ]

        console.log('📊 Combined predictions:', allPicks.length)

        // Transform data to match mobile app format
        return allPicks.map((prediction: any) => ({
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
    })
  }

  // Get predictions by sport (using backend API)
  async getPredictionsBySport(sport: string): Promise<AIPrediction[]> {
    return this.throttleRequest(async () => {
      try {
        console.log(`🏈 Fetching ${sport} predictions from backend API...`)
        const response = await apiClient.get(`/api/ai/predictions/sport/${sport.toLowerCase()}`)
        const predictions = response.data || []

        console.log(`📊 Received ${sport} predictions:`, predictions.length)

        return predictions.map((prediction: any) => ({
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
    })
  }

  // Generate new predictions (calls backend AI orchestrator)
  async generatePredictions(sport: string = 'MLB'): Promise<AIPrediction[]> {
    try {
      const response = await apiClient.post('/api/ai/generate-picks', {
        sport: sport.toUpperCase(),
        count: 10
      })

      return response.data.predictions || []
    } catch (error) {
      console.error('Error generating predictions:', error)
      throw error
    }
  }

  // Get AI insights (Professor Lock insights) - using backend API
  // New method: Fetch full predictions from ai_predictions table with tier-based limits
  async getFullPredictions(userId: string, userTier: string): Promise<AIPrediction[]> {
    return this.throttleRequest(async () => {
      try {
        console.log('🎯 Fetching full predictions using daily-picks-combined (same as iOS)...', { userId, userTier })
        // Use the same endpoint as iOS app since predictions are global, not user-specific
        const params = new URLSearchParams()
        if (userId) params.append('userId', userId)
        if (userTier) params.append('userTier', userTier)

        const response = await apiClient.get(`/api/ai/daily-picks-combined?${params.toString()}`)
        const data = response.data || {}

        // Combine team picks and player props picks
        const allPicks = [
          ...(data.team_picks || []),
          ...(data.player_props_picks || [])
        ]

        console.log('📊 Received full predictions:', allPicks.length)

        return allPicks.map((prediction: any) => ({
          id: prediction.id,
          match: prediction.match_teams || prediction.match || '',
          pick: prediction.pick || '',
          odds: prediction.odds || '',
          confidence: prediction.confidence || 0,
          sport: prediction.sport || 'MLB',
          eventTime: prediction.event_time || prediction.created_at,
          reasoning: prediction.reasoning || '',
          value_percentage: prediction.value_percentage,
          roi_estimate: prediction.roi_estimate,
          bet_type: prediction.bet_type || '',
          status: prediction.status || 'pending',
          game_id: prediction.game_id || '',
          metadata: prediction.metadata || {}
        }))
      } catch (error) {
        console.error('Error fetching full predictions:', error)
        throw error
      }
    })
  }

  // New method: Get Lock of the Day (highest confidence pick)
  async getLockOfTheDay(userId: string): Promise<AIPrediction | null> {
    try {
      console.log('🔒 Fetching Lock of the Day from daily picks...', { userId })
      // Get all today's predictions and find highest confidence
      const allPredictions = await this.getTodaysPredictions(userId, 'pro') // Get full set

      if (!allPredictions || allPredictions.length === 0) {
        console.log('No predictions available for Lock of the Day')
        return null
      }

      // Find highest confidence pick
      const lockPick = allPredictions.reduce((highest, current) => {
        return (current.confidence > highest.confidence) ? current : highest
      })

      console.log('🔒 Lock of the Day found:', lockPick.confidence + '% confidence')

      return lockPick
    } catch (error) {
      console.error('Error fetching Lock of the Day:', error)
      return null
    }
  }

  async getDailyInsights(sport?: string): Promise<AIInsight[]> {
    return this.throttleRequest(async () => {
      try {
        console.log('🧠 Fetching daily insights from backend API...')
        const endpoint = sport ? `/api/insights/daily?sport=${sport.toLowerCase()}` : '/api/insights/daily'
        const response = await apiClient.get(endpoint)
        const insights = response.data || []

        console.log('📚 Received insights:', insights.length)

        return insights
      } catch (error) {
        console.error('Error in getDailyInsights:', error)
        return []
      }
    })
  }
}

export const aiService = new AIService()