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
      const sessionId = await createCheckoutSession(selectedPlan.stripePriceId, user.id)
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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-slate-900 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-2xl font-bold leading-6 text-white mb-6 text-center"
                >
                  Upgrade your Predictive Play experience
                </Dialog.Title>

                {/* Tier Switcher */}
                <div className="flex justify-center mb-8 space-x-4">
                  {(['pro', 'elite'] as const).map((tier) => (
                    <button
                      key={tier}
                      onClick={() => handleTierChange(tier)}
                      className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors
                        ${selectedTier === tier ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {tier === 'pro' ? 'Pro' : 'Elite'}
                    </button>
                  ))}
                </div>

                {/* Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {groupedPlans[selectedTier].map((plan) => {
                    const isSelected = plan.id === selectedPlan.id
                    return (
                      <div
                        key={plan.id}
                        onClick={() => handlePlanSelect(plan)}
                        className={`cursor-pointer border rounded-xl p-6 transition transform hover:scale-[1.02]
                          ${isSelected ? 'border-indigo-500 bg-slate-800' : 'border-slate-700 bg-slate-900'}`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-white">{plan.name}</h4>
                          {isSelected && (
                            <span className="text-sm px-2 py-0.5 bg-indigo-600 text-white rounded-full">Selected</span>
                          )}
                        </div>
                        <div className="mb-4">
                          <span className="text-3xl font-extrabold text-white">
                            {plan.interval === 'one_time' ? `$${plan.price.toFixed(2)}` : `$${plan.price.toFixed(2)}`}
                          </span>
                          {plan.interval !== 'one_time' && (
                            <span className="text-slate-400 ml-1">/ {plan.interval === 'day' ? 'day' : plan.interval}</span>
                          )}
                        </div>
                        {/* Optionally add features list here */}
                      </div>
                    )
                  })}
                </div>

                {/* Subscribe Button */}
                <div className="mt-8 flex flex-col items-center">
                  <button
                    disabled={loading || subscriptionTier !== 'free'}
                    onClick={handleSubscribe}
                    className="w-full md:w-auto inline-flex justify-center rounded-full border border-transparent bg-indigo-600 px-8 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Redirecting...' : `Start ${selectedTier === 'pro' ? 'Pro' : 'Elite'} ${selectedPlan.interval === 'one_time' ? 'Access' : 'Subscription'}`}
                  </button>
                  {subscriptionTier !== 'free' && (
                    <p className="mt-2 text-sm text-slate-400">You already have an active subscription.</p>
                  )}
                </div>

                {/* Footer Links */}
                <div className="mt-6 text-center text-xs text-slate-500 space-x-2">
                  <a href="https://rreusch2.github.io/ppwebsite/terms.html" className="hover:underline" target="_blank" rel="noreferrer">Terms of Service</a>
                  <span>•</span>
                  <a href="https://rreusch2.github.io/ppwebsite/privacy.html" className="hover:underline" target="_blank" rel="noreferrer">Privacy Policy</a>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
