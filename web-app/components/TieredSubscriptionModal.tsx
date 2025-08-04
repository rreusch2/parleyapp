'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Crown, 
  Trophy, 
  Check, 
  Star, 
  Sparkles, 
  Infinity,
  Gift,
  Zap,
  Shield,
  Target
} from 'lucide-react'
import { SUBSCRIPTION_PLANS, createCheckoutSession, redirectToCheckout, getCheckoutMode } from '../lib/stripe'
import { toast } from 'react-hot-toast'

interface TieredSubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  userId?: string
  defaultTier?: 'pro' | 'elite'
  isSignup?: boolean
}

type SubscriptionTier = 'pro' | 'elite'
type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS

const TieredSubscriptionModal: React.FC<TieredSubscriptionModalProps> = ({
  isOpen,
  onClose,
  userId,
  defaultTier = 'pro',
  isSignup = false
}) => {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(defaultTier)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('PRO_LIFETIME')
  const [loading, setLoading] = useState(false)

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTier(defaultTier)
      if (defaultTier === 'pro') {
        setSelectedPlan('PRO_LIFETIME' as SubscriptionPlan)
      } else {
        setSelectedPlan('ELITE_YEARLY' as SubscriptionPlan)
      }
    }
  }, [isOpen, defaultTier])

  const handleTierSelection = (tier: SubscriptionTier) => {
    setSelectedTier(tier)
    // Set default plan for selected tier
    if (tier === 'pro') {
      setSelectedPlan('PRO_LIFETIME' as SubscriptionPlan)
    } else {
      setSelectedPlan('ELITE_YEARLY' as SubscriptionPlan)
    }
  }

  const handlePlanSelection = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan)
    // Update tier based on plan
    const planData = SUBSCRIPTION_PLANS[plan]
    if (planData.tier === 'pro') {
      setSelectedTier('pro')
    } else {
      setSelectedTier('elite')
    }
  }

  const handleSubscribe = async () => {
    if (!userId) {
      toast.error('Please sign in to subscribe')
      return
    }

    try {
      setLoading(true)
      const planData = SUBSCRIPTION_PLANS[selectedPlan]
      const checkoutMode = getCheckoutMode(selectedPlan)
      
      // Create checkout session with correct mode
      const sessionId = await createCheckoutSession(planData.stripePriceId, userId, checkoutMode)
      
      // Redirect to Stripe Checkout
      await redirectToCheckout(sessionId)
      
    } catch (error: any) {
      console.error('Subscription error:', error)
      toast.error(error.message || 'Failed to start checkout process')
    } finally {
      setLoading(false)
    }
  }

  const getCurrentTierPlans = (): SubscriptionPlan[] => {
    return Object.keys(SUBSCRIPTION_PLANS).filter(key => 
      SUBSCRIPTION_PLANS[key as SubscriptionPlan].tier === selectedTier
    ) as SubscriptionPlan[]
  }

  const getOriginalPrice = (price: number): number => {
    return price * 2 // Assuming 50% off promotion
  }

  const renderTierComparison = () => (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-white text-center mb-6">
        🚀 {isSignup ? 'Welcome to Predictive Play!' : 'Upgrade Your Plan'}
      </h2>
      
      {/* Tier Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Pro Tier */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative cursor-pointer rounded-2xl overflow-hidden ${
            selectedTier === 'pro' ? 'ring-2 ring-blue-400' : ''
          }`}
          onClick={() => handleTierSelection('pro')}
        >
          <div className={`p-6 text-center relative ${
            selectedTier === 'pro' 
              ? 'bg-gradient-to-br from-blue-600 to-blue-800' 
              : 'bg-gradient-to-br from-slate-700 to-slate-800'
          }`}>
            {/* Most Popular Badge */}
            <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center">
              <Star size={10} className="mr-1" />
              MOST POPULAR
            </div>
            
            <Crown size={32} className={`mx-auto mb-3 ${
              selectedTier === 'pro' ? 'text-white' : 'text-slate-400'
            }`} />
            <h3 className={`text-xl font-bold mb-2 ${
              selectedTier === 'pro' ? 'text-white' : 'text-slate-300'
            }`}>
              Pro
            </h3>
            <p className={`text-sm mb-4 ${
              selectedTier === 'pro' ? 'text-blue-100' : 'text-slate-400'
            }`}>
              Perfect for serious bettors
            </p>
            
            <div className="space-y-2 text-sm">
              <div className={selectedTier === 'pro' ? 'text-blue-100' : 'text-slate-400'}>
                • 20 Daily AI Picks
              </div>
              <div className={selectedTier === 'pro' ? 'text-blue-100' : 'text-slate-400'}>
                • 8 Daily Insights
              </div>
              <div className={selectedTier === 'pro' ? 'text-blue-100' : 'text-slate-400'}>
                • Unlimited Chat
              </div>
              <div className={selectedTier === 'pro' ? 'text-blue-100' : 'text-slate-400'}>
                • Daily AI Predictions
              </div>
            </div>
            
            {selectedTier === 'pro' && (
              <div className="absolute top-2 left-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <Check size={16} className="text-blue-600" />
              </div>
            )}
          </div>
        </motion.div>

        {/* Elite Tier */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative cursor-pointer rounded-2xl overflow-hidden ${
            selectedTier === 'elite' ? 'ring-2 ring-purple-400' : ''
          }`}
          onClick={() => handleTierSelection('elite')}
        >
          <div className={`p-6 text-center relative ${
            selectedTier === 'elite' 
              ? 'bg-gradient-to-br from-purple-600 to-purple-800' 
              : 'bg-gradient-to-br from-slate-700 to-slate-800'
          }`}>
            {/* Premium Badge */}
            <div className="absolute top-2 right-2 bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center">
              <Sparkles size={10} className="mr-1" />
              PREMIUM
            </div>
            
            <Trophy size={32} className={`mx-auto mb-3 ${
              selectedTier === 'elite' ? 'text-white' : 'text-slate-400'
            }`} />
            <h3 className={`text-xl font-bold mb-2 ${
              selectedTier === 'elite' ? 'text-white' : 'text-slate-300'
            }`}>
              Elite
            </h3>
            <p className={`text-sm mb-4 ${
              selectedTier === 'elite' ? 'text-purple-100' : 'text-slate-400'
            }`}>
              Ultimate betting experience
            </p>
            
            <div className="space-y-2 text-sm">
              <div className={selectedTier === 'elite' ? 'text-purple-100' : 'text-slate-400'}>
                • 30 Daily AI Picks
              </div>
              <div className={selectedTier === 'elite' ? 'text-purple-100' : 'text-slate-400'}>
                • 12 Daily Insights
              </div>
              <div className={selectedTier === 'elite' ? 'text-purple-100' : 'text-slate-400'}>
                • Advanced Professor Lock
              </div>
              <div className={selectedTier === 'elite' ? 'text-purple-100' : 'text-slate-400'}>
                • Premium Analytics
              </div>
              <div className={selectedTier === 'elite' ? 'text-purple-100' : 'text-slate-400'}>
                • 🔒 Lock of the Day
              </div>
            </div>
            
            {selectedTier === 'elite' && (
              <div className="absolute top-2 left-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <Check size={16} className="text-purple-600" />
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )

  const renderPlanOptions = () => {
    const currentPlans = getCurrentTierPlans()
    
    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white text-center mb-4">
          Select Billing Period
        </h3>
        
        <div className="space-y-3">
          {currentPlans.map((planKey) => {
            const plan = SUBSCRIPTION_PLANS[planKey]
            const isSelected = selectedPlan === planKey
            const originalPrice = getOriginalPrice(plan.price)
            
            return (
              <motion.div
                key={planKey}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`relative cursor-pointer rounded-xl overflow-hidden ${
                  isSelected ? 'ring-2 ring-blue-400' : ''
                }`}
                onClick={() => handlePlanSelection(planKey)}
              >
                <div className={`p-4 relative ${
                  isSelected 
                    ? (selectedTier === 'pro' 
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700' 
                        : 'bg-gradient-to-r from-purple-600 to-purple-700')
                    : 'bg-gradient-to-r from-slate-700 to-slate-800'
                }`}>
                  {/* Savings Badge */}
                  {plan.savings && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                      {plan.savings}
                    </div>
                  )}
                  
                  {/* Trial Badge */}
                  {plan.trial && (
                    <div className={`absolute top-2 left-2 flex items-center px-2 py-1 rounded text-xs font-bold ${
                      isSelected 
                        ? 'bg-white/20 text-white border border-white/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      <Gift size={10} className="mr-1" />
                      3-DAY FREE
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {plan.interval === 'lifetime' && (
                        <Infinity size={20} className="text-amber-400 mr-2" />
                      )}
                      <div>
                        <h4 className="font-semibold text-white">{plan.name}</h4>
                        <div className="flex items-center space-x-2">
                          {/* Original Price with Strikethrough */}
                          <span className="text-sm text-slate-300 line-through">
                            ${originalPrice.toFixed(2)}
                          </span>
                          <span className="bg-red-500 text-white text-xs px-1 py-0.5 rounded">
                            50% OFF
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        ${plan.price}
                      </div>
                      <div className="text-sm text-slate-300">
                        per {plan.interval === 'lifetime' ? 'one time' : plan.interval}
                      </div>
                      {plan.trial && (
                        <div className="text-xs text-blue-200 mt-1">
                          {plan.trial}, then ${plan.price}/{plan.interval === 'year' ? 'year' : 'month'}
                        </div>
                      )}
                    </div>
                    
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <Check size={16} className="text-blue-600" />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Crown size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">
                    {isSignup ? 'Choose Your Plan' : 'Upgrade to Premium'}
                  </h1>
                  <p className="text-sm text-slate-400">
                    Join elite bettors using AI-powered predictions
                  </p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {renderTierComparison()}
              {renderPlanOptions()}
              
              {/* Subscribe Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubscribe}
                disabled={loading}
                className={`w-full py-4 px-6 rounded-xl font-bold text-white text-lg transition-all ${
                  loading
                    ? 'bg-slate-600 cursor-not-allowed'
                    : selectedTier === 'pro'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                    : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Crown size={20} className="mr-2" />
                    Start {selectedTier === 'pro' ? 'Pro' : 'Elite'} Experience
                  </div>
                )}
              </motion.button>
              
              {isSignup && (
                <div className="mt-4">
                  <button
                    onClick={onClose}
                    className="w-full py-3 px-6 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Continue with Free (2 picks daily)
                  </button>
                </div>
              )}
              
              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-slate-700">
                <div className="flex items-center justify-center space-x-6 text-xs text-slate-400">
                  <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                  <span>•</span>
                  <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                  <span>•</span>
                  <button className="hover:text-white transition-colors">Restore Purchases</button>
                </div>
                
                <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400 text-center leading-relaxed">
                    Secure payments powered by Stripe. Cancel anytime. 
                    {selectedTier === 'pro' ? ' Pro subscriptions' : ' Elite subscriptions'} 
                    are auto-renewable. 3-day free trial for yearly plans.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default TieredSubscriptionModal