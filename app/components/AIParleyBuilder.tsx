import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
  Target,
  Layers,
  Users,
  BarChart3,
  Trophy
} from 'lucide-react-native';
import { useUITheme } from '../services/uiThemeContext';
import { useSubscription } from '../services/subscriptionContext';
import ParlayModal from '../components/ParlayModal';

interface ParlayConfig {
  legs: number;
  risk: 'conservative' | 'balanced' | 'aggressive';
  type: 'team' | 'props' | 'mixed';
}

export default function AIParleyBuilder() {
  const { theme } = useUITheme();
  const { isPro, isElite, openSubscriptionModal } = useSubscription();
  const [config, setConfig] = useState<ParlayConfig>({
    legs: 3,
    risk: 'balanced',
    type: 'mixed',
  });
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [parlayData, setParlayData] = useState<any>(null);

  const legOptions = [
    { value: 2, label: '2-Leg', icon: Layers },
    { value: 3, label: '3-Leg', icon: Target },
    { value: 4, label: '4-Leg', icon: TrendingUp },
    { value: 5, label: '5-Leg', icon: Trophy },
  ];

  const riskOptions = [
    { value: 'conservative' as const, label: 'Conservative', icon: Shield, gradient: ['#10B981', '#059669'] as any },
    { value: 'balanced' as const, label: 'Balanced', icon: BarChart3, gradient: ['#00E5FF', '#0EA5E9'] as any },
    { value: 'aggressive' as const, label: 'Aggressive', icon: Zap, gradient: ['#F59E0B', '#DC2626'] as any },
  ];

  const typeOptions = [
    { value: 'team' as const, label: 'Team Bets', icon: Users, desc: 'Spreads, totals, moneylines' },
    { value: 'props' as const, label: 'Player Props', icon: Target, desc: 'Player performance bets' },
    { value: 'mixed' as const, label: 'Mixed', icon: Sparkles, desc: 'Best of both worlds' },
  ];

  const handleGenerate = async () => {
    if (!isPro && !isElite) {
      openSubscriptionModal();
      return;
    }

    setLoading(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      const response = await fetch(`${baseUrl}/api/ai/parlay/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          legs: config.legs,
          risk: config.risk,
          type: config.type,
          userTier: isElite ? 'elite' : 'pro',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setParlayData(data.parlay);
        setModalVisible(true);
      } else {
        console.error('Failed to generate parlay:', data.error);
      }
    } catch (error) {
      console.error('Error generating parlay:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <View style={[
        styles.container,
        { backgroundColor: theme.cardSurface, borderColor: theme.borderColor }
      ]}>
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={isElite ? (theme.ctaGradient as any) : (['#8B5CF6', '#EC4899', '#F59E0B'] as any)}
            style={styles.iconGradient}
          >
            <Sparkles size={24} color="white" />
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.cardTextPrimary }]}>
              AI Parlay Builder
            </Text>
            <Text style={[styles.subtitle, { color: theme.surfaceSecondaryText }]}>
              {isPro || isElite ? 'Let AI build your perfect parlay' : 'Pro Feature - Unlock intelligent parlays'}
            </Text>
          </View>
          {!isPro && !isElite && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>

        {/* Number of Legs */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.cardTextPrimary }]}>
            Number of Legs
          </Text>
          <View style={styles.optionsRow}>
            {legOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = config.legs === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setConfig({ ...config, legs: option.value })}
                  style={[
                    styles.legOption,
                    isSelected && styles.selectedLegOption,
                    { 
                      backgroundColor: isSelected 
                        ? `${theme.accentPrimary}1A` 
                        : theme.surfaceSecondary,
                      borderColor: isSelected 
                        ? theme.accentPrimary 
                        : theme.borderColor
                    }
                  ]}
                  disabled={!isPro && !isElite}
                >
                  <Icon 
                    size={20} 
                    color={isSelected ? theme.accentPrimary : theme.surfaceSecondaryText} 
                  />
                  <Text style={[
                    styles.legOptionText,
                    { color: isSelected ? theme.accentPrimary : theme.surfaceSecondaryText }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Risk Level */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.cardTextPrimary }]}>
            Risk Tolerance
          </Text>
          <View style={styles.riskOptionsContainer}>
            {riskOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = config.risk === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setConfig({ ...config, risk: option.value })}
                  style={[styles.riskOption]}
                  disabled={!isPro && !isElite}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={option.gradient}
                      style={styles.riskOptionGradient}
                    >
                      <Icon size={18} color="white" />
                      <Text style={styles.riskOptionTextSelected}>
                        {option.label}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={[
                      styles.riskOptionInactive,
                      { backgroundColor: theme.surfaceSecondary, borderColor: theme.borderColor }
                    ]}>
                      <Icon size={18} color={theme.surfaceSecondaryText} />
                      <Text style={[
                        styles.riskOptionTextInactive,
                        { color: theme.surfaceSecondaryText }
                      ]}>
                        {option.label}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bet Type */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.cardTextPrimary }]}>
            Bet Type
          </Text>
          <View style={styles.typeOptionsContainer}>
            {typeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = config.type === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setConfig({ ...config, type: option.value })}
                  style={[
                    styles.typeOption,
                    {
                      backgroundColor: isSelected 
                        ? `${theme.accentPrimary}1A` 
                        : theme.surfaceSecondary,
                      borderColor: isSelected 
                        ? theme.accentPrimary 
                        : theme.borderColor
                    }
                  ]}
                  disabled={!isPro && !isElite}
                >
                  <Icon 
                    size={20} 
                    color={isSelected ? theme.accentPrimary : theme.surfaceSecondaryText} 
                  />
                  <View style={styles.typeOptionText}>
                    <Text style={[
                      styles.typeOptionLabel,
                      { color: isSelected ? theme.accentPrimary : theme.cardTextPrimary }
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[
                      styles.typeOptionDesc,
                      { color: theme.surfaceSecondaryText }
                    ]}>
                      {option.desc}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={loading || (!isPro && !isElite)}
          style={styles.generateButton}
        >
          <LinearGradient
            colors={
              !isPro && !isElite
                ? ['#64748B', '#475569'] as any
                : isElite 
                ? (theme.ctaGradient as any)
                : (['#8B5CF6', '#EC4899'] as any)
            }
            style={styles.generateGradient}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.generateButtonText}>Generating...</Text>
              </>
            ) : (
              <>
                <Sparkles size={20} color="white" />
                <Text style={styles.generateButtonText}>
                  {!isPro && !isElite ? 'Unlock AI Parlay Builder' : 'Generate Smart Parlay'}
                </Text>
                <TrendingUp size={20} color="white" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Info Footer */}
        {(isPro || isElite) && (
          <View style={[styles.footer, { backgroundColor: `${theme.accentPrimary}0A` }]}>
            <Text style={[styles.footerText, { color: theme.surfaceSecondaryText }]}>
              🤖 AI analyzes odds, trends, and insights to build optimal parlays
            </Text>
          </View>
        )}
      </View>

      {/* Parlay Modal */}
      <ParlayModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        parlayData={parlayData}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconGradient: {
    borderRadius: 24,
    padding: 10,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  proBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  proBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  legOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 6,
  },
  selectedLegOption: {
    // Styles applied inline
  },
  legOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  riskOptionsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  riskOption: {
    flex: 1,
  },
  riskOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  riskOptionInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  riskOptionTextSelected: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  riskOptionTextInactive: {
    fontSize: 14,
    fontWeight: '500',
  },
  typeOptionsContainer: {
    gap: 10,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  typeOptionText: {
    flex: 1,
  },
  typeOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  typeOptionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  generateButton: {
    marginBottom: 12,
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 10,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    padding: 12,
    borderRadius: 10,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
