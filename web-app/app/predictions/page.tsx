'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Shield, 
  Star, 
  ChevronRight, 
  Sparkles,
  Trophy,
  BarChart3,
  MessageCircle,
  Crown,
  Lock,
  Calendar,
  Activity,
  RefreshCw,
  Bell,
  ArrowLeft,
  Filter
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'

interface AIPrediction {
  id: string
  match: string
  sport: string
  eventTime: string
  pick: string
  odds: string
  confidence: number
  reasoning: string
  value?: number
  type: 'team' | 'player'
}

export default function Predictions() {
  const { user } = useAuth()
  const { isPro, isElite, subscriptionTier } = useSubscription()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [predictions, setPredictions] = useState<AIPrediction[]>([])
  const [selectedSport, setSelectedSport] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/')
    }
  }, [user, router])

  useEffect(() => {
    if (user) {
      loadPredictions()
    }
  }, [user, isPro, isElite])

  const loadPredictions = async () => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const maxPicks = isElite ? 30 : isPro ? 20 : 2
      const mockPredictions: AIPrediction[] = []
      
      const sports = ['NBA', 'MLB', 'NFL', 'NHL']
      const teams = {
        NBA: ['Lakers vs Warriors', 'Celtics vs Heat', 'Nuggets vs Suns', 'Bucks vs 76ers'],
        MLB: ['Yankees vs Red Sox', 'Dodgers vs Giants', 'Astros vs Rangers', 'Braves vs Mets'],
        NFL: ['Chiefs vs Bills', 'Cowboys vs Eagles', 'Rams vs 49ers', 'Packers vs Bears'],
        NHL: ['Rangers vs Bruins', 'Lightning vs Panthers', 'Oilers vs Flames', 'Kings vs Sharks']
      }
      
      for (let i = 0; i < maxPicks; i++) {
        const sport = sports[i % sports.length] as keyof typeof teams
        const sportTeams = teams[sport]
        const team = sportTeams[Math.floor(i / sports.length) % sportTeams.length]
        
        const isPlayerProp = i >= Math.floor(maxPicks / 2)
        
        mockPredictions.push({
          id: `pred-${i}`,
          match: team,
          sport,
          eventTime: new Date(Date.now() + (i * 3600000) + (Math.random() * 86400000)).toISOString(),
          pick: isPlayerProp 
            ? `${team.split(' vs ')[0].split(' ').pop()} Player Over 25.5 pts`
            : i % 3 === 0 ? `${team.split(' vs ')[0]} -3.5` 
            : i % 3 === 1 ? `${team.split(' vs ')[1]} ML`
            : `Over ${40 + Math.floor(Math.random() * 20)}.5`,
          odds: i % 3 === 0 ? '-110' : i % 3 === 1 ? `+${110 + Math.floor(Math.random() * 200)}` : '-105',
          confidence: 65 + Math.floor(Math.random() * 30),
          reasoning: `Advanced AI analysis ${isPlayerProp ? 'shows this player prop has strong value based on recent performance and matchup data' : 'indicates strong value in this bet based on team trends, injuries, and statistical models'}.`,
          value: 8 + Math.floor(Math.random() * 20),
          type: isPlayerProp ? 'player' : 'team'
        })
      }
      
      // Sort by confidence
      mockPredictions.sort((a, b) => b.confidence - a.confidence)
      setPredictions(mockPredictions)
      
    } catch (error) {
      console.error('Error loading predictions:', error)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadPredictions()
    setRefreshing(false)
  }

  const filteredPredictions = predictions.filter(pred => {
    const sportMatch = selectedSport === 'all' || pred.sport === selectedSport
    const typeMatch = selectedType === 'all' || pred.type === selectedType
    return sportMatch && typeMatch
  })

  const getMaxPicks = () => {
    if (isElite) return 30
    if (isPro) return 20
    return 2
  }

  const getTierDisplay = () => {
    if (isElite) return 'Elite'
    if (isPro) return 'Pro' 
    return 'Free'
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12"
        >
          <Sparkles className="w-12 h-12 text-blue-400" />
        </motion.div>
        <p className="text-gray-300 text-lg ml-4">Loading predictions...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-gray-800/50 hover:bg-gray-700/50 p-3 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
            <div>
              <h1 className={`text-3xl font-bold ${isElite ? 'text-yellow-400' : 'text-white'}`}>
                {isElite ? 'Elite' : isPro ? 'Pro' : 'Daily'} AI Predictions
              </h1>
              <div className="flex items-center space-x-4 mt-2">
                <div className="flex items-center space-x-2">
                  {isElite ? (
                    <div className="flex items-center space-x-2 bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-500/30">
                      <Crown className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-bold text-sm">✨ ELITE MEMBER ✨</span>
                    </div>
                  ) : isPro ? (
                    <div className="flex items-center space-x-2 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30">
                      <Crown className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-400 font-bold text-sm">PRO MEMBER</span>
                    </div>
                  ) : (
                    <div className="bg-gray-600/20 px-3 py-1 rounded-full border border-gray-600/30">
                      <span className="text-gray-400 font-medium text-sm">FREE TIER</span>
                    </div>
                  )}
                </div>
                <div className="text-gray-400 text-sm">
                  {filteredPredictions.length} of {getMaxPicks()} picks
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 px-4 py-3 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-blue-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-blue-400 font-medium">Refresh</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 mb-8">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400 font-medium">Filters:</span>
          </div>
          
          {/* Sport Filter */}
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded-lg focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Sports</option>
            <option value="NBA">NBA</option>
            <option value="MLB">MLB</option>
            <option value="NFL">NFL</option>
            <option value="NHL">NHL</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded-lg focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="team">Team Bets</option>
            <option value="player">Player Props</option>
          </select>
        </div>

        {/* Predictions Grid */}
        <div className="space-y-4">
          {filteredPredictions.map((prediction, index) => (
            <motion.div
              key={prediction.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 hover:border-blue-500/50 transition-colors group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="bg-blue-500/20 px-3 py-1 rounded-full">
                      <span className="text-blue-400 font-medium text-sm">{prediction.sport}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full ${
                      prediction.type === 'player' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      <span className="font-medium text-sm">{prediction.type === 'player' ? 'Player Prop' : 'Team Bet'}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full ${
                      prediction.confidence >= 85 ? 'bg-green-500/20 text-green-400' : 
                      prediction.confidence >= 70 ? 'bg-blue-500/20 text-blue-400' : 
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      <span className="font-semibold text-sm">{prediction.confidence}% Confidence</span>
                    </div>
                  </div>
                  <h3 className="text-white font-semibold text-xl mb-2">{prediction.match}</h3>
                  <p className="text-gray-400 text-sm">{new Date(prediction.eventTime).toLocaleString()}</p>
                </div>
                <div className="text-right ml-6">
                  <div className="text-blue-400 font-bold text-xl mb-1">{prediction.pick}</div>
                  <div className="text-gray-300 text-lg font-medium mb-1">{prediction.odds}</div>
                  {prediction.value && (
                    <div className="text-green-400 text-sm font-medium">+{prediction.value}% Value</div>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
                <h4 className="text-blue-400 font-medium text-sm mb-2">AI Analysis</h4>
                <p className="text-gray-300 text-sm leading-relaxed">{prediction.reasoning}</p>
              </div>
              
              <div className="flex space-x-3">
                <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>Analyze with AI</span>
                </button>
                {isPro && (
                  <button className="bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors">
                    Track Bet
                  </button>
                )}
                <button className="bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors">
                  Share
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Load More Button (if needed) */}
        {filteredPredictions.length === 0 && (
          <div className="text-center py-12">
            <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No predictions found</h3>
            <p className="text-gray-400 mb-6">Try adjusting your filters or refresh to load new predictions</p>
            <button 
              onClick={onRefresh}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 mx-auto"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Refresh Predictions</span>
            </button>
          </div>
        )}

        {/* Upgrade prompt for free users */}
        {!isPro && filteredPredictions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-6 border border-gray-600 text-center"
          >
            <div className="bg-blue-500/20 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Lock className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Unlock {getMaxPicks() - 2} More Premium Predictions
            </h3>
            <p className="text-gray-400 mb-6">
              Get access to all {getMaxPicks()} AI-powered predictions with Pro subscription
            </p>
            <button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 rounded-lg font-semibold flex items-center space-x-2 mx-auto transition-colors">
              <Crown className="w-5 h-5" />
              <span>Upgrade to Pro</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* AI Disclaimer */}
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 mt-12">
          <div className="flex items-center space-x-2 text-gray-400">
            <Shield className="w-4 h-4" />
            <p className="text-sm">
              AI can make mistakes. Verify important info and bet responsibly. All predictions are for entertainment purposes only.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
