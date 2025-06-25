import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  TrendingUp, 
  Target, 
  Calendar, 
  Filter, 
  BarChart3,
  Clock,
  Zap,
  Eye,
  Star,
  Trophy,
  Activity,
  Crown,
  Lock,
  ChevronRight,
  Brain,
  Shield,
  DollarSign
} from 'lucide-react-native';
import { aiService, AIPrediction } from '@/app/services/api/aiService';
import { useSubscription } from '@/app/services/subscriptionContext';
import EnhancedPredictionCard from '@/app/components/EnhancedPredictionCard';
import { useAIChat } from '@/app/services/aiChatContext';

const { width: screenWidth } = Dimensions.get('window');

export default function PredictionsScreen() {
  const { isPro, proFeatures, subscribeToPro, openSubscriptionModal } = useSubscription();
  const { openChatWithContext, setSelectedPick } = useAIChat();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [predictions, setPredictions] = useState<AIPrediction[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'high' | 'value'>('all');
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [selectedPrediction, setSelectedPrediction] = useState<AIPrediction | null>(null);

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    setLoading(true);
    try {
      const data = await aiService.getTodaysPicks();
      setPredictions(data);
    } catch (error) {
      console.error('Error loading predictions:', error);
      Alert.alert('Error', 'Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPredictions();
    setRefreshing(false);
  };



  const getFilteredPredictions = () => {
    let filtered = predictions;

    // Pro-only filters
    if (isPro) {
      if (filterType === 'high') {
        filtered = filtered.filter(p => p.confidence >= 85);
      } else if (filterType === 'value') {
        filtered = filtered.filter(p => (p.value || 0) >= 10);
      }

      if (selectedSport !== 'all') {
        filtered = filtered.filter(p => p.sport.toLowerCase() === selectedSport.toLowerCase());
      }
    } else {
      // Free users only see first 2 predictions
      filtered = filtered.slice(0, 2);
    }

    return filtered;
  };

  const handlePredictionAnalyze = (prediction: AIPrediction) => {
    setSelectedPrediction(prediction);
    setSelectedPick(prediction);
    
    // Create a custom prompt for this specific prediction
    const customPrompt = `Analyze this AI prediction in detail:

🏟️ Match: ${prediction.match}
🏈 Sport: ${prediction.sport}
🎯 Pick: ${prediction.pick}
📊 Odds: ${prediction.odds}
🔥 Confidence: ${prediction.confidence}%
${prediction.value ? `💰 Edge: +${prediction.value}%` : ''}

💭 AI Reasoning: ${prediction.reasoning}

Please provide deeper analysis on:
- Why this pick has potential
- Key factors that could affect the outcome
- Risk assessment and betting strategy
- Any additional insights you can provide

What are your thoughts on this prediction?`;
    
    openChatWithContext({ 
      screen: 'predictions', 
      selectedPrediction: prediction,
      customPrompt: customPrompt
    }, prediction);
  };

  const filteredPredictions = getFilteredPredictions();
  const sports = ['all', ...Array.from(new Set(predictions.map(p => p.sport)))];

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E5FF"
            colors={['#00E5FF']}
          />
        }
      >
        {/* Header Stats */}
        <LinearGradient
          colors={isPro ? ['#7C3AED', '#1E40AF'] : ['#334155', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerStats}
        >
          {isPro && (
            <View style={styles.proBadge}>
              <Crown size={16} color="#F59E0B" />
              <Text style={styles.proBadgeText}>PRO MEMBER</Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Activity size={20} color="#00E5FF" />
              <Text style={styles.statValue}>
                {isPro ? predictions.length : `${Math.min(predictions.length, 2)}/2`}
              </Text>
              <Text style={styles.statLabel}>
                {isPro ? 'Total Picks' : 'Daily Picks'}
              </Text>
            </View>
            
            <View style={styles.statCard}>
              <Target size={20} color="#10B981" />
              <Text style={styles.statValue}>
                {isPro ? predictions.filter(p => p.confidence >= 85).length : '?'}
              </Text>
              <Text style={styles.statLabel}>High Confidence</Text>
              {!isPro && (
                <View style={styles.lockOverlay}>
                  <Lock size={14} color="#64748B" />
                </View>
              )}
            </View>
            
            <View style={styles.statCard}>
              <TrendingUp size={20} color="#F59E0B" />
              <Text style={styles.statValue}>
                {isPro ? predictions.filter(p => (p.value || 0) >= 10).length : '?'}
              </Text>
              <Text style={styles.statLabel}>Value Bets</Text>
              {!isPro && (
                <View style={styles.lockOverlay}>
                  <Lock size={14} color="#64748B" />
                </View>
              )}
            </View>
          </View>

          {!isPro && (
            <TouchableOpacity 
              style={styles.upgradePrompt}
              onPress={openSubscriptionModal}
            >
              <LinearGradient
                colors={['#00E5FF', '#0891B2']}
                style={styles.upgradeGradient}
              >
                <Crown size={16} color="#FFFFFF" />
                <Text style={styles.upgradeText}>
                  Unlock unlimited picks & advanced analytics
                </Text>
                <ChevronRight size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Filter Controls */}
        {isPro ? (
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Filter Predictions</Text>
            
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                {['all', 'high', 'value'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterChip,
                      filterType === type && styles.filterChipActive
                    ]}
                    onPress={() => setFilterType(type as any)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      filterType === type && styles.filterChipTextActive
                    ]}>
                      {type === 'all' ? 'All Picks' : type === 'high' ? 'High Confidence' : 'Value Bets'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                {sports.map(sport => (
                  <TouchableOpacity
                    key={sport}
                    style={[
                      styles.sportChip,
                      selectedSport === sport && styles.sportChipActive
                    ]}
                    onPress={() => setSelectedSport(sport)}
                  >
                    <Text style={[
                      styles.sportChipText,
                      selectedSport === sport && styles.sportChipTextActive
                    ]}>
                      {sport === 'all' ? 'All Sports' : sport.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Pro Features Info */}
            <View style={styles.proFeaturesInfo}>
              <View style={styles.proFeature}>
                <Brain size={16} color="#00E5FF" />
                <Text style={styles.proFeatureText}>AI-Powered Analysis</Text>
              </View>
              <View style={styles.proFeature}>
                <Shield size={16} color="#10B981" />
                <Text style={styles.proFeatureText}>Risk Assessment</Text>
              </View>
              <View style={styles.proFeature}>
                <DollarSign size={16} color="#F59E0B" />
                <Text style={styles.proFeatureText}>Kelly Calculations</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.filterSection}>
            <View style={styles.lockedFilters}>
              <Lock size={20} color="#64748B" />
              <Text style={styles.lockedFiltersText}>
                Advanced filters available with Pro
              </Text>
            </View>
          </View>
        )}



        {/* Predictions List */}
        <View style={styles.predictionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isPro ? 'All AI Predictions' : 'Your Daily Picks'}
            </Text>
            <Text style={styles.resultCount}>{filteredPredictions.length} results</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00E5FF" />
              <Text style={styles.loadingText}>Loading predictions...</Text>
            </View>
          ) : filteredPredictions.length === 0 ? (
            <View style={styles.emptyState}>
              <Trophy size={48} color="#64748B" />
              <Text style={styles.emptyStateTitle}>No predictions found</Text>
              <Text style={styles.emptyStateText}>
                Try adjusting your filters or generate new predictions
              </Text>
            </View>
          ) : (
            <View style={styles.predictionsContainer}>
              {filteredPredictions.map((prediction, index) => (
                <EnhancedPredictionCard
                  key={prediction.id}
                  prediction={prediction}
                  index={index}
                  onAnalyze={() => handlePredictionAnalyze(prediction)}
                />
              ))}

              {/* Show locked predictions for free users */}
              {!isPro && predictions.length > 2 && (
                <View style={styles.proUpgradeCard}>
                  <LinearGradient
                    colors={['#1a1a2e', '#16213e']}
                    style={styles.upgradeCard}
                  >
                    <View style={styles.upgradeContent}>
                      <View style={styles.upgradeIcon}>
                        <Lock size={32} color="#00E5FF" />
                      </View>
                      <Text style={styles.upgradeTitle}>
                        {predictions.length - 2} More Predictions Available
                      </Text>
                      <Text style={styles.upgradeSubtitle}>Pro Feature</Text>
                      <Text style={styles.upgradeDescription}>
                        Access all predictions with advanced filters, confidence scoring, 
                        value betting analysis, and detailed AI reasoning.
                      </Text>
                      <TouchableOpacity style={styles.upgradeButton} onPress={openSubscriptionModal}>
                        <LinearGradient
                          colors={['#00E5FF', '#0891B2']}
                          style={styles.upgradeButtonGradient}
                        >
                          <Crown size={16} color="#0F172A" />
                          <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                          <ChevronRight size={16} color="#0F172A" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Smart Betting Calculator Upgrade Card - Free Users Only */}
        {!isPro && (
          <View style={styles.section}>
            <View style={styles.proUpgradeCard}>
              <LinearGradient
                colors={['#1a1a2e', '#16213e']}
                style={styles.upgradeCard}
              >
                <View style={styles.upgradeContent}>
                  <View style={styles.upgradeIcon}>
                    <DollarSign size={32} color="#00E5FF" />
                  </View>
                  <Text style={styles.upgradeTitle}>Smart Betting Calculator</Text>
                  <Text style={styles.upgradeSubtitle}>Pro Feature</Text>
                  <Text style={styles.upgradeDescription}>
                    Kelly criterion calculations, bankroll management, optimal bet sizing, 
                    ROI tracking, and advanced risk assessment tools.
                  </Text>
                  <TouchableOpacity style={styles.upgradeButton} onPress={openSubscriptionModal}>
                    <LinearGradient
                      colors={['#00E5FF', '#0891B2']}
                      style={styles.upgradeButtonGradient}
                    >
                      <Crown size={16} color="#0F172A" />
                      <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                      <ChevronRight size={16} color="#0F172A" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Predictions are generated by our advanced AI models and are for entertainment purposes only.
          </Text>
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  headerStats: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    position: 'relative',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 10,
    right: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    position: 'relative',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#E2E8F0',
    textAlign: 'center',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradePrompt: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  filterSection: {
    padding: 16,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterScrollView: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
  sportChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sportChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  sportChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  sportChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  lockedFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  lockedFiltersText: {
    color: '#64748B',
    fontSize: 14,
    marginLeft: 8,
  },
  proFeaturesInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  proFeature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proFeatureText: {
    fontSize: 12,
    color: '#E2E8F0',
    marginLeft: 6,
    fontWeight: '500',
  },

  predictionsSection: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultCount: {
    fontSize: 14,
    color: '#94A3B8',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  predictionsContainer: {
    marginBottom: 20,
  },
  lockedPredictions: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  lockedGradient: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 16,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 12,
    marginBottom: 8,
  },
  lockedSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  unlockButtonText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  
  // Pro Upgrade Card Styles (consistent with RecurringTrends)
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  proUpgradeCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  upgradeCard: {
    padding: 24,
  },
  upgradeContent: {
    alignItems: 'center',
  },
  upgradeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  upgradeSubtitle: {
    fontSize: 12,
    color: '#00E5FF',
    marginBottom: 16,
    fontWeight: '600',
  },
  upgradeDescription: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: 8,
  },
  
  footer: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});