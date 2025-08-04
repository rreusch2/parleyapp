'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, Crown, Sparkles, ArrowRight } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function CheckoutSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)
  const [sessionData, setSessionData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID found')
      setLoading(false)
      return
    }

    // Verify the checkout session
    verifySession()
  }, [sessionId])

  const verifySession = async () => {
    try {
      const response = await fetch('/api/stripe/verify-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify session')
      }

      setSessionData(data)
      toast.success('Payment successful! Welcome to Predictive Play!')
    } catch (err: any) {
      console.error('Session verification error:', err)
      setError(err.message)
      toast.error('Failed to verify payment')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Verifying your payment...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Verification Failed</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-lg w-full bg-white/5 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/10"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <Check size={40} className="text-white" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-white mb-4"
        >
          🎉 Welcome to {sessionData?.tier === 'elite' ? 'Elite' : 'Pro'}!
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-slate-300 text-lg mb-6"
        >
          Your subscription is now active. Get ready for AI-powered betting insights!
        </motion.p>

        {/* Plan Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800/50 rounded-xl p-4 mb-6"
        >
          <div className="flex items-center justify-center mb-3">
            {sessionData?.tier === 'elite' ? (
              <Sparkles size={24} className="text-purple-400 mr-2" />
            ) : (
              <Crown size={24} className="text-blue-400 mr-2" />
            )}
            <span className="text-white font-semibold">
              {sessionData?.planName || 'Premium Plan'}
            </span>
          </div>
          
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>Daily AI Picks:</span>
              <span className="text-white font-medium">
                {sessionData?.tier === 'elite' ? '30' : '20'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Daily Insights:</span>
              <span className="text-white font-medium">
                {sessionData?.tier === 'elite' ? '12' : '8'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Professor Chat:</span>
              <span className="text-white font-medium">Unlimited</span>
            </div>
            {sessionData?.tier === 'elite' && (
              <div className="flex justify-between">
                <span>🔒 Lock of the Day:</span>
                <span className="text-amber-400 font-medium">✓ Included</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-3"
        >
          <button
            onClick={handleContinue}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-white flex items-center justify-center transition-all ${
              sessionData?.tier === 'elite'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
            }`}
          >
            Start Using Your Premium Features
            <ArrowRight size={20} className="ml-2" />
          </button>
          
          <button
            onClick={() => router.push('/dashboard/billing')}
            className="w-full py-3 px-6 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Manage Subscription
          </button>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-6 pt-6 border-t border-slate-700"
        >
          <p className="text-xs text-slate-400 leading-relaxed">
            Your subscription will automatically renew. You can cancel anytime from your dashboard.
            {sessionData?.trialEnd && (
              <> Your trial ends on {new Date(sessionData.trialEnd).toLocaleDateString()}.</>
            )}
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}