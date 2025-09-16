import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Zap, 
  Clock, 
  Award,
  DollarSign,
  BarChart3,
  Eye,
  CheckCircle,
  AlertTriangle,
  Flame,
  Trophy,
  Activity,
  ChevronRight
} from 'lucide-react-native';
import { formatEventTime } from '../utils/timeFormat';
import { useUITheme } from '../services/uiThemeContext';

const { width: screenWidth } = Dimensions.get('window');

interface AIPrediction {
  id: string;
  match_teams: string;
  pick: string;
  odds: string;
  confidence: number;
  value_percentage: number;
  roi_estimate: number;
  bet_type: string;
  reasoning: string;
  created_at: string;
  league?: string;
  status?: 'pending' | 'won' | 'lost' | 'push';
  actual_result?: string;
  profit_loss?: number;
  eventTime?: string;
}

interface ProAIPicksDisplayProps {
  onPickPress?: (pick: AIPrediction) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  limit?: number;
  showViewAllButton?: boolean;
  onViewAllPress?: () => void;
  isElite?: boolean;
}

const ProAIPicksDisplay: React.FC<ProAIPicksDisplayProps> = ({
  onPickPress,
  onRefresh,
  refreshing = false,
  limit,
  isElite = false,
  showViewAllButton,
  onViewAllPress
}) => {
  const { theme } = useUITheme();
  const [picks, setPicks] = useState<AIPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPicks, setExpandedPicks] = useState<Set<string>>(new Set());
  const [sparkleAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    fetchLatestPicks();
    startSparkleAnimation();
  }, []);

  const startSparkleAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const fetchLatestPicks = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      
      // Fetch both team picks and player props picks (10 each = 20 total for Pro)
      const [teamResponse, propsResponse] = await Promise.all([
        fetch(`${baseUrl}/api/ai/team-picks?test=true`),
        fetch(`${baseUrl}/api/ai/player-props-picks?test=true`)
      ]);
      
      const allPicks: AIPrediction[] = [];
      
      // Process team picks
      if (teamResponse.ok) {
        const teamData = await teamResponse.json();
        if (teamData.success && teamData.picks) {
          const transformedTeamPicks = teamData.picks.map((pick: any) => {
            console.log('🔍 Raw team pick data:', pick); // Debug log
            return {
              id: pick.id,
              match_teams: pick.match_teams || pick.match || pick.teams || 'Unknown Match',
              pick: pick.pick,
              odds: pick.odds,
              confidence: pick.confidence,
              value_percentage: pick.value_percentage || pick.value || 0,
              roi_estimate: pick.roi_estimate || 0,
              bet_type: pick.bet_type || 'moneyline',
              reasoning: pick.reasoning,
              created_at: pick.created_at,
              league: pick.sport || pick.league,
              status: pick.status,
              eventTime: pick.eventTime || pick.game_time || pick.event_time || 'TBD'
            };
          });
          allPicks.push(...transformedTeamPicks);
        }
      }
      
      // Process player props picks
      if (propsResponse.ok) {
        const propsData = await propsResponse.json();
        if (propsData.success && propsData.picks) {
          const transformedPropsPicks = propsData.picks.map((pick: any) => {
            console.log('🔍 Raw props pick data:', pick); // Debug log
            return {
              id: pick.id,
              match_teams: pick.match_teams || pick.match || pick.teams || 'Unknown Match',
              pick: pick.pick,
              odds: pick.odds,
              confidence: pick.confidence,
              value_percentage: pick.value_percentage || pick.value || 0,
              roi_estimate: pick.roi_estimate || 0,
              bet_type: pick.bet_type || 'player_prop',
              reasoning: pick.reasoning,
              created_at: pick.created_at,
              league: pick.sport || pick.league,
              status: pick.status,
              eventTime: pick.eventTime || pick.game_time || pick.event_time || 'TBD'
            };
          });
          allPicks.push(...transformedPropsPicks);
        }
      }
      
      console.log('🔍 All Pro picks (Team + Props):', allPicks); // Debug log
      setPicks(allPicks);
      
    } catch (error) {
      console.error('Error fetching Pro AI picks:', error);
      setPicks([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (pickId: string) => {
    setExpandedPicks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pickId)) {
        newSet.delete(pickId);
      } else {
        newSet.add(pickId);
      }
      return newSet;
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#10B981'; // High confidence - green
    if (confidence >= 65) return '#00E5FF'; // Medium confidence - cyan
    return '#8B5CF6'; // Lower confidence - purple (more appealing than red)
  };

  const getValueColor = (value: number) => {
    if (value >= 30) return '#10B981'; // Excellent value - green
    if (value >= 15) return '#00E5FF'; // Good value - cyan
    if (value >= 5) return '#F59E0B'; // Fair value - orange
    return '#8B5CF6'; // Lower value - purple (appealing)
  };

  const getROIColor = (roi: number) => {
    if (roi >= 50) return '#00E676';
    if (roi >= 25) return '#4CAF50';
    if (roi >= 10) return '#FFC107';
    return '#FF9800';
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const renderPickCard = (pick: AIPrediction, index: number) => {
    const isExpanded = expandedPicks.has(pick.id);
    const isTopPick = index < 3;
    
    return (
      <TouchableOpacity
        style={[
          styles.pickCard,
          isTopPick && { ...styles.topPickCard, borderColor: theme.accentPrimary },
        ]}
        onPress={() => onPickPress?.(pick)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isElite 
            ? (isTopPick ? ['#1E293B', '#334155', '#475569'] : ['#0F172A', '#1E293B', '#334155']) 
            : (isTopPick ? ['#7C3AED', '#1E40AF'] : ['#1E293B', '#0F172A'])
          }
          style={[styles.pickCardGradient, isTopPick && styles.topPickPadding]}
        >
          {/* Top Pick Badge - Moved to avoid overlap */}
          {isTopPick && (
            <View style={[styles.topPickBadge, { backgroundColor: theme.accentPrimary }]}>
              <Trophy size={12} color="#000000" />
              <Text style={[styles.topPickText, { color: '#000000' }]}>TOP {index + 1}</Text>
              <Animated.View
                style={[
                  styles.sparkle,
                  {
                    opacity: sparkleAnimation,
                    transform: [{
                      rotate: sparkleAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    }],
                  },
                ]}
              >
                <Flame size={10} color={theme.accentPrimary} />
              </Animated.View>
            </View>
          )}

          {/* Header */}
          <View style={styles.pickHeader}>
            <View style={styles.pickHeaderLeft}>
              <View style={styles.matchInfo}>
                <Text style={styles.matchTeams} numberOfLines={2}>
                  {pick.match_teams}
                </Text>
                <View style={styles.pickTypeContainer}>
                  <View style={styles.sportBadge}>
                    <Text style={styles.pickType}>{pick.bet_type}</Text>
                    {pick.league && (
                      <Text style={styles.leagueBadge}>{pick.league}</Text>
                    )}
                  </View>
                  {pick.eventTime && (
                    <View style={styles.gameTimeContainer}>
                      <Clock size={14} color="#00E5FF" />
                      <Text style={styles.gameTime}>{formatEventTime(pick.eventTime)}</Text>
                    </View>
                  )}
                  <Text style={styles.timeAgo}>{formatTimeAgo(pick.created_at)}</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.pickHeaderRight}>
              <View style={[
                styles.confidenceBadge, 
                { 
                  backgroundColor: getConfidenceColor(pick.confidence) + '20',
                  borderColor: getConfidenceColor(pick.confidence) + '40',
                  shadowColor: getConfidenceColor(pick.confidence),
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                }
              ]}>
                <Text style={[styles.confidenceText, { color: getConfidenceColor(pick.confidence) }]}>
                  {pick.confidence}%
                </Text>
              </View>
            </View>
          </View>

          {/* Main Pick Display - Make this SUPER prominent */}
          <View style={styles.mainPickSection}>
            <View style={styles.pickHighlight}>
              <Brain size={20} color="#00E5FF" />
              <Text style={styles.prominentPickText}>
                {pick.pick}
              </Text>
            </View>
            <Text style={styles.prominentOddsText}>{pick.odds}</Text>
          </View>

          {/* Pick Details */}
          <View style={styles.pickDetails}>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Target size={14} color={getValueColor(pick.value_percentage)} />
                <Text style={styles.statLabel}>Value</Text>
                <Text style={[styles.statValue, { color: getValueColor(pick.value_percentage) }]}>
                  {pick.value_percentage.toFixed(1)}%
                </Text>
              </View>

              <View style={styles.statItem}>
                <TrendingUp size={14} color={getROIColor(pick.roi_estimate)} />
                <Text style={styles.statLabel}>ROI</Text>
                <Text style={[styles.statValue, { color: getROIColor(pick.roi_estimate) }]}>
                  +{pick.roi_estimate.toFixed(1)}%
                </Text>
              </View>

              <View style={styles.statItem}>
                <Activity size={14} color="#00E5FF" />
                <Text style={styles.statLabel}>League</Text>
                <Text style={styles.statValue}>
                  {pick.league || 'MLB'}
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.expandButton}
                onPress={() => toggleExpanded(pick.id)}
              >
                <ChevronRight 
                  size={16} 
                  color="#64748B" 
                  style={[
                    styles.expandIcon,
                    isExpanded && { transform: [{ rotate: '90deg' }] }
                  ]}
                />
              </TouchableOpacity>
            </View>

            {/* Expanded Reasoning */}
            {isExpanded && (
              <View style={styles.expandedContent}>
                <View style={styles.reasoningSection}>
                  <View style={styles.reasoningHeader}>
                    <Eye size={14} color="#00E5FF" />
                    <Text style={styles.reasoningTitle}>AI Analysis</Text>
                  </View>
                  <Text style={styles.reasoningText}>
                    {pick.reasoning}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Activity size={24} color="#00E5FF" />
        <Text style={styles.loadingText}>Loading AI Picks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Brain size={24} color="#00E5FF" />
          <Text style={styles.headerTitle}>AI Predictions</Text>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          {limit ? `Top ${Math.min(limit, picks.length)} of 20` : `20 Pro Picks (Team + Props)`}
        </Text>
      </View>

      {/* Picks List */}
      <ScrollView
        style={styles.picksContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh || fetchLatestPicks}
            tintColor="#00E5FF"
            colors={['#00E5FF']}
          />
        }
      >
        {picks.length > 0 ? (
          <>
            {(limit ? picks.slice(0, limit) : picks).map((pick, index) => renderPickCard(pick, index))}
            
            {/* View All Picks Button */}
            {showViewAllButton && limit && picks.length > limit && (
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={onViewAllPress}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#7C3AED', '#1E40AF']}
                  style={styles.viewAllGradient}
                >
                  <Text style={styles.viewAllText}>View All 20 Picks</Text>
                  <ChevronRight size={16} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Brain size={48} color="#64748B" />
            <Text style={styles.emptyStateTitle}>No AI Picks Yet</Text>
            <Text style={styles.emptyStateText}>
              Run the AI orchestrator to generate new predictions
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 16,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
  liveBadge: {
    backgroundColor: '#00E676',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  liveBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 14,
  },
  picksContainer: {
    flex: 1,
    padding: 16,
  },
  pickCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  topPickCard: {
    borderWidth: 1,
    elevation: 8,
    shadowOpacity: 0.5,
  },
  pickCardGradient: {
    padding: 16,
  },
  topPickPadding: {
    paddingTop: 48, // Extra padding for top pick badge
  },
  topPickBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor will be set dynamically with theme
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  topPickText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
    marginHorizontal: 4,
  },
  sparkle: {
    marginLeft: 2,
  },
  pickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pickHeaderLeft: {
    flex: 1,
  },
  matchInfo: {
    flex: 1,
  },
  matchTeams: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 22,
  },
  pickTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickType: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: '#00E5FF20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  gameTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gameTime: {
    fontSize: 13,
    color: '#00E5FF',
    marginLeft: 4,
    fontWeight: '600',
  },
  timeAgo: {
    color: '#64748B',
    fontSize: 12,
  },
  pickHeaderRight: {
    alignItems: 'flex-end',
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mainPickSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  pickHighlight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 12,
  },
  prominentPickText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
  },
  prominentOddsText: {
    color: '#00E676',
    fontSize: 24,
    fontWeight: '800',
    textShadowColor: '#00E67650',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pickDetails: {
    gap: 12,
  },
  pickMainInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pickContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  pickText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  oddsText: {
    color: '#00E676',
    fontSize: 16,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  expandButton: {
    padding: 8,
  },
  expandIcon: {
    // React Native doesn't support CSS transitions - animations handled by Animated API
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  reasoningSection: {
    marginBottom: 16,
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reasoningTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  reasoningText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  trackButton: {
    backgroundColor: '#00E67620',
    borderWidth: 1,
    borderColor: '#00E676',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  viewAllButton: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  viewAllText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leagueBadge: {
    fontSize: 11,
    color: '#8B5CF6',
    fontWeight: '600',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
});

export default ProAIPicksDisplay; 