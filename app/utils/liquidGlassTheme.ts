import { isLiquidGlassSupported } from '@callstack/liquid-glass';

/**
 * Liquid Glass Theme Configuration
 * Centralized theming for liquid glass effects across the app
 */

export const LiquidGlassTheme = {
  // Check if device supports liquid glass
  isSupported: isLiquidGlassSupported,

  // Tier-based configurations
  tiers: {
    free: {
      effect: 'none' as const,
      tintColor: undefined,
      glowEffect: false,
      interactive: false,
    },
    pro: {
      effect: 'regular' as const,
      tintColor: 'rgba(59, 130, 246, 0.08)', // Blue tint
      glowEffect: false,
      interactive: true,
    },
    allStar: {
      effect: 'clear' as const,
      tintColor: 'rgba(255, 215, 0, 0.1)', // Gold tint
      glowEffect: true,
      interactive: true,
    },
  },

  // Color schemes for different contexts
  colors: {
    premium: {
      glow: 'rgba(255, 215, 0, 0.1)',
      border: 'rgba(255, 215, 0, 0.3)',
      tint: 'rgba(255, 215, 0, 0.08)',
      accent: '#FFD700',
    },
    success: {
      glow: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.3)',
      tint: 'rgba(16, 185, 129, 0.08)',
      accent: '#10B981',
    },
    warning: {
      glow: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.3)',
      tint: 'rgba(245, 158, 11, 0.08)',
      accent: '#F59E0B',
    },
    error: {
      glow: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.3)',
      tint: 'rgba(239, 68, 68, 0.08)',
      accent: '#EF4444',
    },
    info: {
      glow: 'rgba(59, 130, 246, 0.1)',
      border: 'rgba(59, 130, 246, 0.3)',
      tint: 'rgba(59, 130, 246, 0.08)',
      accent: '#3B82F6',
    },
    purple: {
      glow: 'rgba(139, 92, 246, 0.1)',
      border: 'rgba(139, 92, 246, 0.3)',
      tint: 'rgba(139, 92, 246, 0.08)',
      accent: '#8B5CF6',
    },
  },

  // Fallback gradients for unsupported devices
  fallbackGradients: {
    default: ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'],
    premium: ['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.05)'],
    dark: ['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.1)'],
    light: ['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)'],
  },

  // Border radius presets
  borderRadius: {
    small: 12,
    medium: 16,
    large: 20,
    xlarge: 24,
    pill: 999,
  },

  // Spacing presets for LiquidGlassContainerView
  spacing: {
    tight: 8,
    normal: 12,
    relaxed: 16,
    loose: 20,
  },

  // Shadow presets
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },
    premium: {
      shadowColor: '#FFD700',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
  },
};

/**
 * Get configuration for user tier
 */
export const getLiquidGlassConfigForTier = (
  tier: 'free' | 'pro' | 'allStar' | 'all-star'
) => {
  const normalizedTier = tier === 'all-star' ? 'allStar' : tier;
  return LiquidGlassTheme.tiers[normalizedTier] || LiquidGlassTheme.tiers.free;
};

/**
 * Get color scheme for category
 */
export const getLiquidGlassColors = (
  category: 'premium' | 'success' | 'warning' | 'error' | 'info' | 'purple'
) => {
  return LiquidGlassTheme.colors[category] || LiquidGlassTheme.colors.info;
};

/**
 * Get appropriate border radius
 */
export const getLiquidGlassBorderRadius = (
  size: 'small' | 'medium' | 'large' | 'xlarge' | 'pill'
) => {
  return LiquidGlassTheme.borderRadius[size] || LiquidGlassTheme.borderRadius.medium;
};

/**
 * Get shadow preset
 */
export const getLiquidGlassShadow = (
  size: 'none' | 'small' | 'medium' | 'large' | 'premium'
) => {
  return LiquidGlassTheme.shadows[size] || LiquidGlassTheme.shadows.none;
};

/**
 * Determine if premium effects should be shown
 */
export const shouldShowPremiumEffects = (
  userTier: string | undefined,
  requiresPremium: boolean = false
): boolean => {
  if (!requiresPremium) return true;
  return userTier === 'pro' || userTier === 'all-star' || userTier === 'allStar';
};

/**
 * Get opacity for confidence level
 */
export const getConfidenceOpacity = (confidence: number): number => {
  if (confidence >= 80) return 1.0;
  if (confidence >= 70) return 0.9;
  if (confidence >= 60) return 0.8;
  return 0.7;
};

/**
 * Get color for confidence level
 */
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 75) return LiquidGlassTheme.colors.success.accent;
  if (confidence >= 65) return LiquidGlassTheme.colors.info.accent;
  if (confidence >= 55) return LiquidGlassTheme.colors.warning.accent;
  return LiquidGlassTheme.colors.error.accent;
};

/**
 * Get gradient for bet type
 */
export const getBetTypeGradient = (betType: string): string[] => {
  switch (betType.toLowerCase()) {
    case 'moneyline':
    case 'ml':
      return ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.05)'];
    case 'spread':
      return ['rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.05)'];
    case 'total':
    case 'over':
    case 'under':
      return ['rgba(139, 92, 246, 0.15)', 'rgba(139, 92, 246, 0.05)'];
    case 'prop':
    case 'player_prop':
      return ['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)'];
    default:
      return LiquidGlassTheme.fallbackGradients.default;
  }
};

/**
 * Get appropriate effect based on device support and context
 */
export const getAdaptiveEffect = (
  preferredEffect: 'clear' | 'regular' | 'none',
  isPremium: boolean = false
): 'clear' | 'regular' | 'none' => {
  if (!isLiquidGlassSupported) return 'none';
  if (isPremium) return 'clear';
  return preferredEffect;
};

export default LiquidGlassTheme;
