'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import TieredSubscriptionModal from '@/components/TieredSubscriptionModal'
import AIChatModal from '@/components/AIChatModal'
import LockOfTheDay from '@/components/LockOfTheDay'
import DailyProfessorInsights from '@/components/DailyProfessorInsights'
import TierEnhancedUI, { TierGatedContent, NoUpgradePrompts, TierButton } from '@/components/TierEnhancedUI'
import PredictionsPreview from '@/components/PredictionsPreview'
import TrendsPreview from '@/components/TrendsPreview'
import LatestNewsFeed from '@/components/LatestNewsFeed'
import OnboardingFlow from '@/components/OnboardingFlow'
import WelcomeBonusBanner from '@/components/WelcomeBonusBanner'
import { useOnboarding } from '@/hooks/useOnboarding'
import { usePredictions } from '@/shared/hooks/usePredictions'
import { useAIChat } from '@/shared/hooks/useAIChat'
import { AIPrediction } from '@/shared/services/aiService'
import { 
  getTierCapabilities, 
  getDisplayPicksCount, 
  getTierStyling, 
  isInWelcomeBonusPeriod 
} from '@/lib/subscriptionUtils'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Brain, 
  TrendingUp, 
  Target,
  Activity,
  Sparkles
} from 'lucide-react'

export default function Dashboard() {
  const { user, signOut, justSignedUp, profile } = useAuth()
  const { subscriptionTier } = useSubscription()
  
  // Get tier-based capabilities and styling
  const tierCapabilities = getTierCapabilities(subscriptionTier as any)
  const tierStyling = getTierStyling(subscriptionTier as any)
  const isWelcomeBonus = profile ? isInWelcomeBonusPeriod(
    profile.welcome_bonus_claimed || false,
    profile.welcome_bonus_expires_at || null
  ) : false
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
  } = usePredictions({
    subscriptionTier: subscriptionTier as any,
    welcomeBonusClaimed: profile?.welcome_bonus_claimed || true,
    welcomeBonusExpiresAt: profile?.welcome_bonus_expires_at || null
  })

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
    <TierEnhancedUI>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Welcome Section with tier-based styling */}
        <div className={`mb-8 p-6 rounded-xl ${
          subscriptionTier === 'elite' ? 'bg-gradient-to-r from-yellow-900/20 to-amber-900/20 border border-yellow-500/30' :
          subscriptionTier === 'pro' ? 'bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30' :
          'bg-gray-800/30 border border-gray-700/30'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-4xl font-bold text-white">
                  Welcome back, {user.user_metadata?.display_name || user.email}!
                </h1>
                <TierGatedContent requiredTier="pro">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    subscriptionTier === 'elite' ? 'bg-gradient-to-r from-yellow-600 to-amber-600 text-black' :
                    'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                  }`}>
                    {subscriptionTier.toUpperCase()} ✨
                  </div>
                </TierGatedContent>
              </div>
              <p className={`text-xl ${
                subscriptionTier === 'elite' ? 'text-yellow-300' :
                subscriptionTier === 'pro' ? 'text-purple-300' :
                'text-gray-300'
              }`}>
                {subscriptionTier === 'elite' ? 'Elite AI-powered insights with premium analytics 🏆' :
                 subscriptionTier === 'pro' ? 'Professional AI-powered betting insights 🚀' :
                 'Ready to make some winning predictions? 🚀'}
              </p>
            </div>
            <NoUpgradePrompts>
              <TierButton 
                onClick={() => setSubscriptionModalOpen(true)}
                className="text-sm"
              >
                Upgrade Now
              </TierButton>
            </NoUpgradePrompts>
          </div>
        </div>

        {/* Enhanced AI Stats with tier-based styling */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className={`backdrop-blur-sm rounded-xl p-6 border transition-all duration-300 ${
              subscriptionTier === 'elite' ? 'bg-gradient-to-br from-yellow-900/10 to-amber-900/10 border-yellow-500/30 hover:border-yellow-400/60' :
              subscriptionTier === 'pro' ? 'bg-gradient-to-br from-purple-900/10 to-blue-900/10 border-purple-500/30 hover:border-purple-400/60' :
              'bg-white/5 border-white/10 hover:border-blue-500/50'
            }`}
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
                    getDisplayPicksCount(
                      subscriptionTier as any,
                      profile?.welcome_bonus_claimed || false,
                      profile?.welcome_bonus_expires_at || null
                    )
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
        {subscriptionTier === 'elite' && user && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-8"
          >
            <LockOfTheDay userId={user.id} />
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
    </TierEnhancedUI>

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