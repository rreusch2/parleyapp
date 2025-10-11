import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  PlatformColor,
  Platform,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { LiquidGlassCard, LiquidGlassStatCard, AdaptiveText } from './LiquidGlassCard';
import { PremiumLiquidGlassPickCard, PremiumLiquidGlassPicksContainer } from './PremiumLiquidGlassPicks';
import { LiquidGlassInsightCard, LiquidGlassInsightsGrid } from './LiquidGlassInsights';
import {
  Crown,
  TrendingUp,
  Target,
  Zap,
  Star,
  Activity,
  Award,
  DollarSign,
} from 'lucide-react-native';

/**
 * Elite Liquid Glass Showcase
 * Demonstration of all liquid glass components with premium styling
 */
export const LiquidGlassShowcase: React.FC = () => {
  const [isPremiumMode, setIsPremiumMode] = useState(true);

  // Mock data for demonstration
  const mockPicks = [
    {
      id: '1',
      match_teams: 'Los Angeles Dodgers @ San Francisco Giants',
      pick: 'Dodgers ML',
      odds: '-145',
      confidence: 78,
      bet_type: 'Moneyline',
      reasoning: 'Strong pitching matchup favors Dodgers rotation. Giants bullpen showing fatigue after recent series.',
    },
    {
      id: '2',
      match_teams: 'New York Yankees @ Boston Red Sox',
      pick: 'Over 9.5 Runs',
      odds: '+105',
      confidence: 72,
      bet_type: 'Total',
      reasoning: 'Both teams hitting well against similar pitching styles. Weather conditions favor hitters.',
    },
    {
      id: '3',
      match_teams: 'Chicago Cubs @ St. Louis Cardinals',
      pick: 'Cardinals -1.5',
      odds: '+130',
      confidence: 65,
      bet_type: 'Spread',
      reasoning: 'Cardinals have dominated at home. Cubs struggling on the road with 2-8 record.',
    },
  ];

  const mockInsights = [
    {
      id: '1',
      title: 'Hot Bats in the Bronx',
      content: 'Yankees averaging 6.2 runs over last 10 games. Aaron Judge heating up with .420 avg in last week.',
      category: 'trends',
      confidence: 82,
    },
    {
      id: '2',
      title: 'Injury Alert: Star Pitcher Out',
      content: 'Dodgers ace scratched from tonight\'s start. Replacement pitcher has 5.80 ERA in last 3 outings.',
      category: 'injury',
      confidence: 95,
    },
    {
      id: '3',
      title: 'Bullpen Vulnerability Exposed',
      content: 'Red Sox bullpen blown 4 of last 5 save opportunities. Late-game totals showing value.',
      category: 'bullpen',
      confidence: 76,
    },
    {
      id: '4',
      title: 'Weather Factor: Wind Blowing Out',
      content: '15+ mph winds blowing out to right field at Wrigley. Historical data shows 3+ more runs scored.',
      category: 'research',
      confidence: 88,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.titleRow}>
                <Crown size={32} color="#FFD700" strokeWidth={2.5} />
                <Text style={styles.title}>Liquid Glass</Text>
              </View>
              <Text style={styles.subtitle}>
                {isLiquidGlassSupported ? 'iOS 26 Premium Effect' : 'Elegant Fallback UI'}
              </Text>
            </View>
            
            <View style={styles.premiumToggle}>
              <Text style={styles.toggleLabel}>Elite Mode</Text>
              <Switch
                value={isPremiumMode}
                onValueChange={setIsPremiumMode}
                trackColor={{ false: '#374151', true: '#FFD70060' }}
                thumbColor={isPremiumMode ? '#FFD700' : '#9CA3AF'}
              />
            </View>
          </View>

          {/* Support Badge */}
          <LiquidGlassCard
            style={styles.supportBadge}
            effect="clear"
            tintColor={isLiquidGlassSupported ? '#10B98120' : '#EF444420'}
          >
            <View style={styles.supportContent}>
              <View
                style={[
                  styles.supportDot,
                  { backgroundColor: isLiquidGlassSupported ? '#10B981' : '#EF4444' },
                ]}
              />
              <AdaptiveText style={styles.supportText}>
                {isLiquidGlassSupported
                  ? 'Native Liquid Glass Active'
                  : 'Fallback Mode (iOS < 26)'}
              </AdaptiveText>
            </View>
          </LiquidGlassCard>
        </View>

        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statRow}>
              <LiquidGlassStatCard
                title="Win Rate"
                value="73%"
                subtitle="Last 30 days"
                icon={<Award size={24} color="#10B981" strokeWidth={2.5} />}
                accentColor="#10B981"
                interactive={true}
                premium={isPremiumMode}
              />
            </View>
            
            <View style={styles.statRow}>
              <LiquidGlassStatCard
                title="Total Profit"
                value="$2,847"
                subtitle="+18.4% ROI"
                icon={<DollarSign size={24} color="#3B82F6" strokeWidth={2.5} />}
                accentColor="#3B82F6"
                interactive={true}
                premium={isPremiumMode}
              />
            </View>

            <View style={styles.statRow}>
              <LiquidGlassStatCard
                title="Hot Streak"
                value="7"
                subtitle="Consecutive wins"
                icon={<Zap size={24} color="#F59E0B" strokeWidth={2.5} fill="#F59E0B" />}
                accentColor="#F59E0B"
                interactive={true}
                premium={isPremiumMode}
              />
            </View>
          </View>
        </View>

        {/* AI Picks Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI Predictions</Text>
            <View style={styles.badge}>
              <Target size={14} color="#8B5CF6" strokeWidth={2.5} />
              <Text style={styles.badgeText}>{mockPicks.length} Picks</Text>
            </View>
          </View>
          
          <View style={styles.picksContainer}>
            {mockPicks.map((pick, index) => (
              <PremiumLiquidGlassPickCard
                key={pick.id}
                matchTeams={pick.match_teams}
                pick={pick.pick}
                odds={pick.odds}
                confidence={pick.confidence}
                betType={pick.bet_type}
                reasoning={pick.reasoning}
                isPremium={isPremiumMode && index === 0}
                onPress={() => console.log('Pick pressed:', pick.id)}
              />
            ))}
          </View>
        </View>

        {/* Insights Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Smart Insights</Text>
            <View style={styles.badge}>
              <TrendingUp size={14} color="#10B981" strokeWidth={2.5} />
              <Text style={styles.badgeText}>{mockInsights.length} Insights</Text>
            </View>
          </View>

          <View style={styles.insightsContainer}>
            {mockInsights.map((insight, index) => (
              <LiquidGlassInsightCard
                key={insight.id}
                title={insight.title}
                content={insight.content}
                category={insight.category}
                confidence={insight.confidence}
                isPremium={isPremiumMode && index < 2}
                onPress={() => console.log('Insight pressed:', insight.id)}
              />
            ))}
          </View>
        </View>

        {/* Feature Highlights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Elite Features</Text>
          
          <LiquidGlassCard
            style={styles.featureCard}
            effect="clear"
            glowEffect={isPremiumMode}
            premium={isPremiumMode}
            interactive={true}
          >
            <View style={styles.featureContent}>
              <View style={styles.featureIcon}>
                <Star size={28} color="#FFD700" strokeWidth={2.5} fill="#FFD700" />
              </View>
              <View style={styles.featureText}>
                <AdaptiveText style={styles.featureTitle}>
                  Advanced Analytics
                </AdaptiveText>
                <AdaptiveText style={styles.featureDescription}>
                  AI-powered insights with real-time data analysis and predictive modeling
                </AdaptiveText>
              </View>
            </View>
          </LiquidGlassCard>

          <LiquidGlassCard
            style={styles.featureCard}
            effect="clear"
            glowEffect={isPremiumMode}
            premium={isPremiumMode}
            interactive={true}
          >
            <View style={styles.featureContent}>
              <View style={styles.featureIcon}>
                <Activity size={28} color="#8B5CF6" strokeWidth={2.5} />
              </View>
              <View style={styles.featureText}>
                <AdaptiveText style={styles.featureTitle}>
                  Live Odds Tracking
                </AdaptiveText>
                <AdaptiveText style={styles.featureDescription}>
                  Real-time odds updates from multiple sportsbooks with line movement alerts
                </AdaptiveText>
              </View>
            </View>
          </LiquidGlassCard>
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  premiumToggle: {
    alignItems: 'flex-end',
    gap: 6,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  supportBadge: {
    padding: 12,
    borderRadius: 12,
  },
  supportContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  supportDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  supportText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 20,
    paddingTop: 0,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  statsGrid: {
    gap: 12,
  },
  statRow: {
    flex: 1,
  },
  picksContainer: {
    gap: 16,
  },
  insightsContainer: {
    gap: 12,
  },
  featureCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
  },
  featureContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  bottomPadding: {
    height: 40,
  },
});

export default LiquidGlassShowcase;
