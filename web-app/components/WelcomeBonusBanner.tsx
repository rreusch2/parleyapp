'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Gift, 
  Clock,
  Star,
  Sparkles,
  Crown,
  Trophy
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface WelcomeBonusBannerProps {
  userId: string
}

export default function WelcomeBonusBanner({ userId }: WelcomeBonusBannerProps) {
  const [welcomeBonusActive, setWelcomeBonusActive] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkWelcomeBonusStatus()
    
    // Update timer every minute
    const interval = setInterval(() => {
      checkWelcomeBonusStatus()
    }, 60000)

    return () => clearInterval(interval)
  }, [userId])

  const checkWelcomeBonusStatus = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('welcome_bonus_claimed, welcome_bonus_expires_at')
        .eq('id', userId)
        .single()

      if (error || !profile) {
        setLoading(false)
        return
      }

      const now = new Date()
      const expiresAt = profile.welcome_bonus_expires_at ? new Date(profile.welcome_bonus_expires_at) : null
      const hasActiveBonus = profile.welcome_bonus_claimed && expiresAt && now < expiresAt

      setWelcomeBonusActive(hasActiveBonus)

      if (hasActiveBonus && expiresAt) {
        const remaining = expiresAt.getTime() - now.getTime()
        const hours = Math.floor(remaining / (1000 * 60 * 60))
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
        
        if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m`)
        } else {
          setTimeRemaining(`${minutes}m`)
        }
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error checking welcome bonus:', error)
      setLoading(false)
    }
  }

  if (loading || !welcomeBonusActive) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mb-8"
      >
        <div className="bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-yellow-500/20 rounded-xl p-6 border border-purple-500/30 relative overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-2 left-4 animate-bounce">
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="absolute top-4 right-8 animate-pulse">
              <Star className="w-3 h-3 text-purple-400" />
            </div>
            <div className="absolute bottom-3 left-8 animate-bounce delay-300">
              <Crown className="w-3 h-3 text-yellow-400" />
            </div>
            <div className="absolute bottom-4 right-4 animate-pulse delay-700">
              <Trophy className="w-4 h-4 text-purple-400" />
            </div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
                    🎉 Welcome Bonus Active!
                  </h3>
                  <p className="text-gray-300">
                    You have <span className="text-purple-400 font-semibold">5 Premium Picks</span> available
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 font-bold text-lg">{timeRemaining}</span>
                </div>
                <p className="text-xs text-gray-400">remaining</p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-black/30 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  ⚡ Premium access includes: AI insights, Professor Lock chat, trend analysis
                </span>
                <span className="text-purple-400 font-semibold">
                  Worth $24.95
                </span>
              </div>
            </div>
          </div>

          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 blur-xl -z-10"></div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}