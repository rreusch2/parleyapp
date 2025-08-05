'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { PLANS, Plan } from '@/lib/plans'
import { createCheckoutSession, redirectToCheckout } from '@/lib/stripe'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'

interface TieredSubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  onContinueFree?: () => void
}

// Group plans by tier for easier rendering
const groupedPlans = PLANS.reduce<Record<'pro' | 'elite', Plan[]>>(
  (acc, plan) => {
    acc[plan.tier].push(plan)
    return acc
  },
  { pro: [], elite: [] }
)

export default function TieredSubscriptionModal({
  isOpen,
  onClose,
  onContinueFree,
}: TieredSubscriptionModalProps) {
  const [selectedTier, setSelectedTier] = useState<'pro' | 'elite'>('pro')
  const [selectedPlan, setSelectedPlan] = useState<Plan>(groupedPlans.pro[0])
  const [loading, setLoading] = useState(false)

  const { user } = useAuth()
  const { subscriptionTier } = useSubscription()

  const handleTierChange = (tier: 'pro' | 'elite') => {
    setSelectedTier(tier)
    const firstPlan = groupedPlans[tier][0]
    setSelectedPlan(firstPlan)
  }

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan)
  }

  const handleSubscribe = async () => {
    if (!user) {
      // Should not happen – gate behind auth elsewhere
      alert('Please sign in to subscribe.')
      return
    }

    if (!selectedPlan.stripePriceId) {
      alert('Stripe price ID missing for this plan – please configure in env.')
      return
    }

    try {
      setLoading(true)
      const sessionId = await createCheckoutSession(
        selectedPlan.stripePriceId, 
        user.id,
        `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        `${window.location.origin}/dashboard`
      )
      await redirectToCheckout(sessionId)
    } catch (err) {
      console.error(err)
      alert('Unable to initiate checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-left align-middle shadow-2xl transition-all border border-slate-700">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-2xl animate-pulse">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
                    🚀 Join 50,000+ Winners
                  </h3>
                  <p className="text-slate-300 text-xl mb-4">Get AI-powered predictions that beat the sportsbooks</p>
                  
                  {/* Social Proof */}
                  <div className="flex items-center justify-center space-x-8 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">73%</div>
                      <div className="text-xs text-slate-400">Win Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">$2.1M</div>
                      <div className="text-xs text-slate-400">Won This Month</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">50K+</div>
                      <div className="text-xs text-slate-400">Active Users</div>
                    </div>
                  </div>
                  
                  {/* Urgency */}
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-red-200 text-sm font-semibold">
                      ⏰ Limited Time: 50% OFF First Month - Expires in 23:59:45
                    </p>
                  </div>
                </div>

                {/* Tier Switcher */}
                <div className="flex justify-center mb-10">
                  <div className="bg-slate-800/50 p-2 rounded-2xl border border-slate-700">
                    {(['pro', 'elite'] as const).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => handleTierChange(tier)}
                        className={`relative px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                          selectedTier === tier 
                            ? tier === 'pro' 
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25' 
                              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        {tier === 'pro' && (
                          <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        )}
                        {tier === 'elite' && (
                          <svg className="w-4 h-4 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                            <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                          </svg>
                        )}
                        {tier === 'pro' ? 'Pro' : 'Elite'}
                        {tier === 'pro' && selectedTier === 'pro' && (
                          <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                            POPULAR
                          </span>
                        )}
                        {tier === 'elite' && selectedTier === 'elite' && (
                          <span className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs px-2 py-0.5 rounded-full font-bold">
                            PREMIUM
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
                  {groupedPlans[selectedTier].map((plan) => {
                    const isSelected = plan.id === selectedPlan.id
                    const tierColor = selectedTier === 'pro' ? 'blue' : 'purple'
                    
                    return (
                      <div
                        key={plan.id}
                        onClick={() => handlePlanSelect(plan)}
                        className={`relative cursor-pointer rounded-2xl p-6 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ${
                          isSelected 
                            ? selectedTier === 'pro'
                              ? 'bg-gradient-to-br from-blue-600/20 to-blue-900/40 border-2 border-blue-500 shadow-xl shadow-blue-500/20'
                              : 'bg-gradient-to-br from-purple-600/20 to-pink-900/40 border-2 border-purple-500 shadow-xl shadow-purple-500/20'
                            : 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {/* Savings Badge */}
                        {plan.savings && (
                          <div className="absolute -top-3 -right-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            {plan.savings}
                          </div>
                        )}

                        {/* Plan Header */}
                        <div className="text-center mb-6">
                          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                            selectedTier === 'pro' 
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                              : 'bg-gradient-to-r from-purple-500 to-pink-500'
                          }`}>
                            {plan.interval === 'one_time' ? (
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                            ) : (
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>
                          
                          <h4 className="text-xl font-bold text-white mb-2">{plan.name}</h4>
                          
                          <div className="mb-4">
                            <div className="text-4xl font-black text-white mb-1">
                              ${plan.price.toFixed(2)}
                            </div>
                            {plan.interval !== 'one_time' && (
                              <div className="text-slate-400 text-sm">
                                per {plan.interval === 'day' ? 'day' : plan.interval}
                              </div>
                            )}
                          </div>

                          {isSelected && (
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                              selectedTier === 'pro' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-purple-500 text-white'
                            }`}>
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Selected
                            </div>
                          )}
                        </div>

                        {/* Features */}
                        <div className="space-y-3">
                          {plan.features.map((feature, i) => (
                            <div key={i} className="flex items-center text-sm">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center mr-3 ${
                                selectedTier === 'pro' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                              }`}>
                                <svg className={`w-3 h-3 ${
                                  selectedTier === 'pro' ? 'text-blue-400' : 'text-purple-400'
                                }`} fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <span className="text-slate-300">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Subscribe Button */}
                <div className="text-center">
                  <button
                    disabled={loading || subscriptionTier !== 'free'}
                    onClick={handleSubscribe}
                    className={`w-full md:w-auto inline-flex items-center justify-center px-12 py-4 rounded-2xl text-lg font-bold text-white shadow-2xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 ${
                      selectedTier === 'pro'
                        ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 shadow-blue-500/25'
                        : 'bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 hover:from-purple-600 hover:via-pink-600 hover:to-purple-700 shadow-purple-500/25'
                    }`}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Redirecting to Checkout...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Start {selectedTier === 'pro' ? 'Pro' : 'Elite'} {selectedPlan.interval === 'one_time' ? 'Access' : 'Subscription'}
                        <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </>
                    )}
                  </button>
                  {onContinueFree && (
                    <button
                      onClick={onContinueFree}
                      className="mt-4 inline-flex items-center justify-center px-6 py-2 text-sm font-semibold rounded-md text-blue-500 bg-white bg-opacity-10 hover:bg-opacity-20 transition"
                    >
                      Continue for Free (2 picks daily)
                    </button>
                  )}
                  
                  {subscriptionTier !== 'free' && (
                    <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <div className="flex items-center justify-center text-amber-400">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        You already have an active subscription
                      </div>
                    </div>
                  )}

                  {/* Money Back Guarantee */}
                  <div className="mt-6 flex items-center justify-center text-sm text-slate-400">
                    <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    30-day money-back guarantee
                  </div>
                </div>

                {/* Footer Links */}
                <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                  <div className="text-xs text-slate-500 space-x-4">
                    <a href="https://rreusch2.github.io/ppwebsite/terms.html" className="hover:text-slate-300 transition-colors" target="_blank" rel="noreferrer">Terms of Service</a>
                    <span>•</span>
                    <a href="https://rreusch2.github.io/ppwebsite/privacy.html" className="hover:text-slate-300 transition-colors" target="_blank" rel="noreferrer">Privacy Policy</a>
                    <span>•</span>
                    <span>Secure checkout powered by Stripe</span>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
