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
 * Get tier-specific styling classes
 */
export function getTierStyling(tier: SubscriptionTier): {
  gradient: string
  accent: string
  cardBg: string
  border: string
} {
  switch (tier) {
    case 'elite':
      return {
        gradient: 'from-purple-900 via-blue-900 to-purple-900',
        accent: 'purple-400',
        cardBg: 'bg-gradient-to-br from-gray-900/95 to-purple-900/20',
        border: 'border-purple-500/30',
      }
    case 'pro':
      return {
        gradient: 'from-blue-900 via-indigo-900 to-blue-900',
        accent: 'blue-400',
        cardBg: 'bg-gradient-to-br from-gray-900/95 to-blue-900/20',
        border: 'border-blue-500/30',
      }
    default:
      return {
        gradient: 'from-gray-900 via-blue-900 to-gray-900',
        accent: 'blue-500',
        cardBg: 'bg-gray-900/95',
        border: 'border-gray-700',
      }
  }
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