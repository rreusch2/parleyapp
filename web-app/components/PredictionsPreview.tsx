'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  Zap, 
  Target, 
  TrendingUp,
  Sparkles,
  Crown,
  Eye,
  ChevronRight,
  Activity,
  BarChart3,
  Brain
} from 'lucide-react'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { usePredictions } from '@/shared/hooks/usePredictions'
import { useAIChat } from '@/shared/hooks/useAIChat'
import { AIPrediction } from '@/shared/services/aiService'

interface PredictionsPreviewProps {
  limit?: number
}

export default function PredictionsPreview({ limit = 2 }: PredictionsPreviewProps) {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { subscriptionTier } = useSubscription()
  const { predictions, isLoading, totalPredictions, averageConfidence } = usePredictions()
  const { openChatWithContext } = useAIChat()

  useEffect(() => {
    setMounted(true)
  }, [])

  const previewPredictions = predictions.slice(0, limit)

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400'
    if (confidence >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30'
    if (confidence >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    return 'bg-red-500/20 text-red-400 border-red-500/30'
  }

  const handlePredictionClick = (prediction: AIPrediction) => {
    openChatWithContext({ selectedPrediction: prediction }, prediction)
  }

  const handleViewAllClick = () => {
    router.push('/predictions')
  }

  if (!mounted) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">⚡ AI Predictions Preview</h3>
          <p className="text-gray-400">
            {isLoading ? 'Loading...' : `${totalPredictions} total picks • ${averageConfidence.toFixed(1)}% avg confidence`}
          </p>
        </div>
        <button
          onClick={handleViewAllClick}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
        >
          <Eye className="w-4 h-4" />
          <span>View All Picks</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="animate-pulse">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 w-12 bg-gray-600 rounded"></div>
                </div>
                <div className="h-3 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Predictions List */}
      {!isLoading && previewPredictions.length > 0 && (
        <div className="space-y-4">
          {previewPredictions.map((prediction, index) => (
            <motion.div
              key={prediction.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-blue-500/50 transition-all duration-300 cursor-pointer group"
              onClick={() => handlePredictionClick(prediction)}
            >
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                  <Zap className="w-5 h-5 text-blue-400" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-semibold group-hover:text-blue-400 transition-colors">
                      {prediction.match || prediction.match_teams}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full border ${getConfidenceBadgeColor(prediction.confidence)}`}>
                        {prediction.confidence}% confidence
                      </span>
                      {prediction.confidence >= 80 && (
                        <div className="flex items-center space-x-1 text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                          <Sparkles className="w-3 h-3" />
                          <span>HIGH</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-gray-400 text-sm">Pick</p>
                      <p className="text-white font-medium">{prediction.pick}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Odds</p>
                      <p className="text-white font-medium">{prediction.odds}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Sport</p>
                      <p className="text-blue-400 font-medium">{prediction.sport || prediction.league}</p>
                    </div>
                  </div>

                  {/* Value metrics for Pro/Elite users */}
                  {subscriptionTier !== 'free' && (prediction.value_percentage || prediction.roi_estimate) && (
                    <div className="flex items-center space-x-4 mb-3">
                      {prediction.value_percentage && (
                        <div className="flex items-center space-x-1">
                          <Target className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-gray-400">Value:</span>
                          <span className="text-xs text-green-400 font-medium">
                            {prediction.value_percentage}%
                          </span>
                        </div>
                      )}
                      {prediction.roi_estimate && (
                        <div className="flex items-center space-x-1">
                          <TrendingUp className="w-3 h-3 text-blue-400" />
                          <span className="text-xs text-gray-400">ROI:</span>
                          <span className="text-xs text-blue-400 font-medium">
                            {prediction.roi_estimate}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {prediction.reasoning && (
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                      {prediction.reasoning}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <Activity className="w-3 h-3" />
                      <span>Click to discuss with Professor Lock</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Brain className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Locked features for free users */}
              {subscriptionTier === 'free' && (
                <div className="mt-4 p-3 bg-gray-600/20 rounded-lg border border-gray-600/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">Advanced analytics locked</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Crown className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs text-gray-400">Pro Feature</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && previewPredictions.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center"
        >
          <Zap className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-white mb-2">
            No Predictions Available
          </h4>
          <p className="text-gray-400 mb-4">
            Check back soon for fresh AI-powered predictions
          </p>
          <button
            onClick={handleViewAllClick}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View All Predictions
          </button>
        </motion.div>
      )}

      {/* View All CTA */}
      {!isLoading && previewPredictions.length > 0 && totalPredictions > limit && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <button
            onClick={handleViewAllClick}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            <Eye className="w-4 h-4" />
            <span>View All {totalPredictions} Predictions</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}