'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import TieredSubscriptionModal from '@/components/TieredSubscriptionModal'
import AIChatModal from '@/components/AIChatModal'
import EliteLockOfTheDay from '@/components/EliteLockOfTheDay'
import DailyProfessorInsights from '@/components/DailyProfessorInsights'
import PredictionsPreview from '@/components/PredictionsPreview'
import TrendsPreview from '@/components/TrendsPreview'
import LatestNewsFeed from '@/components/LatestNewsFeed'
import OnboardingFlow from '@/components/OnboardingFlow'
import WelcomeBonusBanner from '@/components/WelcomeBonusBanner'
import { useOnboarding } from '@/hooks/useOnboarding'
import { usePredictions } from '@/shared/hooks/usePredictions'
import { useAIChat } from '@/shared/hooks/useAIChat'
import { AIPrediction } from '@/shared/services/aiService'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Brain, 
  TrendingUp, 
  Target,
  Activity,
  Sparkles
} from 'lucide-react'

export default function Dashboard() {
  const { user, signOut, justSignedUp } = useAuth()
  const { subscriptionTier } = useSubscription()
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  
  // 🎯 ONBOARDING INTEGRATION
  const {
    needsOnboarding,
    isOnboardingOpen,
    closeOnboarding,
    completeOnboarding,
    forceOnboarding
  } = useOnboarding()

  // 🔥 MOBILE APP FUNCTIONALITY
  const {
    isLoading,
    isLoadingTeam,
    totalPredictions,
    highConfidencePicks,
    averageConfidence,
    teamPicks
  } = usePredictions()

  const {
    showAIChat,
    setShowAIChat
  } = useAIChat()

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/')
    }
  }, [user, router])

  // Fix hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <>
      {/* Debug Section - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
            <h3 className="text-red-400 font-semibold mb-2">🔧 DEBUG: Onboarding Status</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-300">Needs Onboarding: <span className={needsOnboarding ? 'text-green-400' : 'text-red-400'}>{needsOnboarding ? 'Yes' : 'No'}</span></p>
                <p className="text-gray-300">Modal Open: <span className={isOnboardingOpen ? 'text-green-400' : 'text-red-400'}>{isOnboardingOpen ? 'Yes' : 'No'}</span></p>
                <p className="text-gray-300">Just Signed Up: <span className={justSignedUp ? 'text-green-400' : 'text-red-400'}>{justSignedUp ? 'Yes' : 'No'}</span></p>
                <p className="text-gray-300">User ID: <span className="text-blue-400">{user?.id?.slice(0, 8)}...</span></p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={forceOnboarding}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm w-full"
                >
                  🚀 Force Onboarding
                </button>
                <button
                  onClick={() => {
                    console.log('🗑️ Clearing all flags and refreshing')
                    localStorage.clear()
                    window.location.reload()
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm w-full"
                >
                  🔄 Reset & Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome back, {user.user_metadata?.display_name || user.email}!
          </h1>
          <p className="text-xl text-gray-300">
            Ready to make some winning predictions? 🚀
          </p>
        </div>

        {/* 🔥 REAL AI STATS FROM MOBILE APP */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-blue-500/50 transition-all duration-300"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Today's Picks</h3>
                <p className="text-2xl font-bold text-blue-400">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-600 h-6 w-8 rounded"></div>
                  ) : (
                    totalPredictions
                  )}
                </p>
                <p className="text-xs text-gray-400">AI Generated</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-green-500/50 transition-all duration-300"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Avg Confidence</h3>
                <p className="text-2xl font-bold text-green-400">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-600 h-6 w-12 rounded"></div>
                  ) : (
                    `${averageConfidence.toFixed(1)}%`
                  )}
                </p>
                <p className="text-xs text-gray-400">AI Analysis</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-purple-500/50 transition-all duration-300"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">High Confidence</h3>
                <p className="text-2xl font-bold text-purple-400">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-600 h-6 w-8 rounded"></div>
                  ) : (
                    highConfidencePicks.length
                  )}
                </p>
                <p className="text-xs text-gray-400">80%+ Picks</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-yellow-500/50 transition-all duration-300"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Team Picks</h3>
                <p className="text-2xl font-bold text-yellow-400">
                  {isLoadingTeam ? (
                    <div className="animate-pulse bg-gray-600 h-6 w-8 rounded"></div>
                  ) : (
                    teamPicks.length
                  )}
                </p>
                <p className="text-xs text-gray-400">ML • Spreads • Totals</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Welcome Bonus Banner */}
        {subscriptionTier === 'free' && user && (
          <WelcomeBonusBanner userId={user.id} />
        )}

        {/* Subscription Prompt for Free Users (only if no welcome bonus) */}
        {subscriptionTier === 'free' && (
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-500/30 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  🚀 Unlock Premium Features
                </h3>
                <p className="text-gray-300">
                  Get unlimited AI predictions, expert insights, and exclusive picks!
                </p>
              </div>
              <button
                onClick={() => setSubscriptionModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        {/* 🔒 ELITE LOCK OF THE DAY */}
        {subscriptionTier === 'elite' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-8"
          >
            <EliteLockOfTheDay onPickPress={() => setShowAIChat(true)} />
          </motion.div>
        )}

        {/* ⚡ AI PREDICTIONS PREVIEW */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-8"
        >
          <PredictionsPreview limit={2} />
        </motion.div>

        {/* 📚 DAILY PROFESSOR INSIGHTS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-8"
        >
          <DailyProfessorInsights />
        </motion.div>

        {/* 📈 TRENDING NOW */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mb-8"
        >
          <TrendsPreview />
        </motion.div>

        {/* 📰 LATEST NEWS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mb-8"
        >
          <LatestNewsFeed limit={4} />
        </motion.div>

      </div>

      {/* Subscription Modal */}
      <TieredSubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onContinueFree={() => setSubscriptionModalOpen(false)}
      />

      {/* 🔥 AI Chat Modal (Professor Lock) */}
      <AIChatModal 
        isOpen={showAIChat}
        onClose={() => setShowAIChat(false)}
      />

      {/* 🎯 ONBOARDING FLOW */}
      <OnboardingFlow
        isOpen={isOnboardingOpen}
        onClose={closeOnboarding}
        onComplete={completeOnboarding}
      />
    </>
  )
}