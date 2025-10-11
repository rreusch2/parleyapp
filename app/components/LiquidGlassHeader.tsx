import React from 'react';
import { View, Text, StyleSheet, PlatformColor, Platform, Pressable } from 'react-native';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Sparkles, ChevronRight, TrendingUp } from 'lucide-react-native';

interface LiquidGlassHeaderProps {
  title: string;
  subtitle?: string;
  stat?: {
    label: string;
    value: string;
    trend?: number;
  };
  isPremium?: boolean;
  showUpgradePrompt?: boolean;
  onUpgradePress?: () => void;
}

/**
 * Premium Liquid Glass Header
 * Hero section with stats and optional upgrade prompt
 */
export const LiquidGlassHeader: React.FC<LiquidGlassHeaderProps> = ({
  title,
  subtitle,
  stat,
  isPremium = false,
  showUpgradePrompt = false,
  onUpgradePress,
}) => {
  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={
          isPremium
            ? ['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.05)', 'transparent']
            : ['rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.05)', 'transparent']
        }
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Main header content */}
      <View style={styles.content}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          {isPremium && (
            <View style={styles.premiumBadgeHeader}>
              <Crown size={16} color="#FFD700" strokeWidth={2.5} />
              <Sparkles size={14} color="#FFD700" strokeWidth={2.5} />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* Stat Card */}
        {stat && (
          <View style={styles.statCardWrapper}>
            {isLiquidGlassSupported ? (
              <LiquidGlassView
                style={styles.statCard}
                interactive={false}
                effect={isPremium ? 'clear' : 'regular'}
                tintColor={isPremium ? 'rgba(255, 215, 0, 0.08)' : 'rgba(59, 130, 246, 0.08)'}
                colorScheme="system"
              >
                <StatContent stat={stat} isPremium={isPremium} />
              </LiquidGlassView>
            ) : (
              <LinearGradient
                colors={
                  isPremium
                    ? ['rgba(255, 215, 0, 0.2)', 'rgba(255, 215, 0, 0.08)']
                    : ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']
                }
                style={[styles.statCard, styles.fallbackStatCard]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <StatContent stat={stat} isPremium={isPremium} />
              </LinearGradient>
            )}
          </View>
        )}

        {/* Upgrade Prompt */}
        {showUpgradePrompt && !isPremium && (
          <Pressable onPress={onUpgradePress} style={styles.upgradePromptWrapper}>
            {isLiquidGlassSupported ? (
              <LiquidGlassView
                style={styles.upgradePrompt}
                interactive={true}
                effect="clear"
                tintColor="rgba(255, 215, 0, 0.1)"
                colorScheme="system"
              >
                <UpgradeContent />
              </LiquidGlassView>
            ) : (
              <LinearGradient
                colors={['rgba(255, 215, 0, 0.2)', 'rgba(255, 215, 0, 0.1)']}
                style={[styles.upgradePrompt, styles.fallbackUpgrade]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <UpgradeContent />
              </LinearGradient>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

const StatContent: React.FC<{ stat: any; isPremium: boolean }> = ({ stat, isPremium }) => (
  <View style={styles.statContent}>
    <View style={styles.statTextGroup}>
      <Text
        style={[
          styles.statValue,
          { color: Platform.select({ ios: PlatformColor('labelColor'), default: '#FFFFFF' }) },
        ]}
      >
        {stat.value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          { color: Platform.select({ ios: PlatformColor('secondaryLabelColor'), default: '#9CA3AF' }) },
        ]}
      >
        {stat.label}
      </Text>
    </View>
    {stat.trend !== undefined && (
      <View style={[styles.trendBadge, { backgroundColor: stat.trend >= 0 ? '#10B98120' : '#EF444420' }]}>
        <TrendingUp
          size={16}
          color={stat.trend >= 0 ? '#10B981' : '#EF4444'}
          strokeWidth={2.5}
          style={stat.trend < 0 ? { transform: [{ rotate: '180deg' }] } : {}}
        />
        <Text style={[styles.trendText, { color: stat.trend >= 0 ? '#10B981' : '#EF4444' }]}>
          {stat.trend >= 0 ? '+' : ''}
          {stat.trend}%
        </Text>
      </View>
    )}
  </View>
);

const UpgradeContent: React.FC = () => (
  <>
    <View style={styles.upgradeIcon}>
      <Crown size={24} color="#FFD700" strokeWidth={2.5} />
    </View>
    <View style={styles.upgradeText}>
      <Text
        style={[
          styles.upgradeTitle,
          { color: Platform.select({ ios: PlatformColor('labelColor'), default: '#FFFFFF' }) },
        ]}
      >
        Upgrade to All-Star
      </Text>
      <Text
        style={[
          styles.upgradeSubtitle,
          { color: Platform.select({ ios: PlatformColor('secondaryLabelColor'), default: '#9CA3AF' }) },
        ]}
      >
        Unlock 30 daily picks & premium analytics
      </Text>
    </View>
    <ChevronRight size={20} color="#FFD700" strokeWidth={2.5} />
  </>
);

/**
 * Compact Liquid Glass Section Header
 */
export const LiquidGlassSectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onPress: () => void;
  };
  isPremium?: boolean;
}> = ({ title, subtitle, icon, action, isPremium = false }) => {
  return (
    <View style={styles.sectionHeaderContainer}>
      {isLiquidGlassSupported ? (
        <LiquidGlassView
          style={styles.sectionHeader}
          interactive={false}
          effect="regular"
          tintColor={isPremium ? 'rgba(255, 215, 0, 0.05)' : undefined}
          colorScheme="system"
        >
          <SectionHeaderContent title={title} subtitle={subtitle} icon={icon} action={action} />
        </LiquidGlassView>
      ) : (
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']}
          style={[styles.sectionHeader, styles.fallbackSection]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SectionHeaderContent title={title} subtitle={subtitle} icon={icon} action={action} />
        </LinearGradient>
      )}
    </View>
  );
};

const SectionHeaderContent: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: any;
}> = ({ title, subtitle, icon, action }) => (
  <>
    <View style={styles.sectionHeaderLeft}>
      {icon && <View style={styles.sectionIcon}>{icon}</View>}
      <View>
        <Text
          style={[
            styles.sectionTitle,
            { color: Platform.select({ ios: PlatformColor('labelColor'), default: '#FFFFFF' }) },
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[
              styles.sectionSubtitle,
              { color: Platform.select({ ios: PlatformColor('secondaryLabelColor'), default: '#9CA3AF' }) },
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </View>
    {action && (
      <Pressable onPress={action.onPress} style={styles.sectionAction}>
        <Text style={styles.actionText}>{action.label}</Text>
        <ChevronRight size={16} color="#8B5CF6" strokeWidth={2.5} />
      </Pressable>
    )}
  </>
);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    paddingVertical: 24,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  titleSection: {
    gap: 6,
  },
  premiumBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  statCardWrapper: {
    marginTop: 4,
  },
  statCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  fallbackStatCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
  },
  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statTextGroup: {
    gap: 4,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  trendText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  upgradePromptWrapper: {
    marginTop: 4,
  },
  upgradePrompt: {
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  fallbackUpgrade: {
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
  },
  upgradeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeText: {
    flex: 1,
    gap: 2,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  upgradeSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionHeaderContainer: {
    marginVertical: 8,
  },
  sectionHeader: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  fallbackSection: {
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
});
