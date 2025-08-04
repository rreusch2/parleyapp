'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

interface SubscriptionContextType {
  isPro: boolean
  isElite: boolean
  subscriptionTier: 'free' | 'pro' | 'elite'
  checkSubscriptionStatus: () => Promise<void>
  hasWelcomeBonus: boolean
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { profile, refreshProfile } = useAuth()
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'elite'>('free')
  const [isPro, setIsPro] = useState(false)
  const [isElite, setIsElite] = useState(false)
  const [hasWelcomeBonus, setHasWelcomeBonus] = useState(false)

  const checkSubscriptionStatus = async () => {
    await refreshProfile()
  }

  // Update subscription state when profile changes
  useEffect(() => {
    if (profile) {
      setSubscriptionTier(profile.subscription_tier)
      setIsPro(profile.subscription_tier === 'pro')
      setIsElite(profile.subscription_tier === 'elite')
      
      // Check welcome bonus status
      const now = new Date()
      const welcomeBonusActive = Boolean(profile.welcome_bonus_claimed && 
        profile.welcome_bonus_expires_at && 
        new Date(profile.welcome_bonus_expires_at) > now)
      
      setHasWelcomeBonus(welcomeBonusActive)
    } else {
      setSubscriptionTier('free')
      setIsPro(false)
      setIsElite(false)
      setHasWelcomeBonus(false)
    }
  }, [profile])

  const value = {
    isPro,
    isElite,
    subscriptionTier,
    checkSubscriptionStatus,
    hasWelcomeBonus,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider')
  }
  return context
}
