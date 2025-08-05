'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export function useOnboarding() {
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<'preferences' | 'subscription' | 'welcome-wheel' | 'completed'>('preferences')
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const { user, profile, justSignedUp, clearJustSignedUp } = useAuth()

  useEffect(() => {
    console.log('🔍 Onboarding effect triggered:', {
      justSignedUp,
      hasUser: !!user,
      hasProfile: !!profile,
      shouldTrigger: justSignedUp && user && profile
    })
    
    if (justSignedUp && user && profile) {
      console.log('🚀 SIMPLE: User just signed up - triggering onboarding!')
      
      setNeedsOnboarding(true)
      setOnboardingStep('preferences')
      setIsOnboardingOpen(true)
      
      // Clear the flag so it doesn't trigger again
      clearJustSignedUp()
    } else if (justSignedUp && user && !profile) {
      console.log('⏳ Waiting for profile to load after signup...')
    }
  }, [justSignedUp, user, profile, clearJustSignedUp])

  const startOnboarding = () => {
    console.log('🚀 Manual onboarding trigger')
    setNeedsOnboarding(true)
    setOnboardingStep('preferences')
    setIsOnboardingOpen(true)
  }

  const forceOnboarding = () => {
    console.log('🔄 FORCE onboarding - manual trigger')
    setNeedsOnboarding(true)
    setOnboardingStep('preferences')
    setIsOnboardingOpen(true)
  }

  const closeOnboarding = () => {
    setIsOnboardingOpen(false)
  }

  const completeOnboarding = () => {
    setNeedsOnboarding(false)
    setIsOnboardingOpen(false)
    setOnboardingStep('completed')
  }

  return {
    needsOnboarding,
    onboardingStep,
    isOnboardingOpen,
    startOnboarding,
    forceOnboarding,
    closeOnboarding,
    completeOnboarding
  }
}