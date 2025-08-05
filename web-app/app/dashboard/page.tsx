'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import TieredSubscriptionModal from '@/components/TieredSubscriptionModal'
import { 
  Brain, 
  TrendingUp, 
  Trophy, 
  Star,
  Bell,
  Settings,
  LogOut,
  Crown
} from 'lucide-react'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { subscriptionTier } = useSubscription()
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const router = useRouter()

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/')
    }
  }, [user, router])

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">
                Predictive Play
              </span>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {/* Subscription Badge */}
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                subscriptionTier === 'elite' 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : subscriptionTier === 'pro'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-600 text-white'
              }`}>
                {subscriptionTier === 'elite' && <Crown className="w-4 h-4 inline mr-1" />}
                {subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)}
              </div>

              {/* Notifications */}
              <button className="text-gray-300 hover:text-white transition-colors">
                <Bell className="w-6 h-6" />
              </button>

              {/* Settings */}
              <button className="text-gray-300 hover:text-white transition-colors">
                <Settings className="w-6 h-6" />
              </button>

              {/* Sign Out */}
              <button 
                onClick={handleSignOut}
                className="text-gray-300 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome back, {user.user_metadata?.display_name || user.email}!
          </h1>
          <p className="text-xl text-gray-300">
            Ready to make some winning predictions? 🚀
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Today's Picks</h3>
                <p className="text-gray-300">Coming soon...</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Win Rate</h3>
                <p className="text-gray-300">Coming soon...</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">AI Score</h3>
                <p className="text-gray-300">Coming soon...</p>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Prompt for Free Users */}
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

        {/* Placeholder Content */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center">
          <Brain className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">
            Dashboard Under Construction
          </h2>
          <p className="text-gray-300 mb-6">
            This is your clean, fresh dashboard foundation. Ready to build something amazing!
          </p>
          <div className="text-sm text-gray-400">
            <p>✅ Landing page working</p>
            <p>✅ Authentication working</p>
            <p>✅ Subscription system ready</p>
            <p>🔄 Now ready to integrate with your backend and AI predictions!</p>
          </div>
        </div>
      </main>

      {/* Subscription Modal */}
      <TieredSubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onContinueFree={() => setSubscriptionModalOpen(false)}
      />
    </div>
  )
}