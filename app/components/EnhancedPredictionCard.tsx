import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
  
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Brain,
  TrendingUp,
  Target,
  Activity,
  Zap,
  Award,
  BarChart3,
  Eye,
  X,
  Sparkles,
  Shield,
  Clock,
  CheckCircle,
  Lock,
  Crown,
  ChevronRight,
  Calculator,
  MessageCircle
} from 'lucide-react-native';
import { AIPrediction } from '../services/api/aiService';
import { useSubscription } from '../services/subscriptionContext';
import { formatEventTime } from '../utils/timeFormat';
import { useUITheme } from '../services/uiThemeContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Props {
  prediction: AIPrediction;
  index: number;
  onAnalyze?: () => void;
  welcomeBonusActive?: boolean;
}

interface AdvancedAnalysis {
  kellyStake: number;
  expectedValue: number;
  winProbability: number;
  confidenceInterval: [number, number];
  factors: {
    predictiveAnalytics: string;
    recentNews: string;
    valueAssessment: string;
  };
  toolsUsed: string[];
}

export default function EnhancedPredictionCard({ prediction, index, onAnalyze, welcomeBonusActive = false }: Props) {
  const { isPro, isElite, openSubscriptionModal } = useSubscription();
  const { theme } = useUITheme();
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [advancedAnalysis, setAdvancedAnalysis] = useState<AdvancedAnalysis | null>(null);
  const [glowAnimation] = useState(new Animated.Value(0));
  const [showFullReasoning, setShowFullReasoning] = useState(false);

  React.useEffect(() => {
    if (isPro || isElite) {
      // Animate premium glow effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnimation, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isPro, isElite]);

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence || typeof confidence !== 'number') return '#8B5CF6';
    if (confidence >= 85) return '#10B981';     // Green for high confidence
    if (confidence >= 70) return '#00E5FF';     // Cyan for medium confidence  
    return '#8B5CF6';                          // Purple for lower confidence (more appealing than gray)
  };

  const getSportIcon = (sport?: string) => {
    if (!sport) return '🏟️';
    switch (sport.toLowerCase()) {
      case 'nba': return '🏀';
      case 'nfl': return '🏈';
      case 'mlb': return '⚾';
      case 'nhl': return '🏒';
      default: return '🏟️';
    }
  };

  const formatOdds = (odds?: string) => {
    if (!odds || typeof odds !== 'string') return 'N/A';
    
    // Handle cases where odds might already be formatted
    if (odds.startsWith('+') || odds.startsWith('-')) {
      return odds;
    }
    
    // Convert to number to check if positive or negative
    const numericOdds = parseFloat(odds);
    
    // If positive, add the "+" sign
    if (numericOdds > 0) {
      return `+${odds}`;
    }
    
    // If negative, return as is (already has "-")
    return odds;
  };

  const getRiskLevel = (confidence?: number): string => {
    if (!confidence) return 'Unknown';
    if (confidence >= 75) return 'Low';
    if (confidence >= 60) return 'Medium';
    return 'High';
  };

  const calculateKellyStake = (prediction: AIPrediction): number => {
    // Kelly Criterion: f = (bp - q) / b
    // Where: f = fraction of bankroll to bet, b = odds, p = probability of win, q = probability of loss
    try {
      const odds = parseFloat(prediction.odds?.replace(/[+-]/g, '') || '100');
      const confidence = prediction.confidence || 50;
      const impliedProbability = confidence / 100;
      
      // Convert American odds to decimal
      const decimalOdds = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
      const b = decimalOdds - 1; // Net odds
      const p = impliedProbability; // Our estimated probability
      const q = 1 - p; // Probability of loss
      
      const kelly = (b * p - q) / b;
      
      // Cap Kelly at 10% and ensure non-negative
      return Math.max(0, Math.min(kelly * 100, 10));
    } catch (error) {
      return 2.5; // Default conservative stake
    }
  };

  const calculateExpectedValue = (prediction: AIPrediction): number => {
    // EV = (Probability of Win × Payout) - (Probability of Loss × Stake)
    try {
      const confidence = prediction.confidence || 50;
      const odds = parseFloat(prediction.odds?.replace(/[+-]/g, '') || '100');
      
      const winProbability = confidence / 100;
      const lossProbability = 1 - winProbability;
      
      // Convert American odds to decimal payout
      const payout = odds > 0 ? odds / 100 : 100 / Math.abs(odds);
      
      const ev = (winProbability * payout) - (lossProbability * 1);
      
      return ev * 100; // Convert to percentage
    } catch (error) {
      return prediction.value || 5; // Fallback to value_percentage or default
    }
  };

  const handleAdvancedAnalysis = async () => {
    // Free users now have access to the analysis modal as well
    setIsLoadingAnalysis(true);
    
    try {
      // Calculate analytics from prediction data
      setTimeout(() => {
        try {
          const kellyStake = calculateKellyStake(prediction);
          const expectedValue = prediction.roi_estimate || calculateExpectedValue(prediction);
          // Normalize key factors to a safe short string (avoid crashes if string vs array)
          const keyFactorsText = (() => {
            const kf: any = (prediction as any).key_factors;
            if (Array.isArray(kf)) return kf.slice(0, 2).join(', ');
            if (typeof kf === 'string') return kf.split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, 2).join(', ');
            return '';
          })();
          
          setAdvancedAnalysis({
            kellyStake: kellyStake,
            expectedValue: expectedValue,
            winProbability: prediction.confidence || 50,
            confidenceInterval: [Math.max(0, (prediction.confidence || 50) - 8), Math.min(100, (prediction.confidence || 50) + 7)],
            factors: {
              predictiveAnalytics: `Win probability: ${prediction.confidence || 50}% | Kelly stake: ${kellyStake.toFixed(1)}% | Expected value: +${expectedValue.toFixed(1)}%`,
              recentNews: `Based on ${(prediction as any).metadata?.research_insights_count || 'multiple'} data sources | Current odds: ${prediction.odds || 'N/A'}`,
              valueAssessment: `${expectedValue > 0 ? 'Positive' : 'Negative'} expected value (${expectedValue > 0 ? '+' : ''}${expectedValue.toFixed(1)}%) with ${prediction.confidence || 50}% AI confidence. Optimal stake: ${kellyStake.toFixed(1)}% of bankroll.${keyFactorsText ? ` Key factors: ${keyFactorsText}.` : ''}`
            },
            toolsUsed: ['sportsDataIO', 'webSearch', 'aiAnalysis', 'realTimeData']
          });
          setShowAnalysis(true);
          setIsLoadingAnalysis(false);
        } catch (error) {
          console.error('❌ Error calculating analysis:', error);
          setIsLoadingAnalysis(false);
        }
      }, 300);
    } catch (error) {
      console.error('❌ Error in handleAdvancedAnalysis:', error);
      setIsLoadingAnalysis(false);
    }
  };

  const glowOpacity = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <>
      <TouchableOpacity style={styles.container}>
        <LinearGradient
          colors={isPro ? ['#1E293B', '#334155'] : ['#1A1F2E', '#2D3748']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Premium Glow Effect */}
          {(isPro || isElite) && (
            <Animated.View 
              style={[
                styles.premiumGlow, 
                { 
                  opacity: glowOpacity,
                  borderColor: isElite ? theme.accentPrimary : '#00E5FF'
                }
              ]} 
            />
          )}



          {/* Header */}
          <View style={styles.header}>
            <View style={styles.matchInfo}>
              <View style={styles.sportBadge}>
                <Text style={styles.sportIcon}>{getSportIcon(prediction.sport)}</Text>
                <Text style={styles.sportText}>{prediction.sport || 'Unknown'}</Text>
              </View>
              {/* Display the matchup – fall back to `match_teams` if `match` is missing (e.g., Pro picks) */}
              <Text style={styles.matchTitle}>{prediction.match || (prediction as any).match_teams || 'Unknown Match'}</Text>
              <View style={styles.timeContainer}>
                <Clock size={12} color="#94A3B8" />
                <Text style={styles.eventTime}>{formatEventTime(prediction.eventTime || (prediction as any).event_time || (prediction as any).created_at)}</Text>
              </View>
            </View>
            
            <View style={[
              styles.confidenceBadge, 
              { 
                backgroundColor: `${getConfidenceColor(prediction.confidence)}20`,
                borderWidth: 1,
                borderColor: `${getConfidenceColor(prediction.confidence)}40`
              }
            ]}>
              <Text style={[
                styles.confidenceText, 
                { color: getConfidenceColor(prediction.confidence) }
              ]}>
                {prediction.confidence || 0}%
              </Text>
            </View>
          </View>

          {/* Prediction Details */}
          <View style={styles.predictionContent}>
            <View style={styles.pickSection}>
              <Text style={styles.pickLabel}>AI Prediction</Text>
              <Text style={[styles.pickValue, isElite && { color: theme.accentPrimary }]}>{prediction.pick || 'Loading...'}</Text>
              <Text style={styles.oddsText}>Odds: {formatOdds(prediction.odds)}</Text>
            </View>

            {prediction.value && prediction.value > 0 && (
              <View style={styles.valueSection}>
                <View style={[
                  styles.valueIndicator,
                  { backgroundColor: `${theme.accentPrimary}1A`, borderColor: `${theme.accentPrimary}33` }
                ]}>
                  <Target size={16} color={theme.accentPrimary} />
                  <Text style={[styles.valueText, { color: theme.accentPrimary }]}>+{prediction.value}% Edge</Text>
                </View>
              </View>
            )}
          </View>

          {/* Premium Features Section */}
          {(isPro || isElite || welcomeBonusActive) ? (
            <View style={[styles.premiumSection, welcomeBonusActive && !isPro && styles.bonusSection]}> 
              <View style={styles.premiumBadge}>
                <Crown size={12} color={isElite ? theme.accentPrimary : '#00E5FF'} />
                <Text style={[styles.premiumBadgeText, isElite && { color: theme.accentPrimary }]}>
                  {isPro ? "PRO INSIGHTS" : "BONUS INSIGHTS"}
                </Text>
                {welcomeBonusActive && !isPro && (
                  <Text style={styles.bonusIndicator}>🎁</Text>
                )}
              </View>
              
              <View style={styles.premiumStats}>
                <View style={styles.premiumStat}>
                  <Brain size={14} color={isElite ? theme.accentPrimary : '#00E5FF'} />
                  <Text style={styles.premiumStatText}>AI: {prediction.confidence}% Confident</Text>
                </View>
                <View style={styles.premiumStat}>
                  <Shield size={14} color="#10B981" />
                  <Text style={styles.premiumStatText}>ROI: {prediction.roi_estimate ? `+${parseFloat(prediction.roi_estimate.toString()).toFixed(1)}%` : 'Calculating...'}</Text>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.lockSection} onPress={openSubscriptionModal}>
              <Lock size={16} color="#64748B" />
              <Text style={styles.lockText}>Unlock Pro Insights</Text>
              <ChevronRight size={16} color="#64748B" />
            </TouchableOpacity>
          )}

          {/* Reasoning */}
          <View style={styles.reasoningSection}>
            <Text 
              style={styles.reasoningText} 
              numberOfLines={showFullReasoning ? undefined : ((isPro || welcomeBonusActive) ? 4 : 2)}
            >
              {(isPro || welcomeBonusActive) ? 
                (prediction.reasoning || 'AI analysis pending...') : 
                `${(prediction.reasoning || 'AI analysis pending...').substring(0, 100)}...`
              }
            </Text>
            {(isPro || isElite || welcomeBonusActive) && (prediction.reasoning?.length || 0) > 200 && (
              <TouchableOpacity 
                onPress={() => setShowFullReasoning(!showFullReasoning)}
                style={styles.showMoreButton}
              >
                <Text style={[styles.showMoreText, isElite && { color: theme.accentPrimary }]}>
                  {showFullReasoning ? 'Show Less' : 'Show More'}
                </Text>
                <ChevronRight 
                  size={14} 
                  color={isElite ? theme.accentPrimary : '#00E5FF'} 
                  style={{ transform: [{ rotate: showFullReasoning ? '-90deg' : '90deg' }] }}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[
                styles.actionButton, 
                (isPro || isElite || welcomeBonusActive) && styles.actionButtonPro,
                isElite && (isPro || welcomeBonusActive) && { borderColor: theme.accentPrimary, backgroundColor: `${theme.accentPrimary}1A` }
              ]}
              onPress={handleAdvancedAnalysis}
              disabled={isLoadingAnalysis}
            >
              {isLoadingAnalysis ? (
                <Activity size={16} color={isElite ? theme.accentPrimary : '#00E5FF'} style={{ transform: [{ rotate: '45deg' }] }} />
              ) : (
                <Eye size={16} color={isElite ? theme.accentPrimary : '#00E5FF'} />
              )}
              <Text style={styles.actionButtonText}>
                {(isPro || isElite || welcomeBonusActive) ? 'Advanced Analysis' : 'View Analysis'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.actionButton, 
                (isPro || isElite || welcomeBonusActive) && styles.actionButtonPro,
                isElite && (isPro || welcomeBonusActive) && { borderColor: theme.accentPrimary, backgroundColor: `${theme.accentPrimary}1A` }
              ]}
              onPress={onAnalyze}
            >
              <MessageCircle size={16} color={isElite ? theme.accentPrimary : '#8B5CF6'} />
              <Text style={styles.actionButtonText}>AI Chat</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Advanced Analysis Modal */}
      {showAnalysis && advancedAnalysis && (
        <Modal
          visible={showAnalysis}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAnalysis(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <LinearGradient
                colors={['#1E293B', '#0F172A']}
                style={styles.modalGradient}
              >
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Advanced AI Analysis</Text>
                    {/* Modal subtitle should also show the matchup */}
                    <Text style={styles.modalSubtitle}>{prediction.match || (prediction as any).match_teams}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowAnalysis(false)}>
                    <Text style={styles.closeButton}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.analysisContent}>
                  {/* Kelly Criterion Section */}
                  <View style={styles.analysisSection}>
                    <View style={styles.sectionHeader}>
                      <Calculator size={20} color={isElite ? theme.accentPrimary : '#00E5FF'} />
                      <Text style={styles.sectionTitle}>Kelly Criterion Analysis</Text>
                    </View>
                    <View style={[styles.kellyStats, isElite && { backgroundColor: `${theme.accentPrimary}1A` }]}>
                      <View style={styles.kellyStat}>
                        <Text style={[styles.kellyValue, isElite && { color: theme.accentPrimary }]}>{advancedAnalysis.kellyStake}%</Text>
                        <Text style={styles.kellyLabel}>Optimal Stake</Text>
                      </View>
                      <View style={styles.kellyStat}>
                        <Text style={[styles.kellyValue, isElite && { color: theme.accentPrimary }]}>+{advancedAnalysis.expectedValue}%</Text>
                        <Text style={styles.kellyLabel}>Expected Value</Text>
                      </View>
                      <View style={styles.kellyStat}>
                        <Text style={[styles.kellyValue, isElite && { color: theme.accentPrimary }]}>{advancedAnalysis.winProbability}%</Text>
                        <Text style={styles.kellyLabel}>Win Probability</Text>
                      </View>
                    </View>
                  </View>

                  {/* Multi-Tool Analysis */}
                  <View style={styles.analysisSection}>
                    <View style={styles.sectionHeader}>
                      <Calculator size={20} color="#8B5CF6" />
                      <Text style={styles.sectionTitle}>Multi-Source Intelligence</Text>
                    </View>
                    <View style={styles.toolsUsed}>
                      {advancedAnalysis.toolsUsed.map((tool, idx) => (
                        <View key={idx} style={styles.toolChip}>
                          <CheckCircle size={12} color="#10B981" />
                          <Text style={styles.toolText}>{tool}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* AI Reasoning Section */}
                  <View style={styles.analysisSection}>
                    <Text style={styles.factorTitle}>🧠 AI Reasoning</Text>
                    <Text style={styles.factorText}>{prediction.reasoning}</Text>
                  </View>

                  {/* Analysis Factors */}
                  <View style={styles.analysisSection}>
                    <Text style={styles.factorTitle}>📊 Predictive Analytics</Text>
                    <Text style={styles.factorText}>{advancedAnalysis.factors.predictiveAnalytics}</Text>
                  </View>

                  <View style={styles.analysisSection}>
                    <Text style={styles.factorTitle}>📰 Recent Intelligence</Text>
                    <Text style={styles.factorText}>{advancedAnalysis.factors.recentNews}</Text>
                  </View>

                  <View style={styles.analysisSection}>
                    <Text style={styles.factorTitle}>💰 Value Assessment</Text>
                    <Text style={styles.factorText}>{advancedAnalysis.factors.valueAssessment}</Text>
                  </View>
                </ScrollView>
              </LinearGradient>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    padding: 12,
    position: 'relative',
  },
  premiumGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00E5FF',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  matchInfo: {
    flex: 1,
    marginRight: 12,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sportIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  sportText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  matchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 4,
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '700',
  },
  predictionContent: {
    marginBottom: 12,
  },
  pickSection: {
    marginBottom: 8,
  },
  pickLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  pickValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00E5FF',
    marginBottom: 2,
  },
  oddsText: {
    fontSize: 13,
    color: '#E2E8F0',
  },
  valueSection: {
    marginTop: 8,
  },
  valueIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  valueText: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
    marginLeft: 6,
  },
  premiumSection: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  bonusSection: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  premiumBadgeText: {
    fontSize: 11,
    color: '#00E5FF',
    fontWeight: '700',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  bonusIndicator: {
    fontSize: 12,
    marginLeft: 4,
  },
  premiumStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 4,
  },
  premiumStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumStatText: {
    fontSize: 11,
    color: '#E2E8F0',
    marginLeft: 4,
  },
  lockSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  lockText: {
    fontSize: 12,
    color: '#64748B',
    marginHorizontal: 8,
  },
  reasoningText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
    marginBottom: 12,
  },
  reasoningSection: {
    marginBottom: 12,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  showMoreText: {
    fontSize: 12,
    color: '#00E5FF',
    fontWeight: '600',
    marginRight: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionButtonPro: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  actionButtonText: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '600',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: screenHeight * 0.85,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalGradient: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  closeButton: {
    fontSize: 24,
    color: '#64748B',
    padding: 8,
  },
  analysisContent: {
    flex: 1,
  },
  analysisSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  kellyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  kellyStat: {
    alignItems: 'center',
  },
  kellyValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00E5FF',
  },
  kellyLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  toolsUsed: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toolText: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 4,
  },
  factorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  factorText: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  placeButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  placeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
}); 