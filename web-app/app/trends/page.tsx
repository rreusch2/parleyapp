'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  TrendingUp, 
  User,
  Users,
  Activity,
  BarChart3,
  Eye,
  Calendar,
  Trophy,
  Target,
  Sparkles,
  Crown,
  Lock,
  X
} from 'lucide-react'
import TrendChart from '@/components/TrendChart'
import { supabase } from '@/lib/supabase'
import { getTierCapabilities } from '@/lib/subscriptionUtils'

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

// Mock data - replace with real Supabase queries
const mockTrends: Trend[] = [
  {
    id: '1',
    title: 'MVP Hot Streak',
    headline: 'Juan Soto hits over 1.5 hits in 8 of last 10 games',
    trend_text: 'Juan Soto has been incredibly consistent with his hitting, going over 1.5 hits in 8 out of his last 10 games.',
    description: 'Soto is in phenomenal form and has been getting excellent pitches to hit.',
    insight: 'Strong value play for tonight\'s game against left-handed pitching.',
    trend_type: 'player_prop',
    sport: 'MLB',
    confidence_score: 87,
    trend_category: 'streak',
    full_player_name: 'Juan Soto',
    key_stats: {
      recent_games: 10,
      success_rate: 80,
      streak_length: 3
    },
    chart_data: {
      recent_results: ['over', 'over', 'under', 'over', 'over', 'over', 'under', 'over', 'over', 'over']
    },
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Team Dominance',
    headline: 'Yankees score 5+ runs in 7 of last 8 home games',
    trend_text: 'The Yankees have been explosive at home, consistently putting up big offensive numbers.',
    description: 'Home field advantage is real for the Yankees this season.',
    trend_type: 'team',
    sport: 'MLB',
    confidence_score: 82,
    trend_category: 'form',
    key_stats: {
      recent_games: 8,
      success_rate: 87.5,
      avg_runs: 6.2
    },
    created_at: new Date().toISOString()
  }
]

export default function TrendsPage() {
  const { user } = useAuth()
  const { subscriptionTier } = useSubscription()
  const [activeTab, setActiveTab] = useState<'player' | 'team'>('player')
  const [activeSport, setActiveSport] = useState<'All' | 'MLB' | 'NBA' | 'NFL' | 'NHL'>('All')
  const [trends, setTrends] = useState<Trend[]>([])
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }
    setMounted(true)
    fetchTrends()
  }, [user, router])

  const fetchTrends = async () => {
    try {
      setIsLoading(true)
      
      const { data, error } = await supabase
        .from('ai_trends')
        .select('*')
        .eq('is_global', true)
        .eq('sport', 'MLB') // TODO: Make this dynamic based on activeSport
        .order('created_at', { ascending: false })
        .limit(50) // Get more than we need, then filter client-side
      
      if (error) throw error
      
      setTrends(data || [])
      
    } catch (error) {
      console.error('Error fetching trends:', error)
      // Fallback to mock data if real data fails
      setTrends(mockTrends)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredTrends = trends.filter(trend => {
    const matchesTab = trend.trend_type === (activeTab === 'player' ? 'player_prop' : 'team')
    const matchesSport = activeSport === 'All' || trend.sport === activeSport
    return matchesTab && matchesSport
  })

  const capabilities = getTierCapabilities(subscriptionTier as any)
  const trendLimit = capabilities.dailyTrends

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400'
    if (confidence >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getTrendCategoryIcon = (category?: string) => {
    switch (category) {
      case 'streak': return <Trophy className="w-4 h-4" />
      case 'form': return <TrendingUp className="w-4 h-4" />
      case 'matchup': return <Target className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  if (!user || !mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">AI Trends</h1>
            <p className="text-xl text-gray-300">
              Discover patterns and insights from advanced analytics
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-sm font-medium">
                {filteredTrends.length} trends found
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sport Filter */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex items-center space-x-1 bg-white/5 backdrop-blur-sm rounded-lg p-1">
          {['All', 'MLB', 'NBA', 'NFL', 'NHL'].map((sport) => (
            <button
              key={sport}
              onClick={() => setActiveSport(sport as any)}
              className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                activeSport === sport
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {sport}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Trend Limit Info */}
      {subscriptionTier === 'free' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-4 border border-purple-500/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="w-5 h-5 text-yellow-400" />
              <div>
                <h3 className="text-white font-semibold">Free Tier - Limited Trends</h3>
                <p className="text-gray-300 text-sm">Access to {trendLimit} trends. Upgrade for unlimited access or use the mobile app to watch ads for extra trends!</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all duration-200">
              Upgrade
            </button>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mb-8"
      >
        <div className="flex space-x-1 bg-white/5 backdrop-blur-sm rounded-lg p-1">
          <button
            onClick={() => setActiveTab('player')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md font-medium transition-all duration-200 ${
              activeTab === 'player'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Player Props</span>
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md font-medium transition-all duration-200 ${
              activeTab === 'team'
                ? 'bg-green-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Trends</span>
          </button>
        </div>
      </motion.div>

      {/* Trends Grid */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-white font-medium">Loading trends...</span>
            </div>
          </div>
        ) : filteredTrends.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center"
          >
            <TrendingUp className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              No {activeTab} trends found
            </h3>
            <p className="text-gray-400">
              Check back later for new insights and patterns
            </p>
          </motion.div>
        ) : (
          filteredTrends.slice(0, trendLimit).map((trend, index) => (
            <motion.div
              key={trend.id}
              initial={{ opacity: 0, y: 20 }}
              animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-blue-500/50 transition-all duration-300 cursor-pointer group"
              onClick={() => setSelectedTrend(trend)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`p-2 rounded-lg ${
                      activeTab === 'player' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {getTrendCategoryIcon(trend.trend_category)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold group-hover:text-blue-400 transition-colors">
                        {trend.title || trend.headline}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {trend.sport} • {trend.trend_category || 'General'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getConfidenceColor(trend.confidence_score)}`}>
                        {trend.confidence_score}%
                      </div>
                      <div className="text-xs text-gray-400">Confidence</div>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 mb-4">
                    {trend.trend_text}
                  </p>

                  {trend.key_stats && (
                    <div className="flex items-center space-x-6 text-sm">
                      {trend.key_stats.recent_games && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          <span className="text-gray-400">Last {trend.key_stats.recent_games} games</span>
                        </div>
                      )}
                      {trend.key_stats.success_rate && (
                        <div className="flex items-center space-x-1">
                          <BarChart3 className="w-4 h-4 text-green-400" />
                          <span className="text-gray-400">{trend.key_stats.success_rate}% success rate</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="w-5 h-5 text-blue-400" />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
                  View Full Trend
                </button>
                {subscriptionTier === 'free' && (
                  <div className="flex items-center space-x-1">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">Detailed analysis locked</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}

        {/* Show locked trends for free users */}
        {subscriptionTier === 'free' && filteredTrends.length > trendLimit && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.4, delay: filteredTrends.length * 0.05 }}
            className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30"
          >
            <div className="text-center">
              <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                {filteredTrends.length - trendLimit} More Premium Trends Available
              </h3>
              <p className="text-gray-300 mb-4">
                Unlock unlimited trend analysis with advanced insights and detailed breakdowns
              </p>
              <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200">
                Upgrade to Pro
              </button>
            </div>
          </motion.div>
        )}
      </div>

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
                    <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                      <p className="text-blue-100">{selectedTrend.insight}</p>
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
    </div>
  )
}