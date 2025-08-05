'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import UserPreferencesModal, { UserPreferences } from './UserPreferencesModal'
import TieredSubscriptionModal from './TieredSubscriptionModal'
import WelcomeSpinWheel from './WelcomeSpinWheel'

interface OnboardingFlowProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

type OnboardingStep = 'preferences' | 'subscription' | 'welcome-wheel' | 'completed'

export default function OnboardingFlow({ isOpen, onClose, onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('preferences')
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      // Reset to first step when onboarding opens
      setCurrentStep('preferences')
      setUserPreferences(null)
    }
  }, [isOpen])

  const handlePreferencesComplete = (preferences: UserPreferences) => {
    console.log('✅ User preferences completed:', preferences)
    setUserPreferences(preferences)
    setCurrentStep('subscription')
  }

  const handleSubscriptionComplete = () => {
    // User chose a paid plan - skip welcome wheel
    console.log('✅ User subscribed to paid plan')
    handleOnboardingComplete()
  }

  const handleContinueFree = () => {
    // User chose to continue free - show welcome wheel
    console.log('✅ User chose to continue free - showing welcome wheel')
    setCurrentStep('welcome-wheel')
  }

  const handleWelcomeWheelComplete = async (picks: number) => {
    console.log(`🎊 User won ${picks} picks! Activating welcome bonus...`)
    
    if (!user) {
      console.error('No user found')
      return
    }

    setIsLoading(true)

    try {
      // Calculate expiration time (24 hours from now for fair trial period)
      const now = new Date()
      const expiration = new Date(now.getTime() + (24 * 60 * 60 * 1000)) // 24 hours from now
      
      console.log(`🕛 Setting welcome bonus to expire at: ${expiration.toISOString()} (24 hours from signup)`)
      
      // CRITICAL: Update user profile to activate welcome bonus BUT ensure they stay FREE tier
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_tier: 'free',  // EXPLICITLY set to free (critical!)
          welcome_bonus_claimed: true,
          welcome_bonus_expires_at: expiration.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('❌ Error updating welcome bonus:', updateError)
        throw updateError
      }

      console.log('✅ Welcome bonus activated successfully!')
      
      // Complete onboarding
      handleOnboardingComplete()
      
    } catch (error) {
      console.error('❌ Failed to activate welcome bonus:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOnboardingComplete = () => {
    console.log('🎉 Onboarding flow completed!')
    setCurrentStep('completed')
    onComplete()
    
    // Redirect to dashboard
    router.push('/dashboard')
  }

  const handleClose = () => {
    if (currentStep === 'preferences') {
      // Allow closing only on first step
      onClose()
    }
    // Prevent closing during other steps to ensure proper onboarding
  }

  return (
    <>
      {/* User Preferences Modal */}
      <UserPreferencesModal
        isOpen={isOpen && currentStep === 'preferences'}
        onClose={handleClose}
        onComplete={handlePreferencesComplete}
      />

      {/* Subscription Modal */}
      <TieredSubscriptionModal
        isOpen={isOpen && currentStep === 'subscription'}
        onClose={handleSubscriptionComplete} // This should only be called if they subscribe
        onContinueFree={handleContinueFree}
      />

      {/* Welcome Wheel */}
      <WelcomeSpinWheel
        isOpen={isOpen && currentStep === 'welcome-wheel'}
        onClose={() => {}} // Prevent closing - user must complete the wheel
        onComplete={handleWelcomeWheelComplete}
      />
    </>
  )
}