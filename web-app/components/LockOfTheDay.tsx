'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Lock, 
  TrendingUp, 
  Target, 
  Sparkles, 
  Calendar,
  Clock,
  Trophy,
  Zap,
  ChevronRight,
  X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface LockPrediction {
  id: string
  match_teams: string
  pick: string
  odds: string
  confidence: number
  sport: string
  event_time: string
  reasoning: string
  bet_type: string
  key_factors?: any
}

interface LockOfTheDayProps {
  userId: string
}

export default function LockOfTheDay({ userId }: LockOfTheDayProps) {
  const [lockPick, setLockPick] = useState<LockPrediction | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchLockOfTheDay()
  }, [userId])

  const fetchLockOfTheDay = async () => {
    setLoading(true)
    try {
      // Get the prediction with the highest confidence for today (global predictions, not user-specific)
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('ai_predictions')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .order('confidence', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error fetching lock of the day:', error)
        return
      }

      if (data && data.length > 0) {
        setLockPick(data[0])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatEventTime = (eventTime: string) => {
    const date = new Date(eventTime)
    const now = new Date()
    const diffInHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString([], { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-green-400'
    if (confidence >= 75) return 'text-yellow-400'
    return 'text-orange-400'
  }

  const getConfidenceGradient = (confidence: number) => {
    if (confidence >= 85) return 'from-green-500/20 to-green-600/20'
    if (confidence >= 75) return 'from-yellow-500/20 to-yellow-600/20'
    return 'from-orange-500/20 to-orange-600/20'
  }

  if (!mounted) {
    return null
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-purple-900/40 via-gray-900/60 to-purple-900/40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 overflow-hidden"
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 via-transparent to-purple-600/5 animate-pulse"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-400/10 to-transparent rounded-full blur-xl"></div>
        
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center space-x-2">
                  <span>🔒 Lock of the Day</span>
                  <div className="flex items-center space-x-1 px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-medium">
                    <Trophy className="w-3 h-3" />
                    <span>ELITE</span>
                  </div>
                </h3>
                <p className="text-purple-300">Our highest confidence pick today</p>
              </div>
            </div>
            
            {lockPick && (
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r ${getConfidenceGradient(lockPick.confidence)} border border-current/20`}>
                <Zap className={`w-4 h-4 ${getConfidenceColor(lockPick.confidence)}`} />
                <span className={`font-bold ${getConfidenceColor(lockPick.confidence)}`}>
                  {lockPick.confidence}% Confidence
                </span>
              </div>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="h-6 bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-6 bg-gray-700 rounded w-2/3 mb-4"></div>
              <div className="h-10 bg-gray-700 rounded w-1/3"></div>
            </div>
          )}

          {/* Lock Pick Content */}
          {!loading && lockPick && (
            <div className="space-y-4">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-bold text-white">{lockPick.match_teams}</h4>
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <Calendar className="w-4 h-4" />
                    <span>{formatEventTime(lockPick.event_time)}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Pick</p>
                    <p className="text-lg font-semibold text-purple-300">{lockPick.pick}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Odds</p>
                    <p className="text-lg font-semibold text-green-400">{lockPick.odds}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-sm text-gray-300">
                  <div className="flex items-center space-x-1">
                    <Target className="w-4 h-4" />
                    <span>{lockPick.sport.toUpperCase()}</span>
                  </div>
                  <span>•</span>
                  <span>{lockPick.bet_type}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowAnalysis(true)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-semibold transition-all duration-200"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>View Full Analysis</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* No Lock Available */}
          {!loading && !lockPick && (
            <div className="text-center py-8">
              <Lock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h4 className="text-xl font-semibold text-white mb-2">
                No Lock Available
              </h4>
              <p className="text-gray-400">
                Check back later for today's highest confidence pick
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Analysis Modal */}
      {showAnalysis && lockPick && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-purple-500/30"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center space-x-2">
                <Lock className="w-6 h-6 text-purple-400" />
                <span>Full Analysis</span>
              </h3>
              <button
                onClick={() => setShowAnalysis(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-2">{lockPick.match_teams}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Pick:</span>
                    <span className="text-purple-300 ml-2 font-semibold">{lockPick.pick}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Odds:</span>
                    <span className="text-green-400 ml-2 font-semibold">{lockPick.odds}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Confidence:</span>
                    <span className={`ml-2 font-semibold ${getConfidenceColor(lockPick.confidence)}`}>
                      {lockPick.confidence}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Sport:</span>
                    <span className="text-white ml-2">{lockPick.sport.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {lockPick.reasoning && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h5 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>AI Reasoning</span>
                  </h5>
                  <p className="text-gray-300 leading-relaxed">
                    {lockPick.reasoning}
                  </p>
                </div>
              )}

              {lockPick.key_factors && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h5 className="text-lg font-semibold text-white mb-3">Key Factors</h5>
                  <div className="space-y-2">
                    {Object.entries(lockPick.key_factors).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-400 capitalize">{key.replace('_', ' ')}:</span>
                        <span className="text-white">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}