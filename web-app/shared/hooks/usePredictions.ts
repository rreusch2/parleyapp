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

  // Filter predictions based on tier and welcome bonus
  const filterPredictionsByTier = useCallback((predictions: AIPrediction[]) => {
    const isWelcomeBonus = isInWelcomeBonusPeriod(welcomeBonusClaimed, welcomeBonusExpiresAt)
    const capabilities = getTierCapabilities(subscriptionTier)
    
    console.log('🎯 Filtering predictions by tier:', {
      subscriptionTier,
      isWelcomeBonus,
      totalPredictions: predictions.length,
      maxPicks: isWelcomeBonus ? 5 : capabilities.dailyPicks
    })
    
    if (isWelcomeBonus) {
      // During welcome bonus, show 5 picks regardless of tier
      return predictions.slice(0, 5)
    }
    
    // Regular tier-based filtering
    return predictions.slice(0, capabilities.dailyPicks)
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
      // Filter for team bets (not player props)
      const allTeamPicks = allPredictions.filter(p => 
        p.bet_type && !p.bet_type.toLowerCase().includes('prop') &&
        (p.bet_type.includes('ML') || 
         p.bet_type.includes('spread') || 
         p.bet_type.includes('total') ||
         p.bet_type.includes('moneyline') ||
         p.bet_type.includes('over') ||
         p.bet_type.includes('under'))
      )
      
      const isWelcomeBonus = isInWelcomeBonusPeriod(welcomeBonusClaimed, welcomeBonusExpiresAt)
      const capabilities = getTierCapabilities(subscriptionTier)
      const teamPicksLimit = isWelcomeBonus ? Math.ceil(5 / 2) : capabilities.teamPicks
      
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
      // Filter for player props
      const allPropsPicks = allPredictions.filter(p => 
        p.bet_type && (
          p.bet_type.toLowerCase().includes('prop') ||
          p.bet_type.toLowerCase().includes('hit') ||
          p.bet_type.toLowerCase().includes('homer') ||
          p.bet_type.toLowerCase().includes('rbi') ||
          p.bet_type.toLowerCase().includes('strikeout') ||
          p.bet_type.toLowerCase().includes('assist') ||
          p.bet_type.toLowerCase().includes('rebound')
        )
      )
      
      const isWelcomeBonus = isInWelcomeBonusPeriod(welcomeBonusClaimed, welcomeBonusExpiresAt)
      const capabilities = getTierCapabilities(subscriptionTier)
      const propsPicksLimit = isWelcomeBonus ? Math.floor(5 / 2) : capabilities.playerPropPicks
      
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