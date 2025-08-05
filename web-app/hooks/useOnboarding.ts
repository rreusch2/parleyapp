'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export function useOnboarding() {
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<'preferences' | 'subscription' | 'welcome-wheel' | 'completed'>('preferences')
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const { user, profile, justSignedUp, clearJustSignedUp } = useAuth()

  useEffect(() => {
    if (justSignedUp && user && profile) {
      setNeedsOnboarding(true)
      setOnboardingStep('preferences')
      setIsOnboardingOpen(true)
      
      // Clear the flag so it doesn't trigger again
      clearJustSignedUp()
    }
  }, [justSignedUp, user, profile, clearJustSignedUp])

  const startOnboarding = () => {
    setNeedsOnboarding(true)
    setOnboardingStep('preferences')
    setIsOnboardingOpen(true)
  }

  const forceOnboarding = () => {
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