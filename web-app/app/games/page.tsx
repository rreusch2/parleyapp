'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { motion } from 'framer-motion'
import { 
  Calendar, 
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Filter,
  Zap,
  Crown
} from 'lucide-react'

interface Game {
  id: string
  homeTeam: string
  awayTeam: string
  startTime: string
  status: 'upcoming' | 'live' | 'final'
  homeScore?: number
  awayScore?: number
  sport: 'MLB' | 'NBA' | 'NFL' | 'NHL'
  odds?: {
    homeML: string
    awayML: string
    spread: string
    total: string
  }
}

// Mock data - replace with real API calls
const mockGames: Game[] = [
  {
    id: '1',
    homeTeam: 'Yankees',
    awayTeam: 'Red Sox',
    startTime: '7:00 PM ET',
    status: 'upcoming',
    sport: 'MLB',
    odds: {
      homeML: '-120',
      awayML: '+110',
      spread: '-1.5',
      total: '8.5'
    }
  },
  {
    id: '2',
    homeTeam: 'Lakers',
    awayTeam: 'Warriors',
    startTime: '10:30 PM ET',
    status: 'live',
    homeScore: 89,
    awayScore: 92,
    sport: 'NBA',
    odds: {
      homeML: '+105',
      awayML: '-125',
      spread: '+2.5',
      total: '220.5'
    }
  }
]

export default function GamesPage() {
  const { user } = useAuth()
  const { subscriptionTier } = useSubscription()
  const [selectedSport, setSelectedSport] = useState<'All' | 'MLB' | 'NBA' | 'NFL' | 'NHL'>('All')
  const [games, setGames] = useState<Game[]>(mockGames)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }
    setMounted(true)
  }, [user, router])

  const sports = ['All', 'MLB', 'NBA', 'NFL', 'NHL']
  
  const filteredGames = selectedSport === 'All' 
    ? games 
    : games.filter(game => game.sport === selectedSport)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'text-green-400'
      case 'final': return 'text-gray-400'
      default: return 'text-blue-400'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'final': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
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
            <h1 className="text-4xl font-bold text-white mb-2">Live Games & Odds</h1>
            <p className="text-xl text-gray-300">
              Real-time scores, odds, and betting opportunities
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-2 bg-green-500/20 rounded-lg border border-green-500/30">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-sm font-medium">LIVE</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sport Filter */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mb-8"
      >
        <div className="flex items-center space-x-1 bg-white/5 backdrop-blur-sm rounded-lg p-1">
          {sports.map((sport) => (
            <button
              key={sport}
              onClick={() => setSelectedSport(sport as any)}
              className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                selectedSport === sport
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {sport}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Games Grid */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-white font-medium">Loading games...</span>
            </div>
          </div>
        ) : filteredGames.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center"
          >
            <Calendar className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              No {selectedSport === 'All' ? '' : selectedSport} games today
            </h3>
            <p className="text-gray-400">
              Check back later for upcoming games and live odds
            </p>
          </motion.div>
        ) : (
          filteredGames.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-blue-500/50 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                {/* Teams and Score */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                        {game.sport}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getStatusBadge(game.status)}`}>
                        {game.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{game.startTime}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Away Team */}
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-white">{game.awayTeam}</h3>
                      {game.status === 'live' && game.awayScore !== undefined && (
                        <p className="text-2xl font-bold text-blue-400">{game.awayScore}</p>
                      )}
                      <p className="text-sm text-gray-400">Away</p>
                    </div>
                    
                    {/* VS or Score */}
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-white">{game.homeTeam}</h3>
                      {game.status === 'live' && game.homeScore !== undefined && (
                        <p className="text-2xl font-bold text-blue-400">{game.homeScore}</p>
                      )}
                      <p className="text-sm text-gray-400">Home</p>
                    </div>
                  </div>
                </div>

                {/* Odds */}
                {game.odds && (
                  <div className="ml-8 bg-black/20 rounded-lg p-4 min-w-[200px]">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Betting Odds</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">Moneyline</span>
                        <div className="flex space-x-2">
                          <span className="text-sm text-white">{game.odds.awayML}</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-sm text-white">{game.odds.homeML}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">Spread</span>
                        <span className="text-sm text-white">{game.odds.spread}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">Total</span>
                        <span className="text-sm text-white">{game.odds.total}</span>
                      </div>
                    </div>
                    
                    {subscriptionTier !== 'free' && (
                      <button className="w-full mt-3 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
                        Get AI Analysis
                      </button>
                    )}
                    
                    {subscriptionTier === 'free' && (
                      <div className="mt-3 p-2 bg-gray-600/20 rounded-lg border border-gray-600/30 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Crown className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs text-gray-400">Pro Feature</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Coming Soon Notice */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-8 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-500/30"
      >
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            🚀 Enhanced Live Games Coming Soon
          </h3>
          <p className="text-gray-300">
            Real-time odds tracking, live score updates, and AI-powered betting recommendations
          </p>
        </div>
      </motion.div>
    </div>
  )
}