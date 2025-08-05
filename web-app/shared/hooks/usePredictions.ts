// Shared Predictions hook (combines mobile app logic)
'use client'
import { useState, useEffect, useCallback } from 'react'
import { aiService, AIPrediction } from '../services/aiService'
import { getTierCapabilities, isInWelcomeBonusPeriod } from '@/lib/subscriptionUtils'
import type { SubscriptionTier } from '@/lib/subscriptionUtils'

export interface PredictionsState {
  predictions: AIPrediction[]
  teamPicks: AIPrediction[]
  playerPropsPicks: AIPrediction[]
  isLoading: boolean
  isLoadingTeam: boolean
  isLoadingProps: boolean
  refreshing: boolean
  error: string | null
}

interface UsePredictionsProps {
  subscriptionTier: SubscriptionTier
  welcomeBonusClaimed?: boolean
  welcomeBonusExpiresAt?: string | null
}

export function usePredictions({
  subscriptionTier = 'free',
  welcomeBonusClaimed = true,
  welcomeBonusExpiresAt = null
}: UsePredictionsProps = {} as UsePredictionsProps) {
  const [state, setState] = useState<PredictionsState>({
    predictions: [],
    teamPicks: [],
    playerPropsPicks: [],
    isLoading: false,
    isLoadingTeam: false,
    isLoadingProps: false,
    refreshing: false,
    error: null
  })

  // Filter predictions based on tier and welcome bonus with proper team/player prop split
  const filterPredictionsByTier = useCallback((predictions: AIPrediction[]) => {
    const isWelcomeBonus = isInWelcomeBonusPeriod(welcomeBonusClaimed, welcomeBonusExpiresAt)
    
    // Separate team picks from player props
    const teamPicks = predictions.filter(p => 
      ['moneyline', 'spread', 'total'].includes(p.bet_type || '')
    )
    const playerProps = predictions.filter(p => 
      p.bet_type === 'player_prop'
    )
    
    let maxTeamPicks = 0
    let maxPlayerProps = 0
    let totalLimit = 0
    
    if (isWelcomeBonus) {
      // During welcome bonus, show 5 picks regardless of tier (mixed)
      totalLimit = 5
    } else {
      // Regular tier-based filtering with proper splits
      switch (subscriptionTier) {
        case 'elite':
          maxTeamPicks = 15
          maxPlayerProps = 15
          totalLimit = 30
          break
        case 'pro':
          maxTeamPicks = 10
          maxPlayerProps = 10
          totalLimit = 20
          break
        case 'free':
        default:
          maxTeamPicks = 1
          maxPlayerProps = 1
          totalLimit = 2
          break
      }
    }
    
    console.log('🎯 Filtering predictions by tier:', {
      subscriptionTier,
      isWelcomeBonus,
      totalPredictions: predictions.length,
      teamPicks: teamPicks.length,
      playerProps: playerProps.length,
      limits: { maxTeamPicks, maxPlayerProps, totalLimit }
    })
    
    if (isWelcomeBonus) {
      // During welcome bonus, return first 5 predictions (mixed)
      return predictions.slice(0, totalLimit)
    }
    
    // For regular tiers, combine team picks and player props with proper limits
    const filteredTeamPicks = teamPicks.slice(0, maxTeamPicks)
    const filteredPlayerProps = playerProps.slice(0, maxPlayerProps)
    
    // Combine and sort by confidence or creation date
    const combined = [...filteredTeamPicks, ...filteredPlayerProps]
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    
    return combined.slice(0, totalLimit)
  }, [subscriptionTier, welcomeBonusClaimed, welcomeBonusExpiresAt])

  // Fetch today's predictions
  const fetchTodaysPredictions = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const allPredictions = await aiService.getTodaysPredictions()
      const filteredPredictions = filterPredictionsByTier(allPredictions)
      
      setState(prev => ({ 
        ...prev, 
        predictions: filteredPredictions,
        isLoading: false 
      }))
      return filteredPredictions
    } catch (error) {
      console.error('Error fetching todays predictions:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load predictions', 
        isLoading: false 
      }))
      return []
    }
  }, [filterPredictionsByTier])

  // Fetch team picks (ML, spreads, totals)
  const fetchTeamPicks = useCallback(async () => {
    setState(prev => ({ ...prev, isLoadingTeam: true, error: null }))
    try {
      const allPredictions = await aiService.getTodaysPredictions()
      // Filter for team bets using consistent criteria
      const allTeamPicks = allPredictions.filter(p => 
        ['moneyline', 'spread', 'total'].includes(p.bet_type || '')
      )
      
      const isWelcomeBonus = isInWelcomeBonusPeriod(welcomeBonusClaimed, welcomeBonusExpiresAt)
      let teamPicksLimit = 0
      
      if (isWelcomeBonus) {
        teamPicksLimit = Math.ceil(5 / 2) // About half of welcome bonus picks
      } else {
        switch (subscriptionTier) {
          case 'elite':
            teamPicksLimit = 15
            break
          case 'pro':
            teamPicksLimit = 10
            break
          case 'free':
          default:
            teamPicksLimit = 1
            break
        }
      }
      
      const teamPicks = allTeamPicks.slice(0, teamPicksLimit)
      
      setState(prev => ({ 
        ...prev, 
        teamPicks,
        isLoadingTeam: false 
      }))
      return teamPicks
    } catch (error) {
      console.error('Error fetching team picks:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load team picks', 
        isLoadingTeam: false 
      }))
      return []
    }
  }, [subscriptionTier, welcomeBonusClaimed, welcomeBonusExpiresAt])

  // Fetch player props picks
  const fetchPlayerPropsPicks = useCallback(async () => {
    setState(prev => ({ ...prev, isLoadingProps: true, error: null }))
    try {
      const allPredictions = await aiService.getTodaysPredictions()
      // Filter for player props using consistent criteria
      const allPropsPicks = allPredictions.filter(p => 
        p.bet_type === 'player_prop'
      )
      
      const isWelcomeBonus = isInWelcomeBonusPeriod(welcomeBonusClaimed, welcomeBonusExpiresAt)
      let propsPicksLimit = 0
      
      if (isWelcomeBonus) {
        propsPicksLimit = Math.floor(5 / 2) // About half of welcome bonus picks
      } else {
        switch (subscriptionTier) {
          case 'elite':
            propsPicksLimit = 15
            break
          case 'pro':
            propsPicksLimit = 10
            break
          case 'free':
          default:
            propsPicksLimit = 1
            break
        }
      }
      
      const propsPicks = allPropsPicks.slice(0, propsPicksLimit)
      
      setState(prev => ({ 
        ...prev, 
        playerPropsPicks: propsPicks,
        isLoadingProps: false 
      }))
      return propsPicks
    } catch (error) {
      console.error('Error fetching player props picks:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load player props', 
        isLoadingProps: false 
      }))
      return []
    }
  }, [subscriptionTier, welcomeBonusClaimed, welcomeBonusExpiresAt])

  // Fetch predictions by sport
  const fetchPredictionsBySport = useCallback(async (sport: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const predictions = await aiService.getPredictionsBySport(sport)
      setState(prev => ({ 
        ...prev, 
        predictions,
        isLoading: false 
      }))
      return predictions
    } catch (error) {
      console.error('Error fetching predictions by sport:', error)
      setState(prev => ({ 
        ...prev, 
        error: `Failed to load ${sport} predictions`, 
        isLoading: false 
      }))
      return []
    }
  }, [])

  // Generate new predictions
  const generatePredictions = useCallback(async (sport: string = 'MLB') => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const newPredictions = await aiService.generatePredictions(sport)
      // Refresh the current predictions after generation
      await fetchTodaysPredictions()
      return newPredictions
    } catch (error) {
      console.error('Error generating predictions:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to generate new predictions', 
        isLoading: false 
      }))
      throw error
    }
  }, [fetchTodaysPredictions])

  // Refresh all data
  const refreshAll = useCallback(async () => {
    setState(prev => ({ ...prev, refreshing: true }))
    try {
      await Promise.all([
        fetchTodaysPredictions(),
        fetchTeamPicks(),
        fetchPlayerPropsPicks()
      ])
    } finally {
      setState(prev => ({ ...prev, refreshing: false }))
    }
  }, [fetchTodaysPredictions, fetchTeamPicks, fetchPlayerPropsPicks])

  // Load initial data
  useEffect(() => {
    fetchTodaysPredictions()
    fetchTeamPicks()
    fetchPlayerPropsPicks()
  }, [fetchTodaysPredictions, fetchTeamPicks, fetchPlayerPropsPicks])

  return {
    // State
    ...state,

    // Actions
    fetchTodaysPredictions,
    fetchTeamPicks,
    fetchPlayerPropsPicks,
    fetchPredictionsBySport,
    generatePredictions,
    refreshAll,

    // Computed values
    totalPredictions: state.predictions.length,
    highConfidencePicks: state.predictions.filter(p => p.confidence >= 80),
    averageConfidence: state.predictions.length > 0 
      ? state.predictions.reduce((sum, p) => sum + p.confidence, 0) / state.predictions.length 
      : 0
  }
}