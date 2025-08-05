'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Crown, 
  Target, 
  TrendingUp, 
  Star, 
  Zap, 
  DollarSign, 
  BarChart3, 
  Sparkles, 
  Trophy, 
  Lock, 
  X,
  Eye,
  Brain
} from 'lucide-react'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { supabase } from '@/lib/supabase'

interface LockOfTheDayPick {
  id: string
  match_teams: string
  pick: string
  confidence: number
  odds: string
  bet_type: string
  reasoning?: string
  roi_estimate?: string
  value_percentage?: string
  sport?: string
  created_at: string
}

interface EliteLockOfTheDayProps {
  onPickPress?: (pick: LockOfTheDayPick) => void
}

export default function EliteLockOfTheDay({ onPickPress }: EliteLockOfTheDayProps) {
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [lockPick, setLockPick] = useState<LockOfTheDayPick | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { subscriptionTier } = useSubscription()

  useEffect(() => {
    if (subscriptionTier === 'elite') {
      fetchLockOfTheDay()
    }
  }, [subscriptionTier])

  const fetchLockOfTheDay = async () => {
    try {
      setLoading(true)
      setError(null)

      // Query for highest confidence pick from last 24 hours
      const { data: picks, error: queryError } = await supabase
        .from('ai_predictions')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('confidence', { ascending: false })
        .limit(1)

      if (queryError) {
        console.error('Error fetching Lock of the Day:', queryError)
        setError('Failed to load Lock of the Day')
        return
      }

      if (!picks || picks.length === 0) {
        setError('No Lock of the Day available')
        return
      }

      const pick = picks[0]
      setLockPick({
        id: pick.id,
        match_teams: pick.match_teams,
        pick: pick.pick,
        confidence: pick.confidence || 0,
        odds: pick.odds,
        bet_type: pick.bet_type || 'moneyline',
        reasoning: pick.reasoning,
        roi_estimate: pick.roi_estimate?.toString(),
        value_percentage: pick.value_percentage?.toString(),
        sport: pick.sport,
        created_at: pick.created_at
      })
    } catch (error) {
      console.error('Error:', error)
      setError('Failed to load Lock of the Day')
    } finally {
      setLoading(false)
    }
  }

  if (subscriptionTier !== 'elite') {
    return null
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30"
      >
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
        </div>
      </motion.div>
    )
  }

  if (error || !lockPick) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30"
      >
        <div className="text-center py-8">
          <Lock className="w-12 h-12 text-purple-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Lock of the Day</h3>
          <p className="text-gray-400">{error || 'No lock available today'}</p>
        </div>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-purple-500/30"
      >
        {/* Elite Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        
        {/* Elite Badge */}
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full">
            <Crown className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-bold">ELITE EXCLUSIVE</span>
          </div>
        </div>

        {/* Floating Sparkles */}
        <div className="absolute top-6 left-6">
          <motion.div
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1] 
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut" 
            }}
          >
            <Sparkles className="w-6 h-6 text-yellow-400" />
          </motion.div>
        </div>

        <div className="relative p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <Lock className="w-5 h-5 text-purple-400" />
              <h3 className="text-xl font-bold text-white">🔒 Lock of the Day</h3>
            </div>
            <p className="text-purple-200">
              Professor Lock's highest confidence pick
            </p>
          </div>

          {/* Pick Details */}
          <div className="space-y-4 mb-6">
            <div className="bg-black/30 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-white mb-2">
                {lockPick.match_teams}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-purple-200">Pick</p>
                  <p className="text-white font-semibold">{lockPick.pick}</p>
                </div>
                <div>
                  <p className="text-purple-200">Odds</p>
                  <p className="text-white font-semibold">{lockPick.odds}</p>
                </div>
              </div>
            </div>

            {/* Confidence Meter */}
            <div className="bg-black/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-200 text-sm">Confidence Level</span>
                <span className="text-white font-bold">{lockPick.confidence}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${lockPick.confidence}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                />
              </div>
            </div>

            {/* Value Metrics */}
            {(lockPick.roi_estimate || lockPick.value_percentage) && (
              <div className="grid grid-cols-2 gap-4">
                {lockPick.roi_estimate && (
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <TrendingUp className="w-4 h-4 text-green-400 mx-auto mb-1" />
                    <p className="text-xs text-purple-200">ROI Estimate</p>
                    <p className="text-white font-bold">{lockPick.roi_estimate}%</p>
                  </div>
                )}
                {lockPick.value_percentage && (
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <Target className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                    <p className="text-xs text-purple-200">Value</p>
                    <p className="text-white font-bold">{lockPick.value_percentage}%</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={() => setShowAnalysisModal(true)}
              className="flex-1 flex items-center justify-center space-x-2 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
            >
              <Eye className="w-4 h-4" />
              <span>View Full Analysis</span>
            </button>
            <button
              onClick={() => onPickPress?.(lockPick)}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-all duration-200"
            >
              <Brain className="w-4 h-4" />
              <span>Ask Professor</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Full Analysis Modal */}
      <AnimatePresence>
        {showAnalysisModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAnalysisModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-purple-500/30"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Crown className="w-6 h-6 text-purple-400" />
                    <h2 className="text-2xl font-bold text-white">Lock of the Day Analysis</h2>
                  </div>
                  <p className="text-gray-400">Elite-level breakdown and insights</p>
                </div>
                <button
                  onClick={() => setShowAnalysisModal(false)}
                  className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg p-4 border border-purple-500/30">
                  <h3 className="text-lg font-semibold text-white mb-2">{lockPick.match_teams}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-purple-200 text-sm">Pick</p>
                      <p className="text-white font-bold">{lockPick.pick}</p>
                    </div>
                    <div>
                      <p className="text-purple-200 text-sm">Odds</p>
                      <p className="text-white font-bold">{lockPick.odds}</p>
                    </div>
                  </div>
                </div>

                {lockPick.reasoning && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">🧠 AI Analysis</h3>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-gray-300 leading-relaxed">{lockPick.reasoning}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <Trophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Confidence</p>
                    <p className="text-2xl font-bold text-white">{lockPick.confidence}%</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Expected ROI</p>
                    <p className="text-2xl font-bold text-green-400">
                      {lockPick.roi_estimate || 'TBD'}
                    </p>
                  </div>
                </div>

                <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <h4 className="text-white font-semibold">Elite Advantage</h4>
                  </div>
                  <p className="text-purple-100 text-sm">
                    This is our highest-conviction pick, available exclusively to Elite members. 
                    Professor Lock has analyzed all available data points to identify the strongest betting opportunity.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}