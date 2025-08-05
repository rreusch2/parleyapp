'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Brain, 
  Target, 
  Trophy, 
  Crown, 
  BarChart3,
  ChevronRight,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  TrendingUp,
  Flame,
  Eye,
  Search,
  Database,
  Globe,
  Lock
} from 'lucide-react'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { supabase } from '@/lib/supabase'

interface DailyInsight {
  id: string
  title: string
  description: string
  category: 'weather' | 'injury' | 'pitcher' | 'bullpen' | 'trends' | 'matchup' | 'research' | 'intro'
  confidence: number
  impact: 'low' | 'medium' | 'high'
  research_sources: string[]
  created_at: string
  insight_order?: number
  insight_text?: string
  teams?: string[]
  game_info?: {
    home_team: string
    away_team: string
    game_time: string
    odds?: {
      home: number
      away: number
    }
  }
}

interface DailyProfessorInsightsProps {
  sport?: string
  limit?: number
}

export default function DailyProfessorInsights({ sport = 'MLB', limit }: DailyProfessorInsightsProps) {
  const [insights, setInsights] = useState<DailyInsight[]>([])
  const [dailyMessage, setDailyMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { subscriptionTier } = useSubscription()
  
  // Determine insights limit based on subscription tier if not explicitly provided
  const insightsLimit = limit || (
    subscriptionTier === 'elite' ? 12 :
    subscriptionTier === 'pro' ? 8 : 2
  )

  useEffect(() => {
    fetchInsights()
  }, [sport])

  const fetchInsights = async () => {
    try {
      setLoading(true)
      setError(null)

      const today = new Date().toISOString().split('T')[0]
      
      const { data, error: queryError } = await supabase
        .from('daily_professor_insights')
        .select('*')
        .eq('date_generated', today)
        .order('insight_order', { ascending: true })
        .limit(insightsLimit)

      if (queryError) {
        console.error('Error fetching insights:', queryError)
        setError('Failed to load insights')
        return
      }

      if (!data || data.length === 0) {
        setError('No insights available today')
        return
      }

      // Extract daily message and insights
      const { message, remainingInsights } = extractDailyMessage(data)
      setDailyMessage(message)
      setInsights(remainingInsights.slice(0, insightsLimit))
      setLastGenerated(new Date(data[0]?.created_at))
      
    } catch (error) {
      console.error('Error:', error)
      setError('Failed to load insights')
    } finally {
      setLoading(false)
    }
  }

  const extractDailyMessage = (insights: any[]): { message: string | null, remainingInsights: any[] } => {
    if (!insights || insights.length === 0) {
      return { message: null, remainingInsights: [] }
    }

    // Find the intro message
    const introIndex = insights.findIndex(insight => 
      insight.category === 'intro' || 
      insight.insight_order === 1 ||
      insight.title === 'Daily AI Greeting' ||
      (insight.description && insight.description.toLowerCase().includes('brother'))
    )

    if (introIndex !== -1) {
      const introInsight = insights[introIndex]
      const message = introInsight.insight_text || introInsight.description || null
      const remainingInsights = insights.filter((_, index) => index !== introIndex)
      return { message, remainingInsights }
    }

    return { message: null, remainingInsights: insights }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'weather': return <Activity className="w-4 h-4 text-blue-400" />
      case 'injury': return <AlertTriangle className="w-4 h-4 text-red-400" />
      case 'pitcher': return <Target className="w-4 h-4 text-green-400" />
      case 'trends': return <TrendingUp className="w-4 h-4 text-purple-400" />
      case 'matchup': return <Zap className="w-4 h-4 text-yellow-400" />
      case 'research': return <Search className="w-4 h-4 text-cyan-400" />
      default: return <Brain className="w-4 h-4 text-blue-400" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400'
      case 'medium': return 'text-yellow-400'
      case 'low': return 'text-green-400'
      default: return 'text-gray-400'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400'
    if (confidence >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchInsights()
    setRefreshing(false)
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
          <h3 className="text-xl font-bold text-white">📚 Daily Professor Insights</h3>
          <p className="text-gray-400">AI-powered analysis and research</p>
        </div>
        <div className="flex items-center space-x-3">
          {lastGenerated && (
            <div className="text-xs text-gray-500">
              Updated {lastGenerated.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Daily Message */}
      {dailyMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-500/30"
        >
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Brain className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-semibold mb-2">👋 Good morning from Professor Lock</h4>
              <p className="text-blue-100 leading-relaxed">{dailyMessage}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-white">Loading insights...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center"
        >
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h4 className="text-white font-semibold mb-2">Unable to Load Insights</h4>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchInsights}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </motion.div>
      )}

      {/* Insights List */}
      {!loading && !error && insights.length > 0 && (
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-blue-500/50 transition-all duration-300"
            >
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-gray-800 rounded-lg">
                  {getCategoryIcon(insight.category)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-semibold">{insight.title}</h4>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${getImpactColor(insight.impact)}`}>
                        {insight.impact.toUpperCase()}
                      </span>
                      <span className={`text-sm font-bold ${getConfidenceColor(insight.confidence)}`}>
                        {insight.confidence}%
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 mb-3">{insight.description}</p>
                  
                  {insight.teams && insight.teams.length > 0 && (
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-gray-400 text-sm">Teams:</span>
                      <div className="flex space-x-1">
                        {insight.teams.map((team, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                            {team}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {insight.research_sources && insight.research_sources.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <Database className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-500">
                        Sources: {insight.research_sources.slice(0, 2).join(', ')}
                        {insight.research_sources.length > 2 && ` +${insight.research_sources.length - 2} more`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Free User Upgrade Prompt */}
      {subscriptionTier === 'free' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30"
        >
          <div className="text-center">
            <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h4 className="text-xl font-bold text-white mb-2">
              Unlock Complete Professor Insights
            </h4>
            <p className="text-gray-300 mb-4">
              Get access to all daily insights, detailed analysis, and exclusive research from Professor Lock
            </p>
            <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200">
              Upgrade to Pro
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}