'use client'
import { ReactNode } from 'react'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { getTierStyling } from '@/lib/subscriptionUtils'

interface TierEnhancedUIProps {
  children: ReactNode
  className?: string
}

/**
 * Higher-order component that applies tier-based styling enhancements
 * Pro: Enhanced colors, subtle animations, premium feel
 * Elite: Luxury styling, gold accents, special effects
 */
export default function TierEnhancedUI({ children, className = '' }: TierEnhancedUIProps) {
  const { subscriptionTier } = useSubscription()
  const tierStyling = getTierStyling(subscriptionTier as any)
  
  if (subscriptionTier === 'free') {
    return <div className={className}>{children}</div>
  }
  
  return (
    <div className={`
      ${className}
      ${tierStyling.containerClass}
      ${subscriptionTier === 'pro' ? 'pro-enhanced' : ''}
      ${subscriptionTier === 'elite' ? 'elite-enhanced' : ''}
    `}>
      {/* Pro tier subtle glow effect */}
      {subscriptionTier === 'pro' && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-lg pointer-events-none" />
      )}
      
      {/* Elite tier luxury effects */}
      {subscriptionTier === 'elite' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 rounded-lg pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-lg pointer-events-none animate-pulse" />
        </>
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

/**
 * Component that conditionally renders content based on subscription tier
 */
interface TierGatedContentProps {
  children: ReactNode
  requiredTier: 'free' | 'pro' | 'elite'
  fallback?: ReactNode
}

export function TierGatedContent({ children, requiredTier, fallback }: TierGatedContentProps) {
  const { subscriptionTier } = useSubscription()
  
  const tierOrder = { free: 0, pro: 1, elite: 2 }
  const currentTierLevel = tierOrder[subscriptionTier as keyof typeof tierOrder] || 0
  const requiredTierLevel = tierOrder[requiredTier]
  
  if (currentTierLevel >= requiredTierLevel) {
    return <>{children}</>
  }
  
  return <>{fallback || null}</>
}

/**
 * Component that hides upgrade prompts for Pro/Elite users
 */
interface NoUpgradePromptsProps {
  children: ReactNode
}

export function NoUpgradePrompts({ children }: NoUpgradePromptsProps) {
  const { subscriptionTier } = useSubscription()
  
  if (subscriptionTier === 'free') {
    return <>{children}</>
  }
  
  return null
}

/**
 * Enhanced button component with tier-based styling
 */
interface TierButtonProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  variant?: 'primary' | 'secondary' | 'accent'
  disabled?: boolean
}

export function TierButton({ 
  children, 
  onClick, 
  className = '', 
  variant = 'primary',
  disabled = false 
}: TierButtonProps) {
  const { subscriptionTier } = useSubscription()
  
  const getButtonStyles = () => {
    const baseStyles = 'px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
    
    if (subscriptionTier === 'elite') {
      return `${baseStyles} bg-gradient-to-r from-yellow-600 via-amber-600 to-orange-600 text-white hover:from-yellow-500 hover:via-amber-500 hover:to-orange-500 shadow-lg hover:shadow-yellow-500/25`
    }
    
    if (subscriptionTier === 'pro') {
      return `${baseStyles} bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-lg hover:shadow-purple-500/25`
    }
    
    // Free tier - standard styling
    return `${baseStyles} bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500`
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${getButtonStyles()} ${className}`}
    >
      {children}
    </button>
  )
}