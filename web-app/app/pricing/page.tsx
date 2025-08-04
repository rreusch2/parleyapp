'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Crown, Sparkles, Check, Star } from 'lucide-react'
import TieredSubscriptionModal from '../../components/TieredSubscriptionModal'

export default function PricingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTier, setSelectedTier] = useState<'pro' | 'elite'>('pro')

  const openModal = (tier: 'pro' | 'elite') => {
    setSelectedTier(tier)
    setIsModalOpen(true)
  }

  const features = {
    pro: [
      '20 Daily AI Picks',
      '8 Daily Insights',
      'Unlimited Chat',
      'Daily AI Predictions',
      'Professor Lock Chat'
    ],
    elite: [
      '30 Daily AI Picks',
      '12 Daily Insights',
      'Advanced Professor Lock',
      'Premium Analytics',
      '🔒 Lock of the Day',
      'Elite Exclusive Features'
    ]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold text-white mb-6"
          >
            Choose Your Plan
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-300 max-w-2xl mx-auto"
          >
            Join thousands of winning bettors using AI-powered predictions
          </motion.p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {/* Pro Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 hover:border-blue-500 transition-all duration-300"
          >
            {/* Most Popular Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <div className="bg-amber-500 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center">
                <Star size={16} className="mr-1" />
                MOST POPULAR
              </div>
            </div>

            <div className="text-center mb-8">
              <Crown size={48} className="text-blue-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
              <p className="text-slate-400">Perfect for serious bettors</p>
            </div>

            <div className="space-y-4 mb-8">
              {features.pro.map((feature, index) => (
                <div key={index} className="flex items-center text-slate-300">
                  <Check size={20} className="text-green-400 mr-3 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>

            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-white mb-2">
                Starting at $9.99
              </div>
              <div className="text-slate-400">per week</div>
            </div>

            <button
              onClick={() => openModal('pro')}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              Choose Pro Plan
            </button>
          </motion.div>

          {/* Elite Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative bg-gradient-to-br from-purple-900/50 to-slate-900 rounded-2xl p-8 border border-purple-500 hover:border-purple-400 transition-all duration-300"
          >
            {/* Premium Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <div className="bg-purple-500 text-white text-sm font-bold px-4 py-2 rounded-full flex items-center">
                <Sparkles size={16} className="mr-1" />
                PREMIUM
              </div>
            </div>

            <div className="text-center mb-8">
              <Sparkles size={48} className="text-purple-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Elite</h3>
              <p className="text-slate-400">Ultimate betting experience</p>
            </div>

            <div className="space-y-4 mb-8">
              {features.elite.map((feature, index) => (
                <div key={index} className="flex items-center text-slate-300">
                  <Check size={20} className="text-green-400 mr-3 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>

            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-white mb-2">
                Starting at $14.99
              </div>
              <div className="text-slate-400">per week</div>
            </div>

            <button
              onClick={() => openModal('elite')}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              Choose Elite Plan
            </button>
          </motion.div>
        </div>

        {/* Features Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Why Choose Predictive Play?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown size={32} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">AI-Powered Predictions</h3>
              <p className="text-slate-400">Advanced machine learning algorithms analyze thousands of data points</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles size={32} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Expert Insights</h3>
              <p className="text-slate-400">Get daily insights from our AI Professor with years of betting expertise</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Proven Results</h3>
              <p className="text-slate-400">Join thousands of winning bettors who trust our predictions</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Subscription Modal */}
      <TieredSubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userId="demo-user-id" // Replace with actual user ID from auth
        defaultTier={selectedTier}
        isSignup={false}
      />
    </div>
  )
}