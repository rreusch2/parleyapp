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
  Plus
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import TieredSubscriptionModal from '@/components/TieredSubscriptionModal'
import PreferencesModal from '@/components/PreferencesModal'

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
}

interface UserStats {
  todayPicks: number
  winRate: string
  roi: string
  streak: number
  totalBets: number
  profitLoss: string
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const { isPro, isElite, subscriptionTier, hasWelcomeBonus } = useSubscription()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)
  const [todaysPicks, setTodaysPicks] = useState<AIPrediction[]>([])
  const [userStats, setUserStats] = useState<UserStats>({
    todayPicks: 0,
    winRate: '0%',
    roi: '0%',
    streak: 0,
    totalBets: 0,
    profitLoss: '$0'
  })

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/')
    }
  }, [user, router])

  // Trigger onboarding preferences modal if user has no preferences
  useEffect(() => {
    if (profile && (!profile.preferred_sports || profile.preferred_sports.length === 0)) {
      setShowPreferencesModal(true)
    }
  }, [profile])

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user, isPro, isElite])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Simulate API calls - in production, these would be real API endpoints
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data based on subscription tier
      const mockPicks: AIPrediction[] = []
      const pickCount = isElite ? 4 : isPro ? 3 : hasWelcomeBonus ? 5 : 2
      
      for (let i = 0; i < pickCount; i++) {
        mockPicks.push({
          id: `pick-${i}`,
          match: i === 0 ? 'Lakers vs Warriors' : i === 1 ? 'Yankees vs Red Sox' : i === 2 ? 'Chiefs vs Bills' : 'Dodgers vs Giants',
          sport: i === 0 ? 'NBA' : i === 1 ? 'MLB' : i === 2 ? 'NFL' : 'MLB',
          eventTime: new Date(Date.now() + i * 3600000).toISOString(),
          pick: i === 0 ? 'Lakers -3.5' : i === 1 ? 'Yankees ML' : i === 2 ? 'Over 47.5' : 'Under 8.5',
          odds: i === 0 ? '-110' : i === 1 ? '+125' : i === 2 ? '-105' : '+115',
          confidence: 75 + (i * 5),
          reasoning: `Advanced AI analysis shows strong value in this ${i === 0 ? 'spread' : i === 1 ? 'moneyline' : 'total'} bet based on recent performance metrics and injury reports.`,
          value: 12 + (i * 3)
        })
      }
      
      setTodaysPicks(mockPicks)
      
      // Mock user stats
      setUserStats({
        todayPicks: pickCount,
        winRate: isPro ? '73%' : '67%',
        roi: isPro ? (isElite ? '+28.5%' : '+23.8%') : '+15.2%',
        streak: 4,
        totalBets: 127,
        profitLoss: '+$2,431'
      })
      
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
  }

  const openUpgradeModal = () => {
    setSubscriptionModalOpen(true)
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
        <p className="text-gray-300 text-lg ml-4">Loading your dashboard...</p>
      </div>
    )
  }

  const getHeaderGradient = () => {
    if (isElite) return 'from-purple-600 via-pink-500 to-yellow-500'
    if (isPro) return 'from-blue-700 via-purple-700 to-gray-900'
    return 'from-gray-800 via-gray-700 to-gray-900'
  }

  const getTierDisplay = () => {
    if (isElite) return 'Elite Dashboard'
    if (isPro) return 'Pro Dashboard' 
    return 'Predictive Play'
  }

  const getPicksTitle = () => {
    if (isElite) return 'Elite AI Predictions'
    if (isPro) return 'Pro AI Predictions'
    return 'Your Daily Picks'
  }

  const getMaxPicks = () => {
    if (isElite) return 30
    if (isPro) return 20
    return 2
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className={`bg-gradient-to-r ${getHeaderGradient()} relative overflow-hidden`}>
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
          </div>

          {/* Tier Badge */}
          {isElite ? (
            <div className="absolute top-6 right-6 flex items-center space-x-2 bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-500/30">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-sm tracking-wider">ELITE</span>
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </div>
          ) : isPro ? (
            <div className="absolute top-6 right-6 flex items-center space-x-2 bg-blue-500/20 px-4 py-2 rounded-full border border-blue-500/30">
              <Crown className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-bold text-sm tracking-wider">PRO</span>
            </div>
          ) : null}

          <div className="relative z-10 px-6 py-12">
            {/* Welcome Section */}
            <div className="text-center mb-12">
              <div className="flex items-center justify-center space-x-4 mb-6">
                {!isElite && <Brain className="w-8 h-8 text-blue-400" />}
                <div>
                  <p className="text-gray-300 text-lg font-medium">Welcome back!</p>
                  <h1 className="text-4xl font-bold text-white mt-2">{getTierDisplay()}</h1>
                </div>
                <Sparkles className={`w-6 h-6 ${isElite ? 'text-yellow-400' : 'text-blue-400'}`} />
              </div>
            </div>

            {/* Stats Container */}
            <div className={`${
              isElite 
                ? 'bg-yellow-500/10 border-yellow-500/20 shadow-yellow-500/20' 
                : 'bg-blue-500/10 border-blue-500/20'
            } border-2 rounded-3xl p-8 backdrop-blur-sm shadow-2xl`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Win Rate */}
                <div className="text-center relative">
                  <div className="bg-white/10 p-4 rounded-2xl mb-4 inline-block">
                    <Trophy className={`w-6 h-6 ${isPro ? 'text-green-400' : 'text-gray-400'}`} />
                  </div>
                  <div className="text-3xl font-bold text-white mb-2">
                    {isPro ? userStats.winRate : '?'}
                  </div>
                  <div className={`text-sm font-medium ${isElite ? 'text-yellow-400' : 'text-gray-300'}`}>
                    Win Rate
                  </div>
                  {!isPro && (
                    <div className="absolute inset-0 bg-gray-900/80 rounded-2xl flex items-center justify-center">
                      <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Daily Picks - Center/Highlighted */}
                <div className={`text-center ${
                  isElite 
                    ? 'bg-yellow-500/20 border border-yellow-500/30' 
                    : 'bg-blue-500/20 border border-blue-500/30'
                } rounded-2xl p-6 relative`}>
                  <div className={`${
                    isElite ? 'bg-yellow-500/30' : 'bg-blue-500/30'
                  } p-4 rounded-2xl mb-4 inline-block`}>
                    <Target className={`w-7 h-7 ${isElite ? 'text-yellow-400' : 'text-blue-400'}`} />
                  </div>
                  <div className={`text-4xl font-bold mb-2 ${isElite ? 'text-yellow-400' : 'text-blue-400'}`}>
                    {getMaxPicks()}
                  </div>
                  <div className={`text-sm font-semibold ${
                    isElite ? 'text-yellow-400' : 'text-blue-400'
                  }`}>
                    {isElite ? 'Elite Picks' : isPro ? 'Pro Picks' : 'Daily Picks'}
                  </div>
                  {(hasWelcomeBonus && !isPro) && (
                    <div className="absolute -top-2 -right-2 bg-blue-500/20 p-2 rounded-full">
                      <span className="text-lg">🎁</span>
                    </div>
                  )}
                </div>

                {/* ROI */}
                <div className="text-center relative">
                  <div className="bg-white/10 p-4 rounded-2xl mb-4 inline-block">
                    <TrendingUp className={`w-6 h-6 ${isPro ? 'text-green-400' : 'text-gray-400'}`} />
                  </div>
                  <div className={`text-3xl font-bold mb-2 ${
                    isPro ? (isElite ? 'text-yellow-400' : 'text-green-400') : 'text-gray-400'
                  }`}>
                    {isPro ? userStats.roi : '?'}
                  </div>
                  <div className={`text-sm font-medium ${isElite ? 'text-yellow-400' : 'text-gray-300'}`}>
                    ROI
                  </div>
                  {!isPro && (
                    <div className="absolute inset-0 bg-gray-900/80 rounded-2xl flex items-center justify-center">
                      <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Upgrade Prompt for Free Users */}
            {!isElite && !isPro && (
              <motion.button
                onClick={openUpgradeModal}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 via-pink-500 to-yellow-500 rounded-2xl p-4 flex items-center justify-between hover:scale-105 transition-transform"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center space-x-3">
                  <Crown className="w-6 h-6 text-white" />
                  <div className="text-left">
                    <div className="text-white font-bold text-lg">Unlock Elite Features</div>
                    <div className="text-white/90 text-sm">Lock of the Day & Premium Analytics</div>
                  </div>
                </div>
                <Sparkles className="w-6 h-6 text-white" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 py-8 space-y-8">
          {/* Elite Lock of the Day - Only for Elite users */}
          {isElite && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-2xl p-6 border border-yellow-500/30"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-yellow-500/20 p-3 rounded-full">
                  <Crown className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-yellow-400">🔒 Elite Lock of the Day</h3>
                  <p className="text-yellow-300/80 text-sm">Highest confidence pick with premium analysis</p>
                </div>
              </div>
              
              <div className="bg-black/30 rounded-xl p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="text-white font-semibold text-lg">Lakers vs Warriors</h4>
                    <p className="text-gray-300">NBA • Tonight 8:00 PM</p>
                  </div>
                  <div className="text-right">
                    <div className="text-yellow-400 font-bold text-2xl">92%</div>
                    <div className="text-yellow-300 text-sm">Confidence</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-gray-400 text-sm">Pick</div>
                    <div className="text-white font-semibold">Lakers -3.5</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Odds</div>
                    <div className="text-white font-semibold">-110</div>
                  </div>
                </div>
                
                <div className="bg-yellow-500/10 rounded-lg p-3 mb-4">
                  <div className="text-yellow-400 text-sm font-medium mb-1">AI Reasoning</div>
                  <div className="text-gray-300 text-sm">Lakers have covered the spread in 8 of their last 10 home games. Warriors are on back-to-back games with key injuries to Curry and Thompson.</div>
                </div>
                
                <button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-semibold py-3 rounded-lg hover:from-yellow-400 hover:to-orange-400 transition-colors">
                  View Full Analysis
                </button>
              </div>
            </motion.div>
          )}

          {/* AI Picks Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className={`text-2xl font-bold ${isElite ? 'text-yellow-400' : 'text-white'}`}>
                {getPicksTitle()}
              </h2>
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-blue-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="text-blue-400 font-medium">Refresh</span>
              </button>
            </div>

            {todaysPicks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 rounded-2xl p-8 text-center border border-gray-700"
              >
                <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No picks yet today</h3>
                <p className="text-gray-400 mb-6">Generate your AI-powered picks to get started</p>
                <button 
                  onClick={onRefresh}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 mx-auto"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Picks</span>
                </button>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {todaysPicks.map((pick, index) => (
                  <motion.div
                    key={pick.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 hover:border-blue-500/50 transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="bg-blue-500/20 px-3 py-1 rounded-full">
                            <span className="text-blue-400 font-medium text-sm">{pick.sport}</span>
                          </div>
                          <div className={`px-3 py-1 rounded-full ${
                            pick.confidence >= 85 ? 'bg-green-500/20 text-green-400' : 
                            pick.confidence >= 70 ? 'bg-blue-500/20 text-blue-400' : 
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            <span className="font-semibold text-sm">{pick.confidence}% Confidence</span>
                          </div>
                        </div>
                        <h4 className="text-white font-semibold text-lg mb-1">{pick.match}</h4>
                        <p className="text-gray-400 text-sm">{new Date(pick.eventTime).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-blue-400 font-bold text-lg">{pick.pick}</div>
                        <div className="text-gray-300 text-sm">{pick.odds}</div>
                        {pick.value && (
                          <div className="text-green-400 text-sm font-medium">+{pick.value}% Value</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                      <h5 className="text-blue-400 font-medium text-sm mb-2">AI Analysis</h5>
                      <p className="text-gray-300 text-sm">{pick.reasoning}</p>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2">
                        <MessageCircle className="w-4 h-4" />
                        <span>Analyze with AI</span>
                      </button>
                      {isPro && (
                        <button className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
                          Track Bet
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Upgrade Card for Free Users */}
                {!isPro && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: todaysPicks.length * 0.1 }}
                    className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-6 border border-gray-600"
                  >
                    <div className="text-center">
                      <div className="bg-blue-500/20 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Lock className="w-8 h-8 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {getMaxPicks() - todaysPicks.length} More Premium Picks Available
                      </h3>
                      <p className="text-gray-400 mb-2">Pro Feature • {getMaxPicks()} Total Picks</p>
                      <p className="text-gray-300 text-sm mb-6">
                        Unlock all {getMaxPicks()} daily AI-powered predictions with advanced analytics, 
                        Kelly Criterion calculations, and detailed multi-source reasoning.
                      </p>
                      <button 
                        onClick={openUpgradeModal}
                        className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 rounded-lg font-semibold flex items-center space-x-2 mx-auto transition-colors"
                      >
                        <Crown className="w-5 h-5" />
                        <span>Upgrade to Pro</span>
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* View All Button for Pro Users */}
                {isPro && (
                  <motion.button
                    onClick={() => router.push('/predictions')}
                    className={`w-full bg-gradient-to-r ${
                      isElite 
                        ? 'from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black' 
                        : 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                    } py-4 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-colors`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isElite ? <Trophy className="w-5 h-5" /> : <Brain className="w-5 h-5" />}
                    <span>View All {getMaxPicks()} Picks</span>
                    <ChevronRight className="w-5 h-5" />
                  </motion.button>
                )}
              </div>
            )}
          </div>

          {/* Additional Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
            {/* Latest News */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-bold text-white">Latest News</h3>
                  <div className="flex items-center space-x-1 bg-blue-500/20 px-2 py-1 rounded-full">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    <span className="text-blue-400 text-xs font-medium">LIVE</span>
                  </div>
                </div>
                <button className="text-blue-400 text-sm font-medium flex items-center space-x-1">
                  <span>View All</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="bg-gray-900/50 rounded-lg p-4 hover:bg-gray-900/70 transition-colors cursor-pointer">
                    <div className="flex items-start space-x-3">
                      <div className="bg-blue-500/20 p-2 rounded-lg">
                        <Activity className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-medium text-sm mb-1">
                          {item === 1 ? 'LeBron James injury update affects Lakers odds' : 
                           item === 2 ? 'Yankees acquire star pitcher in trade' : 
                           'Chiefs release injury report ahead of playoff game'}
                        </h4>
                        <p className="text-gray-400 text-xs">
                          {item === 1 ? '2 minutes ago' : item === 2 ? '15 minutes ago' : '1 hour ago'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!isPro && (
                <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600">
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-2">Premium News Access</div>
                    <div className="text-blue-400 text-xs mb-3">Pro Feature • Real-time Updates</div>
                    <button 
                      onClick={openUpgradeModal}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Injury Reports */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Injury Reports</h3>
                <button className="text-blue-400 text-sm font-medium flex items-center space-x-1">
                  <span>View All</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="bg-gray-900/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <span className="text-blue-400 text-xs font-bold">
                            {item === 1 ? 'LJ' : item === 2 ? 'SC' : 'PM'}
                          </span>
                        </div>
                        <div>
                          <div className="text-white font-medium text-sm">
                            {item === 1 ? 'LeBron James' : item === 2 ? 'Stephen Curry' : 'Patrick Mahomes'}
                          </div>
                          <div className="text-gray-400 text-xs">
                            {item === 1 ? 'Lakers' : item === 2 ? 'Warriors' : 'Chiefs'}
                          </div>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item === 1 ? 'bg-yellow-500/20 text-yellow-400' : 
                        item === 2 ? 'bg-red-500/20 text-red-400' : 
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {item === 1 ? 'Questionable' : item === 2 ? 'Out' : 'Probable'}
                      </div>
                    </div>
                    <p className="text-gray-300 text-xs">
                      {item === 1 ? 'Left ankle soreness, game-time decision' : 
                       item === 2 ? 'Shoulder injury, expected to miss 2-3 games' : 
                       'Right knee maintenance, likely to play'}
                    </p>
                  </div>
                ))}
              </div>

              {!isPro && (
                <div className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600">
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-2">Premium Injury Reports</div>
                    <div className="text-blue-400 text-xs mb-3">Pro Feature • Real-time Updates</div>
                    <button 
                      onClick={openUpgradeModal}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* AI Disclaimer */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 mt-12">
            <div className="flex items-center space-x-2 text-gray-400">
              <Shield className="w-4 h-4" />
              <p className="text-sm">
                AI can make mistakes. Verify important info and bet responsibly.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Modal */}
      <PreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        onComplete={() => {
          setShowPreferencesModal(false)
          setSubscriptionModalOpen(true)
        }}
      />
      <TieredSubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onContinueFree={() => {/* TODO: open WelcomeWheel component */}}
      />
    </div>
  )
}
