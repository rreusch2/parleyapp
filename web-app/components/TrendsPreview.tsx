'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  TrendingUp, 
  ChevronRight, 
  BarChart3, 
  Target,
  User,
  Users,
  Trophy,
  Activity,
  Eye,
  X,
  Sparkles,
  Calendar
} from 'lucide-react'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { supabase } from '@/lib/supabase'
import TrendChart from './TrendChart'

interface Trend {
  id: string
  title?: string
  headline?: string
  trend_text: string
  description?: string
  insight?: string
  supporting_data?: string
  trend_type: 'player_prop' | 'team'
  sport: string
  confidence_score: number
  trend_category?: string
  key_stats?: any
  chart_data?: any
  visual_data?: any
  full_player_name?: string
  created_at: string
}

interface TrendsPreviewProps {
  onViewAllTrends?: () => void
}

export default function TrendsPreview({ onViewAllTrends }: TrendsPreviewProps) {
  const [trends, setTrends] = useState<Trend[]>([])
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const { subscriptionTier } = useSubscription()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    fetchTrendsPreview()
  }, [])

  const fetchTrendsPreview = async () => {
    setLoading(true)
    try {
      // Get 2 most recent trends (1 player prop, 1 team trend if available)
      const [playerResponse, teamResponse] = await Promise.all([
        supabase
          .from('ai_trends')
          .select('*')
          .eq('trend_type', 'player_prop')
          .eq('is_global', true)
          .eq('sport', 'MLB')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('ai_trends')
          .select('*')
          .eq('trend_type', 'team')
          .eq('is_global', true)
          .eq('sport', 'MLB')
          .order('created_at', { ascending: false })
          .limit(1)
      ])

      if (playerResponse.error) throw playerResponse.error
      if (teamResponse.error) throw teamResponse.error

      // Combine and limit to 2 trends
      const allTrends = [
        ...(playerResponse.data || []),
        ...(teamResponse.data || [])
      ].slice(0, 2)

      setTrends(allTrends)
    } catch (error) {
      console.error('Error fetching trends preview:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewAllTrends = () => {
    if (onViewAllTrends) {
      onViewAllTrends()
    } else {
      router.push('/trends')
    }
  }

  const handleTrendPress = (trend: Trend) => {
    if (subscriptionTier === 'free') {
      // Show upgrade modal or limit functionality
      return
    }
    setSelectedTrend(trend)
  }

  const getTrendCategoryIcon = (category?: string) => {
    switch (category) {
      case 'streak': return <Trophy className="w-4 h-4" />
      case 'form': return <TrendingUp className="w-4 h-4" />
      case 'matchup': return <Target className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400'
    if (confidence >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (!mounted) {
    return null
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Section Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">📈 Trending Now</h3>
            <p className="text-gray-400">Latest patterns and insights</p>
          </div>
          <button
            onClick={handleViewAllTrends}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-200"
          >
            <TrendingUp className="w-4 h-4" />
            <span>View All Trends</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <div className="animate-pulse">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-gray-600 rounded-lg"></div>
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

        {/* Trends List */}
        {!loading && trends.length > 0 && (
          <div className="space-y-4">
            {trends.map((trend, index) => (
              <motion.div
                key={trend.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-purple-500/50 transition-all duration-300 cursor-pointer group"
                onClick={() => handleTrendPress(trend)}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-2 rounded-lg ${
                    trend.trend_type === 'player_prop' 
                      ? 'bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30' 
                      : 'bg-green-500/20 text-green-400 group-hover:bg-green-500/30'
                  } transition-colors`}>
                    {trend.trend_type === 'player_prop' ? (
                      <User className="w-5 h-5" />
                    ) : (
                      <Users className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-white font-semibold group-hover:text-purple-400 transition-colors">
                          {trend.title || trend.headline}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                            {trend.sport}
                          </span>
                          <span className="text-xs text-gray-400">
                            {trend.trend_category || 'General'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className={`text-lg font-bold ${getConfidenceColor(trend.confidence_score)}`}>
                          {trend.confidence_score}%
                        </div>
                        <div className="text-xs text-gray-400">Confidence</div>
                      </div>
                    </div>
                    
                    <p className="text-gray-300 mb-3 line-clamp-2">
                      {trend.trend_text}
                    </p>

                    {trend.key_stats && (
                      <div className="flex items-center space-x-4 mb-3 text-sm">
                        {trend.key_stats.recent_games && (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-blue-400" />
                            <span className="text-gray-400">Last {trend.key_stats.recent_games} games</span>
                          </div>
                        )}
                        {trend.key_stats.success_rate && (
                          <div className="flex items-center space-x-1">
                            <BarChart3 className="w-3 h-3 text-green-400" />
                            <span className="text-gray-400">{trend.key_stats.success_rate}% success rate</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTrendPress(trend)
                        }}
                        className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                      >
                        View Full Trend
                      </button>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-4 h-4 text-purple-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Free tier limitation */}
                {subscriptionTier === 'free' && (
                  <div className="mt-4 p-3 bg-gray-600/20 rounded-lg border border-gray-600/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-400">Detailed trend analysis locked</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 text-yellow-400" />
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
        {!loading && trends.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center"
          >
            <TrendingUp className="w-16 h-16 text-purple-500 mx-auto mb-4" />
            <h4 className="text-xl font-semibold text-white mb-2">
              No Trends Available
            </h4>
            <p className="text-gray-400 mb-4">
              Check back soon for new patterns and insights
            </p>
            <button
              onClick={handleViewAllTrends}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              View All Trends
            </button>
          </motion.div>
        )}

        {/* View All CTA */}
        {!loading && trends.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <button
              onClick={handleViewAllTrends}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Explore All Trends</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Trend Detail Modal */}
      <AnimatePresence>
        {selectedTrend && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTrend(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {selectedTrend.title || selectedTrend.headline}
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    <span>{selectedTrend.sport}</span>
                    <span>•</span>
                    <span>{selectedTrend.trend_category || 'General'}</span>
                    <span>•</span>
                    <span className={getConfidenceColor(selectedTrend.confidence_score)}>
                      {selectedTrend.confidence_score}% confidence
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTrend(null)}
                  className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Overview</h3>
                  <p className="text-gray-300">{selectedTrend.trend_text}</p>
                </div>

                {selectedTrend.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Analysis</h3>
                    <p className="text-gray-300">{selectedTrend.description}</p>
                  </div>
                )}

                {selectedTrend.insight && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Key Insight</h3>
                    <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
                      <p className="text-purple-100">{selectedTrend.insight}</p>
                    </div>
                  </div>
                )}

                {selectedTrend.supporting_data && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Supporting Data</h3>
                    <p className="text-gray-300">{selectedTrend.supporting_data}</p>
                  </div>
                )}

                {/* Chart Section */}
                {selectedTrend.chart_data && selectedTrend.visual_data && (
                  <div>
                    <TrendChart 
                      chartData={selectedTrend.chart_data}
                      visualData={selectedTrend.visual_data}
                      propType={selectedTrend.trend_type === 'player_prop' ? selectedTrend.description?.match(/(RBI|Hit|Home Run|Run)/)?.[0] : undefined}
                    />
                  </div>
                )}

                {/* Key Statistics Section */}
                {selectedTrend.key_stats && Object.keys(selectedTrend.key_stats).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Key Statistics</h3>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(selectedTrend.key_stats).map(([key, value]) => (
                          <div key={key} className="text-center">
                            <p className="text-xs text-gray-400 uppercase tracking-wide">{key}</p>
                            <p className="text-lg font-semibold text-white mt-1">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}