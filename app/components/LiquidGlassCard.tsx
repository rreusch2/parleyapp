import React from 'react';
import { View, StyleSheet, ViewStyle, PlatformColor, Platform } from 'react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { LinearGradient } from 'expo-linear-gradient';

interface LiquidGlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  interactive?: boolean;
  effect?: 'clear' | 'regular' | 'none';
  tintColor?: string;
  colorScheme?: 'light' | 'dark' | 'system';
  gradientFallback?: string[];
  glowEffect?: boolean;
  premium?: boolean;
}

/**
 * Premium Liquid Glass Card Component
 * Apple's iOS 26 liquid glass effect with elegant fallbacks for older devices
 */
export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  style,
  interactive = false,
  effect = 'regular',
  tintColor,
  colorScheme = 'system',
  gradientFallback = ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'],
  glowEffect = false,
  premium = false,
}) => {
  // Premium styling with subtle glow
  const containerStyle = [
    styles.container,
    glowEffect && styles.glowContainer,
    premium && styles.premiumContainer,
    style,
  ];

  if (isLiquidGlassSupported) {
    return (
      <View style={containerStyle}>
        {glowEffect && <View style={styles.glow} />}
        <LiquidGlassView
          style={[styles.glass, style]}
          interactive={interactive}
          effect={effect}
          tintColor={tintColor}
          colorScheme={colorScheme}
        >
          {children}
        </LiquidGlassView>
      </View>
    );
  }

  // Elegant fallback for older iOS versions
  return (
    <View style={containerStyle}>
      {glowEffect && <View style={styles.glow} />}
      <LinearGradient
        colors={gradientFallback}
        style={[styles.fallback, style]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.fallbackOverlay} />
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  glass: {
    overflow: 'hidden',
  },
  glowContainer: {
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  premiumContainer: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 12,
  },
  glow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 30,
    zIndex: -1,
  },
  fallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(20px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  fallbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
});

/**
 * Premium Stat Card with Liquid Glass
 */
export const LiquidGlassStatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  interactive?: boolean;
  premium?: boolean;
}> = ({ title, value, subtitle, icon, accentColor = '#10B981', interactive = false, premium = false }) => {
  return (
    <LiquidGlassCard
      style={styles.statCard}
      interactive={interactive}
      effect="clear"
      tintColor={premium ? 'rgba(255, 215, 0, 0.1)' : undefined}
      glowEffect={premium}
      premium={premium}
    >
      <View style={styles.statContent}>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: accentColor + '20' }]}>
            {icon}
          </View>
        )}
        <View style={styles.statTextContainer}>
          <Text style={[styles.statValue, { color: Platform.select({ ios: PlatformColor('labelColor'), default: '#fff' }) }]}>
            {value}
          </Text>
          <Text style={[styles.statTitle, { color: Platform.select({ ios: PlatformColor('secondaryLabelColor'), default: '#9CA3AF' }) }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.statSubtitle, { color: Platform.select({ ios: PlatformColor('tertiaryLabelColor'), default: '#6B7280' }) }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </LiquidGlassCard>
  );
};

const statStyles = StyleSheet.create({
  statCard: {
    borderRadius: 20,
    padding: 20,
    minHeight: 120,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
});

// Merge stat styles into main styles
Object.assign(styles, statStyles);

/**
 * Text component with auto-adapting color
 */
import { Text as RNText, TextProps } from 'react-native';

export const AdaptiveText: React.FC<TextProps> = ({ style, ...props }) => {
  return (
    <RNText
      {...props}
      style={[
        {
          color: Platform.select({
            ios: PlatformColor('labelColor'),
            default: '#FFFFFF',
          }),
        },
        style,
      ]}
    />
  );
};

export const AdaptiveSecondaryText: React.FC<TextProps> = ({ style, ...props }) => {
  return (
    <RNText
      {...props}
      style={[
        {
          color: Platform.select({
            ios: PlatformColor('secondaryLabelColor'),
            default: '#9CA3AF',
          }),
        },
        style,
      ]}
    />
  );
};
