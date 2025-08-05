/**
 * Subscription tier utilities for the web app
 * Determines capabilities and UI enhancements based on subscription tier
 */

export type SubscriptionTier = 'free' | 'pro' | 'elite'

export interface TierCapabilities {
  dailyPicks: number
  teamPicks: number
  playerPropPicks: number
  dailyInsights: number
  dailyTrends: number
  showUpgradePrompts: boolean
  hasLockOfDay: boolean
  hasAdvancedUI: boolean
  hasPremiumStyling: boolean
}

export const TIER_CAPABILITIES: Record<SubscriptionTier, TierCapabilities> = {
  free: {
    dailyPicks: 2,
    teamPicks: 1,
    playerPropPicks: 1,
    dailyInsights: 6,
    dailyTrends: 5,
    showUpgradePrompts: true,
    hasLockOfDay: false,
    hasAdvancedUI: false,
    hasPremiumStyling: false,
  },
  pro: {
    dailyPicks: 20,
    teamPicks: 10,
    playerPropPicks: 10,
    dailyInsights: 8,
    dailyTrends: 10,
    showUpgradePrompts: false,
    hasLockOfDay: false,
    hasAdvancedUI: true,
    hasPremiumStyling: true,
  },
  elite: {
    dailyPicks: 30,
    teamPicks: 15,
    playerPropPicks: 15,
    dailyInsights: 12,
    dailyTrends: 15,
    showUpgradePrompts: false,
    hasLockOfDay: true,
    hasAdvancedUI: true,
    hasPremiumStyling: true,
  },
}

/**
 * Get capabilities for a subscription tier
 */
export function getTierCapabilities(tier: SubscriptionTier): TierCapabilities {
  return TIER_CAPABILITIES[tier] || TIER_CAPABILITIES.free
}

export interface TierStyling {
  containerClass: string
  gradientClass: string
  accentColor: string
  borderClass: string
  textAccentClass: string
}

export const TIER_STYLING: Record<SubscriptionTier, TierStyling> = {
  free: {
    containerClass: '',
    gradientClass: 'bg-gradient-to-r from-blue-600 to-purple-600',
    accentColor: 'blue',
    borderClass: 'border-blue-500/30',
    textAccentClass: 'text-blue-400'
  },
  pro: {
    containerClass: 'relative overflow-hidden',
    gradientClass: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600',
    accentColor: 'purple',
    borderClass: 'border-purple-500/40 shadow-purple-500/20',
    textAccentClass: 'text-purple-400'
  },
  elite: {
    containerClass: 'relative overflow-hidden',
    gradientClass: 'bg-gradient-to-r from-yellow-600 via-amber-600 to-orange-600',
    accentColor: 'amber', 
    borderClass: 'border-yellow-500/50 shadow-yellow-500/30',
    textAccentClass: 'text-yellow-400'
  }
}

export function getTierStyling(tier: SubscriptionTier): TierStyling {
  return TIER_STYLING[tier] || TIER_STYLING.free
}

/**
 * Get the number of picks to show during welcome bonus period
 */
export function getWelcomeBonusPicks(): number {
  return 5
}

/**
 * Check if user is in welcome bonus period
 */
export function isInWelcomeBonusPeriod(
  welcomeBonusClaimed: boolean,
  welcomeBonusExpiresAt: string | null
): boolean {
  if (welcomeBonusClaimed) return false
  if (!welcomeBonusExpiresAt) return false
  
  return new Date(welcomeBonusExpiresAt) > new Date()
}

/**
 * Get the number of picks to display based on user status
 */
export function getDisplayPicksCount(
  tier: SubscriptionTier,
  welcomeBonusClaimed: boolean,
  welcomeBonusExpiresAt: string | null
): number {
  if (isInWelcomeBonusPeriod(welcomeBonusClaimed, welcomeBonusExpiresAt)) {
    return getWelcomeBonusPicks()
  }
  
  return getTierCapabilities(tier).dailyPicks
}



/**
 * Get display name for subscription tier
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  switch (tier) {
    case 'elite':
      return 'Elite'
    case 'pro':
      return 'Pro'
    default:
      return 'Free'
  }
}