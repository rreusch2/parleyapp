'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

/**
 * This is a special route that forces onboarding to trigger
 * for testing purposes or for users who need to re-do their onboarding
 */
export default function ForceOnboarding() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    // If user is logged in, set the flag and redirect to dashboard
    if (user) {
      // Set the flag to trigger onboarding
      localStorage.setItem('needsOnboarding', 'true')
      router.push('/dashboard')
    } else {
      // If no user, redirect to landing page
      router.push('/')
    }
  }, [user, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-lg text-gray-600">Preparing onboarding experience...</p>
      </div>
    </div>
  )
}