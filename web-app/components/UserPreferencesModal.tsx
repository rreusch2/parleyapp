'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Check,
  Star,
  TrendingUp,
  Shield,
  Zap,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export interface UserPreferences {
  sportPreferences: {
    mlb: boolean
    wnba: boolean
    ufc: boolean
  }
  bettingStyle: 'conservative' | 'balanced' | 'aggressive'
  pickDistribution?: { auto: boolean }
}

interface UserPreferencesModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (preferences: UserPreferences) => void
  currentPreferences?: UserPreferences
}

const sportOptions = [
  {
    key: 'mlb' as const,
    name: 'MLB',
    icon: '⚾',
    description: 'Major League Baseball',
    color: 'from-blue-500 to-blue-600'
  },
  {
    key: 'wnba' as const,
    name: 'WNBA',
    icon: '🏀',
    description: 'Women\'s Basketball',
    color: 'from-orange-500 to-red-500'
  },
  {
    key: 'ufc' as const,
    name: 'UFC',
    icon: '🥊',
    description: 'Mixed Martial Arts',
    color: 'from-red-500 to-red-600'
  }
]

const bettingStyleOptions = [
  {
    key: 'conservative' as const,
    name: 'Conservative',
    icon: Shield,
    description: 'Lower-risk bets with steady returns',
    color: 'from-green-500 to-green-600',
    features: ['Higher win rate', 'Lower odds', 'Safer picks']
  },
  {
    key: 'balanced' as const,
    name: 'Balanced',
    icon: TrendingUp,
    description: 'Mix of safe and value bets',
    color: 'from-blue-500 to-blue-600',
    features: ['Best of both worlds', 'Moderate risk', 'Optimized returns']
  },
  {
    key: 'aggressive' as const,
    name: 'Aggressive',
    icon: Zap,
    description: 'High-value bets with bigger payouts',
    color: 'from-purple-500 to-purple-600',
    features: ['Higher payouts', 'More risk', 'Value hunting']
  }
]

export default function UserPreferencesModal({ 
  isOpen, 
  onClose, 
  onComplete, 
  currentPreferences 
}: UserPreferencesModalProps) {
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { user } = useAuth()
  
  const [preferences, setPreferences] = useState<UserPreferences>({
    sportPreferences: currentPreferences?.sportPreferences || { mlb: true, wnba: false, ufc: false },
    bettingStyle: currentPreferences?.bettingStyle || 'balanced',
    pickDistribution: { auto: true }
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleSport = (sportKey: keyof UserPreferences['sportPreferences']) => {
    setPreferences(prev => ({
      ...prev,
      sportPreferences: {
        ...prev.sportPreferences,
        [sportKey]: !prev.sportPreferences[sportKey]
      }
    }))
  }

  const selectBettingStyle = (style: UserPreferences['bettingStyle']) => {
    setPreferences(prev => ({
      ...prev,
      bettingStyle: style
    }))
  }

  const handleNext = () => {
    if (step === 1) {
      // Ensure at least one sport is selected
      const hasAtLeastOneSport = Object.values(preferences.sportPreferences).some(Boolean)
      if (!hasAtLeastOneSport) {
        setPreferences(prev => ({
          ...prev,
          sportPreferences: { ...prev.sportPreferences, mlb: true }
        }))
      }
      setStep(2)
    } else {
      handleComplete()
    }
  }

  const handleComplete = async () => {
    if (!user?.id) {
      console.error('User not found')
      return
    }

    setIsLoading(true)

    try {
      console.log('🔄 Updating user preferences for user:', user.id)
      console.log('📦 Preferences data:', preferences)
      
      // Transform preferences to match database format
      const updateData = {
        sport_preferences: preferences.sportPreferences,
        betting_style: preferences.bettingStyle,
        pick_distribution: preferences.pickDistribution,
        preferred_sports: Object.keys(preferences.sportPreferences).filter(
          sport => preferences.sportPreferences[sport as keyof typeof preferences.sportPreferences]
        ),
        updated_at: new Date().toISOString(),
      }

      console.log('🔄 Database update data:', updateData)

      // Update preferences in Supabase
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

      if (error) {
        console.error('❌ Supabase update error:', error)
        throw new Error(`Database update failed: ${error.message}`)
      }

      console.log('✅ Preferences successfully updated in database!')
      
      // Notify parent component
      onComplete(preferences)

    } catch (error) {
      console.error('❌ Failed to update preferences:', error)
      console.error('❌ Full error details:', JSON.stringify(error, null, 2))
      
      // Show user-friendly error (you can replace with toast)
      alert(`Failed to save preferences: ${error instanceof Error ? error.message : 'Unknown error'}`)
      
    } finally {
      console.log('🔄 Setting loading to false')
      setIsLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {step === 1 ? '🏆 Choose Your Sports' : '🎯 Select Betting Style'}
                </h2>
                <p className="text-gray-400">
                  {step === 1 
                    ? 'Select the sports you want AI predictions for'
                    : 'Choose your preferred betting approach'
                  }
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress */}
            <div className="flex items-center space-x-4 mb-8">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-400'
              }`}>
                {step > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div className={`flex-1 h-1 rounded-full ${
                step > 1 ? 'bg-blue-600' : 'bg-gray-600'
              }`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-400'
              }`}>
                2
              </div>
            </div>

            {/* Step 1: Sports Selection */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                {sportOptions.map((sport, index) => (
                  <motion.div
                    key={sport.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    onClick={() => toggleSport(sport.key)}
                    className={`relative cursor-pointer rounded-xl p-6 border-2 transition-all duration-300 ${
                      preferences.sportPreferences[sport.key]
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`text-4xl p-3 rounded-xl bg-gradient-to-r ${sport.color}`}>
                        {sport.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white">{sport.name}</h3>
                        <p className="text-gray-400">{sport.description}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        preferences.sportPreferences[sport.key]
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-400'
                      }`}>
                        {preferences.sportPreferences[sport.key] && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Step 2: Betting Style */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {bettingStyleOptions.map((style, index) => (
                  <motion.div
                    key={style.key}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    onClick={() => selectBettingStyle(style.key)}
                    className={`relative cursor-pointer rounded-xl p-6 border-2 transition-all duration-300 transform hover:scale-105 ${
                      preferences.bettingStyle === style.key
                        ? 'border-blue-500 bg-blue-500/10 shadow-xl shadow-blue-500/20'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    {preferences.bettingStyle === style.key && (
                      <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-1 rounded-full">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                    
                    <div className="text-center">
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${style.color} flex items-center justify-center`}>
                        <style.icon className="w-8 h-8 text-white" />
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-2">{style.name}</h3>
                      <p className="text-gray-400 text-sm mb-4">{style.description}</p>
                      
                      <div className="space-y-2">
                        {style.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center justify-center space-x-2 text-sm text-gray-300">
                            <Star className="w-3 h-3 text-yellow-400" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-8">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  disabled={isLoading}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Back
                </button>
              )}
              
              <div className="flex-1" />
              
              <button
                onClick={handleNext}
                disabled={isLoading}
                className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>{step === 2 ? 'Complete Setup' : 'Next'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}