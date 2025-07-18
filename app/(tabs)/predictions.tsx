import React, { useState, useEffect } from 'react';
import { normalize, isTablet } from '@/app/services/device';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Alert,
  Dimensions
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
import { TwoTabPredictionsLayout } from '@/app/components/TwoTabPredictionsLayout';
import { useAIChat } from '@/app/services/aiChatContext';
import { supabase } from '@/app/services/api/supabaseClient';

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
  
  // NEW: Track welcome bonus status and new user status
  const [welcomeBonusActive, setWelcomeBonusActive] = useState(false);
  const [welcomeBonusExpires, setWelcomeBonusExpires] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    loadPredictions();
  }, [isPro]); // Added isPro to dependencies to re-render when subscription changes

  const loadPredictions = async () => {
    setLoading(true);
    try {
      // For Pro users, fetch all today's predictions directly from Supabase
      // For Free users, use the existing service with limits
      if (isPro) {
        // Fetch directly from ai_predictions table for Pro users (10 most recent)
        const { data: rawPredictions, error } = await supabase
          .from('ai_predictions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching predictions from database:', error);
          throw error;
        }

        // Transform database records to AIPrediction interface
        const transformedPredictions: AIPrediction[] = (rawPredictions || []).map(pred => ({
          id: pred.id,
          match: pred.match_teams || 'TBD vs TBD',
          pick: pred.pick,
          odds: pred.odds,
          confidence: pred.confidence,
          sport: pred.sport,
          eventTime: pred.event_time || pred.created_at,
          reasoning: pred.reasoning || 'AI-generated prediction',
          value: pred.value_percentage ? parseFloat(pred.value_percentage) : undefined,
          roi_estimate: pred.roi_estimate ? parseFloat(pred.roi_estimate) : undefined,
          status: pred.status as 'pending' | 'won' | 'lost',
          created_at: pred.created_at
        }));

        console.log(`🎯 Loaded ${transformedPredictions.length} predictions for Pro user from database`);
        setPredictions(transformedPredictions);
      } else {
        // For free users, use the existing service WITH user context for welcome bonus logic
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;
        const currentUserTier = 'free';
        
        // Get picks with welcome bonus logic applied - this returns the full API response
        const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
        const apiResponse = await fetch(`${baseUrl}/api/ai/picks?userId=${currentUserId}&userTier=${currentUserTier}`);
        
        const data = await apiResponse.json();
        
        if (data.success && data.predictions) {
          setPredictions(data.predictions);
          
          // Check if this is a new user scenario or welcome bonus scenario
          if (data.metadata) {
            const isNewUserScenario = data.metadata.isNewUser || false;
            const bonusActiveFromAPI = data.metadata.welcomeBonusActive || false;
            
            setIsNewUser(isNewUserScenario);
            setWelcomeBonusActive(bonusActiveFromAPI);
            
            console.log(`📊 Predictions API Metadata:`, JSON.stringify(data.metadata, null, 2));
            
            if (isNewUserScenario) {
              console.log(`🆕 New user on Predictions tab: ${data.predictions.length} picks (automatic welcome bonus)`);
            } else if (bonusActiveFromAPI) {
              console.log(`🎁 Welcome bonus active on Predictions tab: ${data.predictions.length} picks`);
            } else {
              console.log(`🎲 Free user on Predictions tab: ${data.predictions.length} picks`);
            }
          }
          
          // Also check database welcome bonus status for additional context
          if (currentUserId && !data.metadata?.isNewUser) {
            try {
              const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
              const response = await fetch(`${baseUrl}/api/user/welcome-bonus-status?userId=${currentUserId}`);
              const bonusData = await response.json();
              
              if (bonusData.success && bonusData.status.welcome_bonus_active) {
                setWelcomeBonusActive(true);
                setWelcomeBonusExpires(bonusData.status.welcome_bonus_expires_at);
              }
            } catch (error) {
              console.error('Error fetching welcome bonus status:', error);
            }
          }
        } else {
          // Fallback to the original service method
          const fallbackData = await aiService.getTodaysPicks(currentUserId, currentUserTier);
          setPredictions(fallbackData);
        }
      }
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
      // NEW: For free users, show all picks if they're new users OR have welcome bonus active
      // Otherwise limit to 2 picks
      const hasExtendedAccess = isNewUser || welcomeBonusActive;
      
      if (!hasExtendedAccess) {
        filtered = filtered.slice(0, 2);
      }
      // If new user or welcome bonus is active, show all picks returned by backend (usually 5)
    }

    return filtered;
  };

  const handlePredictionAnalyze = (prediction: AIPrediction) => {
    setSelectedPrediction(prediction);
    setSelectedPick(prediction);
    
    // NEW: During welcome bonus OR for new users, allow full analysis like Pro users
    const hasAnalysisAccess = isPro || welcomeBonusActive || isNewUser;
    
    if (!hasAnalysisAccess) {
      Alert.alert(
        'Pro Feature 🌟',
        'Get detailed AI analysis of every pick with Pro!',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { 
            text: 'Upgrade to Pro', 
            onPress: openSubscriptionModal,
            style: 'default'
          }
        ]
      );
      return;
    }
    
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

  // 🔥 NEW: For Pro users, show the enhanced two-tab layout
  if (isPro) {
    return (
      <View style={styles.container}>
        <TwoTabPredictionsLayout user={{ id: 'current_user', isPro: true }} />
      </View>
    );
  }

  // For Free users, show the existing limited layout with upgrade prompts
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
              <Crown size={16} color="#00E5FF" />
              <Text style={styles.proBadgeText}>PRO MEMBER</Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Activity size={20} color="#00E5FF" />
              <Text style={styles.statValue}>
                {isPro ? predictions.length : 
                 (isNewUser || welcomeBonusActive) ? `${predictions.length}/5` : 
                 `${Math.min(predictions.length, 2)}/2`}
              </Text>
              <Text style={styles.statLabel}>
                {isPro ? 'Total Picks' : 
                 isNewUser ? 'Welcome Picks' :
                 welcomeBonusActive ? 'Bonus Picks' : 
                 'Daily Picks'}
              </Text>
              {(isNewUser || welcomeBonusActive) && !isPro && (
                <View style={styles.bonusBadge}>
                  <Text style={styles.bonusText}>{isNewUser ? '🆕' : '🎁'}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.statCard}>
              <Target size={20} color="#10B981" />
              <Text style={styles.statValue}>
                {isPro || isNewUser || welcomeBonusActive ? 
                  predictions.filter(p => p.confidence >= 85).length : '?'}
              </Text>
              <Text style={styles.statLabel}>High Confidence</Text>
              {!isPro && !isNewUser && !welcomeBonusActive && (
                <View style={styles.lockOverlay}>
                  <Lock size={14} color="#64748B" />
                </View>
              )}
            </View>
            
            <View style={styles.statCard}>
              <TrendingUp size={20} color="#8B5CF6" />
              <Text style={styles.statValue}>
                {isPro || isNewUser || welcomeBonusActive ? 
                  predictions.filter(p => (p.value || 0) >= 10).length : '?'}
              </Text>
              <Text style={styles.statLabel}>Value Bets</Text>
              {!isPro && !isNewUser && !welcomeBonusActive && (
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
                colors={(isNewUser || welcomeBonusActive) ? ['#00E5FF', '#0891B2'] : ['#00E5FF', '#0891B2']}
                style={styles.upgradeGradient}
              >
                <Crown size={16} color="#FFFFFF" />
                <Text style={styles.upgradeText}>
                  {isNewUser ? 
                    'Enjoying the 5 picks? Upgrade for 20 daily picks forever!' :
                    welcomeBonusActive ? 
                      'Love the bonus? Upgrade for 20 daily picks forever!' :
                      'Unlock all Pro features'}
                </Text>
                <ChevronRight size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {/* Welcome Bonus Timer - only for actual welcome bonus, not new users */}
          {welcomeBonusActive && !isNewUser && !isPro && welcomeBonusExpires && (
            <View style={styles.bonusTimer}>
              <Text style={styles.bonusTimerText}>
                🎁 Welcome Bonus Active • Expires {new Date(welcomeBonusExpires).toLocaleDateString()}
              </Text>
            </View>
          )}
          
          {/* New User Welcome Message */}
          {isNewUser && !isPro && (
            <View style={styles.bonusTimer}>
              <Text style={styles.bonusTimerText}>
                🆕 Welcome! You're getting 5 picks to try our AI predictions
              </Text>
            </View>
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
                <DollarSign size={16} color="#8B5CF6" />
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
              {isPro ? 'All AI Predictions' : 
               isNewUser ? 'Your Welcome Picks' :
               welcomeBonusActive ? 'Your Welcome Bonus Picks' : 
               'Your Daily Picks'}
            </Text>
            <Text style={styles.resultCount}>
              {filteredPredictions.length} results
              {isNewUser && !isPro && ' (new user)'}
              {welcomeBonusActive && !isNewUser && !isPro && ' (bonus active)'}
            </Text>
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
                  welcomeBonusActive={welcomeBonusActive || isNewUser}
                />
              ))}

              {/* Show locked predictions for free users (only when NOT new user and welcome bonus is NOT active) */}
              {!isPro && !isNewUser && !welcomeBonusActive && predictions.length > 2 && (
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
                        Unlock 20 Daily Predictions
                      </Text>
                      <Text style={styles.upgradeSubtitle}>Pro Feature</Text>
                      <Text style={styles.upgradeDescription}>
                        Get all daily AI-powered predictions with advanced filters, confidence scoring,
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
    paddingBottom: normalize(30),
  },
  headerStats: {
    paddingVertical: normalize(8),
    paddingHorizontal: normalize(16),
    position: 'relative',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: normalize(10),
    right: normalize(16),
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(20),
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  proBadgeText: {
    fontSize: normalize(11),
    fontWeight: '700',
    color: '#00E5FF',
    marginLeft: normalize(6),
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: normalize(10),
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(16),
    padding: normalize(18),
    flex: 1,
    marginHorizontal: normalize(4),
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statValue: {
    fontSize: normalize(26),
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: normalize(10),
    marginBottom: normalize(6),
    textShadowColor: 'rgba(0, 229, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statLabel: {
    fontSize: normalize(13),
    color: '#E2E8F0',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  bonusBadge: {
    position: 'absolute',
    top: normalize(-8),
    right: normalize(-8),
    backgroundColor: '#00E5FF',
    width: normalize(28),
    height: normalize(28),
    borderRadius: normalize(14),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  bonusText: {
    fontSize: normalize(14),
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: normalize(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradePrompt: {
    marginTop: normalize(16),
    borderRadius: normalize(12),
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(16),
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: normalize(14),
    fontWeight: '600',
    marginHorizontal: normalize(8),
  },
  filterSection: {
    padding: normalize(16),
  },
  filterTitle: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(16),
  },
  filterRow: {
    marginBottom: normalize(12),
  },
  filterScrollView: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(10),
    borderRadius: normalize(24),
    marginRight: normalize(8),
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterChipActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.3,
    elevation: 6,
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: normalize(14),
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
  sportChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: normalize(14),
    paddingVertical: normalize(8),
    borderRadius: normalize(20),
    marginRight: normalize(8),
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  sportChipActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.4,
    elevation: 5,
  },
  sportChipText: {
    color: '#94A3B8',
    fontSize: normalize(12),
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
    borderRadius: normalize(12),
    padding: normalize(16),
    borderWidth: 1,
    borderColor: '#334155',
  },
  lockedFiltersText: {
    color: '#64748B',
    fontSize: normalize(14),
    marginLeft: normalize(8),
  },
  proFeaturesInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: normalize(16),
    paddingTop: normalize(16),
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  proFeature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proFeatureText: {
    fontSize: normalize(12),
    color: '#E2E8F0',
    marginLeft: normalize(6),
    fontWeight: '500',
  },

  predictionsSection: {
    paddingHorizontal: normalize(16),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(16),
  },
  sectionTitle: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultCount: {
    fontSize: normalize(14),
    color: '#94A3B8',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: normalize(60),
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: normalize(12),
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: normalize(60),
  },
  emptyStateTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: normalize(16),
    marginBottom: normalize(8),
  },
  emptyStateText: {
    fontSize: normalize(14),
    color: '#94A3B8',
    textAlign: 'center',
  },
  predictionsContainer: {
    marginBottom: normalize(20),
  },
  lockedPredictions: {
    marginTop: normalize(16),
    borderRadius: normalize(16),
    overflow: 'hidden',
  },
  lockedGradient: {
    padding: normalize(24),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: normalize(16),
  },
  lockedTitle: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: normalize(12),
    marginBottom: normalize(8),
  },
  lockedSubtitle: {
    fontSize: normalize(14),
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: normalize(20),
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: normalize(20),
    paddingVertical: normalize(10),
    borderRadius: normalize(20),
  },
  unlockButtonText: {
    color: '#F59E0B',
    fontSize: normalize(14),
    fontWeight: '700',
    marginLeft: normalize(6),
  },
  
  // Common Upgrade Card Styles
  section: {
    paddingHorizontal: normalize(16),
    marginTop: normalize(16),
  },
  proUpgradeCard: {
    borderRadius: normalize(16),
    overflow: 'hidden',
  },
  upgradeCard: {
    padding: normalize(24),
  },
  upgradeContent: {
    alignItems: 'center',
  },
  upgradeIcon: {
    width: normalize(64),
    height: normalize(64),
    borderRadius: normalize(32),
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(20),
  },
  upgradeTitle: {
    fontSize: normalize(20),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(4),
  },
  upgradeSubtitle: {
    fontSize: normalize(12),
    color: '#00E5FF',
    marginBottom: normalize(16),
    fontWeight: '600',
  },
  upgradeDescription: {
    fontSize: normalize(14),
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: normalize(20),
    marginBottom: normalize(24),
  },
  upgradeButton: {
    borderRadius: normalize(25),
    overflow: 'hidden',
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: normalize(24),
    paddingVertical: normalize(12),
  },
  upgradeButtonText: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: normalize(8),
  },
  
  footer: {
    paddingHorizontal: normalize(16),
    paddingTop: normalize(20),
  },
  footerText: {
    fontSize: normalize(12),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: normalize(18),
  },
  
  // Welcome Bonus Styles
  bonusBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderRadius: normalize(12),
    padding: normalize(4),
  },
  bonusText: {
    fontSize: normalize(12),
  },
  bonusTimer: {
    marginTop: normalize(12),
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: normalize(8),
    padding: normalize(12),
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  bonusTimerText: {
    fontSize: normalize(12),
    color: '#00E5FF',
    fontWeight: '600',
    textAlign: 'center',
  },
});