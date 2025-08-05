'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '@/hooks/useOnboarding'

export default function ForceOnboardingPage() {
  const router = useRouter()
  const { forceOnboarding } = useOnboarding()

  useEffect(() => {
    // Force onboarding when this page loads
    console.log('🚀 Force onboarding page loaded - triggering onboarding')
    forceOnboarding()
    
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      router.push('/dashboard')
    }, 500)
  }, [forceOnboarding, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-white text-lg">🚀 Forcing onboarding flow...</p>
        <p className="text-gray-300 text-sm mt-2">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}